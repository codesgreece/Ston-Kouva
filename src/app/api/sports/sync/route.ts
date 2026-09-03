import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { syncLiveMatches } from "@/lib/sports";

function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

export async function GET() {
  const result = await query(
    `SELECT sync_key, last_success_at, last_attempt_at, last_error, metadata
     FROM sports_sync_state
     ORDER BY sync_key`,
  );
  return NextResponse.json({ syncState: result.rows });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  const cronOk = isCronAuthorized(request);
  const modOk =
    session?.user.isAdmin || session?.user.isModerator;

  if (!cronOk && !modOk) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  try {
    const result = await syncLiveMatches();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
