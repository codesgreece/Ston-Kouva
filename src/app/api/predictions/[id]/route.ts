import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const session = await getCurrentSession();

  const result = await query(
    `SELECT p.*, u.username, u.display_name, u.avatar_url
     FROM predictions p
     JOIN users u ON u.id = p.user_id
     WHERE p.id = $1
     LIMIT 1`,
    [id],
  );

  const prediction = result.rows[0];
  if (!prediction) {
    return NextResponse.json({ error: "Η πρόβλεψη δεν βρέθηκε" }, { status: 404 });
  }

  let myVote: string | null = null;
  if (session) {
    const vote = await query<{ vote: string }>(
      `SELECT vote FROM prediction_votes WHERE prediction_id = $1 AND user_id = $2`,
      [id, session.user.id],
    );
    myVote = vote.rows[0]?.vote ?? null;
  }

  return NextResponse.json({ prediction, myVote });
}
