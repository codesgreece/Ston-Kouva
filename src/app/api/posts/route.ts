import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clientIpFromHeaders,
  getCurrentSession,
  rateLimit,
} from "@/lib/auth";
import { cacheGetOrSet } from "@/lib/cache/memory";
import { createPost, listFeed } from "@/lib/services/social";

const createPostSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  postType: z.string().max(40).optional(),
  matchId: z.string().uuid().optional().nullable(),
  mediaUrl: z.string().url().max(2000).optional().nullable(),
});

export async function GET(request: Request) {
  const session = await getCurrentSession();
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const matchId = searchParams.get("matchId");
  const limit = Math.min(Number(searchParams.get("limit") || 20), 50);

  const params = {
    limit,
    cursor: cursor || null,
    userId: session?.user.id ?? null,
    matchId: matchId || null,
  };

  const useCache = !session && !cursor && !matchId;
  const result = useCache
    ? await cacheGetOrSet("feed:home", 15_000, () => listFeed({ limit: 20 }))
    : await listFeed(params);

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου για να δημοσιεύσεις" }, { status: 401 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit({
    key: `post:${session.user.id}:${ip}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: "Πολύ γρήγορα — περίμενε λίγο" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = createPostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  }

  try {
    const post = await createPost({
      userId: session.user.id,
      content: parsed.data.content,
      postType: parsed.data.postType,
      matchId: parsed.data.matchId ?? null,
      mediaUrl: parsed.data.mediaUrl ?? null,
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CONTENT") {
      return NextResponse.json({ error: "Μη έγκυρο περιεχόμενο" }, { status: 400 });
    }
    throw err;
  }
}
