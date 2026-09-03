import { NextResponse } from "next/server";
import { listMatches } from "@/lib/services/matches";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 20;

  const matches = await listMatches({
    status,
    limit: Number.isFinite(limit) ? limit : 20,
  });

  return NextResponse.json({ matches });
}
