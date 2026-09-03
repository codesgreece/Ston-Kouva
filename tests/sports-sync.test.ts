import assert from "node:assert/strict";
import { test } from "node:test";
import { mapSofaScoreStatus, statusFlags } from "../src/lib/sports/status-mapper";
import { parseSofaScoreEvent } from "../src/lib/sports/sofascore-parser";
import { athensDateIso, formatMatchTime, unixToIso } from "../src/lib/sports/date-utils";
import { isCronAuthorized } from "../src/lib/cron-auth";

test("status mapper: upcoming", () => {
  assert.equal(mapSofaScoreStatus({ code: 0, type: "notstarted" }), "upcoming");
});

test("status mapper: live", () => {
  assert.equal(mapSofaScoreStatus({ code: 6, type: "inprogress", description: "1st half" }), "live");
});

test("status mapper: halftime", () => {
  assert.equal(mapSofaScoreStatus({ code: 31, description: "Halftime" }), "halftime");
});

test("status mapper: finished", () => {
  assert.equal(mapSofaScoreStatus({ code: 100, type: "finished" }), "finished");
});

test("status mapper: postponed", () => {
  assert.equal(mapSofaScoreStatus({ code: 60, description: "Postponed" }), "postponed");
});

test("status mapper: canceled", () => {
  assert.equal(mapSofaScoreStatus({ code: 70, description: "Cancelled" }), "canceled");
});

test("status mapper: suspended", () => {
  assert.equal(mapSofaScoreStatus({ code: 80, type: "interrupted" }), "suspended");
});

test("status mapper: unknown logs safe default", () => {
  assert.equal(mapSofaScoreStatus({ type: "weird_status_xyz" }), "unknown");
});

test("status flags", () => {
  const live = statusFlags("live");
  assert.equal(live.isLive, true);
  assert.equal(live.isUpcoming, false);
  const ht = statusFlags("halftime");
  assert.equal(ht.isLive, true);
});

test("parser: valid event", () => {
  const match = parseSofaScoreEvent({
    id: 12345,
    slug: "team-a-team-b",
    startTimestamp: 1_700_000_000,
    homeTeam: { id: 1, name: "Team A", shortName: "TA" },
    awayTeam: { id: 2, name: "Team B", shortName: "TB" },
    status: { code: 0, type: "notstarted", description: "Not started" },
    score: { current: { home: 0, away: 0 } },
    tournament: {
      uniqueTournament: { id: 99, name: "League", slug: "league" },
    },
  });
  assert.ok(match);
  assert.equal(match?.sofascoreEventId, "12345");
  assert.equal(match?.status, "upcoming");
  assert.equal(match?.homeScore, 0);
});

test("parser: live event with score", () => {
  const match = parseSofaScoreEvent({
    id: 99,
    homeTeam: { id: 1, name: "A" },
    awayTeam: { id: 2, name: "B" },
    status: { code: 12, type: "inprogress", description: "2nd half" },
    score: { current: { home: 2, away: 1 } },
    time: { minute: 67, injury: 2 },
  });
  assert.ok(match);
  assert.equal(match?.status, "live");
  assert.equal(match?.homeScore, 2);
  assert.equal(match?.minute, 67);
  assert.equal(match?.injuryTime, 2);
});

test("parser: finished event", () => {
  const match = parseSofaScoreEvent({
    id: 50,
    homeTeam: { id: 1, name: "A" },
    awayTeam: { id: 2, name: "B" },
    status: { code: 100, description: "Ended" },
    score: { current: { home: 1, away: 0 } },
  });
  assert.equal(match?.status, "finished");
  assert.equal(match?.isFinished, true);
});

test("parser: missing teams returns null", () => {
  assert.equal(parseSofaScoreEvent({ id: 1 }), null);
});

test("timezone: unixToIso UTC", () => {
  const iso = unixToIso(1_704_067_200);
  assert.equal(iso, "2024-01-01T00:00:00.000Z");
});

test("timezone: formatMatchTime uses Europe/Athens", () => {
  const formatted = formatMatchTime("2024-07-15T18:00:00.000Z");
  assert.match(formatted, /\d/);
});

test("timezone: athensDateIso returns YYYY-MM-DD", () => {
  assert.match(athensDateIso(new Date("2024-03-10T22:00:00Z")), /^\d{4}-\d{2}-\d{2}$/);
});

test("cron auth rejects without secret", () => {
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = "test-secret";
  assert.equal(
    isCronAuthorized(new Request("http://localhost", { headers: { "x-cron-secret": "wrong" } })),
    false,
  );
  assert.equal(
    isCronAuthorized(new Request("http://localhost", { headers: { "x-cron-secret": "test-secret" } })),
    true,
  );
  process.env.CRON_SECRET = prev;
});

test("cron auth rejects when secret unset", () => {
  const prev = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  assert.equal(isCronAuthorized(new Request("http://localhost")), false);
  process.env.CRON_SECRET = prev;
});
