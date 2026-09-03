/**
 * Internal sports domain models — provider-agnostic.
 */

export type SportModel = {
  id?: string;
  slug: string;
  name: string;
  nameEl?: string | null;
};

export type CompetitionModel = {
  id?: string;
  sportSlug: string;
  externalId: string;
  externalSource: string;
  name: string;
  nameEl?: string | null;
  countryCode?: string | null;
  logoUrl?: string | null;
  season?: string | null;
};

export type TeamModel = {
  id?: string;
  sportSlug: string;
  externalId: string;
  externalSource: string;
  name: string;
  nameEl?: string | null;
  shortName?: string | null;
  countryCode?: string | null;
  flagEmoji?: string | null;
  logoUrl?: string | null;
};

export type MatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled"
  | "interrupted";

export type MatchModel = {
  id?: string;
  sportSlug: string;
  competitionExternalId?: string | null;
  externalId: string;
  externalSource: string;
  status: MatchStatus;
  startTime?: string | null;
  minute?: number | null;
  homeScore: number;
  awayScore: number;
  period?: string | null;
  venue?: string | null;
  homeTeam: TeamModel;
  awayTeam: TeamModel;
  lastSyncedAt?: string | null;
};

export type MatchEventModel = {
  id?: string;
  matchExternalId: string;
  externalId?: string | null;
  eventType: string;
  minute?: number | null;
  extraMinute?: number | null;
  teamSide?: "home" | "away" | null;
  playerName?: string | null;
  assistName?: string | null;
  description?: string | null;
  payload?: Record<string, unknown>;
};

export type MatchStatisticModel = {
  matchExternalId: string;
  period: string;
  statKey: string;
  homeValue: number | null;
  awayValue: number | null;
};

export interface SportsDataAdapter {
  readonly source: string;
  fetchLiveMatches(sportSlug?: string): Promise<MatchModel[]>;
  fetchScheduledMatches(sportSlug?: string, dateIso?: string): Promise<MatchModel[]>;
  fetchMatch(externalId: string): Promise<MatchModel | null>;
  fetchMatchEvents(externalId: string): Promise<MatchEventModel[]>;
  fetchMatchStatistics(externalId: string): Promise<MatchStatisticModel[]>;
}

export const POLL_INTERVALS_MS = {
  scheduled: 5 * 60_000,
  live: 20_000,
  finished: 0,
} as const;
