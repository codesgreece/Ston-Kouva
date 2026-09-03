import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";

const readSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().uuid()).min(1) }),
]);

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = readSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρα δεδομένα" }, { status: 400 });
  }

  if ("all" in parsed.data) {
    await query(
      `UPDATE notifications SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE`,
      [session.user.id],
    );
    return NextResponse.json({ ok: true, marked: "all" });
  }

  await query(
    `UPDATE notifications SET is_read = TRUE
     WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [session.user.id, parsed.data.ids],
  );

  return NextResponse.json({ ok: true, marked: parsed.data.ids.length });
}
