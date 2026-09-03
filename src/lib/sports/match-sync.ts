import { query, withTransaction } from "@/lib/db";
import { formatEventForChat } from "./match-events";
import { sofaScoreAdapter } from "./sofascore-client";
import { athensDateIso, addDays, dateRangeIso } from "./date-utils";
import type { MatchEventModel, MatchModel, SyncResult } from "./types";
import { POLL_INTERVALS_MS } from "./types";
import type { PoolClient } from "pg";

export { POLL_INTERVALS_MS };

const syncLocks = new Map<string, boolean>();

function acquireLock(key: string): boolean {
  if (syncLocks.get(key)) return false;
  syncLocks.set(key, true);
  return true;
}

function releaseLock(key: string): void {
  syncLocks.delete(key);
}

async function recordSyncState(
  syncKey: string,
  success: boolean,
  metadata: Record<string, unknown>,
  error?: string | null,
) {
  await query(
    `INSERT INTO sports_sync_state (sync_key, last_success_at, last_attempt_at, last_error, metadata)
     VALUES ($1, $2, NOW(), $3, $4::jsonb)
     ON CONFLICT (sync_key) DO UPDATE SET
       last_success_at = CASE WHEN $5 THEN NOW() ELSE sports_sync_state.last_success_at END,
       last_attempt_at = NOW(),
       last_error = $3,
       metadata = $4::jsonb`,
    [
      syncKey,
      success ? new Date() : null,
      error ?? null,
      JSON.stringify(metadata),
      success,
    ],
  ).catch((err) => console.warn("[sync] recordSyncState failed", err));
}

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

async function upsertCompetition(
  client: PoolClient,
  sportId: string,
  match: MatchModel,
) {
  if (!match.competitionExternalId) return null;

  const result = await client.query<{ id: string }>(
    `INSERT INTO competitions (
       sport_id, external_id, external_source, name, slug, category_name, season, logo_url, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     ON CONFLICT (external_source, external_id) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, competitions.name),
       slug = COALESCE(EXCLUDED.slug, competitions.slug),
       category_name = COALESCE(EXCLUDED.category_name, competitions.category_name),
       season = COALESCE(EXCLUDED.season, competitions.season),
       updated_at = NOW()
     RETURNING id`,
    [
      sportId,
      match.competitionExternalId,
      match.externalSource,
      match.competitionName || `Competition ${match.competitionExternalId}`,
      match.competitionSlug,
      match.categoryName,
      match.seasonId,
      match.competitionExternalId
        ? `https://api.sofascore.com/api/v1/unique-tournament/${match.competitionExternalId}/image`
        : null,
    ],
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
       sport_id, external_id, external_source, name, name_el, short_name, slug,
       country_code, flag_emoji, logo_url, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
     ON CONFLICT (external_source, external_id) DO UPDATE SET
       name = EXCLUDED.name,
       short_name = COALESCE(EXCLUDED.short_name, teams.short_name),
       slug = COALESCE(EXCLUDED.slug, teams.slug),
       country_code = COALESCE(EXCLUDED.country_code, teams.country_code),
       flag_emoji = COALESCE(EXCLUDED.flag_emoji, teams.flag_emoji),
       logo_url = COALESCE(EXCLUDED.logo_url, teams.logo_url),
       updated_at = NOW()
     RETURNING id`,
    [
      sportId,
      team.externalId,
      team.externalSource,
      team.name,
      team.nameEl,
      team.shortName,
      team.slug,
      team.countryCode,
      team.flagEmoji,
      team.logoUrl,
    ],
  );
  return result.rows[0].id;
}

type UpsertOutcome = "created" | "updated" | "unchanged";

async function upsertMatch(
  client: PoolClient,
  match: MatchModel,
  sportId: string,
): Promise<{ matchId: string; outcome: UpsertOutcome }> {
  const competitionId = await upsertCompetition(client, sportId, match);
  const homeId = await upsertTeam(client, sportId, match.homeTeam);
  const awayId = await upsertTeam(client, sportId, match.awayTeam);

  const existing = await client.query<{
    id: string;
    status: string;
    home_score: number;
    away_score: number;
    minute: number | null;
  }>(
    `SELECT id, status, home_score, away_score, minute
     FROM matches WHERE external_source = $1 AND external_id = $2`,
    [match.externalSource, match.externalId],
  );

  const result = await client.query<{ id: string }>(
    `INSERT INTO matches (
       sport_id, competition_id, external_id, external_source,
       sofascore_event_id, slug,
       home_team_id, away_team_id, status,
       status_type, status_code, status_description, status_period,
       start_time, start_timestamp, minute, injury_time,
       home_score, away_score, home_period_score, away_period_score,
       period, venue, category_name, round_name,
       is_live, is_finished, is_postponed, is_canceled, is_upcoming,
       last_synced_at, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,
       $10,$11,$12,$13,
       $14,$15,$16,$17,
       $18,$19,$20::jsonb,$21::jsonb,
       $22,$23,$24,$25,
       $26,$27,$28,$29,$30,
       NOW(),NOW()
     )
     ON CONFLICT (external_source, external_id) DO UPDATE SET
       competition_id = COALESCE(EXCLUDED.competition_id, matches.competition_id),
       sofascore_event_id = COALESCE(EXCLUDED.sofascore_event_id, matches.sofascore_event_id),
       slug = COALESCE(EXCLUDED.slug, matches.slug),
       status = EXCLUDED.status,
       status_type = EXCLUDED.status_type,
       status_code = EXCLUDED.status_code,
       status_description = EXCLUDED.status_description,
       status_period = EXCLUDED.status_period,
       minute = EXCLUDED.minute,
       injury_time = EXCLUDED.injury_time,
       home_score = EXCLUDED.home_score,
       away_score = EXCLUDED.away_score,
       home_period_score = COALESCE(EXCLUDED.home_period_score, matches.home_period_score),
       away_period_score = COALESCE(EXCLUDED.away_period_score, matches.away_period_score),
       period = EXCLUDED.period,
       venue = COALESCE(EXCLUDED.venue, matches.venue),
       category_name = COALESCE(EXCLUDED.category_name, matches.category_name),
       round_name = COALESCE(EXCLUDED.round_name, matches.round_name),
       start_time = COALESCE(EXCLUDED.start_time, matches.start_time),
       start_timestamp = COALESCE(EXCLUDED.start_timestamp, matches.start_timestamp),
       is_live = EXCLUDED.is_live,
       is_finished = EXCLUDED.is_finished,
       is_postponed = EXCLUDED.is_postponed,
       is_canceled = EXCLUDED.is_canceled,
       is_upcoming = EXCLUDED.is_upcoming,
       last_synced_at = NOW(),
       updated_at = NOW()
     RETURNING id`,
    [
      sportId,
      competitionId,
      match.externalId,
      match.externalSource,
      match.sofascoreEventId,
      match.slug,
      homeId,
      awayId,
      match.status,
      match.statusType,
      match.statusCode,
      match.statusDescription,
      match.statusPeriod,
      match.startTime,
      match.startTimestamp,
      match.minute,
      match.injuryTime,
      match.homeScore,
      match.awayScore,
      match.homePeriodScore ? JSON.stringify(match.homePeriodScore) : null,
      match.awayPeriodScore ? JSON.stringify(match.awayPeriodScore) : null,
      match.period,
      match.venue,
      match.categoryName,
      match.roundName,
      match.isLive,
      match.isFinished,
      match.isPostponed,
      match.isCanceled,
      match.isUpcoming,
    ],
  );

  const matchId = result.rows[0].id;
  const prev = existing.rows[0];

  let outcome: UpsertOutcome = "created";
  if (prev) {
    const changed =
      prev.status !== match.status ||
      prev.home_score !== match.homeScore ||
      prev.away_score !== match.awayScore ||
      prev.minute !== match.minute;
    outcome = changed ? "updated" : "unchanged";
  }

  await client.query(
    `INSERT INTO match_rooms (match_id, status)
     VALUES ($1, 'open')
     ON CONFLICT (match_id) DO NOTHING`,
    [matchId],
  );

  return { matchId, outcome };
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

async function persistMatches(
  matches: MatchModel[],
  sportSlug: string,
  options?: { fetchDetails?: boolean },
): Promise<SyncResult> {
  const start = Date.now();
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let liveCount = 0;
  const errors: string[] = [];

  await withTransaction(async (client) => {
    const sportId = await upsertSport(client, sportSlug);
    for (const match of matches) {
      try {
        let fullMatch = match;
        if (options?.fetchDetails && match.isLive) {
          const detail = await sofaScoreAdapter.fetchMatch(match.externalId);
          if (detail) fullMatch = detail;
        }

        const { matchId, outcome } = await upsertMatch(client, fullMatch, sportId);
        if (outcome === "created") created++;
        else if (outcome === "updated") updated++;
        else unchanged++;

        if (fullMatch.isLive) {
          liveCount++;
          try {
            const events = await sofaScoreAdapter.fetchMatchEvents(fullMatch.externalId);
            await syncEventsForMatch(client, matchId, fullMatch.externalId, events, fullMatch);
          } catch (err) {
            errors.push(`events:${fullMatch.externalId}`);
            console.warn(`[sync] events failed for ${fullMatch.externalId}`, err);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "upsert failed";
        errors.push(`${match.externalId}: ${msg}`);
        console.warn(`[sync] match upsert failed ${match.externalId}`, err);
      }
    }
  });

  return {
    synced: matches.length,
    created,
    updated,
    unchanged,
    liveCount,
    errors,
    durationMs: Date.now() - start,
  };
}

export async function syncScheduledEvents(
  dateIso: string,
  sportSlug = "football",
): Promise<SyncResult> {
  const lockKey = `scheduled:${sportSlug}:${dateIso}`;
  if (!acquireLock(lockKey)) {
    return { synced: 0, created: 0, updated: 0, unchanged: 0, liveCount: 0, errors: ["locked"], durationMs: 0 };
  }

  try {
    const matches = await sofaScoreAdapter.fetchScheduledMatches(sportSlug, dateIso);
    const result = await persistMatches(matches, sportSlug);
    await recordSyncState(`scheduled:${sportSlug}:${dateIso}`, true, {
      ...result,
      date: dateIso,
    });
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "scheduled sync failed";
    await recordSyncState(`scheduled:${sportSlug}:${dateIso}`, false, { date: dateIso }, msg);
    return { synced: 0, created: 0, updated: 0, unchanged: 0, liveCount: 0, errors: [msg], durationMs: 0 };
  } finally {
    releaseLock(lockKey);
  }
}

export async function syncLiveEvents(sportSlug = "football"): Promise<SyncResult> {
  const lockKey = `live:${sportSlug}`;
  if (!acquireLock(lockKey)) {
    return { synced: 0, created: 0, updated: 0, unchanged: 0, liveCount: 0, errors: ["locked"], durationMs: 0 };
  }

  try {
    const matches = await sofaScoreAdapter.fetchLiveMatches(sportSlug);
    const result = await persistMatches(matches, sportSlug, { fetchDetails: true });

    // Refresh DB matches marked live that may have finished
    const staleLive = await query<{ external_id: string }>(
      `SELECT external_id FROM matches
       WHERE external_source = 'sofascore'
         AND is_live = TRUE
         AND last_synced_at < NOW() - INTERVAL '3 minutes'`,
    );
    for (const row of staleLive.rows.slice(0, 20)) {
      const detail = await sofaScoreAdapter.fetchMatch(row.external_id);
      if (detail && !detail.isLive) {
        const partial = await persistMatches([detail], sportSlug);
        result.updated += partial.updated;
        result.synced += 1;
      }
    }

    await recordSyncState(lockKey, true, result);
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "live sync failed";
    await recordSyncState(lockKey, false, {}, msg);
    return { synced: 0, created: 0, updated: 0, unchanged: 0, liveCount: 0, errors: [msg], durationMs: 0 };
  } finally {
    releaseLock(lockKey);
  }
}

export async function syncEvent(
  eventId: string,
  sportSlug = "football",
): Promise<SyncResult> {
  const match = await sofaScoreAdapter.fetchMatch(eventId);
  if (!match) {
    return { synced: 0, created: 0, updated: 0, unchanged: 0, liveCount: 0, errors: ["not found"], durationMs: 0 };
  }
  return persistMatches([match], sportSlug, { fetchDetails: true });
}

export async function syncDateRange(
  startDate: string,
  endDate: string,
  sportSlug = "football",
): Promise<SyncResult> {
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  const dates = dateRangeIso(start, end);

  const aggregate: SyncResult = {
    synced: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    liveCount: 0,
    errors: [],
    durationMs: 0,
  };

  for (const date of dates) {
    const r = await syncScheduledEvents(date, sportSlug);
    aggregate.synced += r.synced;
    aggregate.created += r.created;
    aggregate.updated += r.updated;
    aggregate.unchanged += r.unchanged;
    aggregate.liveCount += r.liveCount;
    aggregate.errors.push(...r.errors);
    aggregate.durationMs += r.durationMs;
  }

  await recordSyncState(`range:${sportSlug}`, true, aggregate);
  return aggregate;
}

/** Sync today + next 7 days (Athens timezone). */
export async function syncUpcomingWindow(
  days = 7,
  sportSlug = "football",
): Promise<SyncResult> {
  const today = athensDateIso();
  const end = athensDateIso(addDays(new Date(), days));
  return syncDateRange(today, end, sportSlug);
}

/** Finalize recently active matches — confirm final scores/status. */
export async function syncFinalize(sportSlug = "football"): Promise<SyncResult> {
  const candidates = await query<{ external_id: string }>(
    `SELECT external_id FROM matches
     WHERE external_source = 'sofascore'
       AND (
         is_live = TRUE
         OR (status IN ('live', 'halftime') AND last_synced_at < NOW() - INTERVAL '5 minutes')
         OR (status = 'upcoming' AND start_time < NOW() - INTERVAL '2 hours' AND is_finished = FALSE)
       )
     ORDER BY last_synced_at ASC NULLS FIRST
     LIMIT 40`,
  );

  const matches: MatchModel[] = [];
  for (const row of candidates.rows) {
    const m = await sofaScoreAdapter.fetchMatch(row.external_id);
    if (m) matches.push(m);
  }

  const result = await persistMatches(matches, sportSlug);
  await recordSyncState(`finalize:${sportSlug}`, true, result);
  return result;
}

// Backward-compatible aliases
export const syncLiveMatches = syncLiveEvents;
export async function syncScheduledMatches(sportSlug = "football") {
  return syncScheduledEvents(athensDateIso(), sportSlug);
}

export function nextPollIntervalMs(status: string): number {
  if (status === "live") return POLL_INTERVALS_MS.live;
  if (status === "halftime") return POLL_INTERVALS_MS.halftime;
  if (status === "upcoming") return POLL_INTERVALS_MS.upcoming;
  return POLL_INTERVALS_MS.finished;
}

/** Remove seed/demo matches from production data (preserves social via cascade rules). */
export async function purgeSeedMatches(): Promise<number> {
  const result = await query(
    `DELETE FROM matches WHERE external_source = 'seed' RETURNING id`,
  );
  return result.rowCount ?? 0;
}
