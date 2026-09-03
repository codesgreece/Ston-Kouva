import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clientIpFromHeaders,
  getCurrentSession,
  rateLimit,
} from "@/lib/auth";
import { addComment, listComments } from "@/lib/services/social";

const commentSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  parentId: z.string().uuid().optional().nullable(),
});

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
  const comments = await listComments(id, limit);
  return NextResponse.json({ comments });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου για να σχολιάσεις" }, { status: 401 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit({
    key: `comment:${session.user.id}:${ip}`,
    limit: 30,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: "Πολύ γρήγορα — περίμενε λίγο" }, { status: 429 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρο σχόλιο" }, { status: 400 });
  }

  try {
    const comment = await addComment({
      postId: id,
      userId: session.user.id,
      content: parsed.data.content,
      parentId: parsed.data.parentId ?? null,
    });
    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CONTENT") {
      return NextResponse.json({ error: "Μη έγκυρο σχόλιο" }, { status: 400 });
    }
    throw err;
  }
}
