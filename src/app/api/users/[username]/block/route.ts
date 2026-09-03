import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { blockUser } from "@/lib/services/moderation";

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
    const result = await blockUser(session.user.id, username);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Ο χρήστης δεν βρέθηκε" }, { status: 404 });
    }
    throw err;
  }
}
