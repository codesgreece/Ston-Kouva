import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { cacheGetOrSet } from "@/lib/cache/memory";
import { query } from "@/lib/db";

export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user.isAdmin) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  const metrics = await cacheGetOrSet("admin:metrics", 10_000, async () => {
    const [users, live, rooms, postsToday, reports, messagesToday] =
      await Promise.all([
        query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM users`),
        query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM matches WHERE status = 'live'`,
        ),
        query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM match_rooms WHERE status = 'open'`,
        ),
        query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM posts WHERE created_at::date = CURRENT_DATE`,
        ),
        query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM reports WHERE status = 'pending'`,
        ),
        query<{ c: string }>(
          `SELECT COUNT(*)::text AS c FROM messages WHERE created_at::date = CURRENT_DATE`,
        ),
      ]);

    return {
      totalUsers: Number(users.rows[0]?.c ?? 0),
      liveMatches: Number(live.rows[0]?.c ?? 0),
      activeRooms: Number(rooms.rows[0]?.c ?? 0),
      postsToday: Number(postsToday.rows[0]?.c ?? 0),
      pendingReports: Number(reports.rows[0]?.c ?? 0),
      messagesToday: Number(messagesToday.rows[0]?.c ?? 0),
    };
  });

  return NextResponse.json({ metrics });
}
