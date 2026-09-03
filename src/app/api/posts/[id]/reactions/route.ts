import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { reactToPost } from "@/lib/services/social";

const reactionSchema = z.object({
  reaction: z.enum(["like", "fire", "laugh", "bucket"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = reactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρη αντίδραση" }, { status: 400 });
  }

  const result = await reactToPost(id, session.user.id, parsed.data.reaction);
  return NextResponse.json(result);
}
