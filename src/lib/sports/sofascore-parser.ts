import type { MatchEventModel, MatchModel, MatchStatisticModel, MatchStatus, TeamModel } from "./types";

type SofaEvent = Record<string, unknown>;

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

function mapStatus(code: unknown, statusDesc?: unknown): MatchStatus {
  const c = num(code);
  const desc = (str(statusDesc) || "").toLowerCase();
  if (c === 0 || desc.includes("not started")) return "scheduled";
  if (c === 100 || desc.includes("ended") || desc.includes("finished")) return "finished";
  if (c === 60 || desc.includes("postponed")) return "postponed";
  if (c === 70 || desc.includes("cancelled")) return "cancelled";
  if (c === 80 || desc.includes("interrupted")) return "interrupted";
  // in-progress codes typically 1–50-ish
  if (c != null && c > 0 && c < 100) return "live";
  if (desc.includes("half") || desc.includes("live") || desc.includes("progress")) return "live";
  return "scheduled";
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

function parseTeam(raw: unknown, sportSlug: string, source: string): TeamModel | null {
  const t = asRecord(raw);
  if (!t) return null;
  const id = num(t.id);
  if (id == null) return null;
  const country = asRecord(t.country);
  const countryCode = str(country?.alpha2) || str(t.countryAlpha2);
  return {
    sportSlug,
    externalId: String(id),
    externalSource: source,
    name: str(t.name) || str(t.shortName) || `Team ${id}`,
    nameEl: null,
    shortName: str(t.shortName) || str(t.nameCode),
    countryCode,
    flagEmoji: countryFlag(countryCode),
    logoUrl: null,
  };
}

export function parseSofaScoreEvent(raw: unknown, sportSlug = "football", source = "sofascore"): MatchModel | null {
  const e = asRecord(raw);
  if (!e) return null;
  const id = num(e.id);
  if (id == null) return null;

  const home = parseTeam(e.homeTeam, sportSlug, source);
  const away = parseTeam(e.awayTeam, sportSlug, source);
  if (!home || !away) return null;

  const statusObj = asRecord(e.status);
  const score = asRecord(e.score);
  const current = asRecord(score?.current);
  const homeScore = num(current?.home) ?? num(asRecord(e.homeScore)?.current) ?? 0;
  const awayScore = num(current?.away) ?? num(asRecord(e.awayScore)?.current) ?? 0;
  const time = asRecord(e.time);
  const startTs = num(e.startTimestamp);

  const tournament = asRecord(e.tournament);
  const uniqueTournament = asRecord(tournament?.uniqueTournament);

  return {
    sportSlug,
    competitionExternalId: uniqueTournament?.id != null ? String(uniqueTournament.id) : null,
    externalId: String(id),
    externalSource: source,
    status: mapStatus(statusObj?.code, statusObj?.description),
    startTime: startTs != null ? new Date(startTs * 1000).toISOString() : null,
    minute: num(time?.currentPeriodStartTimestamp)
      ? null
      : num(e.currentPeriodStartTimestamp) != null
        ? null
        : num(time?.played)
          ? Math.floor((num(time?.played) || 0) / 60)
          : num(statusObj?.code) != null && mapStatus(statusObj?.code) === "live"
            ? num(e.time?.["minute" as never]) ?? num(asRecord(e.time)?.minute)
            : num(asRecord(e.time)?.minute),
    homeScore,
    awayScore,
    period: str(statusObj?.description),
    venue: str(asRecord(e.venue)?.name),
    homeTeam: home,
    awayTeam: away,
    lastSyncedAt: new Date().toISOString(),
  };
}

/** Better minute extraction after initial parse */
export function enrichMinute(match: MatchModel, raw: unknown): MatchModel {
  const e = asRecord(raw);
  if (!e) return match;
  const time = asRecord(e.time);
  const minute =
    num(time?.minute) ??
    num(e.minute) ??
    (num(time?.played) != null ? Math.floor((num(time?.played) || 0) / 60) : null);
  return { ...match, minute: minute ?? match.minute };
}

export function parseSofaScoreLiveResponse(
  payload: unknown,
  sportSlug = "football",
  source = "sofascore",
): MatchModel[] {
  const root = asRecord(payload);
  const events = asArray(root?.events);
  return events
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
          homeValue: num(item.homeValue) ?? (typeof item.home === "string" ? Number.parseFloat(item.home) || null : null),
          awayValue: num(item.awayValue) ?? (typeof item.away === "string" ? Number.parseFloat(item.away) || null : null),
        });
      }
    }
  }

  return out;
}

export function parseSofaScoreMatch(_payload: unknown): MatchModel | null {
  const root = asRecord(_payload);
  const event = root?.event ?? _payload;
  const m = parseSofaScoreEvent(event);
  return m ? enrichMinute(m, event) : null;
}
