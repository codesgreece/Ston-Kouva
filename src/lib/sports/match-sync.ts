/**
 * Controlled match sync worker hooks.
 * Polling intervals by status (Phase 2):
 * - scheduled: sparse
 * - live: more frequent
 * - finished: stop live polling
 */
export const POLL_INTERVALS_MS = {
  scheduled: 5 * 60_000,
  live: 20_000,
  finished: 0,
} as const;

export async function syncLiveMatches(): Promise<{ synced: number }> {
  // Phase 2: adapter → upsert matches/events → notify realtime
  return { synced: 0 };
}
