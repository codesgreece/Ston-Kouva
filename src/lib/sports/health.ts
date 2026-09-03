import { query } from "@/lib/db";

export type SportsHealthStatus = "CONNECTED" | "DEGRADED" | "ERROR";

export type SportsHealth = {
  status: SportsHealthStatus;
  lastSync: string | null;
  lastLiveSync: string | null;
  lastFailure: string | null;
  lastError: string | null;
  liveMatches: number;
  upcomingMatches: number;
  totalSofascoreMatches: number;
  syncStates: Array<{
    syncKey: string;
    lastSuccessAt: string | null;
    lastAttemptAt: string | null;
    lastError: string | null;
    metadata: Record<string, unknown> | null;
  }>;
};

export async function getSportsHealth(): Promise<SportsHealth> {
  const [syncStates, liveCount, upcomingCount, totalCount, lastFailure] =
    await Promise.all([
      query<{
        sync_key: string;
        last_success_at: Date | null;
        last_attempt_at: Date | null;
        last_error: string | null;
        metadata: Record<string, unknown> | null;
      }>(
        `SELECT sync_key, last_success_at, last_attempt_at, last_error, metadata
         FROM sports_sync_state ORDER BY sync_key`,
      ),
      query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM matches WHERE is_live = TRUE AND external_source = 'sofascore'`,
      ),
      query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM matches WHERE is_upcoming = TRUE AND external_source = 'sofascore'`,
      ),
      query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM matches WHERE external_source = 'sofascore'`,
      ),
      query<{ last_error: string | null; last_attempt_at: Date | null }>(
        `SELECT last_error, last_attempt_at FROM sports_sync_state
         WHERE last_error IS NOT NULL
         ORDER BY last_attempt_at DESC NULLS LAST LIMIT 1`,
      ),
    ]);

  const liveSync = syncStates.rows.find((r) => r.sync_key.startsWith("live:"));
  const rangeSync = syncStates.rows.find((r) => r.sync_key.startsWith("range:") || r.sync_key.startsWith("scheduled:"));

  const lastSuccess = liveSync?.last_success_at || rangeSync?.last_success_at;
  const lastSuccessMs = lastSuccess ? lastSuccess.getTime() : 0;
  const staleMs = Date.now() - lastSuccessMs;

  let status: SportsHealthStatus = "ERROR";
  if (lastSuccess && staleMs < 10 * 60_000) {
    status = "CONNECTED";
  } else if (lastSuccess && staleMs < 60 * 60_000) {
    status = "DEGRADED";
  } else if (totalCount.rows[0]?.c !== "0") {
    status = "DEGRADED";
  }

  return {
    status,
    lastSync: lastSuccess?.toISOString() ?? null,
    lastLiveSync: liveSync?.last_success_at?.toISOString() ?? null,
    lastFailure: lastFailure.rows[0]?.last_attempt_at?.toISOString() ?? null,
    lastError: lastFailure.rows[0]?.last_error ?? null,
    liveMatches: Number(liveCount.rows[0]?.c ?? 0),
    upcomingMatches: Number(upcomingCount.rows[0]?.c ?? 0),
    totalSofascoreMatches: Number(totalCount.rows[0]?.c ?? 0),
    syncStates: syncStates.rows.map((r) => ({
      syncKey: r.sync_key,
      lastSuccessAt: r.last_success_at?.toISOString() ?? null,
      lastAttemptAt: r.last_attempt_at?.toISOString() ?? null,
      lastError: r.last_error,
      metadata: r.metadata,
    })),
  };
}
