import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSportsHealth } from "@/lib/sports/health";
import {
  syncLiveEvents,
  syncScheduledEvents,
  syncUpcomingWindow,
  athensDateIso,
  addDays,
} from "@/lib/sports";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentSession();
  if (!session?.user.isAdmin && !session?.user.isModerator) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  const health = await getSportsHealth();
  return NextResponse.json(health);
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  const cronOk = isCronAuthorized(request);
  const modOk = session?.user.isAdmin || session?.user.isModerator;

  if (!cronOk && !modOk) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action = body.action || "live";

  try {
    if (action === "today") {
      const result = await syncScheduledEvents(athensDateIso(), "football");
      return NextResponse.json({ ok: true, action, ...result });
    }
    if (action === "tomorrow") {
      const tomorrow = athensDateIso(addDays(new Date(), 1));
      const result = await syncScheduledEvents(tomorrow, "football");
      return NextResponse.json({ ok: true, action, ...result });
    }
    if (action === "window") {
      const result = await syncUpcomingWindow(7, "football");
      return NextResponse.json({ ok: true, action, ...result });
    }
    const result = await syncLiveEvents("football");
    return NextResponse.json({ ok: true, action: "live", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
