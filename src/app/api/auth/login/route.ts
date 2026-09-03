import { NextResponse } from "next/server";
import {
  attachSessionCookie,
  clientIpFromHeaders,
  createSession,
  findUserByLogin,
  rateLimit,
  toPublicUser,
  verifyPassword,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit({
    key: `login:${ip}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Πολλές προσπάθειες. Δοκίμασε σε λίγο." },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Μη έγκυρα δεδομένα",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const userRow = await findUserByLogin(parsed.data.login);
  if (!userRow) {
    return NextResponse.json(
      { error: "Λάθος στοιχεία σύνδεσης" },
      { status: 401 },
    );
  }

  if (userRow.is_banned) {
    return NextResponse.json(
      { error: "Ο λογαριασμός έχει αποκλειστεί" },
      { status: 403 },
    );
  }

  const valid = await verifyPassword(parsed.data.password, userRow.password_hash);
  if (!valid) {
    return NextResponse.json(
      { error: "Λάθος στοιχεία σύνδεσης" },
      { status: 401 },
    );
  }

  const user = toPublicUser(userRow);
  const session = await createSession({
    userId: user.id,
    userAgent: request.headers.get("user-agent"),
    ipAddress: ip === "unknown" ? null : ip,
  });

  const response = NextResponse.json({
    user,
    csrfToken: session.csrfToken,
  });
  attachSessionCookie(response, session.token, session.expiresAt);
  return response;
}
