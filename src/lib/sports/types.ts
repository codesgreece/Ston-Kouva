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
  slug?: string | null;
  countryCode?: string | null;
  categoryName?: string | null;
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
  slug?: string | null;
  countryCode?: string | null;
  flagEmoji?: string | null;
  logoUrl?: string | null;
};

export type MatchStatus =
  | "upcoming"
  | "live"
  | "halftime"
  | "finished"
  | "postponed"
  | "canceled"
  | "suspended"
  | "unknown";

export type MatchModel = {
  id?: string;
  sportSlug: string;
  slug?: string | null;
  sofascoreEventId: string;
  competitionExternalId?: string | null;
  competitionName?: string | null;
  competitionSlug?: string | null;
  categoryName?: string | null;
  seasonId?: string | null;
  roundName?: string | null;
  externalId: string;
  externalSource: string;
  status: MatchStatus;
  statusType?: string | null;
  statusCode?: number | null;
  statusDescription?: string | null;
  statusPeriod?: string | null;
  startTime?: string | null;
  startTimestamp?: number | null;
  minute?: number | null;
  injuryTime?: number | null;
  homeScore: number;
  awayScore: number;
  homePeriodScore?: Record<string, number> | null;
  awayPeriodScore?: Record<string, number> | null;
  period?: string | null;
  venue?: string | null;
  isLive: boolean;
  isFinished: boolean;
  isPostponed: boolean;
  isCanceled: boolean;
  isUpcoming: boolean;
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
  upcoming: 15 * 60_000,
  live: 45_000,
  halftime: 60_000,
  finished: 0,
} as const;

export type SyncResult = {
  synced: number;
  created: number;
  updated: number;
  unchanged: number;
  liveCount: number;
  errors: string[];
  durationMs: number;
};
