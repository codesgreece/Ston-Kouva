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

  const events = await cacheGetOrSet(`match:${id}:events`, 10_000, async () => {
    const result = await query(
      `SELECT id, event_type, minute, extra_minute, team_side,
              player_name, assist_name, description, created_at
       FROM match_events
       WHERE match_id = $1
       ORDER BY minute ASC NULLS LAST, created_at ASC
       LIMIT 100`,
      [id],
    );
    return result.rows;
  });

  return NextResponse.json({ events });
}
