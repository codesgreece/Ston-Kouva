const ATHENS_TZ = "Europe/Athens";

/** Format UTC ISO timestamp for display in Greece (EET/EEST automatic). */
export function formatMatchTime(
  isoUtc: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isoUtc) return "—";
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: ATHENS_TZ,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(date);
}

/** YYYY-MM-DD in Europe/Athens for scheduled-events API calls. */
export function athensDateIso(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ATHENS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function dateRangeIso(start: Date, end: Date): string[] {
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(athensDateIso(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export function unixToIso(ts: number | null | undefined): string | null {
  if (ts == null || !Number.isFinite(ts)) return null;
  return new Date(ts * 1000).toISOString();
}

/** Seconds since last sync — for freshness UI. */
export function secondsSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
}

export const LIVE_STALE_SECONDS = 120;
