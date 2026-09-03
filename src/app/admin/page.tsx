import { getCurrentSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import Link from "next/link";
import { getSportsHealth } from "@/lib/sports/health";
import { AdminSportsPanel } from "@/components/admin/AdminSportsPanel";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session?.user.isAdmin) {
    redirect("/login");
  }

  const [users, live, rooms, postsToday, reports, messagesToday, activeUsers, sportsHealth, pendingReports] =
    await Promise.all([
      query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM users`),
      query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM matches WHERE is_live = TRUE AND external_source = 'sofascore'`,
      ),
      query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM match_rooms WHERE status = 'open'`,
      ),
      query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM posts WHERE created_at::date = CURRENT_DATE`,
      ),
      query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM reports WHERE status = 'pending'`,
      ),
      query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM messages WHERE created_at::date = CURRENT_DATE`,
      ),
      query<{ c: string }>(
        `SELECT COUNT(*)::text AS c FROM users WHERE last_seen_at > NOW() - INTERVAL '24 hours'`,
      ),
      getSportsHealth().catch(() => ({
        status: "ERROR" as const,
        lastSync: null,
        lastLiveSync: null,
        lastFailure: null,
        lastError: "Health unavailable",
        liveMatches: 0,
        upcomingMatches: 0,
        totalSofascoreMatches: 0,
        syncStates: [],
      })),
      query<{
        id: string;
        target_type: string;
        category: string;
        reason: string | null;
        reporter_username: string;
        created_at: Date;
      }>(
        `SELECT r.id, r.target_type, r.category, r.reason, r.created_at, u.username AS reporter_username
         FROM reports r JOIN users u ON u.id = r.reporter_id
         WHERE r.status = 'pending'
         ORDER BY r.created_at ASC LIMIT 20`,
      ).catch(() => ({ rows: [] as never[] })),
    ]);

  const metrics = [
    { label: "Total users", value: users.rows[0]?.c ?? "0" },
    { label: "Active users (24h)", value: activeUsers.rows[0]?.c ?? "0" },
    { label: "Live matches", value: live.rows[0]?.c ?? "0" },
    { label: "Active rooms", value: rooms.rows[0]?.c ?? "0" },
    { label: "Messages today", value: messagesToday.rows[0]?.c ?? "0" },
    { label: "Posts today", value: postsToday.rows[0]?.c ?? "0" },
    { label: "Reports pending", value: reports.rows[0]?.c ?? "0" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
            Admin
          </h1>
          <p className="text-sm text-muted">Dashboard · moderation · system</p>
        </div>
        <Link href="/" className="text-sm text-brand-2">
          ← App
        </Link>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {[
          "Dashboard",
          "Users",
          "Matches",
          "Rooms",
          "Posts",
          "Reports",
          "Moderation",
          "Predictions",
          "System",
        ].map((s) => (
          <span
            key={s}
            className={`rounded-lg border border-border px-3 py-1.5 ${
              s === "Dashboard" ? "bg-surface text-brand-2" : "text-muted"
            }`}
          >
            {s}
          </span>
        ))}
      </nav>

      <AdminSportsPanel initial={sportsHealth} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{m.label}</p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-black">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Pending reports
        </h2>
        {pendingReports.rows.length === 0 ? (
          <p className="text-sm text-muted">Καμία εκκρεμότητα.</p>
        ) : (
          <ul className="space-y-2">
            {pendingReports.rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-sm"
              >
                <span>
                  @{r.reporter_username} · {r.target_type} · {r.category}
                  {r.reason ? ` — ${r.reason}` : ""}
                </span>
                <span className="text-xs text-muted">
                  API: POST /api/admin/reports
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
        <p>
          Cron: <code className="text-brand-2">/api/cron/sync-matches</code> ·{" "}
          <code className="text-brand-2">/api/cron/sync-live</code> ·{" "}
          <code className="text-brand-2">/api/cron/sync-finalize</code>
        </p>
        <p className="mt-1">
          Realtime: <code className="text-brand-2">npm run realtime</code> · Worker:{" "}
          <code className="text-brand-2">npm run sports:worker</code>
        </p>
      </section>
    </div>
  );
}
