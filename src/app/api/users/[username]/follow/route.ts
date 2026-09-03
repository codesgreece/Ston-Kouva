import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { toggleFollow } from "@/lib/services/social";

export async function POST(
  _request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου" }, { status: 401 });
  }

  const { username } = await context.params;

  try {
    const result = await toggleFollow(session.user.id, username);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Ο χρήστης δεν βρέθηκε" }, { status: 404 });
      }
      if (err.message === "SELF") {
        return NextResponse.json({ error: "Δεν μπορείς να ακολουθήσεις τον εαυτό σου" }, { status: 400 });
      }
    }
    throw err;
  }
}
