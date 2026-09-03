import type { MatchModel } from "./types";
import { parseSofaScoreLiveResponse } from "./sofascore-parser";

/**
 * Load matches from a local JSON fixture (dev/test when SofaScore blocks datacenter IPs).
 * Set SOFASCORE_FIXTURE_PATH to a file containing { "events": [...] }.
 */
export async function fetchFromFixture(
  fixturePath: string,
  sportSlug = "football",
): Promise<MatchModel[]> {
  const fs = await import("fs/promises");
  const raw = await fs.readFile(fixturePath, "utf8");
  const payload = JSON.parse(raw) as unknown;
  return parseSofaScoreLiveResponse(payload, sportSlug, "sofascore");
}
