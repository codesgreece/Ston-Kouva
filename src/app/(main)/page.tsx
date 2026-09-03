import Link from "next/link";
import { MatchCard } from "@/components/matches/MatchCard";
import { BucketReaction } from "@/components/ui/Badges";
import { listMatches } from "@/lib/services/matches";
import { query } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";

type FeedPost = {
  id: string;
  content: string;
  created_at: Date;
  username: string;
  display_name: string;
  avatar_url: string | null;
  like_count: number;
  comment_count: number;
  match_id: string | null;
};

async function getFeedPosts(): Promise<FeedPost[]> {
  try {
    const result = await query<FeedPost>(
      `SELECT p.id, p.content, p.created_at, p.like_count, p.comment_count, p.match_id,
              u.username, u.display_name, u.avatar_url
       FROM posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.deleted_at IS NULL
       ORDER BY p.created_at DESC
       LIMIT 20`,
    );
    return result.rows;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const session = await getCurrentSession();
  let liveMatches: Awaited<ReturnType<typeof listMatches>> = [];
  try {
    liveMatches = await listMatches({ status: "live", limit: 6 });
  } catch {
    liveMatches = [];
  }
  const posts = await getFeedPosts();

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
            Δεν παίζει τίποτα τώρα. Για λίγο η μπάλα μας άφησε ήσυχους.
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
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl font-bold">
          TRENDING
        </h2>
        {liveMatches.length === 0 ? (
          <p className="text-sm text-muted">Δεν υπάρχει ακόμα κίνηση στους αγώνες.</p>
        ) : (
          <ul className="space-y-2">
            {liveMatches.slice(0, 3).map((m) => (
              <li key={m.id}>
                <Link
                  href={`/match/${m.id}`}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm transition hover:border-brand/40"
                >
                  <span>
                    🔥 {m.homeTeam.flagEmoji} {m.homeTeam.nameEl || m.homeTeam.name} -{" "}
                    {m.awayTeam.flagEmoji} {m.awayTeam.nameEl || m.awayTeam.name}
                  </span>
                  <span className="text-muted">
                    {m.room?.memberCount ?? 0} users
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-[family-name:var(--font-display)] text-xl font-bold">
          SOCIAL FEED
        </h2>
        {posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
            Ο Κουβάς είναι άδειος από posts. Πες κάτι.
          </p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <article
                key={post.id}
                className="animate-fade-up rounded-2xl border border-border bg-surface p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-3 text-sm font-bold text-brand">
                    {post.display_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">@{post.username}</p>
                    <p className="text-xs text-muted">
                      {new Date(post.created_at).toLocaleString("el-GR")}
                    </p>
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span>❤️ {post.like_count}</span>
                  <span>💬 {post.comment_count}</span>
                  <BucketReaction />
                  <span>↗ Share</span>
                  <span>🔖</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
