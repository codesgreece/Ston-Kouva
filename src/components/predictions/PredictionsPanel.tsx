"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BucketReaction } from "@/components/ui/Badges";

type PredictionRow = {
  id: string;
  content: string;
  status: string;
  vote_have_it: number;
  vote_bucket: number;
  username: string;
  display_name: string;
};

export function PredictionsPanel({
  matchId,
  initial,
  canResolve = false,
}: {
  matchId: string;
  initial: PredictionRow[];
  canResolve?: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createPrediction(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Αποτυχία");
        return;
      }
      setContent("");
      router.refresh();
    } catch {
      setError("Κάτι πήγε στραβά");
    } finally {
      setLoading(false);
    }
  }

  async function vote(id: string, vote: "have_it" | "bucket") {
    await fetch(`/api/predictions/${id}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vote }),
    });
    router.refresh();
  }

  async function resolve(id: string, result: "hit" | "miss") {
    await fetch(`/api/predictions/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result }),
    });
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
        🎯 Predictions
      </h2>
      <p className="text-[11px] text-muted">
        Social predictions — όχι χρηματική συμβουλή / financial advice.
      </p>

      <form onSubmit={createPrediction} className="space-y-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={500}
          placeholder="π.χ. Ελλάδα να σκοράρει επόμενο"
          className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
        />
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="rounded-xl bg-brand px-3 py-2 text-sm font-bold text-[#1a0d00] disabled:opacity-50"
        >
          Δημοσίευση πρόβλεψης
        </button>
        {error ? <p className="text-xs text-live">{error}</p> : null}
      </form>

      {initial.length === 0 ? (
        <p className="text-sm text-muted">Κανείς δεν ρίσκαρε ακόμα. Ύποπτα ήρεμα.</p>
      ) : (
        <ul className="space-y-3">
          {initial.map((p) => (
            <li key={p.id} className="rounded-xl border border-border bg-surface-2 p-3">
              <p className="text-xs font-bold text-brand">🎯 ΠΡΟΒΛΕΨΗ</p>
              <p className="mt-1 text-sm">«{p.content}»</p>
              <p className="mt-1 text-xs text-muted">
                @{p.username}
                {p.status === "hit"
                  ? " · ✅ HIT"
                  : p.status === "miss"
                    ? " · 🪣 ΣΤΟΝ ΚΟΥΒΑ"
                    : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => vote(p.id, "have_it")}
                  className="rounded-md bg-surface px-2 py-1 text-xs"
                >
                  🔥 Το έχω {p.vote_have_it}
                </button>
                <button type="button" onClick={() => vote(p.id, "bucket")}>
                  <BucketReaction count={p.vote_bucket} />
                </button>
              </div>
              {canResolve && p.status === "open" ? (
                <div className="mt-2 flex gap-2 text-xs">
                  <button
                    type="button"
                    className="text-success"
                    onClick={() => resolve(p.id, "hit")}
                  >
                    ✅ HIT
                  </button>
                  <button
                    type="button"
                    className="text-brand-2"
                    onClick={() => resolve(p.id, "miss")}
                  >
                    🪣 ΣΤΟΝ ΚΟΥΒΑ
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">
        <Link href="/login" className="text-brand-2">
          Σύνδεση
        </Link>{" "}
        αν δεν μπορείς να ψηφίσεις.
      </p>
    </section>
  );
}
