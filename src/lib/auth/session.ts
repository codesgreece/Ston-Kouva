import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import type { DbUser, PublicUser } from "@/types";
import {
  generateCsrfToken,
  generateSessionToken,
  getSessionCookieName,
  getSessionTtlDays,
  hashToken,
} from "./crypto";

function mapUser(row: DbUser): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    isVerified: row.is_verified,
    isAdmin: row.is_admin,
    isModerator: row.is_moderator,
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at ? row.last_seen_at.toISOString() : null,
  };
}

export function toPublicUser(row: DbUser): PublicUser {
  return mapUser(row);
}

export async function createSession(params: {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}): Promise<{ token: string; csrfToken: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const csrfToken = generateCsrfToken();
  const tokenHash = hashToken(token);
  const ttlDays = getSessionTtlDays();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await query(
    `INSERT INTO sessions (user_id, token_hash, csrf_token, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.userId,
      tokenHash,
      csrfToken,
      params.userAgent ?? null,
      params.ipAddress ?? null,
      expiresAt.toISOString(),
    ],
  );

  return { token, csrfToken, expiresAt };
}

export function attachSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
): void {
  const isProd = process.env.NODE_ENV === "production";
  response.cookies.set({
    name: getSessionCookieName(),
    value: token,
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: getSessionCookieName(),
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function revokeSessionByToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await query(
    `UPDATE sessions
     SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash],
  );
}

export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await query(
    `UPDATE sessions
     SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL
     RETURNING id`,
    [userId],
  );
  return result.rowCount ?? 0;
}

type SessionUserRow = DbUser & {
  session_id: string;
  csrf_token: string;
  expires_at: Date;
  revoked_at: Date | null;
};

export async function getSessionFromToken(
  token: string | undefined | null,
): Promise<{ user: PublicUser; sessionId: string; csrfToken: string } | null> {
  if (!token) return null;

  try {
    const tokenHash = hashToken(token);
    const result = await query<SessionUserRow>(
      `SELECT
         u.*,
         s.id AS session_id,
         s.csrf_token,
         s.expires_at,
         s.revoked_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
       LIMIT 1`,
      [tokenHash],
    );

    const row = result.rows[0];
    if (!row) return null;
    if (row.revoked_at) return null;
    if (row.expires_at.getTime() < Date.now()) return null;
    if (row.is_banned) return null;

    // Touch session + last_seen (best-effort)
    await query(
      `UPDATE sessions SET last_used_at = NOW() WHERE id = $1`,
      [row.session_id],
    ).catch(() => undefined);
    await query(`UPDATE users SET last_seen_at = NOW() WHERE id = $1`, [
      row.id,
    ]).catch(() => undefined);

    return {
      user: mapUser(row),
      sessionId: row.session_id,
      csrfToken: row.csrf_token,
    };
  } catch {
    return null;
  }
}

export async function getCurrentSession(): Promise<{
  user: PublicUser;
  sessionId: string;
  csrfToken: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  return getSessionFromToken(token);
}

export async function requireUser(): Promise<PublicUser> {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session.user;
}

export async function registerUser(input: {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<PublicUser> {
  return withTransaction(async (client) => {
    const inserted = await client.query<DbUser>(
      `INSERT INTO users (username, email, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        input.username.toLowerCase(),
        input.email.toLowerCase(),
        input.passwordHash,
        input.displayName,
      ],
    );

    const user = inserted.rows[0];
    if (!user) throw new Error("Failed to create user");

    await client.query(
      `INSERT INTO profiles (user_id) VALUES ($1)`,
      [user.id],
    );
    await client.query(
      `INSERT INTO user_settings (user_id) VALUES ($1)`,
      [user.id],
    );

    return mapUser(user);
  });
}

export async function findUserByLogin(login: string): Promise<DbUser | null> {
  const normalized = login.trim().toLowerCase();
  const result = await query<DbUser>(
    `SELECT * FROM users
     WHERE LOWER(username) = $1 OR LOWER(email) = $1
     LIMIT 1`,
    [normalized],
  );
  return result.rows[0] ?? null;
}
