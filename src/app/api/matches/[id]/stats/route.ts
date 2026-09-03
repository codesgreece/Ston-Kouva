import { NextResponse } from "next/server";
import { cacheGetOrSet } from "@/lib/cache/memory";
import { query } from "@/lib/db";
import { getMatchById } from "@/lib/services/matches";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const match = await getMatchById(id);
  if (!match) {
    return NextResponse.json({ error: "Ο αγώνας δεν βρέθηκε" }, { status: 404 });
  }

  const stats = await cacheGetOrSet(`match:${id}:stats`, 10_000, async () => {
    const result = await query(
      `SELECT period, stat_key, home_value, away_value, updated_at
       FROM match_stats
       WHERE match_id = $1
       ORDER BY period, stat_key`,
      [id],
    );
    return result.rows;
  });

  return NextResponse.json({ stats });
}
