import { NextResponse } from "next/server";
import {
  attachSessionCookie,
  clientIpFromHeaders,
  createSession,
  hashPassword,
  rateLimit,
  registerUser,
} from "@/lib/auth";
import { registerSchema } from "@/lib/validation/auth";
import { query } from "@/lib/db";

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit({
    key: `register:${ip}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Πολλές προσπάθειες. Δοκίμασε σε λίγο." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Μη έγκυρα δεδομένα",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { username, email, password, displayName } = parsed.data;
  const normalizedUsername = username.toLowerCase();
  const normalizedEmail = email.toLowerCase();

  const existing = await query(
    `SELECT id FROM users
     WHERE LOWER(username) = $1 OR LOWER(email) = $2
     LIMIT 1`,
    [normalizedUsername, normalizedEmail],
  );

  if (existing.rows[0]) {
    return NextResponse.json(
      { error: "Το username ή το email χρησιμοποιείται ήδη" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await registerUser({
    username: normalizedUsername,
    email: normalizedEmail,
    passwordHash,
    displayName: displayName?.trim() || normalizedUsername,
  });

  const session = await createSession({
    userId: user.id,
    userAgent: request.headers.get("user-agent"),
    ipAddress: ip === "unknown" ? null : ip,
  });

  const response = NextResponse.json(
    { user, csrfToken: session.csrfToken },
    { status: 201 },
  );
  attachSessionCookie(response, session.token, session.expiresAt);
  return response;
}
