/**
 * Sports data worker — polls SofaScore → PostgreSQL.
 * npm run sports:worker
 */

import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const {
    syncLiveEvents,
    syncUpcomingWindow,
    syncFinalize,
    POLL_INTERVALS_MS,
  } = await import("../src/lib/sports/match-sync");

  console.log("[sports-worker] started", {
    liveMs: POLL_INTERVALS_MS.live,
    upcomingMs: POLL_INTERVALS_MS.upcoming,
  });

  let liveBusy = false;
  let schedBusy = false;
  let finalizeBusy = false;

  async function tickLive() {
    if (liveBusy) return;
    liveBusy = true;
    try {
      const result = await syncLiveEvents("football");
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
      const result = await syncUpcomingWindow(7, "football");
      console.log("[sports-worker] scheduled sync", result);
    } catch (error) {
      console.error("[sports-worker] scheduled error", error);
    } finally {
      schedBusy = false;
    }
  }

  async function tickFinalize() {
    if (finalizeBusy) return;
    finalizeBusy = true;
    try {
      const result = await syncFinalize("football");
      console.log("[sports-worker] finalize sync", result);
    } catch (error) {
      console.error("[sports-worker] finalize error", error);
    } finally {
      finalizeBusy = false;
    }
  }

  await tickScheduled();
  await tickLive();
  await tickFinalize();

  setInterval(tickLive, POLL_INTERVALS_MS.live);
  setInterval(tickScheduled, POLL_INTERVALS_MS.upcoming);
  setInterval(tickFinalize, 5 * 60_000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
