import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveBadge } from "@/components/ui/Badges";
import { PredictionsPanel } from "@/components/predictions/PredictionsPanel";
import { CreatePostBox, PostCard } from "@/components/social/PostCard";
import { getCurrentSession } from "@/lib/auth";
import { getMatchById } from "@/lib/services/matches";
import { listPredictions } from "@/lib/services/predictions";
import { listFeed } from "@/lib/services/social";
import { formatMatchTime } from "@/lib/sports/date-utils";
import { statusLabel, isDisplayLive } from "@/lib/sports/status-mapper";
import { query } from "@/lib/db";

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const match = await getMatchById(id);
  if (!match) notFound();

  const session = await getCurrentSession();
  const activeTab = tab || "overview";
  const showLive = isDisplayLive(match.status);

  const lastSyncSec = match.lastSyncedAt
    ? Math.max(
        0,
        Math.floor(
          (new Date().getTime() - new Date(match.lastSyncedAt).getTime()) / 1000,
        ),
      )
    : null;

  let lastSyncLabel = "—";
  if (lastSyncSec != null) {
    lastSyncLabel = match.isStale
      ? `Τελευταία ενημέρωση πριν από ${lastSyncSec} sec — ενδέχεται καθυστέρηση`
      : `Τελευταία ενημέρωση πριν από ${lastSyncSec} sec`;
  }

  const events = await query<{
    id: string;
    event_type: string;
    minute: number | null;
    description: string | null;
  }>(
    `SELECT id, event_type, minute, description
     FROM match_events WHERE match_id = $1
     ORDER BY minute ASC NULLS LAST, created_at ASC LIMIT 50`,
    [id],
  ).catch(() => ({ rows: [] as { id: string; event_type: string; minute: number | null; description: string | null }[] }));

  const stats = await query<{
    stat_key: string;
    home_value: string | null;
    away_value: string | null;
  }>(
    `SELECT stat_key, home_value::text, away_value::text FROM match_stats
     WHERE match_id = $1 AND period IN ('ALL', 'all', 'Full time')
     ORDER BY stat_key LIMIT 30`,
    [id],
  ).catch(() => ({ rows: [] as { stat_key: string; home_value: string | null; away_value: string | null }[] }));

  const predictions = await listPredictions(id).catch(() => []);
  const matchFeed = await listFeed({
    matchId: id,
    limit: 20,
    userId: session?.user.id,
  }).catch(() => ({ posts: [], nextCursor: null }));

  const home = match.homeTeam.nameEl || match.homeTeam.name;
  const away = match.awayTeam.nameEl || match.awayTeam.name;
  const canResolve = Boolean(session?.user.isAdmin || session?.user.isModerator);

  const tabs = [
    { key: "overview", label: "Overview", href: `/match/${id}` },
    { key: "chat", label: "Chat", href: `/match/${id}/room` },
    { key: "predictions", label: "Predictions", href: `/match/${id}?tab=predictions` },
    { key: "stats", label: "Stats", href: `/match/${id}?tab=stats` },
  ];

  return (
    <div className="space-y-4">
      <header className="rounded-3xl border border-border bg-surface p-5">
        <p className="mb-2 text-center text-xs text-muted">
          {match.competitionName || match.categoryName || "Ποδόσφαιρο"}
          {match.startTime ? ` · ${formatMatchTime(match.startTime, { weekday: "short" })}` : ""}
        </p>
        <div className="mb-3 flex items-center justify-between">
          {showLive ? (
            <LiveBadge stale={match.isStale} />
          ) : match.status === "halftime" ? (
            <span className="text-xs font-bold uppercase text-brand-2">Ημίχρονο</span>
          ) : (
            <span className="text-xs uppercase text-muted">{statusLabel(match.status)}</span>
          )}
          <span className="text-sm font-semibold text-muted">
            {showLive && match.minute != null
              ? `${match.minute}'${match.injuryTime ? `+${match.injuryTime}` : ""}`
              : ""}
          </span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <div>
            {match.homeTeam.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.homeTeam.logoUrl} alt="" className="mx-auto h-10 w-10 object-contain" />
            ) : (
              <div className="text-3xl">{match.homeTeam.flagEmoji}</div>
            )}
            <div className="mt-1 font-semibold">{home}</div>
          </div>
          <div className="font-[family-name:var(--font-display)] text-4xl font-black tabular-nums animate-score-pop">
            {match.homeScore}
            <span className="mx-1 text-muted">-</span>
            {match.awayScore}
          </div>
          <div>
            {match.awayTeam.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={match.awayTeam.logoUrl} alt="" className="mx-auto h-10 w-10 object-contain" />
            ) : (
              <div className="text-3xl">{match.awayTeam.flagEmoji}</div>
            )}
            <div className="mt-1 font-semibold">{away}</div>
          </div>
        </div>
        <p className={`mt-3 text-center text-xs ${match.isStale ? "text-amber-400/80" : "text-muted"}`}>
          {lastSyncLabel}
        </p>
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
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`shrink-0 rounded-lg px-3 py-2 font-medium ${
              (activeTab === "overview" && t.key === "overview") ||
              activeTab === t.key
                ? "bg-surface-3 text-text"
                : "text-muted hover:text-text"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {activeTab === "predictions" ? (
        <PredictionsPanel
          matchId={id}
          initial={predictions as never}
          canResolve={canResolve}
        />
      ) : activeTab === "stats" ? (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            Stats
          </h2>
          {stats.rows.length === 0 ? (
            <p className="text-sm text-muted">Δεν υπάρχουν στατιστικά ακόμα.</p>
          ) : (
            <ul className="space-y-2">
              {stats.rows.map((s) => (
                <li
                  key={s.stat_key}
                  className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm"
                >
                  <span className="text-right tabular-nums">{s.home_value ?? "—"}</span>
                  <span className="text-center text-xs text-muted">{s.stat_key}</span>
                  <span className="tabular-nums">{s.away_value ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
              Overview
            </h2>
            {events.rows.length === 0 ? (
              <p className="text-sm text-muted">Δεν υπάρχουν events ακόμα.</p>
            ) : (
              <ul className="space-y-2">
                {events.rows.map((ev) => (
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

          <PredictionsPanel
            matchId={id}
            initial={predictions.slice(0, 3) as never}
            canResolve={canResolve}
          />

          <section className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
              Match posts
            </h2>
            {session ? <CreatePostBox matchId={id} /> : null}
            {matchFeed.posts.length === 0 ? (
              <p className="text-sm text-muted">Δεν υπάρχουν posts για τον αγώνα.</p>
            ) : (
              matchFeed.posts.map((p) => <PostCard key={p.id} post={p} />)
            )}
          </section>
        </>
      )}
    </div>
  );
}
