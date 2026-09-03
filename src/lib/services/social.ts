import { query, withTransaction } from "@/lib/db";
import { cacheDel, cacheGetOrSet } from "@/lib/cache/memory";

export type FeedPost = {
  id: string;
  content: string;
  postType: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  reactionCount: number;
  matchId: string | null;
  mediaUrl: string | null;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  likedByMe?: boolean;
  bookmarkedByMe?: boolean;
};

const MAX_POST_LEN = 4000;

export async function listFeed(params: {
  limit?: number;
  cursor?: string | null;
  userId?: string | null;
  matchId?: string | null;
}): Promise<{ posts: FeedPost[]; nextCursor: string | null }> {
  const limit = Math.min(params.limit ?? 20, 50);
  const values: unknown[] = [];
  const where: string[] = ["p.deleted_at IS NULL"];

  if (params.matchId) {
    values.push(params.matchId);
    where.push(`p.match_id = $${values.length}`);
  }
  if (params.cursor) {
    values.push(params.cursor);
    where.push(`p.created_at < $${values.length}`);
  }

  values.push(limit + 1);
  const rows = await query<{
    id: string;
    content: string;
    post_type: string;
    created_at: Date;
    like_count: number;
    comment_count: number;
    reaction_count: number;
    match_id: string | null;
    media_url: string | null;
    user_id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  }>(
    `SELECT p.id, p.content, p.post_type, p.created_at, p.like_count, p.comment_count,
            p.reaction_count, p.match_id, p.media_url,
            u.id AS user_id, u.username, u.display_name, u.avatar_url
     FROM posts p
     JOIN users u ON u.id = p.user_id
     WHERE ${where.join(" AND ")}
     ORDER BY p.created_at DESC
     LIMIT $${values.length}`,
    values,
  );

  const slice = rows.rows.slice(0, limit);
  const nextCursor =
    rows.rows.length > limit
      ? slice[slice.length - 1]?.created_at.toISOString() ?? null
      : null;

  let liked = new Set<string>();
  let bookmarked = new Set<string>();
  if (params.userId && slice.length) {
    const ids = slice.map((p) => p.id);
    const likes = await query<{ post_id: string }>(
      `SELECT post_id FROM post_likes WHERE user_id = $1 AND post_id = ANY($2::uuid[])`,
      [params.userId, ids],
    );
    liked = new Set(likes.rows.map((r) => r.post_id));
    const bms = await query<{ post_id: string }>(
      `SELECT post_id FROM bookmarks WHERE user_id = $1 AND post_id = ANY($2::uuid[])`,
      [params.userId, ids],
    );
    bookmarked = new Set(bms.rows.map((r) => r.post_id));
  }

  return {
    posts: slice.map((p) => ({
      id: p.id,
      content: p.content,
      postType: p.post_type,
      createdAt: p.created_at.toISOString(),
      likeCount: p.like_count,
      commentCount: p.comment_count,
      reactionCount: p.reaction_count,
      matchId: p.match_id,
      mediaUrl: p.media_url,
      user: {
        id: p.user_id,
        username: p.username,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
      },
      likedByMe: liked.has(p.id),
      bookmarkedByMe: bookmarked.has(p.id),
    })),
    nextCursor,
  };
}

export async function createPost(input: {
  userId: string;
  content: string;
  postType?: string;
  matchId?: string | null;
  mediaUrl?: string | null;
}) {
  const content = input.content.trim();
  if (!content || content.length > MAX_POST_LEN) {
    throw new Error("INVALID_CONTENT");
  }
  const postType = input.postType || (input.matchId ? "MATCH" : "TEXT");
  const result = await query(
    `INSERT INTO posts (user_id, post_type, content, match_id, media_url)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [input.userId, postType, content, input.matchId ?? null, input.mediaUrl ?? null],
  );
  await query(
    `UPDATE profiles SET posts_count = posts_count + 1, updated_at = NOW() WHERE user_id = $1`,
    [input.userId],
  );
  cacheDel("feed:home");
  return result.rows[0];
}

export async function toggleLike(postId: string, userId: string) {
  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2`,
      [postId, userId],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      await client.query(`DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2`, [
        postId,
        userId,
      ]);
      await client.query(
        `UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1`,
        [postId],
      );
      return { liked: false };
    }
    await client.query(
      `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)`,
      [postId, userId],
    );
    await client.query(`UPDATE posts SET like_count = like_count + 1 WHERE id = $1`, [
      postId,
    ]);

    const owner = await client.query<{ user_id: string }>(
      `SELECT user_id FROM posts WHERE id = $1`,
      [postId],
    );
    if (owner.rows[0] && owner.rows[0].user_id !== userId) {
      await client.query(
        `INSERT INTO notifications (user_id, actor_id, type, title, body, link)
         VALUES ($1, $2, 'like', 'Νέο like', 'Κάποιος έκανε like στο post σου', $3)`,
        [owner.rows[0].user_id, userId, `/`],
      );
    }
    return { liked: true };
  });
}

export async function addComment(input: {
  postId: string;
  userId: string;
  content: string;
  parentId?: string | null;
}) {
  const content = input.content.trim();
  if (!content || content.length > 2000) throw new Error("INVALID_CONTENT");
  const result = await query(
    `INSERT INTO comments (post_id, user_id, parent_id, content)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at`,
    [input.postId, input.userId, input.parentId ?? null, content],
  );
  await query(
    `UPDATE posts SET comment_count = comment_count + 1 WHERE id = $1`,
    [input.postId],
  );
  return result.rows[0];
}

export async function listComments(postId: string, limit = 50) {
  const result = await query(
    `SELECT c.id, c.content, c.created_at, c.parent_id, c.like_count,
            u.username, u.display_name, u.avatar_url, u.id AS user_id
     FROM comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.post_id = $1 AND c.deleted_at IS NULL
     ORDER BY c.created_at ASC
     LIMIT $2`,
    [postId, Math.min(limit, 100)],
  );
  return result.rows;
}

export async function toggleFollow(followerId: string, followingUsername: string) {
  const target = await query<{ id: string }>(
    `SELECT id FROM users WHERE LOWER(username) = LOWER($1)`,
    [followingUsername],
  );
  const followingId = target.rows[0]?.id;
  if (!followingId) throw new Error("NOT_FOUND");
  if (followingId === followerId) throw new Error("SELF");

  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id FROM follows WHERE follower_id = $1 AND following_id = $2`,
      [followerId, followingId],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      await client.query(
        `DELETE FROM follows WHERE follower_id = $1 AND following_id = $2`,
        [followerId, followingId],
      );
      await client.query(
        `UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE user_id = $1`,
        [followerId],
      );
      await client.query(
        `UPDATE profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE user_id = $1`,
        [followingId],
      );
      return { following: false };
    }
    await client.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)`,
      [followerId, followingId],
    );
    await client.query(
      `UPDATE profiles SET following_count = following_count + 1 WHERE user_id = $1`,
      [followerId],
    );
    await client.query(
      `UPDATE profiles SET followers_count = followers_count + 1 WHERE user_id = $1`,
      [followingId],
    );
    await client.query(
      `INSERT INTO notifications (user_id, actor_id, type, title, body, link)
       VALUES ($1, $2, 'follow', 'Νέος follower', 'Κάποιος σε ακολούθησε', $3)`,
      [followingId, followerId, `/profile/${followingUsername}`],
    );
    return { following: true };
  });
}

export async function toggleBookmark(postId: string, userId: string) {
  const existing = await query(
    `SELECT id FROM bookmarks WHERE post_id = $1 AND user_id = $2`,
    [postId, userId],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    await query(`DELETE FROM bookmarks WHERE post_id = $1 AND user_id = $2`, [
      postId,
      userId,
    ]);
    await query(
      `UPDATE posts SET bookmark_count = GREATEST(bookmark_count - 1, 0) WHERE id = $1`,
      [postId],
    );
    return { bookmarked: false };
  }
  await query(`INSERT INTO bookmarks (user_id, post_id) VALUES ($1, $2)`, [
    userId,
    postId,
  ]);
  await query(`UPDATE posts SET bookmark_count = bookmark_count + 1 WHERE id = $1`, [
    postId,
  ]);
  return { bookmarked: true };
}

export async function reactToPost(
  postId: string,
  userId: string,
  reaction: "like" | "fire" | "laugh" | "bucket",
) {
  const existing = await query(
    `SELECT id FROM post_reactions WHERE post_id = $1 AND user_id = $2 AND reaction = $3`,
    [postId, userId, reaction],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    await query(
      `DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2 AND reaction = $3`,
      [postId, userId, reaction],
    );
    await query(
      `UPDATE posts SET reaction_count = GREATEST(reaction_count - 1, 0) WHERE id = $1`,
      [postId],
    );
    return { reacted: false };
  }
  await query(
    `INSERT INTO post_reactions (post_id, user_id, reaction) VALUES ($1, $2, $3)`,
    [postId, userId, reaction],
  );
  await query(`UPDATE posts SET reaction_count = reaction_count + 1 WHERE id = $1`, [
    postId,
  ]);
  return { reacted: true };
}

export async function getCachedHomeFeed(userId?: string | null) {
  if (userId) return listFeed({ limit: 20, userId });
  return cacheGetOrSet("feed:home", 15_000, () => listFeed({ limit: 20 }));
}
