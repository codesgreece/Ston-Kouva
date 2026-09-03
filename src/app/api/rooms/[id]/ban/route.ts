import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { banUserInRoom } from "@/lib/services/moderation";

const banSchema = z.object({
  userId: z.string().uuid(),
  permanent: z.boolean().optional(),
  hours: z.number().int().positive().max(8760).optional(),
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

  const parsed = banSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  }

  const result = await banUserInRoom({
    roomId,
    userId: parsed.data.userId,
    bannedBy: session.user.id,
    permanent: parsed.data.permanent,
    hours: parsed.data.hours,
    reason: parsed.data.reason,
  });

  return NextResponse.json(result);
}
