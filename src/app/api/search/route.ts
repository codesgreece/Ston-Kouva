import { NextResponse } from "next/server";
import { cacheGetOrSet } from "@/lib/cache/memory";
import { query } from "@/lib/db";

const LIMIT = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (q.length < 2) {
    return NextResponse.json({
      users: [],
      teams: [],
      matches: [],
      posts: [],
    });
  }

  const pattern = `%${q}%`;
  const cacheKey = `search:${q.toLowerCase()}`;

  const results = await cacheGetOrSet(cacheKey, 15_000, async () => {
    const [users, teams, matches, posts] = await Promise.all([
      query(
        `SELECT id, username, display_name, avatar_url
         FROM users
         WHERE is_banned = FALSE
           AND (username ILIKE $1 OR display_name ILIKE $1)
         ORDER BY username
         LIMIT $2`,
        [pattern, LIMIT],
      ),
      query(
        `SELECT id, name, name_el, short_name, flag_emoji
         FROM teams
         WHERE name ILIKE $1 OR name_el ILIKE $1 OR short_name ILIKE $1
         ORDER BY name
         LIMIT $2`,
        [pattern, LIMIT],
      ),
      query(
        `SELECT m.id, m.status, m.home_score, m.away_score, m.start_time,
                ht.name AS home_name, ht.name_el AS home_name_el, ht.flag_emoji AS home_flag,
                at.name AS away_name, at.name_el AS away_name_el, at.flag_emoji AS away_flag
         FROM matches m
         JOIN teams ht ON ht.id = m.home_team_id
         JOIN teams at ON at.id = m.away_team_id
         WHERE ht.name ILIKE $1 OR ht.name_el ILIKE $1
            OR at.name ILIKE $1 OR at.name_el ILIKE $1
         ORDER BY m.start_time DESC NULLS LAST
         LIMIT $2`,
        [pattern, LIMIT],
      ),
      query(
        `SELECT p.id, p.content, p.created_at, u.username, u.display_name
         FROM posts p
         JOIN users u ON u.id = p.user_id
         WHERE p.deleted_at IS NULL AND p.content ILIKE $1
         ORDER BY p.created_at DESC
         LIMIT $2`,
        [pattern, LIMIT],
      ),
    ]);

    return {
      users: users.rows,
      teams: teams.rows,
      matches: matches.rows,
      posts: posts.rows,
    };
  });

  return NextResponse.json(results);
}
