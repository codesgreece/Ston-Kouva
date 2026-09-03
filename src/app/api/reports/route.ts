import { NextResponse } from "next/server";
import { z } from "zod";
import {
  clientIpFromHeaders,
  getCurrentSession,
  rateLimit,
} from "@/lib/auth";
import {
  createReport,
  isValidReportCategory,
} from "@/lib/services/moderation";

const reportSchema = z.object({
  targetType: z.enum(["user", "post", "comment", "message"]),
  targetId: z.string().uuid(),
  category: z.string().min(1).max(40),
  reason: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου" }, { status: 401 });
  }

  const ip = clientIpFromHeaders(request.headers);
  const limited = rateLimit({
    key: `report:${session.user.id}:${ip}`,
    limit: 10,
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

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  }

  if (!isValidReportCategory(parsed.data.category)) {
    return NextResponse.json({ error: "Μη έγκυρη κατηγορία" }, { status: 400 });
  }

  const report = await createReport({
    reporterId: session.user.id,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    category: parsed.data.category,
    reason: parsed.data.reason,
  });

  return NextResponse.json({ report }, { status: 201 });
}
