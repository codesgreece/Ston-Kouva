import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
  const unreadOnly = searchParams.get("unread") === "true";

  const result = await query(
    `SELECT id, type, title, body, link, is_read, created_at, actor_id
     FROM notifications
     WHERE user_id = $1
       ${unreadOnly ? "AND is_read = FALSE" : ""}
     ORDER BY created_at DESC
     LIMIT $2`,
    [session.user.id, limit],
  );

  const unread = await query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM notifications
     WHERE user_id = $1 AND is_read = FALSE`,
    [session.user.id],
  );

  return NextResponse.json({
    notifications: result.rows,
    unreadCount: Number(unread.rows[0]?.c ?? 0),
  });
}
