import Link from "next/link";
import { LiveBadge } from "@/components/ui/Badges";
import type { MatchSummary } from "@/types";

function teamLabel(team: MatchSummary["homeTeam"]) {
  return team.nameEl || team.name;
}

export function MatchCard({ match }: { match: MatchSummary }) {
  const chatting = match.room?.memberCount ?? 0;

  return (
    <article className="animate-fade-up rounded-2xl border border-border bg-surface/90 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition hover:border-brand/40">
      <div className="mb-3 flex items-center justify-between gap-2">
        {match.status === "live" ? <LiveBadge /> : (
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {match.status}
          </span>
        )}
        <span className="text-sm font-semibold text-muted">
          {match.status === "live" && match.minute != null ? `${match.minute}'` : "—"}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-right">
          <div className="text-2xl leading-none">{match.homeTeam.flagEmoji}</div>
          <div className="mt-1 text-sm font-semibold">{teamLabel(match.homeTeam)}</div>
        </div>
        <div className="text-center">
          <div className="font-[family-name:var(--font-display)] text-3xl font-black tabular-nums tracking-tight">
            {match.homeScore}
            <span className="mx-1 text-muted">-</span>
            {match.awayScore}
          </div>
        </div>
        <div className="text-left">
          <div className="text-2xl leading-none">{match.awayTeam.flagEmoji}</div>
          <div className="mt-1 text-sm font-semibold">{teamLabel(match.awayTeam)}</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          💬 {chatting > 0 ? `${chatting} στον Κουβά` : "Ο Κουβάς σε περιμένει"}
        </p>
        <Link
          href={`/match/${match.id}/room`}
          className="rounded-xl bg-brand px-3.5 py-2 text-sm font-bold text-[#1a0d00] transition hover:bg-brand-2"
        >
          Μπες στον Κουβά
        </Link>
      </div>
    </article>
  );
}

export function MatchCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="skeleton mb-3 h-4 w-20" />
      <div className="skeleton mx-auto h-10 w-40" />
      <div className="skeleton mt-4 h-9 w-full" />
    </div>
  );
}
