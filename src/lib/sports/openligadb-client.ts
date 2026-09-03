import type { MatchModel, MatchEventModel } from "./types";
import { mapSofaScoreStatus, statusFlags } from "./status-mapper";

/**
 * OpenLigaDB client — free, no API key, covers German leagues + UCL + LaLiga + WM.
 * https://api.openligadb.de
 */

const BASE_URL = "https://api.openligadb.de";
const DEFAULT_HEADERS: HeadersInit = {
  Accept: "application/json",
};

async function fetchJson(url: string, timeoutMs = 12_000): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[openligadb] ${res.status} ${url}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.warn(`[openligadb] fetch failed ${url}`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type OLDBTeam = {
  teamId: number;
  teamName: string;
  shortName?: string | null;
  teamIconUrl?: string | null;
};

type OLDBMatchResult = {
  resultTypeKind?: string;
  resultTypeID?: number;
  pointsTeam1?: number;
  pointsTeam2?: number;
};

type OLDBGoal = {
  goalID?: number;
  scoreTeam1?: number;
  scoreTeam2?: number;
  matchMinute?: number | null;
  goalGetterName?: string | null;
  isOwnGoal?: boolean;
  isPenalty?: boolean;
  isOvertime?: boolean;
  goalGetterID?: number;
};

type OLDBMatch = {
  matchID: number;
  matchDateTimeUTC: string;
  leagueId: number;
  leagueName: string;
  leagueShortcut: string;
  leagueSeason: number;
  group?: { groupName?: string; groupOrderID?: number };
  team1: OLDBTeam;
  team2: OLDBTeam;
  matchIsFinished: boolean;
  matchResults?: OLDBMatchResult[];
  goals?: OLDBGoal[];
  lastUpdateDateTime?: string;
};

function mapOLDBStatus(match: OLDBMatch): ReturnType<typeof mapSofaScoreStatus> {
  if (match.matchIsFinished) return "finished";
  const now = Date.now();
  const start = new Date(match.matchDateTimeUTC).getTime();
  const elapsedMin = (now - start) / 60_000;
  if (start > now) return "upcoming";
  if (elapsedMin < 95) return "live";
  return "live";
}

function extractScore(match: OLDBMatch): { home: number; away: number } {
  const results = match.matchResults || [];
  const final = results.find((r) => r.resultTypeID === 0 || r.resultTypeKind === "Unknown");
  if (final) return { home: final.pointsTeam1 ?? 0, away: final.pointsTeam2 ?? 0 };
  // Fall back to goals
  const goals = match.goals || [];
  if (goals.length > 0) {
    const last = goals[goals.length - 1];
    return { home: last.scoreTeam1 ?? 0, away: last.scoreTeam2 ?? 0 };
  }
  return { home: 0, away: 0 };
}

function estimateMinute(match: OLDBMatch): number | null {
  if (match.matchIsFinished) return null;
  const start = new Date(match.matchDateTimeUTC).getTime();
  const elapsed = Math.floor((Date.now() - start) / 60_000);
  if (elapsed < 0) return null;
  if (elapsed > 90) return 90;
  return elapsed;
}

function oldbTeamToModel(team: OLDBTeam, source = "openligadb"): import("./types").TeamModel {
  return {
    sportSlug: "football",
    externalId: String(team.teamId),
    externalSource: source,
    name: team.teamName,
    shortName: team.shortName || null,
    logoUrl: team.teamIconUrl || null,
    flagEmoji: null,
    countryCode: null,
  };
}

export function parseOLDBMatch(raw: OLDBMatch, source = "openligadb"): MatchModel {
  const status = mapOLDBStatus(raw);
  const flags = statusFlags(status);
  const score = extractScore(raw);
  const minute = flags.isLive ? estimateMinute(raw) : null;
  const eventId = `oldb-${raw.matchID}`;

  return {
    sportSlug: "football",
    slug: `${raw.team1.teamName.toLowerCase().replace(/\s+/g, "-")}-vs-${raw.team2.teamName.toLowerCase().replace(/\s+/g, "-")}-${raw.matchID}`,
    sofascoreEventId: eventId,
    externalId: eventId,
    externalSource: source,
    competitionExternalId: String(raw.leagueId),
    competitionName: raw.leagueName,
    competitionSlug: raw.leagueShortcut,
    categoryName: null,
    seasonId: raw.leagueSeason ? String(raw.leagueSeason) : null,
    roundName: raw.group?.groupName || null,
    status,
    statusType: status,
    statusCode: null,
    statusDescription: status,
    statusPeriod: status,
    startTime: raw.matchDateTimeUTC,
    startTimestamp: Math.floor(new Date(raw.matchDateTimeUTC).getTime() / 1000),
    minute,
    injuryTime: null,
    homeScore: score.home,
    awayScore: score.away,
    period: null,
    venue: null,
    ...flags,
    homeTeam: oldbTeamToModel(raw.team1, source),
    awayTeam: oldbTeamToModel(raw.team2, source),
    lastSyncedAt: new Date().toISOString(),
  };
}

export function parseOLDBGoals(
  match: OLDBMatch,
  matchExternalId: string,
): MatchEventModel[] {
  return (match.goals || []).map((g) => ({
    matchExternalId,
    externalId: g.goalID ? `oldb-goal-${g.goalID}` : null,
    eventType: "goal",
    minute: g.matchMinute ?? null,
    extraMinute: null,
    teamSide: null,
    playerName: g.goalGetterName || null,
    description:
      g.isOwnGoal ? "Own goal" : g.isPenalty ? "Penalty" : g.isOvertime ? "Overtime" : null,
    payload: g as Record<string, unknown>,
  }));
}

/**
 * Leagues to sync. These all have current 2025/26 or 2026/27 data on OpenLigaDB.
 */
export const OPENLIGADB_LEAGUES: Array<{
  shortcut: string;
  season: number;
  name: string;
}> = [
  { shortcut: "bl1", season: 2026, name: "1. Fußball-Bundesliga 2026/2027" },
  { shortcut: "bl2", season: 2026, name: "2. Fußball-Bundesliga 2026/2027" },
  { shortcut: "dfb", season: 2025, name: "DFB Pokal 2025/2026" },
  { shortcut: "ucl2025", season: 2025, name: "Champions League 2025/26" },
  { shortcut: "la1", season: 2026, name: "LaLiga 2026/2027" },
];

/**
 * Fetch all matches for a league (current matchday by default, or full season).
 */
export async function fetchOLDBMatches(
  shortcut: string,
  season?: number,
): Promise<OLDBMatch[]> {
  const url = season
    ? `${BASE_URL}/getmatchdata/${shortcut}/${season}`
    : `${BASE_URL}/getmatchdata/${shortcut}`;
  const data = await fetchJson(url);
  if (!Array.isArray(data)) return [];
  return data as OLDBMatch[];
}

export async function fetchOLDBLiveMatches(): Promise<MatchModel[]> {
  const all: MatchModel[] = [];
  for (const league of OPENLIGADB_LEAGUES) {
    const matches = await fetchOLDBMatches(league.shortcut, league.season);
    const live = matches.filter((m) => {
      if (m.matchIsFinished) return false;
      const now = Date.now();
      const start = new Date(m.matchDateTimeUTC).getTime();
      return start <= now + 5 * 60_000; // started or starting in 5 min
    });
    for (const m of live) {
      all.push(parseOLDBMatch(m));
    }
  }
  return all;
}

export async function fetchOLDBScheduledMatches(): Promise<MatchModel[]> {
  const all: MatchModel[] = [];
  for (const league of OPENLIGADB_LEAGUES) {
    const matches = await fetchOLDBMatches(league.shortcut, league.season);
    for (const m of matches) {
      all.push(parseOLDBMatch(m));
    }
  }
  return all;
}
