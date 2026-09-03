import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clientIpFromHeaders,
  getCurrentSession,
  rateLimit,
} from "@/lib/auth";
import { cacheGetOrSet } from "@/lib/cache/memory";
import {
  createPrediction,
  listPredictions,
} from "@/lib/services/predictions";

const createPredictionSchema = z.object({
  matchId: z.string().uuid(),
  content: z.string().trim().min(1).max(500),
  predictionType: z.string().max(40).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("matchId");
  if (!matchId) {
    return NextResponse.json({ error: "matchId απαιτείται" }, { status: 400 });
  }

  const limit = Math.min(Number(searchParams.get("limit") || 30), 100);
  const predictions = await cacheGetOrSet(
    `predictions:${matchId}:${limit}`,
    10_000,
    () => listPredictions(matchId, limit),
  );

  return NextResponse.json({ predictions });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου για πρόβλεψη" }, { status: 401 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit({
    key: `prediction:${session.user.id}:${ip}`,
    limit: 15,
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

  const parsed = createPredictionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  }

  try {
    const prediction = await createPrediction({
      userId: session.user.id,
      matchId: parsed.data.matchId,
      content: parsed.data.content,
      predictionType: parsed.data.predictionType,
    });
    return NextResponse.json({ prediction }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message === "INVALID_CONTENT") {
      return NextResponse.json({ error: "Μη έγκυρο περιεχόμενο" }, { status: 400 });
    }
    throw err;
  }
}
