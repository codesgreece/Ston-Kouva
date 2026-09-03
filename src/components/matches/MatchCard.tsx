import Link from "next/link";
import { LiveBadge } from "@/components/ui/Badges";
import { formatMatchTime } from "@/lib/sports/date-utils";
import { statusLabel, isDisplayLive } from "@/lib/sports/status-mapper";
import type { MatchSummary } from "@/types";

function teamLabel(team: MatchSummary["homeTeam"]) {
  return team.nameEl || team.name;
}

function TeamLogo({ team }: { team: MatchSummary["homeTeam"] }) {
  if (team.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.logoUrl}
        alt=""
        className="mx-auto h-8 w-8 object-contain"
        loading="lazy"
      />
    );
  }
  return <div className="text-2xl leading-none">{team.flagEmoji}</div>;
}

export function MatchCard({ match }: { match: MatchSummary }) {
  const chatting = match.room?.memberCount ?? 0;
  const showLive = isDisplayLive(match.status);
  const minuteLabel =
    showLive && match.minute != null
      ? `${match.minute}'${match.injuryTime ? `+${match.injuryTime}` : ""}`
      : match.status === "halftime"
        ? "HT"
        : match.startTime
          ? formatMatchTime(match.startTime)
          : "—";

  return (
    <article className="animate-fade-up rounded-2xl border border-border bg-surface/90 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition hover:border-brand/40">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate text-xs text-muted">
          {match.competitionName || match.categoryName || "Ποδόσφαιρο"}
        </div>
        {showLive ? (
          <LiveBadge stale={match.isStale} />
        ) : match.status === "halftime" ? (
          <span className="text-xs font-bold uppercase text-brand-2">Ημίχρονο</span>
        ) : (
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {statusLabel(match.status)}
          </span>
        )}
      </div>

      <div className="mb-3 flex items-center justify-end">
        <span className="text-sm font-semibold text-muted">{minuteLabel}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="text-right">
          <TeamLogo team={match.homeTeam} />
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
          <TeamLogo team={match.awayTeam} />
          <div className="mt-1 text-sm font-semibold">{teamLabel(match.awayTeam)}</div>
        </div>
      </div>

      {match.isStale ? (
        <p className="mt-2 text-center text-xs text-amber-400/80">
          Τα δεδομένα ενδέχεται να μην είναι ενημερωμένα
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          💬 {chatting > 0 ? `${chatting} στον Κουβά` : "Ο Κουβάς σε περιμένει"}
        </p>
        <Link
          href={`/match/${match.id}`}
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
