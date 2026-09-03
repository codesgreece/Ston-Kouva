import { NextResponse } from "next/server";

export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return header === secret;
}

export function cronUnauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
