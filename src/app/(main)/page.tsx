import Link from "next/link";
import { MatchCard } from "@/components/matches/MatchCard";
import { CreatePostBox, PostCard } from "@/components/social/PostCard";
import { listMatches, listTrendingMatches } from "@/lib/services/matches";
import { getCachedHomeFeed } from "@/lib/services/social";
import { getCurrentSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getCurrentSession();
  let liveMatches: Awaited<ReturnType<typeof listMatches>> = [];
  let upcomingMatches: Awaited<ReturnType<typeof listMatches>> = [];
  let trendingMatches: Awaited<ReturnType<typeof listTrendingMatches>> = [];

  try {
    [liveMatches, upcomingMatches, trendingMatches] = await Promise.all([
      listMatches({ live: true, limit: 6 }),
      listMatches({ upcoming: true, limit: 6 }),
      listTrendingMatches(5),
    ]);
  } catch {
    liveMatches = [];
    upcomingMatches = [];
    trendingMatches = [];
  }

  let feed: Awaited<ReturnType<typeof getCachedHomeFeed>> = {
    posts: [],
    nextCursor: null,
  };
  try {
    feed = await getCachedHomeFeed(session?.user.id);
  } catch {
    feed = { posts: [], nextCursor: null };
  }

  return (
    <div className="space-y-8">
      <section className="animate-fade-up overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-[#1a1208] via-surface to-[#0c0c0c] p-6 md:p-8">
        <p className="font-[family-name:var(--font-display)] text-4xl font-black tracking-tight md:text-5xl">
          ΣΤΟΝ ΚΟΥΒΑ<span className="text-brand">!</span>
        </p>
        <p className="mt-3 max-w-md text-base text-muted md:text-lg">
          Βλέπεις τον αγώνα. Μπες στη συζήτηση.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/live"
            className="rounded-xl bg-live px-4 py-2.5 text-sm font-bold text-white"
          >
            🔴 Δες Live Αγώνες
          </Link>
          <Link
            href="/matches"
            className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text"
          >
            📅 Επερχόμενοι
          </Link>
          <Link
            href="/explore"
            className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text"
          >
            💬 Εξερεύνησε τις συζητήσεις
          </Link>
        </div>
        {!session ? (
          <p className="mt-4 text-sm text-muted">
            <Link href="/login" className="text-brand-2 underline-offset-2 hover:underline">
              Σύνδεση
            </Link>{" "}
            ή{" "}
            <Link href="/register" className="text-brand-2 underline-offset-2 hover:underline">
              εγγραφή
            </Link>{" "}
            για να μπεις στον Κουβά.
          </p>
        ) : null}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            LIVE NOW
          </h2>
          <Link href="/live" className="text-sm text-brand-2">
            Όλα →
          </Link>
        </div>
        {liveMatches.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-6 text-sm text-muted">
            Δεν υπάρχουν live αγώνες αυτή τη στιγμή.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
            UPCOMING
          </h2>
          <Link href="/matches" className="text-sm text-brand-2">
            Όλα →
          </Link>
        </div>
        {upcomingMatches.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface/50 p-6 text-sm text-muted">
            Δεν υπάρχουν επερχόμενοι αγώνες αυτή τη στιγμή.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl font-bold">
          TRENDING MATCHES
        </h2>
        {trendingMatches.length === 0 ? (
          <p className="text-sm text-muted">Δεν υπάρχει ακόμα κίνηση στους αγώνες.</p>
        ) : (
          <ul className="space-y-2">
            {trendingMatches.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/match/${m.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm transition hover:border-brand/40"
                >
                  <span>
                    🔥 {m.homeTeam.nameEl || m.homeTeam.name} -{" "}
                    {m.awayTeam.nameEl || m.awayTeam.name}
                    {m.isLive ? " · LIVE" : ""}
                  </span>
                  <span className="text-muted">{m.room?.memberCount ?? 0} users</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-bold">
          SOCIAL FEED
        </h2>
        {session ? <CreatePostBox /> : null}
        {feed.posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
            Ο Κουβάς είναι άδειος από posts. Πες κάτι.
          </p>
        ) : (
          feed.posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </section>
    </div>
  );
}
