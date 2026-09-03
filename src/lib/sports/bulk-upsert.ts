import { query as poolQuery } from "@/lib/db";
import type { MatchModel } from "./types";

/**
 * Bulk upsert matches using unnest-based single SQL per table — minimal round trips.
 */
export async function bulkUpsertMatches(
  matches: MatchModel[],
  sportSlug: string,
): Promise<{ created: number; updated: number; unchanged: number }> {
  if (matches.length === 0) return { created: 0, updated: 0, unchanged: 0 };

  // Step 1: Ensure sport
  const sportRes = await poolQuery<{ id: string }>(
    `INSERT INTO sports (slug, name, name_el, icon, sort_order)
     VALUES ($1, $2, $3, '⚽', 1)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [
      sportSlug,
      sportSlug === "football" ? "Football" : sportSlug,
      sportSlug === "football" ? "Ποδόσφαιρο" : null,
    ],
  );
  const sportId = sportRes.rows[0]?.id;
  if (!sportId) throw new Error("Cannot ensure sport");

  // Step 2: Bulk upsert competitions (single round trip)
  const uniqueComps = Array.from(
    new Map(
      matches
        .filter((m) => m.competitionExternalId)
        .map((m) => [
          `${m.externalSource}:${m.competitionExternalId}`,
          {
            externalId: m.competitionExternalId!,
            source: m.externalSource,
            name: m.competitionName || `Competition ${m.competitionExternalId}`,
            slug: m.competitionSlug || null,
            cat: m.categoryName || null,
            season: m.seasonId || null,
          },
        ]),
    ).values(),
  );

  const compMap = new Map<string, string>();
  if (uniqueComps.length > 0) {
    const cExtIds = uniqueComps.map((c) => c.externalId);
    const cSources = uniqueComps.map((c) => c.source);
    const cNames = uniqueComps.map((c) => c.name);
    const cSlugs = uniqueComps.map((c) => c.slug);
    const cCats = uniqueComps.map((c) => c.cat);
    const cSeasons = uniqueComps.map((c) => c.season);

    const compRes = await poolQuery<{ id: string; external_id: string; external_source: string }>(
      `INSERT INTO competitions (sport_id, external_id, external_source, name, slug, category_name, season, updated_at)
       SELECT $1, x.eid, x.src, x.name, x.slug, x.cat, x.season, NOW()
       FROM unnest(
         $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[]
       ) AS x(eid, src, name, slug, cat, season)
       ON CONFLICT (external_source, external_id) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, competitions.name),
         slug = COALESCE(EXCLUDED.slug, competitions.slug),
         updated_at = NOW()
       RETURNING id, external_id, external_source`,
      [sportId, cExtIds, cSources, cNames, cSlugs, cCats, cSeasons],
    );

    for (const r of compRes.rows) {
      compMap.set(`${r.external_source}:${r.external_id}`, r.id);
    }
  }

  // Step 3: Bulk upsert teams (single round trip)
  const uniqueTeams = Array.from(
    new Map(
      matches.flatMap((m) => [
        [`${m.externalSource}:${m.homeTeam.externalId}`, m.homeTeam],
        [`${m.externalSource}:${m.awayTeam.externalId}`, m.awayTeam],
      ]),
    ).values(),
  );

  const teamMap = new Map<string, string>();
  if (uniqueTeams.length > 0) {
    const tExtIds = uniqueTeams.map((t) => t.externalId);
    const tSources = uniqueTeams.map((t) => t.externalSource);
    const tNames = uniqueTeams.map((t) => t.name);
    const tShorts = uniqueTeams.map((t) => t.shortName || null);
    const tSlugs = uniqueTeams.map((t) => t.slug || null);
    const tLogos = uniqueTeams.map((t) => t.logoUrl || null);
    const tFlags = uniqueTeams.map((t) => t.flagEmoji || null);
    const tCountries = uniqueTeams.map((t) => t.countryCode || null);

    const teamRes = await poolQuery<{ id: string; external_id: string; external_source: string }>(
      `INSERT INTO teams (sport_id, external_id, external_source, name, short_name, slug, country_code, flag_emoji, logo_url, updated_at)
       SELECT $1, x.eid, x.src, x.name, x.short, x.slug, x.country, x.flag, x.logo, NOW()
       FROM unnest(
         $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[]
       ) AS x(eid, src, name, short, slug, country, flag, logo)
       ON CONFLICT (external_source, external_id) DO UPDATE SET
         name = EXCLUDED.name,
         short_name = COALESCE(EXCLUDED.short_name, teams.short_name),
         logo_url = COALESCE(EXCLUDED.logo_url, teams.logo_url),
         flag_emoji = COALESCE(EXCLUDED.flag_emoji, teams.flag_emoji),
         updated_at = NOW()
       RETURNING id, external_id, external_source`,
      [sportId, tExtIds, tSources, tNames, tShorts, tSlugs, tCountries, tFlags, tLogos],
    );

    for (const r of teamRes.rows) {
      teamMap.set(`${r.external_source}:${r.external_id}`, r.id);
    }
  }

  // Step 4: Check existing matches for outcome tracking
  const extIds = matches.map((m) => m.externalId);
  const extSources = matches.map((m) => m.externalSource);

  const existingRes = await poolQuery<{
    external_id: string;
    external_source: string;
    status: string;
    home_score: number;
    away_score: number;
  }>(
    `SELECT external_id, external_source, status, home_score, away_score
     FROM matches
     WHERE (external_source, external_id) IN (
       SELECT unnest($1::text[]), unnest($2::text[])
     )`,
    [extSources, extIds],
  );
  const existingMap = new Map(
    existingRes.rows.map((r) => [`${r.external_source}:${r.external_id}`, r]),
  );

  // Step 5: Bulk upsert matches in chunks of 30 (28 params per match)
  const CHUNK = 30;
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (let i = 0; i < matches.length; i += CHUNK) {
    const chunk = matches.slice(i, i + CHUNK);
    const validChunk = chunk.filter((m) => {
      const homeId = teamMap.get(`${m.externalSource}:${m.homeTeam.externalId}`);
      const awayId = teamMap.get(`${m.externalSource}:${m.awayTeam.externalId}`);
      return homeId && awayId;
    });

    if (validChunk.length === 0) continue;

    const mSportIds = validChunk.map(() => sportId);
    const mCompIds = validChunk.map(
      (m) =>
        (m.competitionExternalId
          ? compMap.get(`${m.externalSource}:${m.competitionExternalId}`)
          : null) ?? null,
    );
    const mExtIds = validChunk.map((m) => m.externalId);
    const mSources = validChunk.map((m) => m.externalSource);
    const mSofaIds = validChunk.map((m) => m.sofascoreEventId);
    const mSlugs = validChunk.map((m) => m.slug || null);
    const mHomeIds = validChunk.map((m) => teamMap.get(`${m.externalSource}:${m.homeTeam.externalId}`) ?? null);
    const mAwayIds = validChunk.map((m) => teamMap.get(`${m.externalSource}:${m.awayTeam.externalId}`) ?? null);
    const mStatuses = validChunk.map((m) => m.status);
    const mStatusTypes = validChunk.map((m) => m.statusType || null);
    const mStatusCodes = validChunk.map((m) => m.statusCode ?? null);
    const mStatusDescs = validChunk.map((m) => m.statusDescription || null);
    const mStartTimes = validChunk.map((m) => m.startTime || null);
    const mStartTs = validChunk.map((m) => m.startTimestamp ?? null);
    const mMinutes = validChunk.map((m) => m.minute ?? null);
    const mInjury = validChunk.map((m) => m.injuryTime ?? null);
    const mHomeScores = validChunk.map((m) => m.homeScore);
    const mAwayScores = validChunk.map((m) => m.awayScore);
    const mPeriods = validChunk.map((m) => m.period || null);
    const mVenues = validChunk.map((m) => m.venue || null);
    const mCats = validChunk.map((m) => m.categoryName || null);
    const mRounds = validChunk.map((m) => m.roundName || null);
    const mIsLive = validChunk.map((m) => m.isLive);
    const mIsFinished = validChunk.map((m) => m.isFinished);
    const mIsPostponed = validChunk.map((m) => m.isPostponed);
    const mIsCanceled = validChunk.map((m) => m.isCanceled);
    const mIsUpcoming = validChunk.map((m) => m.isUpcoming);

    const matchRes = await poolQuery<{ id: string; external_id: string; external_source: string }>(
      `INSERT INTO matches (
         sport_id, competition_id, external_id, external_source,
         sofascore_event_id, slug, home_team_id, away_team_id, status,
         status_type, status_code, status_description,
         start_time, start_timestamp, minute, injury_time,
         home_score, away_score, period, venue, category_name, round_name,
         is_live, is_finished, is_postponed, is_canceled, is_upcoming,
         last_synced_at, updated_at
       )
       SELECT
         x.sport_id::uuid,
         NULLIF(x.comp_id, '')::uuid,
         x.ext_id,
         x.source,
         x.sofa_id,
         NULLIF(x.slug, ''),
         NULLIF(x.home_id, '')::uuid,
         NULLIF(x.away_id, '')::uuid,
         x.status,
         NULLIF(x.status_type, ''),
         NULLIF(x.status_code, '')::int,
         NULLIF(x.status_desc, ''),
         NULLIF(x.start_time, '')::timestamptz,
         NULLIF(x.start_ts, '')::bigint,
         NULLIF(x.minute, '')::int,
         NULLIF(x.injury, '')::int,
         x.home_score::int,
         x.away_score::int,
         NULLIF(x.period, ''),
         NULLIF(x.venue, ''),
         NULLIF(x.cat, ''),
         NULLIF(x.round, ''),
         x.is_live::boolean,
         x.is_finished::boolean,
         x.is_postponed::boolean,
         x.is_canceled::boolean,
         x.is_upcoming::boolean,
         NOW(), NOW()
       FROM unnest(
         $1::text[], $2::text[], $3::text[], $4::text[],
         $5::text[], $6::text[], $7::text[], $8::text[], $9::text[],
         $10::text[], $11::text[], $12::text[],
         $13::text[], $14::text[], $15::text[], $16::text[],
         $17::text[], $18::text[], $19::text[], $20::text[], $21::text[], $22::text[],
         $23::text[], $24::text[], $25::text[], $26::text[], $27::text[]
       ) AS x(
         sport_id, comp_id, ext_id, source,
         sofa_id, slug, home_id, away_id, status,
         status_type, status_code, status_desc,
         start_time, start_ts, minute, injury,
         home_score, away_score, period, venue, cat, round,
         is_live, is_finished, is_postponed, is_canceled, is_upcoming
       )
       ON CONFLICT (external_source, external_id) DO UPDATE SET
         competition_id = COALESCE(EXCLUDED.competition_id, matches.competition_id),
         sofascore_event_id = COALESCE(EXCLUDED.sofascore_event_id, matches.sofascore_event_id),
         status = EXCLUDED.status,
         minute = EXCLUDED.minute,
         home_score = EXCLUDED.home_score,
         away_score = EXCLUDED.away_score,
         period = EXCLUDED.period,
         start_time = COALESCE(EXCLUDED.start_time, matches.start_time),
         start_timestamp = COALESCE(EXCLUDED.start_timestamp, matches.start_timestamp),
         is_live = EXCLUDED.is_live,
         is_finished = EXCLUDED.is_finished,
         is_upcoming = EXCLUDED.is_upcoming,
         last_synced_at = NOW(),
         updated_at = NOW()
       RETURNING id, external_id, external_source`,
      [
        mSportIds,
        mCompIds.map((v) => v ?? ""),
        mExtIds,
        mSources,
        mSofaIds,
        mSlugs.map((v) => v ?? ""),
        mHomeIds.map((v) => v ?? ""),
        mAwayIds.map((v) => v ?? ""),
        mStatuses,
        mStatusTypes.map((v) => v ?? ""),
        mStatusCodes.map((v) => v !== null ? String(v) : ""),
        mStatusDescs.map((v) => v ?? ""),
        mStartTimes.map((v) => v ?? ""),
        mStartTs.map((v) => v !== null ? String(v) : ""),
        mMinutes.map((v) => v !== null ? String(v) : ""),
        mInjury.map((v) => v !== null ? String(v) : ""),
        mHomeScores.map(String),
        mAwayScores.map(String),
        mPeriods.map((v) => v ?? ""),
        mVenues.map((v) => v ?? ""),
        mCats.map((v) => v ?? ""),
        mRounds.map((v) => v ?? ""),
        mIsLive.map(String),
        mIsFinished.map(String),
        mIsPostponed.map(String),
        mIsCanceled.map(String),
        mIsUpcoming.map(String),
      ],
    );

    // Bulk create match rooms
    if (matchRes.rows.length > 0) {
      const matchIds = matchRes.rows.map((r) => r.id);
      await poolQuery(
        `INSERT INTO match_rooms (match_id, status)
         SELECT unnest($1::uuid[]), 'open'
         ON CONFLICT (match_id) DO NOTHING`,
        [matchIds],
      );
    }

    // Count outcomes
    for (const m of validChunk) {
      const prev = existingMap.get(`${m.externalSource}:${m.externalId}`);
      if (!prev) {
        created++;
      } else if (
        prev.status !== m.status ||
        Number(prev.home_score) !== m.homeScore ||
        Number(prev.away_score) !== m.awayScore
      ) {
        updated++;
      } else {
        unchanged++;
      }
    }
  }

  return { created, updated, unchanged };
}
