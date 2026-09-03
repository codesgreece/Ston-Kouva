import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import {
  banUserInRoom,
  muteUserInRoom,
  softDeleteMessage,
} from "@/lib/services/moderation";

const moderationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mute"),
    roomId: z.string().uuid(),
    userId: z.string().uuid(),
    minutes: z.number().int().positive().max(10_080).default(60),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("ban"),
    roomId: z.string().uuid(),
    userId: z.string().uuid(),
    permanent: z.boolean().optional(),
    hours: z.number().int().positive().max(8760).optional(),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal("delete"),
    messageId: z.string().uuid(),
  }),
]);

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου" }, { status: 401 });
  }

  if (!session.user.isAdmin && !session.user.isModerator) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = moderationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  }

  switch (parsed.data.action) {
    case "mute": {
      const result = await muteUserInRoom({
        roomId: parsed.data.roomId,
        userId: parsed.data.userId,
        mutedBy: session.user.id,
        minutes: parsed.data.minutes,
        reason: parsed.data.reason,
      });
      return NextResponse.json(result);
    }
    case "ban": {
      const result = await banUserInRoom({
        roomId: parsed.data.roomId,
        userId: parsed.data.userId,
        bannedBy: session.user.id,
        permanent: parsed.data.permanent,
        hours: parsed.data.hours,
        reason: parsed.data.reason,
      });
      return NextResponse.json(result);
    }
    case "delete": {
      await softDeleteMessage(parsed.data.messageId, session.user.id);
      return NextResponse.json({ ok: true });
    }
  }
}
