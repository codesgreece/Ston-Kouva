import type {
  MatchEventModel,
  MatchModel,
  MatchStatisticModel,
  SportsDataAdapter,
} from "./types";
import {
  parseSofaScoreIncidents,
  parseSofaScoreLiveResponse,
  parseSofaScoreMatch,
  parseSofaScoreStatistics,
} from "./sofascore-parser";

const DEFAULT_HEADERS: HeadersInit = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; StonKouvaBot/1.0; +https://ston-kouva.vercel.app)",
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
      console.warn(`[sofascore] ${res.status} ${url}`);
      return null;
    }
    return await res.json();
  } catch (error) {
    console.warn(`[sofascore] fetch failed ${url}`, error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function sportPath(slug: string): string {
  // SofaScore sport path segments
  const map: Record<string, string> = {
    football: "football",
    basketball: "basketball",
    tennis: "tennis",
    volleyball: "volleyball",
    motorsport: "motorsport",
    boxing: "boxing",
    esports: "esports",
  };
  return map[slug] || slug;
}

/**
 * SofaScore HTTP adapter — server-side only.
 * Never call from the browser.
 */
export class SofaScoreAdapter implements SportsDataAdapter {
  readonly source = "sofascore";

  constructor(
    private readonly baseUrl = process.env.SOFASCORE_BASE_URL ||
      "https://api.sofascore.com/api/v1",
  ) {}

  async fetchLiveMatches(sportSlug = "football"): Promise<MatchModel[]> {
    const url = `${this.baseUrl}/sport/${sportPath(sportSlug)}/events/live`;
    const payload = await fetchJson(url);
    if (!payload) return [];
    return parseSofaScoreLiveResponse(payload, sportSlug, this.source);
  }

  async fetchScheduledMatches(
    sportSlug = "football",
    dateIso?: string,
  ): Promise<MatchModel[]> {
    const date =
      dateIso ||
      new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const url = `${this.baseUrl}/sport/${sportPath(sportSlug)}/scheduled-events/${date}`;
    const payload = await fetchJson(url);
    if (!payload) return [];
    return parseSofaScoreLiveResponse(payload, sportSlug, this.source);
  }

  async fetchMatch(externalId: string): Promise<MatchModel | null> {
    const url = `${this.baseUrl}/event/${externalId}`;
    const payload = await fetchJson(url);
    if (!payload) return null;
    return parseSofaScoreMatch(payload);
  }

  async fetchMatchEvents(externalId: string): Promise<MatchEventModel[]> {
    const url = `${this.baseUrl}/event/${externalId}/incidents`;
    const payload = await fetchJson(url);
    if (!payload) return [];
    return parseSofaScoreIncidents(payload, externalId);
  }

  async fetchMatchStatistics(
    externalId: string,
  ): Promise<MatchStatisticModel[]> {
    const url = `${this.baseUrl}/event/${externalId}/statistics`;
    const payload = await fetchJson(url);
    if (!payload) return [];
    return parseSofaScoreStatistics(payload, externalId);
  }
}

export const sofaScoreAdapter = new SofaScoreAdapter();
