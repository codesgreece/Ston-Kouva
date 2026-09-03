import { NextResponse } from "next/server";
import { getSportsHealth } from "@/lib/sports/health";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await getSportsHealth();
    return NextResponse.json(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Health check failed";
    return NextResponse.json({ status: "ERROR", error: message }, { status: 500 });
  }
}
