import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/auth";
import { resolvePrediction } from "@/lib/services/predictions";

const resolveSchema = z.object({
  result: z.enum(["hit", "miss"]),
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

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Μη έγκυρο JSON" }, { status: 400 });
  }

  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Μη έγκυρο αποτέλεσμα" }, { status: 400 });
  }

  try {
    const result = await resolvePrediction(
      id,
      parsed.data.result,
      session.user.id,
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "NOT_FOUND") {
        return NextResponse.json({ error: "Η πρόβλεψη δεν βρέθηκε" }, { status: 404 });
      }
      if (err.message === "ALREADY_RESOLVED") {
        return NextResponse.json({ error: "Η πρόβλεψη έχει ήδη κριθεί" }, { status: 409 });
      }
    }
    throw err;
  }
}
