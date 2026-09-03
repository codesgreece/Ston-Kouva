import { getCurrentSession } from "@/lib/auth";
import { ensureMatchRoom, getMatchById } from "@/lib/services/matches";
import { query } from "@/lib/db";
import { notFound } from "next/navigation";
import { MatchRoomClient } from "@/components/chat/MatchRoomClient";

type MessageRow = {
  id: string;
  content: string;
  message_type: string;
  created_at: Date;
  username: string | null;
  display_name: string | null;
  deleted_at: Date | null;
};

export default async function MatchRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchById(id);
  if (!match) notFound();

  const session = await getCurrentSession();
  const roomId = await ensureMatchRoom(id);

  if (session) {
    await query(
      `INSERT INTO match_room_members (room_id, user_id, is_online, last_seen_at)
       VALUES ($1, $2, TRUE, NOW())
       ON CONFLICT (room_id, user_id) DO UPDATE SET last_seen_at = NOW(), is_online = TRUE`,
      [roomId, session.user.id],
    );
    await query(
      `UPDATE match_rooms SET
         member_count = (SELECT COUNT(*) FROM match_room_members WHERE room_id = $1),
         active_count = (SELECT COUNT(*) FROM match_room_members WHERE room_id = $1 AND is_online = TRUE AND last_seen_at > NOW() - INTERVAL '5 minutes'),
         updated_at = NOW()
       WHERE id = $1`,
      [roomId],
    );
  }

  const roomMeta = await query<{ member_count: number; active_count: number }>(
    `SELECT member_count, active_count FROM match_rooms WHERE id = $1`,
    [roomId],
  );

  const messages = await query<MessageRow>(
    `SELECT m.id, m.content, m.message_type, m.created_at, m.deleted_at,
            u.username, u.display_name
     FROM messages m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.room_id = $1
     ORDER BY m.created_at ASC
     LIMIT 100`,
    [roomId],
  );

  return (
    <MatchRoomClient
      matchId={id}
      roomId={roomId}
      userId={session?.user.id}
      loggedIn={Boolean(session)}
      initialMembers={roomMeta.rows[0]?.active_count || roomMeta.rows[0]?.member_count || 0}
      header={{
        homeFlag: match.homeTeam.flagEmoji,
        awayFlag: match.awayTeam.flagEmoji,
        home: match.homeTeam.nameEl || match.homeTeam.name,
        away: match.awayTeam.nameEl || match.awayTeam.name,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        minute: match.minute,
        status: match.status,
      }}
      initialMessages={messages.rows.map((m) => ({
        id: m.id,
        content: m.content,
        message_type: m.message_type,
        created_at: m.created_at.toISOString(),
        deleted_at: m.deleted_at ? m.deleted_at.toISOString() : null,
        username: m.username,
        display_name: m.display_name,
      }))}
    />
  );
}
