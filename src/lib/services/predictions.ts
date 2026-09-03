import { query, withTransaction } from "@/lib/db";

export async function createPrediction(input: {
  userId: string;
  matchId: string;
  content: string;
  predictionType?: string;
}) {
  const content = input.content.trim();
  if (!content || content.length > 500) throw new Error("INVALID_CONTENT");
  const result = await query(
    `INSERT INTO predictions (user_id, match_id, content, prediction_type)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.userId, input.matchId, content, input.predictionType || "opinion"],
  );
  return result.rows[0];
}

export async function listPredictions(matchId: string, limit = 30) {
  const result = await query(
    `SELECT p.*, u.username, u.display_name, u.avatar_url
     FROM predictions p
     JOIN users u ON u.id = p.user_id
     WHERE p.match_id = $1
     ORDER BY (p.vote_have_it + p.vote_bucket) DESC, p.created_at DESC
     LIMIT $2`,
    [matchId, Math.min(limit, 100)],
  );
  return result.rows;
}

export async function votePrediction(
  predictionId: string,
  userId: string,
  vote: "have_it" | "bucket",
) {
  return withTransaction(async (client) => {
    const pred = await client.query<{ status: string }>(
      `SELECT status FROM predictions WHERE id = $1 FOR UPDATE`,
      [predictionId],
    );
    if (!pred.rows[0]) throw new Error("NOT_FOUND");
    if (pred.rows[0].status !== "open") throw new Error("LOCKED");

    const existing = await client.query<{ vote: string }>(
      `SELECT vote FROM prediction_votes WHERE prediction_id = $1 AND user_id = $2`,
      [predictionId, userId],
    );

    if (existing.rows[0]) {
      const prev = existing.rows[0].vote;
      if (prev === vote) return { vote };
      await client.query(
        `UPDATE prediction_votes SET vote = $3 WHERE prediction_id = $1 AND user_id = $2`,
        [predictionId, userId, vote],
      );
      if (prev === "have_it") {
        await client.query(
          `UPDATE predictions SET vote_have_it = GREATEST(vote_have_it - 1, 0), vote_bucket = vote_bucket + 1 WHERE id = $1`,
          [predictionId],
        );
      } else {
        await client.query(
          `UPDATE predictions SET vote_bucket = GREATEST(vote_bucket - 1, 0), vote_have_it = vote_have_it + 1 WHERE id = $1`,
          [predictionId],
        );
      }
      return { vote };
    }

    await client.query(
      `INSERT INTO prediction_votes (prediction_id, user_id, vote) VALUES ($1, $2, $3)`,
      [predictionId, userId, vote],
    );
    if (vote === "have_it") {
      await client.query(
        `UPDATE predictions SET vote_have_it = vote_have_it + 1 WHERE id = $1`,
        [predictionId],
      );
    } else {
      await client.query(
        `UPDATE predictions SET vote_bucket = vote_bucket + 1 WHERE id = $1`,
        [predictionId],
      );
    }
    return { vote };
  });
}

export async function resolvePrediction(
  predictionId: string,
  result: "hit" | "miss",
  resolvedBy: string,
) {
  return withTransaction(async (client) => {
    const pred = await client.query<{
      id: string;
      user_id: string;
      status: string;
    }>(`SELECT id, user_id, status FROM predictions WHERE id = $1 FOR UPDATE`, [
      predictionId,
    ]);
    if (!pred.rows[0]) throw new Error("NOT_FOUND");
    if (pred.rows[0].status === "hit" || pred.rows[0].status === "miss") {
      throw new Error("ALREADY_RESOLVED");
    }

    const status = result === "hit" ? "hit" : "miss";
    await client.query(
      `UPDATE predictions SET status = $2, resolved_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [predictionId, status],
    );
    await client.query(
      `INSERT INTO prediction_results (prediction_id, result, resolved_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (prediction_id) DO UPDATE SET result = EXCLUDED.result`,
      [predictionId, result, resolvedBy],
    );

    if (result === "hit") {
      await client.query(
        `UPDATE profiles SET prediction_correct = prediction_correct + 1, updated_at = NOW()
         WHERE user_id = $1`,
        [pred.rows[0].user_id],
      );
    } else {
      await client.query(
        `UPDATE profiles SET prediction_wrong = prediction_wrong + 1, updated_at = NOW()
         WHERE user_id = $1`,
        [pred.rows[0].user_id],
      );
    }

    // Recalc accuracy-ish reputation
    await client.query(
      `UPDATE profiles SET reputation_score = CASE
         WHEN (prediction_correct + prediction_wrong) = 0 THEN 0
         ELSE ROUND((prediction_correct::numeric / (prediction_correct + prediction_wrong)) * 100, 2)
       END
       WHERE user_id = $1`,
      [pred.rows[0].user_id],
    );

    await client.query(
      `INSERT INTO notifications (user_id, actor_id, type, title, body, link)
       VALUES ($1, $2, 'prediction_result', $3, $4, '/profile/me')`,
      [
        pred.rows[0].user_id,
        resolvedBy,
        result === "hit" ? "✅ HIT" : "🪣 ΣΤΟΝ ΚΟΥΒΑ",
        result === "hit"
          ? "Η πρόβλεψή σου βγήκε!"
          : "Η πρόβλεψη πήγε στον Κουβά.",
      ],
    );

    return { status };
  });
}

export function reputationFromCounts(correct: number, wrong: number) {
  const total = correct + wrong;
  if (total === 0) return { total: 0, accuracy: null as number | null };
  return { total, accuracy: Math.round((correct / total) * 100) };
}
