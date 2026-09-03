import Link from "next/link";
import { LiveBadge } from "@/components/ui/Badges";
import { listMatches } from "@/lib/services/matches";

export default async function MatchesPage() {
  let matches: Awaited<ReturnType<typeof listMatches>> = [];
  try {
    matches = await listMatches({ limit: 40 });
  } catch {
    matches = [];
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
          Matches
        </h1>
        <p className="text-sm text-muted">Αγώνες από τη βάση μας (sports cache).</p>
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {matches.length === 0 ? (
          <li className="p-6 text-sm text-muted">Δεν υπάρχουν αγώνες ακόμα.</li>
        ) : (
          matches.map((m) => (
            <li key={m.id}>
              <Link
                href={`/match/${m.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {m.homeTeam.flagEmoji} {m.homeTeam.nameEl || m.homeTeam.name}{" "}
                    {m.homeScore}-{m.awayScore}{" "}
                    {m.awayTeam.flagEmoji} {m.awayTeam.nameEl || m.awayTeam.name}
                  </p>
                  <p className="text-xs text-muted">
                    {m.status === "live" && m.minute != null ? `${m.minute}'` : m.status}
                  </p>
                </div>
                {m.status === "live" ? <LiveBadge /> : null}
              </Link>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
