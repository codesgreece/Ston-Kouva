import Link from "next/link";
import { LiveBadge } from "@/components/ui/Badges";
import { BucketReaction } from "@/components/ui/Badges";
import { getMatchById } from "@/lib/services/matches";
import { query } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const match = await getMatchById(id);
  if (!match) notFound();

  let lastSyncLabel = "—";
  if (match.lastSyncedAt) {
    const sec = Math.max(
      0,
      Math.floor((Date.now() - new Date(match.lastSyncedAt).getTime()) / 1000),
    );
    lastSyncLabel = `Τελευταία ενημέρωση πριν από ${sec} sec`;
  }

  let events: { id: string; event_type: string; minute: number | null; description: string | null }[] = [];
  try {
    const result = await query<{
      id: string;
      event_type: string;
      minute: number | null;
      description: string | null;
    }>(
      `SELECT id, event_type, minute, description
       FROM match_events WHERE match_id = $1
       ORDER BY minute ASC NULLS LAST, created_at ASC
       LIMIT 50`,
      [id],
    );
    events = result.rows;
  } catch {
    events = [];
  }

  const home = match.homeTeam.nameEl || match.homeTeam.name;
  const away = match.awayTeam.nameEl || match.awayTeam.name;

  return (
    <div className="space-y-4">
      <header className="rounded-3xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          {match.status === "live" ? <LiveBadge /> : (
            <span className="text-xs uppercase text-muted">{match.status}</span>
          )}
          <span className="text-sm font-semibold text-muted">
            {match.minute != null ? `${match.minute}'` : ""}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <div>
            <div className="text-3xl">{match.homeTeam.flagEmoji}</div>
            <div className="mt-1 font-semibold">{home}</div>
          </div>
          <div className="font-[family-name:var(--font-display)] text-4xl font-black tabular-nums">
            {match.homeScore}
            <span className="mx-1 text-muted">-</span>
            {match.awayScore}
          </div>
          <div>
            <div className="text-3xl">{match.awayTeam.flagEmoji}</div>
            <div className="mt-1 font-semibold">{away}</div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted">{lastSyncLabel}</p>
        <div className="mt-4 flex justify-center">
          <Link
            href={`/match/${id}/room`}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-[#1a0d00] hover:bg-brand-2"
          >
            Μπες στον Κουβά
          </Link>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto no-scrollbar rounded-xl border border-border bg-surface p-1 text-sm">
        {["Overview", "Chat", "Predictions", "Stats"].map((tab) => {
          const href =
            tab === "Chat"
              ? `/match/${id}/room`
              : tab === "Overview"
                ? `/match/${id}`
                : `/match/${id}?tab=${tab.toLowerCase()}`;
          const active = tab === "Overview";
          return (
            <Link
              key={tab}
              href={href}
              className={`shrink-0 rounded-lg px-3 py-2 font-medium ${
                active ? "bg-surface-3 text-text" : "text-muted hover:text-text"
              }`}
            >
              {tab}
            </Link>
          );
        })}
      </nav>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Overview
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted">Δεν υπάρχουν events ακόμα.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm"
              >
                <span className="w-10 tabular-nums text-muted">
                  {ev.minute != null ? `${ev.minute}'` : "—"}
                </span>
                <span className="font-medium">{ev.event_type}</span>
                <span className="text-muted">{ev.description}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
          Predictions
        </h2>
        <p className="mb-3 text-sm text-muted">
          Κανείς δεν ρίσκαρε ακόμα. Ύποπτα ήρεμα.
        </p>
        <div className="rounded-xl border border-dashed border-border p-4">
          <p className="text-xs font-bold text-brand">🎯 ΠΡΟΒΛΕΨΗ</p>
          <p className="mt-1 text-sm">«{home} να σκοράρει επόμενο»</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-surface-2 px-2 py-1">🔥 Το έχω</span>
            <BucketReaction count={0} />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Social prediction — όχι χρηματική συμβουλή.
          </p>
        </div>
      </section>
    </div>
  );
}
