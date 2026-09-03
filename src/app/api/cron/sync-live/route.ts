import { NextResponse } from "next/server";
import { isCronAuthorized, cronUnauthorized } from "@/lib/cron-auth";
import { syncLiveEvents } from "@/lib/sports";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) return cronUnauthorized();

  try {
    const result = await syncLiveEvents("football");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
