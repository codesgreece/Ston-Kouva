import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { globalBanUser } from "@/lib/services/moderation";

const patchSchema = z.object({
  userId: z.string().uuid(),
  banned: z.boolean(),
  reason: z.string().max(500).optional(),
});

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
  const offset = Math.max(Number(searchParams.get("offset") || 0), 0);
  const q = searchParams.get("q")?.trim();

  const values: unknown[] = [];
  let where = "WHERE 1=1";
  if (q) {
    values.push(`%${q}%`);
    where += ` AND (u.username ILIKE $${values.length} OR u.email ILIKE $${values.length})`;
  }
  values.push(limit, offset);

  const result = await query(
    `SELECT u.id, u.username, u.email, u.display_name, u.is_banned,
            u.is_admin, u.is_moderator, u.created_at, u.last_seen_at
     FROM users u
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  return NextResponse.json({ users: result.rows });
}

export async function PATCH(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  }

  if (parsed.data.userId === session.user.id) {
    return NextResponse.json({ error: "Δεν μπορείς να αλλάξεις τον δικό σου λογαριασμό" }, { status: 400 });
  }

  if (parsed.data.banned) {
    await globalBanUser({
      userId: parsed.data.userId,
      actorId: session.user.id,
      reason: parsed.data.reason,
    });
    return NextResponse.json({ ok: true, banned: true });
  }

  await query(
    `UPDATE users SET is_banned = FALSE, updated_at = NOW() WHERE id = $1`,
    [parsed.data.userId],
  );
  await query(
    `INSERT INTO moderation_actions (actor_id, target_type, target_id, action, reason)
     VALUES ($1, 'user', $2, 'unban', $3)`,
    [session.user.id, parsed.data.userId, parsed.data.reason ?? null],
  );

  return NextResponse.json({ ok: true, banned: false });
}
