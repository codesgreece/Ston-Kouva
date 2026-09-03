import { query } from "@/lib/db";

const REPORT_CATEGORIES = [
  "spam",
  "harassment",
  "abuse",
  "hate_speech",
  "illegal",
  "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export function isValidReportCategory(v: string): v is ReportCategory {
  return (REPORT_CATEGORIES as readonly string[]).includes(v);
}

export async function createReport(input: {
  reporterId: string;
  targetType: "user" | "post" | "comment" | "message";
  targetId: string;
  category: ReportCategory;
  reason?: string;
}) {
  const result = await query(
    `INSERT INTO reports (reporter_id, target_type, target_id, category, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at, status`,
    [
      input.reporterId,
      input.targetType,
      input.targetId,
      input.category,
      input.reason ?? null,
    ],
  );
  return result.rows[0];
}

export async function muteUserInRoom(input: {
  roomId: string;
  userId: string;
  mutedBy: string;
  minutes: number;
  reason?: string;
}) {
  const until = new Date(Date.now() + input.minutes * 60_000);
  await query(
    `UPDATE match_room_members
     SET is_muted = TRUE, muted_until = $3
     WHERE room_id = $1 AND user_id = $2`,
    [input.roomId, input.userId, until.toISOString()],
  );
  await query(
    `INSERT INTO message_mutes (room_id, user_id, muted_by, reason, muted_until)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.roomId, input.userId, input.mutedBy, input.reason ?? null, until.toISOString()],
  );
  await query(
    `INSERT INTO moderation_actions (actor_id, target_type, target_id, action, reason, metadata)
     VALUES ($1, 'user', $2, 'mute', $3, $4::jsonb)`,
    [
      input.mutedBy,
      input.userId,
      input.reason ?? null,
      JSON.stringify({ roomId: input.roomId, minutes: input.minutes }),
    ],
  );
  return { mutedUntil: until.toISOString() };
}

export async function banUserInRoom(input: {
  roomId: string;
  userId: string;
  bannedBy: string;
  permanent?: boolean;
  hours?: number;
  reason?: string;
}) {
  const until =
    input.permanent || !input.hours
      ? null
      : new Date(Date.now() + input.hours * 3600_000);
  await query(
    `UPDATE match_room_members
     SET is_banned = TRUE, banned_until = $3
     WHERE room_id = $1 AND user_id = $2`,
    [input.roomId, input.userId, until?.toISOString() ?? null],
  );
  await query(
    `INSERT INTO message_bans (room_id, user_id, banned_by, reason, is_permanent, banned_until)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.roomId,
      input.userId,
      input.bannedBy,
      input.reason ?? null,
      Boolean(input.permanent),
      until?.toISOString() ?? null,
    ],
  );
  await query(
    `INSERT INTO moderation_actions (actor_id, target_type, target_id, action, reason, metadata)
     VALUES ($1, 'user', $2, 'ban', $3, $4::jsonb)`,
    [
      input.bannedBy,
      input.userId,
      input.reason ?? null,
      JSON.stringify({ roomId: input.roomId, permanent: Boolean(input.permanent) }),
    ],
  );
  return { bannedUntil: until?.toISOString() ?? null, permanent: Boolean(input.permanent) };
}

export async function globalBanUser(input: {
  userId: string;
  actorId: string;
  reason?: string;
}) {
  await query(`UPDATE users SET is_banned = TRUE, updated_at = NOW() WHERE id = $1`, [
    input.userId,
  ]);
  await query(
    `INSERT INTO moderation_actions (actor_id, target_type, target_id, action, reason)
     VALUES ($1, 'user', $2, 'ban', $3)`,
    [input.actorId, input.userId, input.reason ?? "global ban"],
  );
}

export async function softDeleteMessage(
  messageId: string,
  actorId: string,
) {
  await query(
    `UPDATE messages SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NULL`,
    [messageId, actorId],
  );
  await query(
    `INSERT INTO moderation_actions (actor_id, target_type, target_id, action)
     VALUES ($1, 'message', $2, 'delete')`,
    [actorId, messageId],
  );
}

export async function listPendingReports(limit = 50) {
  const result = await query(
    `SELECT r.*, u.username AS reporter_username
     FROM reports r
     JOIN users u ON u.id = r.reporter_id
     WHERE r.status = 'pending'
     ORDER BY r.created_at ASC
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function resolveReport(
  reportId: string,
  actorId: string,
  status: "resolved" | "dismissed",
) {
  await query(`UPDATE reports SET status = $2 WHERE id = $1`, [reportId, status]);
  await query(
    `INSERT INTO moderation_actions (actor_id, target_type, target_id, action, metadata)
     VALUES ($1, 'report', $2, $3, '{}'::jsonb)`,
    [actorId, reportId, status === "resolved" ? "resolve" : "dismiss"],
  );
}

export async function blockUser(blockerId: string, blockedUsername: string) {
  const target = await query<{ id: string }>(
    `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
    [blockedUsername],
  );
  if (!target.rows[0]) throw new Error("NOT_FOUND");
  await query(
    `INSERT INTO user_blocks (blocker_id, blocked_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [blockerId, target.rows[0].id],
  );
  return { blocked: true };
}
