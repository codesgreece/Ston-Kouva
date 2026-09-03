import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { muteUserInRoom } from "@/lib/services/moderation";

const muteSchema = z.object({
  userId: z.string().uuid(),
  minutes: z.number().int().positive().max(10_080).default(60),
  reason: z.string().max(500).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου" }, { status: 401 });
  }

  if (!session.user.isAdmin && !session.user.isModerator) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  const { id: roomId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = muteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  }

  const result = await muteUserInRoom({
    roomId,
    userId: parsed.data.userId,
    mutedBy: session.user.id,
    minutes: parsed.data.minutes,
    reason: parsed.data.reason,
  });

  return NextResponse.json(result);
}
