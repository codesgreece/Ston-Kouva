"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SearchResult = {
  users: { username: string; display_name: string }[];
  teams: { name: string; name_el: string | null; flag_emoji: string | null }[];
  matches: { id: string; label: string; status: string }[];
  posts: { id: string; content: string; username: string }[];
};

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResult | null>(null);
  const debounced = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    if (debounced.length < 2) {
      setData(null);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`);
      if (res.ok) setData(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [debounced]);

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

      {!data ? (
        <p className="text-sm text-muted">Users · Teams · Matches · Posts</p>
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase text-muted">Users</h2>
            <ul className="space-y-1">
              {data.users?.map((u) => (
                <li key={u.username}>
                  <Link href={`/profile/${u.username}`} className="text-sm text-brand-2">
                    @{u.username} · {u.display_name}
                  </Link>
                </li>
              )) || <li className="text-sm text-muted">—</li>}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase text-muted">Teams</h2>
            <ul className="space-y-1 text-sm">
              {data.teams?.map((t, i) => (
                <li key={`${t.name}-${i}`}>
                  {t.flag_emoji} {t.name_el || t.name}
                </li>
              )) || <li className="text-muted">—</li>}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase text-muted">Matches</h2>
            <ul className="space-y-1">
              {(data.matches as Array<{
                id: string;
                status: string;
                home_name?: string;
                home_name_el?: string | null;
                away_name?: string;
                away_name_el?: string | null;
                home_flag?: string | null;
                away_flag?: string | null;
                label?: string;
              }>)?.map((m) => {
                const label =
                  m.label ||
                  `${m.home_flag || ""} ${m.home_name_el || m.home_name} vs ${m.away_flag || ""} ${m.away_name_el || m.away_name}`;
                return (
                  <li key={m.id}>
                    <Link href={`/match/${m.id}`} className="text-sm hover:text-brand-2">
                      {label} · {m.status}
                    </Link>
                  </li>
                );
              }) || <li className="text-sm text-muted">—</li>}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase text-muted">Posts</h2>
            <ul className="space-y-2">
              {data.posts?.map((p) => (
                <li key={p.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
                  <span className="text-brand-2">@{p.username}</span> — {p.content}
                </li>
              )) || <li className="text-sm text-muted">—</li>}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
