import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";

const reactionSchema = z.object({
  reaction: z.string().trim().min(1).max(32),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; messageId: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου" }, { status: 401 });
  }

  const { id: roomId, messageId } = await context.params;

  const message = await query<{ room_id: string }>(
    `SELECT room_id FROM messages WHERE id = $1 AND deleted_at IS NULL`,
    [messageId],
  );
  if (!message.rows[0] || message.rows[0].room_id !== roomId) {
    return NextResponse.json({ error: "Το μήνυμα δεν βρέθηκε" }, { status: 404 });
  }

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

  const existing = await query(
    `SELECT id FROM message_reactions
     WHERE message_id = $1 AND user_id = $2 AND reaction = $3`,
    [messageId, session.user.id, parsed.data.reaction],
  );

  if (existing.rowCount && existing.rowCount > 0) {
    await query(
      `DELETE FROM message_reactions
       WHERE message_id = $1 AND user_id = $2 AND reaction = $3`,
      [messageId, session.user.id, parsed.data.reaction],
    );
    return NextResponse.json({ reacted: false });
  }

  await query(
    `INSERT INTO message_reactions (message_id, user_id, reaction)
     VALUES ($1, $2, $3)`,
    [messageId, session.user.id, parsed.data.reaction],
  );

  return NextResponse.json({ reacted: true });
}
