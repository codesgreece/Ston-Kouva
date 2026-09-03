import Link from "next/link";
import { LiveBadge } from "@/components/ui/Badges";
import { formatMatchTime } from "@/lib/sports/date-utils";
import { statusLabel, isDisplayLive } from "@/lib/sports/status-mapper";
import { listMatches } from "@/lib/services/matches";

export default async function MatchesPage() {
  let matches: Awaited<ReturnType<typeof listMatches>> = [];
  try {
    matches = await listMatches({ limit: 50 });
  } catch {
    matches = [];
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
          Matches
        </h1>
        <p className="text-sm text-muted">Πραγματικοί αγώνες από PostgreSQL (SofaScore sync).</p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {matches.length === 0 ? (
          <li className="p-6 text-sm text-muted">
            Δεν υπάρχουν αγώνες ακόμα. Ο συγχρονισμός θα ενημερώσει τη λίστα σύντομα.
          </li>
        ) : (
          matches.map((m) => {
            const showLive = isDisplayLive(m.status);
            const timeLabel = showLive && m.minute != null
              ? `${m.minute}'`
              : m.status === "halftime"
                ? "HT"
                : m.startTime
                  ? formatMatchTime(m.startTime)
                  : statusLabel(m.status);

            return (
              <li key={m.id}>
                <Link
                  href={`/match/${m.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted">
                      {m.competitionName || m.categoryName || "—"}
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {m.homeTeam.nameEl || m.homeTeam.name}{" "}
                      {showLive || m.status === "finished" || m.status === "halftime"
                        ? `${m.homeScore}-${m.awayScore}`
                        : "vs"}{" "}
                      {m.awayTeam.nameEl || m.awayTeam.name}
                    </p>
                    <p className="text-xs text-muted">{timeLabel}</p>
                  </div>
                  {showLive ? <LiveBadge stale={m.isStale} /> : null}
                </Link>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
