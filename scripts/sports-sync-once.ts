import path from "path";
import { config } from "dotenv";

config({ path: path.resolve(process.cwd(), ".env") });

async function main() {
  const { syncUpcomingWindow, syncLiveEvents, purgeSeedMatches } = await import(
    "../src/lib/sports/match-sync"
  );

  const purged = await purgeSeedMatches();
  console.log(`Purged ${purged} seed matches`);

  const scheduled = await syncUpcomingWindow(7, "football");
  console.log("Scheduled sync:", scheduled);

  const live = await syncLiveEvents("football");
  console.log("Live sync:", live);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
