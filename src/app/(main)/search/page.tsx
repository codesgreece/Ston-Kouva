"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const debouncedHint = useMemo(() => q.trim(), [q]);

  return (
    <div className="space-y-4">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-extrabold">
        Search
      </h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ψάξε ομάδα, αγώνα ή χρήστη…"
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none ring-brand focus:ring-2"
      />
      <p className="text-sm text-muted">
        {debouncedHint
          ? `Αναζήτηση για «${debouncedHint}» — API search στο Phase 4.`
          : "Users · Teams · Matches · Posts"}
      </p>
      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/live" className="rounded-lg bg-surface-2 px-3 py-1.5 text-muted">
          Live
        </Link>
        <Link href="/explore" className="rounded-lg bg-surface-2 px-3 py-1.5 text-muted">
          Explore
        </Link>
      </div>
    </div>
  );
}
