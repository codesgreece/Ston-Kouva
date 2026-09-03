import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import {
  listPendingReports,
  resolveReport,
} from "@/lib/services/moderation";

const resolveSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["resolved", "dismissed"]),
});

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user.isAdmin && !session?.user.isModerator) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit") || 50), 100);
  const reports = await listPendingReports(limit);
  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session?.user.isAdmin && !session?.user.isModerator) {
    return NextResponse.json({ error: "Δεν επιτρέπεται" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  }

  await resolveReport(
    parsed.data.reportId,
    session.user.id,
    parsed.data.status,
  );

  return NextResponse.json({ ok: true });
}
