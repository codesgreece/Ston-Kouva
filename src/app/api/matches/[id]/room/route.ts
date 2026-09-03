import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { ensureMatchRoom, getMatchById } from "@/lib/services/matches";
import { query } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const match = await getMatchById(id);
  if (!match) {
    return NextResponse.json({ error: "Ο αγώνας δεν βρέθηκε" }, { status: 404 });
  }

  const roomId = await ensureMatchRoom(id);
  const room = await query(
    `SELECT id, match_id, status, member_count, active_count, message_count, created_at
     FROM match_rooms WHERE id = $1`,
    [roomId],
  );

  return NextResponse.json({ room: room.rows[0], match });
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου για να μπεις στον Κουβά" }, { status: 401 });
  }

  const { id } = await context.params;
  const match = await getMatchById(id);
  if (!match) {
    return NextResponse.json({ error: "Ο αγώνας δεν βρέθηκε" }, { status: 404 });
  }

  const roomId = await ensureMatchRoom(id);

  await query(
    `INSERT INTO match_room_members (room_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen_at = NOW()`,
    [roomId, session.user.id],
  );

  await query(
    `UPDATE match_rooms SET
       member_count = (SELECT COUNT(*) FROM match_room_members WHERE room_id = $1),
       updated_at = NOW()
     WHERE id = $1`,
    [roomId],
  );

  return NextResponse.json({ ok: true, roomId, redirect: `/match/${id}/room` });
}
