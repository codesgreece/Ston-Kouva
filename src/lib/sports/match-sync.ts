import { query, withTransaction } from "@/lib/db";
import { formatEventForChat } from "./match-events";
import { sofaScoreAdapter } from "./sofascore-client";
import { POLL_INTERVALS_MS, type MatchEventModel, type MatchModel } from "./types";
import type { PoolClient } from "pg";

export { POLL_INTERVALS_MS };

async function upsertSport(client: PoolClient, slug: string) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO sports (slug, name, name_el, icon, sort_order)
     VALUES ($1, $2, $3, '⚽', 1)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [slug, slug.charAt(0).toUpperCase() + slug.slice(1), slug === "football" ? "Ποδόσφαιρο" : null],
  );
  return result.rows[0].id;
}

async function upsertTeam(
  client: PoolClient,
  sportId: string,
  team: MatchModel["homeTeam"],
) {
  const result = await client.query<{ id: string }>(
    `INSERT INTO teams (
       sport_id, external_id, external_source, name, name_el, short_name,
       country_code, flag_emoji, logo_url, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (external_source, external_id) DO UPDATE SET
       name = EXCLUDED.name,
       short_name = COALESCE(EXCLUDED.short_name, teams.short_name),
       country_code = COALESCE(EXCLUDED.country_code, teams.country_code),
       flag_emoji = COALESCE(EXCLUDED.flag_emoji, teams.flag_emoji),
       updated_at = NOW()
     RETURNING id`,
    [
      sportId,
      team.externalId,
      team.externalSource,
      team.name,
      team.nameEl,
      team.shortName,
      team.countryCode,
      team.flagEmoji,
      team.logoUrl,
    ],
  );
  return result.rows[0].id;
}

async function upsertMatch(client: PoolClient, match: MatchModel, sportId: string) {
  let competitionId: string | null = null;
  if (match.competitionExternalId) {
    const comp = await client.query<{ id: string }>(
      `INSERT INTO competitions (sport_id, external_id, external_source, name)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (external_source, external_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [
        sportId,
        match.competitionExternalId,
        match.externalSource,
        `Competition ${match.competitionExternalId}`,
      ],
    );
    competitionId = comp.rows[0].id;
  }

  const homeId = await upsertTeam(client, sportId, match.homeTeam);
  const awayId = await upsertTeam(client, sportId, match.awayTeam);

  const result = await client.query<{ id: string }>(
    `INSERT INTO matches (
       sport_id, competition_id, external_id, external_source,
       home_team_id, away_team_id, status, start_time, minute,
       home_score, away_score, period, venue, last_synced_at, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW()
     )
     ON CONFLICT (external_source, external_id) DO UPDATE SET
       status = EXCLUDED.status,
       minute = EXCLUDED.minute,
       home_score = EXCLUDED.home_score,
       away_score = EXCLUDED.away_score,
       period = EXCLUDED.period,
       venue = COALESCE(EXCLUDED.venue, matches.venue),
       start_time = COALESCE(EXCLUDED.start_time, matches.start_time),
       last_synced_at = NOW(),
       updated_at = NOW()
     RETURNING id`,
    [
      sportId,
      competitionId,
      match.externalId,
      match.externalSource,
      homeId,
      awayId,
      match.status,
      match.startTime,
      match.minute,
      match.homeScore,
      match.awayScore,
      match.period,
      match.venue,
    ],
  );

  const matchId = result.rows[0].id;

  await client.query(
    `INSERT INTO match_rooms (match_id, status)
     VALUES ($1, 'open')
     ON CONFLICT (match_id) DO NOTHING`,
    [matchId],
  );

  return matchId;
}

async function syncEventsForMatch(
  client: PoolClient,
  matchId: string,
  externalId: string,
  events: MatchEventModel[],
  match: MatchModel,
) {
  const room = await client.query<{ id: string }>(
    `SELECT id FROM match_rooms WHERE match_id = $1`,
    [matchId],
  );
  const roomId = room.rows[0]?.id;

  for (const ev of events) {
    const existing = ev.externalId
      ? await client.query(
          `SELECT id FROM match_events WHERE match_id = $1 AND external_id = $2`,
          [matchId, ev.externalId],
        )
      : { rowCount: 0, rows: [] };

    if (existing.rowCount && existing.rowCount > 0) continue;

    await client.query(
      `INSERT INTO match_events (
         match_id, external_id, event_type, minute, extra_minute,
         team_side, player_name, assist_name, description, payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        matchId,
        ev.externalId,
        ev.eventType,
        ev.minute,
        ev.extraMinute,
        ev.teamSide,
        ev.playerName,
        ev.assistName,
        ev.description,
        JSON.stringify(ev.payload || {}),
      ],
    );

    if (roomId && ["goal", "yellow_card", "red_card", "substitution", "period_end"].includes(ev.eventType)) {
      const teamName =
        ev.teamSide === "home"
          ? match.homeTeam.nameEl || match.homeTeam.name
          : ev.teamSide === "away"
            ? match.awayTeam.nameEl || match.awayTeam.name
            : null;
      const content = formatEventForChat({
        eventType: ev.eventType,
        minute: ev.minute,
        teamName,
        description: ev.description,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
      });
      const msgType =
        ev.eventType === "goal"
          ? "goal"
          : ev.eventType === "yellow_card" || ev.eventType === "red_card"
            ? "card"
            : ev.eventType === "substitution"
              ? "substitution"
              : "period";

      await client.query(
        `INSERT INTO messages (room_id, user_id, content, message_type)
         VALUES ($1, NULL, $2, $3)`,
        [roomId, content, msgType],
      );
    }
  }
}

export async function syncLiveMatches(sportSlug = "football"): Promise<{
  synced: number;
  error?: string;
}> {
  let matches: MatchModel[] = [];
  try {
    matches = await sofaScoreAdapter.fetchLiveMatches(sportSlug);
  } catch (error) {
    return {
      synced: 0,
      error: error instanceof Error ? error.message : "SofaScore unavailable",
    };
  }

  if (matches.length === 0) {
    // Keep serving cache — mark sync attempt
    await query(
      `INSERT INTO sports_sync_state (sync_key, last_attempt_at, last_error, metadata)
       VALUES ('live:' || $1, NOW(), 'empty_or_unreachable', '{}'::jsonb)
       ON CONFLICT (sync_key) DO UPDATE SET
         last_attempt_at = NOW(),
         last_error = EXCLUDED.last_error`,
      [sportSlug],
    ).catch(() => undefined);
    return { synced: 0 };
  }

  let synced = 0;
  await withTransaction(async (client) => {
    const sportId = await upsertSport(client, sportSlug);
    for (const match of matches) {
      const matchId = await upsertMatch(client, match, sportId);
      try {
        const events = await sofaScoreAdapter.fetchMatchEvents(match.externalId);
        await syncEventsForMatch(client, matchId, match.externalId, events, match);
        const stats = await sofaScoreAdapter.fetchMatchStatistics(match.externalId);
        for (const s of stats) {
          await client.query(
            `INSERT INTO match_stats (match_id, period, stat_key, home_value, away_value, updated_at)
             VALUES ($1,$2,$3,$4,$5,NOW())
             ON CONFLICT (match_id, period, stat_key) DO UPDATE SET
               home_value = EXCLUDED.home_value,
               away_value = EXCLUDED.away_value,
               updated_at = NOW()`,
            [matchId, s.period, s.statKey, s.homeValue, s.awayValue],
          );
        }
      } catch (err) {
        console.warn(`[sync] events/stats failed for ${match.externalId}`, err);
      }
      synced += 1;
    }

    await client.query(
      `INSERT INTO sports_sync_state (sync_key, last_success_at, last_attempt_at, last_error, metadata)
       VALUES ($1, NOW(), NOW(), NULL, $2::jsonb)
       ON CONFLICT (sync_key) DO UPDATE SET
         last_success_at = NOW(),
         last_attempt_at = NOW(),
         last_error = NULL,
         metadata = EXCLUDED.metadata`,
      [`live:${sportSlug}`, JSON.stringify({ synced, at: new Date().toISOString() })],
    );
  });

  return { synced };
}

export async function syncScheduledMatches(sportSlug = "football"): Promise<{ synced: number }> {
  const matches = await sofaScoreAdapter.fetchScheduledMatches(sportSlug);
  let synced = 0;
  await withTransaction(async (client) => {
    const sportId = await upsertSport(client, sportSlug);
    for (const match of matches.slice(0, 80)) {
      await upsertMatch(client, match, sportId);
      synced += 1;
    }
  });
  return { synced };
}

export function nextPollIntervalMs(status: string): number {
  if (status === "live") return POLL_INTERVALS_MS.live;
  if (status === "scheduled") return POLL_INTERVALS_MS.scheduled;
  return POLL_INTERVALS_MS.finished;
}
