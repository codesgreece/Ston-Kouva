/**
 * Sports data worker — polls SofaScore → PostgreSQL.
 * npm run sports:worker
 *
 * Live matches: every 20s
 * Scheduled: every 5 min
 * Finished: no live polling
 */

import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  // Dynamic import after env load
  const { syncLiveMatches, syncScheduledMatches, POLL_INTERVALS_MS } =
    await import("../src/lib/sports/match-sync");

  console.log("[sports-worker] started", {
    liveMs: POLL_INTERVALS_MS.live,
    scheduledMs: POLL_INTERVALS_MS.scheduled,
  });

  let liveBusy = false;
  let schedBusy = false;

  async function tickLive() {
    if (liveBusy) return;
    liveBusy = true;
    try {
      const result = await syncLiveMatches("football");
      console.log("[sports-worker] live sync", result);
    } catch (error) {
      console.error("[sports-worker] live error", error);
    } finally {
      liveBusy = false;
    }
  }

  async function tickScheduled() {
    if (schedBusy) return;
    schedBusy = true;
    try {
      const result = await syncScheduledMatches("football");
      console.log("[sports-worker] scheduled sync", result);
    } catch (error) {
      console.error("[sports-worker] scheduled error", error);
    } finally {
      schedBusy = false;
    }
  }

  await tickLive();
  await tickScheduled();
  setInterval(tickLive, POLL_INTERVALS_MS.live);
  setInterval(tickScheduled, POLL_INTERVALS_MS.scheduled);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
