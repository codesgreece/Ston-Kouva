import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { getCurrentSession } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { FollowButton } from "@/components/social/FollowButton";

type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  followers_count: number;
  following_count: number;
  prediction_correct: number;
  prediction_wrong: number;
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const session = await getCurrentSession();

  const result = await query<ProfileRow>(
    `SELECT u.id, u.username, u.display_name, u.bio, u.avatar_url, u.is_verified,
            COALESCE(p.followers_count, 0) AS followers_count,
            COALESCE(p.following_count, 0) AS following_count,
            COALESCE(p.prediction_correct, 0) AS prediction_correct,
            COALESCE(p.prediction_wrong, 0) AS prediction_wrong
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE LOWER(u.username) = LOWER($1)
     LIMIT 1`,
    [username],
  );

  const profile = result.rows[0];
  if (!profile) notFound();

  const totalPred =
    profile.prediction_correct + profile.prediction_wrong;
  const accuracy =
    totalPred > 0
      ? Math.round((profile.prediction_correct / totalPred) * 100)
      : null;

  const posts = await query<{ id: string; content: string; created_at: Date }>(
    `SELECT id, content, created_at FROM posts
     WHERE user_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC LIMIT 20`,
    [profile.id],
  );

  const isSelf = session?.user.id === profile.id;

  let initiallyFollowing = false;
  if (session && !isSelf) {
    const fol = await query(
      `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [session.user.id, profile.id],
    );
    initiallyFollowing = Boolean(fol.rowCount && fol.rowCount > 0);
  }

  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-border bg-surface p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-3 text-2xl font-black text-brand">
            {profile.display_name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
              {profile.display_name}
              {profile.is_verified ? " ✓" : ""}
            </h1>
            <p className="text-sm text-muted">@{profile.username}</p>
            <p className="mt-2 text-sm">{profile.bio || "Καμία βιογραφία ακόμα."}</p>
            <div className="mt-3 flex gap-4 text-sm">
              <span>
                <strong>{profile.followers_count}</strong>{" "}
                <span className="text-muted">followers</span>
              </span>
              <span>
                <strong>{profile.following_count}</strong>{" "}
                <span className="text-muted">following</span>
              </span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {!isSelf ? (
            <>
              {session ? (
                <FollowButton
                  username={profile.username}
                  initiallyFollowing={initiallyFollowing}
                />
              ) : (
                <Link
                  href="/login"
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-[#1a0d00]"
                >
                  Follow
                </Link>
              )}
              <button
                type="button"
                className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-muted"
              >
                Message
              </button>
            </>
          ) : (
            <LogoutButton />
          )}
        </div>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          🎯 Predictions
        </h2>
        <p className="mt-2 text-sm">
          {profile.prediction_correct} correct · {profile.prediction_wrong} wrong
        </p>
        <p className="text-sm text-muted">
          Accuracy: {accuracy != null ? `${accuracy}%` : "—"}
        </p>
        <p className="mt-1 text-[11px] text-muted">
          Βασίζεται μόνο σε ολοκληρωμένες προβλέψεις.
        </p>
      </section>

      <nav className="flex gap-1 rounded-xl border border-border bg-surface p-1 text-sm">
        {["Posts", "Predictions", "Activity"].map((tab, i) => (
          <span
            key={tab}
            className={`rounded-lg px-3 py-2 font-medium ${
              i === 0 ? "bg-surface-3" : "text-muted"
            }`}
          >
            {tab}
          </span>
        ))}
      </nav>

      <section className="space-y-3">
        {posts.rows.length === 0 ? (
          <p className="text-sm text-muted">Δεν υπάρχουν posts.</p>
        ) : (
          posts.rows.map((p) => (
            <article key={p.id} className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm">{p.content}</p>
              <p className="mt-2 text-xs text-muted">
                {new Date(p.created_at).toLocaleString("el-GR")}
              </p>
            </article>
          ))
        )}
      </section>

      {!session ? (
        <p className="text-sm text-muted">
          <Link href="/login" className="text-brand-2">
            Σύνδεση
          </Link>{" "}
          για follow.
        </p>
      ) : null}
    </div>
  );
}
