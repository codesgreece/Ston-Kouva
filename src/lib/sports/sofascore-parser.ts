import type { MatchEventModel, MatchModel, MatchStatisticModel, TeamModel } from "./types";
import { mapSofaScoreStatus, statusFlags } from "./status-mapper";
import { unixToIso } from "./date-utils";
import {
  sofaScoreEventSchema,
  sofaScoreEventsResponseSchema,
  type ValidatedSofaScoreEvent,
} from "./validation";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function countryFlag(code: string | null | undefined): string | null {
  if (!code || code.length !== 2) return null;
  const base = 0x1f1e6;
  const chars = code.toUpperCase();
  return String.fromCodePoint(
    base + chars.charCodeAt(0) - 65,
    base + chars.charCodeAt(1) - 65,
  );
}

function teamLogoUrl(teamId: number): string {
  return `https://api.sofascore.com/api/v1/team/${teamId}/image`;
}

function parseTeam(
  raw: ValidatedSofaScoreEvent["homeTeam"],
  sportSlug: string,
  source: string,
): TeamModel {
  const country = asRecord((raw as Record<string, unknown>).country);
  const countryCode = str(country?.alpha2);
  return {
    sportSlug,
    externalId: String(raw.id),
    externalSource: source,
    name: str(raw.name) || str(raw.shortName) || `Team ${raw.id}`,
    nameEl: null,
    shortName: str(raw.shortName),
    slug: str(raw.slug),
    countryCode,
    flagEmoji: countryFlag(countryCode),
    logoUrl: teamLogoUrl(raw.id),
  };
}

function extractScores(e: ValidatedSofaScoreEvent): {
  homeScore: number;
  awayScore: number;
  homePeriodScore: Record<string, number> | null;
  awayPeriodScore: Record<string, number> | null;
} {
  const score = asRecord(e.score);
  const current = asRecord(score?.current);
  const homeScore = num(current?.home) ?? 0;
  const awayScore = num(current?.away) ?? 0;

  const homePeriod: Record<string, number> = {};
  const awayPeriod: Record<string, number> = {};
  const homeScoreObj = asRecord(e.homeScore);
  const awayScoreObj = asRecord(e.awayScore);

  for (const [key, val] of Object.entries(homeScoreObj || {})) {
    const n = num(val);
    if (n != null) homePeriod[key] = n;
  }
  for (const [key, val] of Object.entries(awayScoreObj || {})) {
    const n = num(val);
    if (n != null) awayPeriod[key] = n;
  }

  return {
    homeScore,
    awayScore,
    homePeriodScore: Object.keys(homePeriod).length ? homePeriod : null,
    awayPeriodScore: Object.keys(awayPeriod).length ? awayPeriod : null,
  };
}

export function parseSofaScoreEvent(
  raw: unknown,
  sportSlug = "football",
  source = "sofascore",
): MatchModel | null {
  const parsed = sofaScoreEventSchema.safeParse(raw);
  if (!parsed.success) {
    console.warn("[sofascore-parser] invalid event", parsed.error.issues[0]);
    return null;
  }

  const e = parsed.data;
  const home = parseTeam(e.homeTeam, sportSlug, source);
  const away = parseTeam(e.awayTeam, sportSlug, source);

  const statusObj = e.status || {};
  const status = mapSofaScoreStatus({
    code: statusObj.code,
    type: statusObj.type,
    description: statusObj.description,
  });
  const flags = statusFlags(status);

  const { homeScore, awayScore, homePeriodScore, awayPeriodScore } = extractScores(e);
  const startTs = e.startTimestamp ?? null;
  const time = e.time;
  const minute = num(time?.minute) ?? (num(time?.played) != null ? Math.floor((num(time?.played) || 0) / 60) : null);

  const tournament = e.tournament;
  const uniqueTournament = tournament?.uniqueTournament;
  const category =
    uniqueTournament?.category?.name ||
    tournament?.category?.name ||
    null;

  const competitionId = uniqueTournament?.id != null ? String(uniqueTournament.id) : null;
  const competitionName =
    uniqueTournament?.name || tournament?.name || null;
  const competitionSlug =
    uniqueTournament?.slug || tournament?.slug || null;
  const seasonId =
    tournament?.season?.id != null ? String(tournament.season.id) : null;
  const roundName =
    tournament?.roundInfo?.name ||
    (tournament?.roundInfo?.round != null
      ? `Round ${tournament.roundInfo.round}`
      : null);

  const eventId = String(e.id);
  const slug = str(e.slug) || `event-${eventId}`;

  return {
    sportSlug,
    slug,
    sofascoreEventId: eventId,
    competitionExternalId: competitionId,
    competitionName,
    competitionSlug,
    categoryName: category,
    seasonId,
    roundName,
    externalId: eventId,
    externalSource: source,
    status,
    statusType: str(statusObj.type),
    statusCode: num(statusObj.code),
    statusDescription: str(statusObj.description),
    statusPeriod: str(statusObj.description),
    startTime: unixToIso(startTs),
    startTimestamp: startTs,
    minute,
    injuryTime: num(time?.injury),
    homeScore,
    awayScore,
    homePeriodScore,
    awayPeriodScore,
    period: str(statusObj.description),
    venue: str(e.venue?.name),
    ...flags,
    homeTeam: home,
    awayTeam: away,
    lastSyncedAt: new Date().toISOString(),
  };
}

export function enrichMinute(match: MatchModel, raw: unknown): MatchModel {
  const e = asRecord(raw);
  if (!e) return match;
  const time = asRecord(e.time);
  const minute =
    num(time?.minute) ??
    num(e.minute) ??
    (num(time?.played) != null ? Math.floor((num(time?.played) || 0) / 60) : null);
  const injuryTime = num(time?.injury) ?? match.injuryTime;
  return { ...match, minute: minute ?? match.minute, injuryTime };
}

export function parseSofaScoreLiveResponse(
  payload: unknown,
  sportSlug = "football",
  source = "sofascore",
): MatchModel[] {
  const root = sofaScoreEventsResponseSchema.safeParse(payload);
  if (!root.success) {
    const fallback = asRecord(payload);
    const events = asArray(fallback?.events);
    return events
      .map((ev) => {
        const m = parseSofaScoreEvent(ev, sportSlug, source);
        return m ? enrichMinute(m, ev) : null;
      })
      .filter((m): m is MatchModel => Boolean(m));
  }

  return root.data.events
    .map((ev) => {
      const m = parseSofaScoreEvent(ev, sportSlug, source);
      return m ? enrichMinute(m, ev) : null;
    })
    .filter((m): m is MatchModel => Boolean(m));
}

export function parseSofaScoreIncidents(
  payload: unknown,
  matchExternalId: string,
): MatchEventModel[] {
  const root = asRecord(payload);
  const incidents = asArray(root?.incidents);
  const out: MatchEventModel[] = [];

  for (const item of incidents) {
    const i = asRecord(item);
    if (!i) continue;
    const incidentType = str(i.incidentType) || str(i.type) || "other";
    let eventType = "other";
    if (incidentType === "goal" || incidentType === "scoreChange") eventType = "goal";
    else if (incidentType === "card") {
      const className = (str(i.incidentClass) || "").toLowerCase();
      eventType = className.includes("red") ? "red_card" : "yellow_card";
    } else if (incidentType === "substitution") eventType = "substitution";
    else if (incidentType === "period") eventType = "period_end";

    const player = asRecord(i.player);
    const assist = asRecord(i.assist1) || asRecord(i.assist);
    const isHome = i.isHome === true ? "home" : i.isHome === false ? "away" : null;

    out.push({
      matchExternalId,
      externalId: i.id != null ? String(i.id) : null,
      eventType,
      minute: num(i.time) ?? num(i.minute),
      extraMinute: num(i.addedTime),
      teamSide: isHome,
      playerName: str(player?.name),
      assistName: str(assist?.name),
      description: str(i.text) || str(i.reason),
      payload: i,
    });
  }

  return out;
}

export function parseSofaScoreStatistics(
  payload: unknown,
  matchExternalId: string,
): MatchStatisticModel[] {
  const root = asRecord(payload);
  const groups = asArray(root?.statistics);
  const out: MatchStatisticModel[] = [];

  for (const g of groups) {
    const group = asRecord(g);
    const period = str(group?.period) || "ALL";
    const groupsInner = asArray(group?.groups);
    for (const gi of groupsInner) {
      const stats = asArray(asRecord(gi)?.statisticsItems);
      for (const s of stats) {
        const item = asRecord(s);
        if (!item) continue;
        const key = str(item.key) || str(item.name);
        if (!key) continue;
        out.push({
          matchExternalId,
          period,
          statKey: key,
          homeValue:
            num(item.homeValue) ??
            (typeof item.home === "string" ? Number.parseFloat(item.home) || null : null),
          awayValue:
            num(item.awayValue) ??
            (typeof item.away === "string" ? Number.parseFloat(item.away) || null : null),
        });
      }
    }
  }

  return out;
}

export function parseSofaScoreMatch(payload: unknown): MatchModel | null {
  const root = asRecord(payload);
  const event = root?.event ?? payload;
  const m = parseSofaScoreEvent(event);
  return m ? enrichMinute(m, event) : null;
}
