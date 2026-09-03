"use client";

import { useState } from "react";

type Health = {
  status: string;
  lastSync: string | null;
  lastLiveSync: string | null;
  lastError: string | null;
  liveMatches: number;
  upcomingMatches: number;
  totalSofascoreMatches: number;
};

export function AdminSportsPanel({ initial }: { initial: Health }) {
  const [health, setHealth] = useState(initial);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function runSync(action: string, label: string) {
    if (!confirm(`Εκτέλεση: ${label};`)) return;
    setLoading(action);
    setResult(null);
    try {
      const res = await fetch("/api/sports/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setResult(
        `${data.synced ?? 0} matches · ${data.created ?? 0} new · ${data.updated ?? 0} updated · ${data.unchanged ?? 0} unchanged · ${data.liveCount ?? 0} live`,
      );
      const healthRes = await fetch("/api/sports/health");
      if (healthRes.ok) setHealth(await healthRes.json());
    } catch (err) {
      setResult(err instanceof Error ? err.message : "Σφάλμα sync");
    } finally {
      setLoading(null);
    }
  }

  const statusColor =
    health.status === "CONNECTED"
      ? "text-emerald-400"
      : health.status === "DEGRADED"
        ? "text-amber-400"
        : "text-red-400";

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
        Sports Data
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div>
          <p className="text-xs text-muted">Status</p>
          <p className={`font-bold ${statusColor}`}>{health.status}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Last sync</p>
          <p>{health.lastSync ? new Date(health.lastSync).toLocaleString("el-GR") : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Live matches</p>
          <p className="font-bold">{health.liveMatches}</p>
        </div>
        <div>
          <p className="text-xs text-muted">Upcoming</p>
          <p className="font-bold">{health.upcomingMatches}</p>
        </div>
      </div>

      {health.lastError ? (
        <p className="text-xs text-red-400">Last error: {health.lastError}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          { action: "today", label: "SYNC TODAY" },
          { action: "tomorrow", label: "SYNC TOMORROW" },
          { action: "live", label: "SYNC LIVE" },
          { action: "window", label: "SYNC 7 DAYS" },
        ].map((btn) => (
          <button
            key={btn.action}
            type="button"
            disabled={loading !== null}
            onClick={() => runSync(btn.action, btn.label)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-bold hover:border-brand/40 disabled:opacity-50"
          >
            {loading === btn.action ? "…" : btn.label}
          </button>
        ))}
      </div>

      {result ? <p className="text-sm text-brand-2">{result}</p> : null}

      <p className="text-xs text-muted">
        Total SofaScore matches in DB: {health.totalSofascoreMatches}
      </p>
    </section>
  );
}
