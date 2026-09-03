import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { reputationFromCounts } from "@/lib/services/predictions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const { username } = await context.params;
  const session = await getCurrentSession();

  const result = await query<{
    id: string;
    username: string;
    display_name: string;
    bio: string | null;
    avatar_url: string | null;
    is_verified: boolean;
    created_at: Date;
    followers_count: number;
    following_count: number;
    posts_count: number;
    prediction_correct: number;
    prediction_wrong: number;
    reputation_score: string;
  }>(
    `SELECT u.id, u.username, u.display_name, u.bio, u.avatar_url, u.is_verified,
            u.created_at,
            COALESCE(p.followers_count, 0) AS followers_count,
            COALESCE(p.following_count, 0) AS following_count,
            COALESCE(p.posts_count, 0) AS posts_count,
            COALESCE(p.prediction_correct, 0) AS prediction_correct,
            COALESCE(p.prediction_wrong, 0) AS prediction_wrong,
            COALESCE(p.reputation_score, 0) AS reputation_score
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE LOWER(u.username) = LOWER($1) AND u.is_banned = FALSE
     LIMIT 1`,
    [username],
  );

  const row = result.rows[0];
  if (!row) {
    return NextResponse.json({ error: "Ο χρήστης δεν βρέθηκε" }, { status: 404 });
  }

  let followingByMe = false;
  if (session && session.user.id !== row.id) {
    const follow = await query(
      `SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [session.user.id, row.id],
    );
    followingByMe = (follow.rowCount ?? 0) > 0;
  }

  const reputation = reputationFromCounts(
    row.prediction_correct,
    row.prediction_wrong,
  );

  return NextResponse.json({
    user: {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      isVerified: row.is_verified,
      createdAt: row.created_at.toISOString(),
      followersCount: row.followers_count,
      followingCount: row.following_count,
      postsCount: row.posts_count,
      followingByMe,
      isSelf: session?.user.id === row.id,
    },
    reputation: {
      ...reputation,
      score: Number(row.reputation_score),
      correct: row.prediction_correct,
      wrong: row.prediction_wrong,
    },
  });
}
