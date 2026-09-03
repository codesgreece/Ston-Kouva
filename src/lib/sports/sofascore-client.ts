import type {
  MatchEventModel,
  MatchModel,
  MatchStatisticModel,
  SportsDataAdapter,
} from "./types";
import { SofaScoreError } from "./errors";
import {
  parseSofaScoreIncidents,
  parseSofaScoreLiveResponse,
  parseSofaScoreMatch,
  parseSofaScoreStatistics,
} from "./sofascore-parser";

const DEFAULT_HEADERS: HeadersInit = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9,el;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Referer: "https://www.sofascore.com/",
  Origin: "https://www.sofascore.com",
  "Cache-Control": "no-cache",
};

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(
  url: string,
  timeoutMs = 12_000,
  retries = MAX_RETRIES,
): Promise<unknown> {
  const fixturePath = process.env.SOFASCORE_FIXTURE_PATH;
  if (fixturePath) {
    const fs = await import("fs/promises");
    const raw = await fs.readFile(fixturePath, "utf8");
    return JSON.parse(raw) as unknown;
  }

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const proxy = process.env.SOFASCORE_PROXY || process.env.HTTPS_PROXY;
      const fetchOptions: RequestInit & { dispatcher?: unknown } = {
        headers: DEFAULT_HEADERS,
        signal: controller.signal,
        cache: "no-store",
      };

      if (proxy) {
        try {
          const { ProxyAgent } = await import("undici");
          fetchOptions.dispatcher = new ProxyAgent(proxy);
        } catch {
          console.warn("[sofascore] ProxyAgent unavailable — set HTTPS_PROXY in runtime");
        }
      }

      const res = await fetch(url, fetchOptions);
      if (!res.ok) {
        const err = new SofaScoreError(
          `HTTP ${res.status}`,
          "http",
          res.status,
          url,
        );
        if (res.status >= 500 && attempt < retries) {
          lastError = err;
          await sleep(BASE_DELAY_MS * 2 ** attempt);
          continue;
        }
        console.warn(`[sofascore] ${res.status} ${url}`);
        throw err;
      }
      return await res.json();
    } catch (error) {
      lastError = error;
      const isAbort = error instanceof Error && error.name === "AbortError";
      if ((isAbort || error instanceof TypeError) && attempt < retries) {
        console.warn(`[sofascore] retry ${attempt + 1} ${url}`);
        await sleep(BASE_DELAY_MS * 2 ** attempt);
        continue;
      }
      if (error instanceof SofaScoreError) throw error;
      console.warn(`[sofascore] fetch failed ${url}`, error);
      throw new SofaScoreError(
        error instanceof Error ? error.message : "Network error",
        isAbort ? "timeout" : "network",
        undefined,
        url,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new SofaScoreError("Max retries exceeded", "unknown");
}

function sportPath(slug: string): string {
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
    try {
      const payload = await fetchJson(url);
      return parseSofaScoreLiveResponse(payload, sportSlug, this.source);
    } catch (error) {
      console.warn("[sofascore] fetchLiveMatches failed", error);
      return [];
    }
  }

  async fetchScheduledMatches(
    sportSlug = "football",
    dateIso?: string,
  ): Promise<MatchModel[]> {
    const date =
      dateIso ||
      new Date().toISOString().slice(0, 10);
    const url = `${this.baseUrl}/sport/${sportPath(sportSlug)}/scheduled-events/${date}`;
    try {
      const payload = await fetchJson(url);
      return parseSofaScoreLiveResponse(payload, sportSlug, this.source);
    } catch (error) {
      console.warn(`[sofascore] fetchScheduledMatches ${date} failed`, error);
      return [];
    }
  }

  async fetchMatch(externalId: string): Promise<MatchModel | null> {
    const url = `${this.baseUrl}/event/${externalId}`;
    try {
      const payload = await fetchJson(url);
      return parseSofaScoreMatch(payload);
    } catch (error) {
      console.warn(`[sofascore] fetchMatch ${externalId} failed`, error);
      return null;
    }
  }

  async fetchMatchEvents(externalId: string): Promise<MatchEventModel[]> {
    const url = `${this.baseUrl}/event/${externalId}/incidents`;
    try {
      const payload = await fetchJson(url);
      return parseSofaScoreIncidents(payload, externalId);
    } catch {
      return [];
    }
  }

  async fetchMatchStatistics(
    externalId: string,
  ): Promise<MatchStatisticModel[]> {
    const url = `${this.baseUrl}/event/${externalId}/statistics`;
    try {
      const payload = await fetchJson(url);
      return parseSofaScoreStatistics(payload, externalId);
    } catch {
      return [];
    }
  }
}

export const sofaScoreAdapter = new SofaScoreAdapter();
