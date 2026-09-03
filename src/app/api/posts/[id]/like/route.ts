import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { toggleLike } from "@/lib/services/social";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await toggleLike(id, session.user.id);
  return NextResponse.json(result);
}
