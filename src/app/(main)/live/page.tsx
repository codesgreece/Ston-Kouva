import { MatchCard } from "@/components/matches/MatchCard";
import { listMatches } from "@/lib/services/matches";

export default async function LivePage() {
  let matches: Awaited<ReturnType<typeof listMatches>> = [];
  try {
    matches = await listMatches({ live: true, limit: 30 });
  } catch {
    matches = [];
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
          🔴 Live
        </h1>
        <p className="text-sm text-muted">Αγώνες σε εξέλιξη — μπες στον Κουβά.</p>
      </div>
      {matches.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
          Δεν υπάρχουν live αγώνες αυτή τη στιγμή.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
}
