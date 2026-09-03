import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  getCurrentSession,
  revokeAllUserSessions,
} from "@/lib/auth";

export async function POST() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Μη συνδεδεμένος" }, { status: 401 });
  }

  const revoked = await revokeAllUserSessions(session.user.id);
  const response = NextResponse.json({ ok: true, revoked });
  clearSessionCookie(response);
  return response;
}
