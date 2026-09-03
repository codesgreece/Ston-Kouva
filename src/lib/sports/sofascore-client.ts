import type { MatchEventModel, MatchModel, SportsDataAdapter } from "./types";

/**
 * SofaScore adapter (Phase 2 will implement HTTP + parsing).
 * Phase 1: stub that never hits the network — DB is the source of truth.
 */
export class SofaScoreAdapter implements SportsDataAdapter {
  readonly source = "sofascore";

  constructor(private readonly baseUrl = process.env.SOFASCORE_BASE_URL) {}

  async fetchLiveMatches(): Promise<MatchModel[]> {
    // Phase 2: GET `${baseUrl}/sport/football/events/live`
    void this.baseUrl;
    return [];
  }

  async fetchMatch(_externalId: string): Promise<MatchModel | null> {
    void _externalId;
    return null;
  }

  async fetchMatchEvents(_externalId: string): Promise<MatchEventModel[]> {
    void _externalId;
    return [];
  }
}
