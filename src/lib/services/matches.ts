import { query } from "@/lib/db";
import { LIVE_STALE_SECONDS, secondsSince } from "@/lib/sports/date-utils";
import type { MatchSummary } from "@/types";

type MatchRow = {
  id: string;
  slug: string | null;
  status: MatchSummary["status"];
  minute: number | null;
  injury_time: number | null;
  home_score: number;
  away_score: number;
  start_time: Date | null;
  last_synced_at: Date | null;
  is_live: boolean;
  competition_name: string | null;
  category_name: string | null;
  home_id: string;
  home_name: string;
  home_name_el: string | null;
  home_flag: string | null;
  home_short: string | null;
  home_logo: string | null;
  away_id: string;
  away_name: string;
  away_name_el: string | null;
  away_flag: string | null;
  away_short: string | null;
  away_logo: string | null;
  room_id: string | null;
  room_active: number | null;
  room_members: number | null;
  activity_score: string | null;
};

function mapMatch(row: MatchRow): MatchSummary {
  const lastSyncedAt = row.last_synced_at ? row.last_synced_at.toISOString() : null;
  const staleSec = secondsSince(lastSyncedAt);
  const isStale =
    row.is_live &&
    staleSec != null &&
    staleSec > LIVE_STALE_SECONDS;

  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    minute: row.minute,
    injuryTime: row.injury_time,
    homeScore: row.home_score,
    awayScore: row.away_score,
    startTime: row.start_time ? row.start_time.toISOString() : null,
    lastSyncedAt,
    competitionName: row.competition_name,
    categoryName: row.category_name,
    isLive: row.is_live,
    isStale,
    homeTeam: {
      id: row.home_id,
      name: row.home_name,
      nameEl: row.home_name_el,
      flagEmoji: row.home_flag,
      shortName: row.home_short,
      logoUrl: row.home_logo,
    },
    awayTeam: {
      id: row.away_id,
      name: row.away_name,
      nameEl: row.away_name_el,
      flagEmoji: row.away_flag,
      shortName: row.away_short,
      logoUrl: row.away_logo,
    },
    room: row.room_id
      ? {
          id: row.room_id,
          activeCount: row.room_active ?? 0,
          memberCount: row.room_members ?? 0,
        }
      : null,
    activityScore: row.activity_score ? Number(row.activity_score) : 0,
  };
}

const MATCH_SELECT = `
  SELECT
    m.id,
    m.slug,
    m.status,
    m.minute,
    m.injury_time,
    m.home_score,
    m.away_score,
    m.start_time,
    m.last_synced_at,
    m.is_live,
    m.category_name,
    c.name AS competition_name,
    ht.id AS home_id,
    ht.name AS home_name,
    ht.name_el AS home_name_el,
    ht.flag_emoji AS home_flag,
    ht.short_name AS home_short,
    ht.logo_url AS home_logo,
    at.id AS away_id,
    at.name AS away_name,
    at.name_el AS away_name_el,
    at.flag_emoji AS away_flag,
    at.short_name AS away_short,
    at.logo_url AS away_logo,
    r.id AS room_id,
    r.active_count AS room_active,
    r.member_count AS room_members,
    (
      COALESCE((SELECT COUNT(*) FROM posts p WHERE p.match_id = m.id), 0) * 3 +
      COALESCE((SELECT COUNT(*) FROM post_reactions pr JOIN posts p2 ON p2.id = pr.post_id WHERE p2.match_id = m.id), 0) +
      COALESCE(r.message_count, 0) * 2 +
      COALESCE(r.member_count, 0)
    )::text AS activity_score
  FROM matches m
  JOIN teams ht ON ht.id = m.home_team_id
  JOIN teams at ON at.id = m.away_team_id
  LEFT JOIN competitions c ON c.id = m.competition_id
  LEFT JOIN match_rooms r ON r.match_id = m.id
`;

export async function listMatches(params?: {
  status?: string;
  live?: boolean;
  upcoming?: boolean;
  excludeSeed?: boolean;
  limit?: number;
  orderBy?: "start" | "activity";
}): Promise<MatchSummary[]> {
  const limit = Math.min(params?.limit ?? 20, 50);
  const values: unknown[] = [];
  const conditions: string[] = [];

  if (params?.excludeSeed !== false) {
    conditions.push(`m.external_source IN ('sofascore', 'openligadb')`);
  }

  if (params?.live) {
    conditions.push(`m.is_live = TRUE`);
  } else if (params?.upcoming) {
    conditions.push(`m.is_upcoming = TRUE`);
  } else if (params?.status) {
    values.push(params.status);
    conditions.push(`m.status = $${values.length}`);
  }

  values.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const orderBy =
    params?.orderBy === "activity"
      ? `activity_score DESC, m.start_time ASC NULLS LAST`
      : `CASE m.status WHEN 'live' THEN 0 WHEN 'halftime' THEN 1 WHEN 'upcoming' THEN 2 ELSE 3 END,
         m.start_time ASC NULLS LAST`;

  const result = await query<MatchRow>(
    `${MATCH_SELECT}
     ${where}
     ORDER BY ${orderBy}
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

export async function listTrendingMatches(limit = 5): Promise<MatchSummary[]> {
  return listMatches({ limit, orderBy: "activity", excludeSeed: true });
}
