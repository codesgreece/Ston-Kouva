import { getCurrentSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import Link from "next/link";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session?.user.isAdmin) {
    redirect("/login");
  }

  const [users, live, rooms, postsToday, reports] = await Promise.all([
    query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM users`),
    query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM matches WHERE status = 'live'`),
    query<{ c: string }>(`SELECT COUNT(*)::text AS c FROM match_rooms WHERE status = 'open'`),
    query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM posts WHERE created_at::date = CURRENT_DATE`,
    ),
    query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM reports WHERE status = 'pending'`,
    ),
  ]);

  const metrics = [
    { label: "Total users", value: users.rows[0]?.c ?? "0" },
    { label: "Live matches", value: live.rows[0]?.c ?? "0" },
    { label: "Active rooms", value: rooms.rows[0]?.c ?? "0" },
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
          <p className="text-sm text-muted">Dashboard · Phase 1 skeleton</p>
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
    </div>
  );
}
