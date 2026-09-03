/**
 * Sports data layer — Phase 1 stubs.
 * Browser never talks to SofaScore. All sync goes:
 * SofaScore → worker → PostgreSQL → our API → users
 */

export type SportModel = {
  id: string;
  slug: string;
  name: string;
  nameEl?: string | null;
};

export type CompetitionModel = {
  id: string;
  sportId: string;
  name: string;
  nameEl?: string | null;
  externalId?: string | null;
  externalSource?: string | null;
};

export type TeamModel = {
  id: string;
  sportId: string;
  name: string;
  nameEl?: string | null;
  shortName?: string | null;
  flagEmoji?: string | null;
  externalId?: string | null;
};

export type MatchModel = {
  id: string;
  sportId: string;
  competitionId?: string | null;
  status: string;
  startTime?: string | null;
  minute?: number | null;
  homeScore: number;
  awayScore: number;
  homeTeam: TeamModel;
  awayTeam: TeamModel;
  lastSyncedAt?: string | null;
};

export type MatchEventModel = {
  id: string;
  matchId: string;
  eventType: string;
  minute?: number | null;
  teamSide?: string | null;
  playerName?: string | null;
  description?: string | null;
};

export interface SportsDataAdapter {
  readonly source: string;
  fetchLiveMatches(): Promise<MatchModel[]>;
  fetchMatch(externalId: string): Promise<MatchModel | null>;
  fetchMatchEvents(externalId: string): Promise<MatchEventModel[]>;
}
