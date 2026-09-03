import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { votePrediction } from "@/lib/services/predictions";

const voteSchema = z.object({
  vote: z.enum(["have_it", "bucket"]),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Συνδέσου για να ψηφίσεις" }, { status: 401 });
  }

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = voteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρη ψήφος" }, { status: 400 });
  }

  try {
    const result = await votePrediction(id, session.user.id, parsed.data.vote);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Η πρόβλεψη δεν βρέθηκε" }, { status: 404 });
      }
      if (err.message === "LOCKED") {
        return NextResponse.json({ error: "Η πρόβλεψη είναι κλειδωμένη" }, { status: 409 });
      }
    }
    throw err;
  }
}
