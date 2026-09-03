import Link from "next/link";
import { LiveBadge } from "@/components/ui/Badges";
import { getCurrentSession } from "@/lib/auth";
import { ensureMatchRoom, getMatchById } from "@/lib/services/matches";
import { query } from "@/lib/db";
import { notFound } from "next/navigation";
import { RoomComposer } from "@/components/chat/RoomComposer";

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
  }

  const roomMeta = await query<{ member_count: number; active_count: number }>(
    `SELECT member_count, active_count FROM match_rooms WHERE id = $1`,
    [roomId],
  );
  const members = roomMeta.rows[0]?.member_count ?? 0;

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

  const home = match.homeTeam.nameEl || match.homeTeam.name;
  const away = match.awayTeam.nameEl || match.awayTeam.name;

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] flex-col md:h-[calc(100dvh-6rem)]">
      <header className="shrink-0 rounded-2xl border border-border bg-surface p-3">
        <div className="flex items-center justify-between gap-2">
          <Link href={`/match/${id}`} className="text-xs text-muted hover:text-brand-2">
            ← Match
          </Link>
          {match.status === "live" ? <LiveBadge /> : (
            <span className="text-xs uppercase text-muted">{match.status}</span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {match.homeTeam.flagEmoji} {home} — {away} {match.awayTeam.flagEmoji}
            </p>
            <p className="text-xs text-muted">
              {match.homeScore} - {match.awayScore}
              {match.minute != null ? ` · ${match.minute}'` : ""}
            </p>
          </div>
          <p className="shrink-0 text-xs text-muted">
            👥 {members} στον Κουβά
          </p>
        </div>
      </header>

      <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border bg-[#0c0c0c] p-3">
        {messages.rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Ο Κουβάς είναι άδειος.</p>
        ) : (
          messages.rows.map((msg) => {
            if (msg.deleted_at) {
              return (
                <div key={msg.id} className="text-xs italic text-muted">
                  Το μήνυμα διαγράφηκε.
                </div>
              );
            }
            if (msg.message_type !== "user") {
              return (
                <div
                  key={msg.id}
                  className="mx-auto max-w-[90%] rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-center text-sm font-medium text-brand-2 animate-fade-up"
                >
                  {msg.content}
                </div>
              );
            }
            return (
              <div key={msg.id} className="animate-fade-up flex gap-2">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-brand">
                  {(msg.display_name || msg.username || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-brand-2">
                      @{msg.username}
                    </span>
                    <span className="text-[10px] text-muted">
                      {new Date(msg.created_at).toLocaleTimeString("el-GR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-[15px] leading-snug">{msg.content}</p>
                  <div className="mt-1 flex gap-2 text-[11px] text-muted">
                    <span>❤️</span>
                    <span>😂</span>
                    <span>🪣</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 shrink-0">
        <RoomComposer matchId={id} loggedIn={Boolean(session)} />
      </div>
    </div>
  );
}
