import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { ensureMatchRoom, getMatchById } from "@/lib/services/matches";
import { query } from "@/lib/db";
import { clientIpFromHeaders, rateLimit } from "@/lib/auth";

const messageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  replyToMessageId: z.string().uuid().optional(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const match = await getMatchById(id);
  if (!match) {
    return NextResponse.json({ error: "Ο αγώνας δεν βρέθηκε" }, { status: 404 });
  }

  const roomId = await ensureMatchRoom(id);
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);

  const result = await query(
    `SELECT m.id, m.content, m.message_type, m.created_at, m.deleted_at,
            m.reply_to_message_id,
            u.id AS user_id, u.username, u.display_name, u.avatar_url
     FROM messages m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.room_id = $1
     ORDER BY m.created_at DESC
     LIMIT $2`,
    [roomId, limit],
  );

  return NextResponse.json({
    messages: result.rows.reverse(),
    roomId,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου για να γράψεις" }, { status: 401 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit({
    key: `msg:${session.user.id}:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: "Πολύ γρήγορα — περίμενε λίγο" }, { status: 429 });
  }

  const { id } = await context.params;
  const match = await getMatchById(id);
  if (!match) {
    return NextResponse.json({ error: "Ο αγώνας δεν βρέθηκε" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρο μήνυμα" }, { status: 400 });
  }

  const roomId = await ensureMatchRoom(id);

  // Ensure membership
  await query(
    `INSERT INTO match_room_members (room_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen_at = NOW()`,
    [roomId, session.user.id],
  );

  // Check mute/ban
  const member = await query<{
    is_muted: boolean;
    muted_until: Date | null;
    is_banned: boolean;
    banned_until: Date | null;
  }>(
    `SELECT is_muted, muted_until, is_banned, banned_until
     FROM match_room_members WHERE room_id = $1 AND user_id = $2`,
    [roomId, session.user.id],
  );
  const m = member.rows[0];
  if (m?.is_banned && (!m.banned_until || m.banned_until > new Date())) {
    return NextResponse.json({ error: "Έχεις ban από αυτόν τον Κουβά" }, { status: 403 });
  }
  if (m?.is_muted && (!m.muted_until || m.muted_until > new Date())) {
    return NextResponse.json({ error: "Είσαι σε mute προσωρινά" }, { status: 403 });
  }

  const inserted = await query(
    `INSERT INTO messages (room_id, user_id, content, reply_to_message_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, content, created_at, message_type, deleted_at`,
    [
      roomId,
      session.user.id,
      parsed.data.content,
      parsed.data.replyToMessageId ?? null,
    ],
  );

  await query(
    `UPDATE match_rooms SET
       message_count = message_count + 1,
       member_count = (SELECT COUNT(*) FROM match_room_members WHERE room_id = $1),
       updated_at = NOW()
     WHERE id = $1`,
    [roomId],
  );

  const row = inserted.rows[0];
  return NextResponse.json(
    {
      message: {
        ...row,
        username: session.user.username,
        display_name: session.user.displayName,
        deleted_at: null,
      },
      roomId,
    },
    { status: 201 },
  );
}
