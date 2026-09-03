import { NextResponse } from "next/server";
import { getMatchById } from "@/lib/services/matches";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const match = await getMatchById(id);

  if (!match) {
    return NextResponse.json({ error: "Ο αγώνας δεν βρέθηκε" }, { status: 404 });
  }

  return NextResponse.json({ match });
}
