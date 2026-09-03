import { query } from "@/lib/db";
import type { MatchSummary } from "@/types";

type MatchRow = {
  id: string;
  status: MatchSummary["status"];
  minute: number | null;
  home_score: number;
  away_score: number;
  start_time: Date | null;
  last_synced_at: Date | null;
  home_id: string;
  home_name: string;
  home_name_el: string | null;
  home_flag: string | null;
  home_short: string | null;
  away_id: string;
  away_name: string;
  away_name_el: string | null;
  away_flag: string | null;
  away_short: string | null;
  room_id: string | null;
  room_active: number | null;
  room_members: number | null;
};

function mapMatch(row: MatchRow): MatchSummary {
  return {
    id: row.id,
    status: row.status,
    minute: row.minute,
    homeScore: row.home_score,
    awayScore: row.away_score,
    startTime: row.start_time ? row.start_time.toISOString() : null,
    lastSyncedAt: row.last_synced_at ? row.last_synced_at.toISOString() : null,
    homeTeam: {
      id: row.home_id,
      name: row.home_name,
      nameEl: row.home_name_el,
      flagEmoji: row.home_flag,
      shortName: row.home_short,
    },
    awayTeam: {
      id: row.away_id,
      name: row.away_name,
      nameEl: row.away_name_el,
      flagEmoji: row.away_flag,
      shortName: row.away_short,
    },
    room: row.room_id
      ? {
          id: row.room_id,
          activeCount: row.room_active ?? 0,
          memberCount: row.room_members ?? 0,
        }
      : null,
  };
}

const MATCH_SELECT = `
  SELECT
    m.id,
    m.status,
    m.minute,
    m.home_score,
    m.away_score,
    m.start_time,
    m.last_synced_at,
    ht.id AS home_id,
    ht.name AS home_name,
    ht.name_el AS home_name_el,
    ht.flag_emoji AS home_flag,
    ht.short_name AS home_short,
    at.id AS away_id,
    at.name AS away_name,
    at.name_el AS away_name_el,
    at.flag_emoji AS away_flag,
    at.short_name AS away_short,
    r.id AS room_id,
    r.active_count AS room_active,
    r.member_count AS room_members
  FROM matches m
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams at ON at.id = m.away_team_id
  LEFT JOIN match_rooms r ON r.match_id = m.id
`;

export async function listMatches(params?: {
  status?: string;
  limit?: number;
}): Promise<MatchSummary[]> {
  const limit = Math.min(params?.limit ?? 20, 50);
  const values: unknown[] = [];
  let where = "";

  if (params?.status) {
    values.push(params.status);
    where = `WHERE m.status = $${values.length}`;
  }

  values.push(limit);
  const result = await query<MatchRow>(
    `${MATCH_SELECT}
     ${where}
     ORDER BY
       CASE m.status WHEN 'live' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
       m.start_time DESC NULLS LAST
     LIMIT $${values.length}`,
    values,
  );

  return result.rows.map(mapMatch);
}

export async function getMatchById(id: string): Promise<MatchSummary | null> {
  const result = await query<MatchRow>(
    `${MATCH_SELECT} WHERE m.id = $1 LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  return row ? mapMatch(row) : null;
}

export async function ensureMatchRoom(matchId: string): Promise<string> {
  const existing = await query<{ id: string }>(
    `SELECT id FROM match_rooms WHERE match_id = $1`,
    [matchId],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const inserted = await query<{ id: string }>(
    `INSERT INTO match_rooms (match_id)
     VALUES ($1)
     ON CONFLICT (match_id) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [matchId],
  );
  return inserted.rows[0].id;
}
