"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function RoomComposer({
  matchId,
  loggedIn,
  onSent,
}: {
  matchId: string;
  loggedIn: boolean;
  onSent?: (message: unknown) => void;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!loggedIn) {
    return (
      <div className="rounded-xl border border-border bg-surface p-3 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-brand-2">
          Σύνδεσου
        </Link>{" "}
        για να γράψεις στον Κουβά.
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${matchId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Αποτυχία αποστολής");
        return;
      }
      setContent("");
      onSent?.(data.message);
      router.refresh();
    } catch {
      setError("Κάτι πήγε στραβά");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-border bg-surface p-2">
      <div className="flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          placeholder="Γράψε στον Κουβά…"
          className="min-w-0 flex-1 rounded-lg bg-surface-2 px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
        />
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="rounded-lg bg-brand px-4 text-sm font-bold text-[#1a0d00] disabled:opacity-50"
        >
          Αποστολή
        </button>
      </div>
      {error ? <p className="mt-1 px-1 text-xs text-live">{error}</p> : null}
    </form>
  );
}
