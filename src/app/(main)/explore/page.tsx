import Link from "next/link";
import { listTrendingMatches } from "@/lib/services/matches";
import { query } from "@/lib/db";

export default async function ExplorePage() {
  let matches: Awaited<ReturnType<typeof listTrendingMatches>> = [];
  try {
    matches = await listTrendingMatches(10);
  } catch {
    matches = [];
  }

  let users: { username: string; display_name: string }[] = [];
  try {
    const result = await query<{ username: string; display_name: string }>(
      `SELECT username, display_name FROM users
       WHERE is_banned = FALSE
       ORDER BY created_at DESC LIMIT 8`,
    );
    users = result.rows;
  } catch {
    users = [];
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
          Explore
        </h1>
        <p className="text-sm text-muted">Trending αγώνες, users, συζητήσεις.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Trending matches
        </h2>
        {matches.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
            Δεν υπάρχουν trending αγώνες αυτή τη στιγμή.
          </p>
        ) : (
          <ul className="space-y-2">
            {matches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/match/${m.id}`}
                  className="block rounded-xl border border-border bg-surface px-4 py-3 text-sm hover:border-brand/40"
                >
                  {m.homeTeam.nameEl || m.homeTeam.name} vs{" "}
                  {m.awayTeam.nameEl || m.awayTeam.name}
                  {m.isLive ? " · LIVE" : ""}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Trending users
        </h2>
        <ul className="flex flex-wrap gap-2">
          {users.map((u) => (
            <li key={u.username}>
              <Link
                href={`/profile/${u.username}`}
                className="inline-block rounded-full border border-border bg-surface px-3 py-1.5 text-sm hover:border-brand/40"
              >
                @{u.username}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
          Popular predictions
        </h2>
        <p className="text-sm text-muted">Κανείς δεν ρίσκαρε ακόμα. Ύποπτα ήρεμα.</p>
      </section>
    </div>
  );
}
