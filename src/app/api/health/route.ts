import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib/db";

export async function GET() {
  const db = await checkDatabaseConnection();
  return NextResponse.json({
    ok: db.ok,
    service: "ΣΤΟΝ ΚΟΥΒΑ!",
    database: db,
    timestamp: new Date().toISOString(),
  }, { status: db.ok ? 200 : 503 });
}
