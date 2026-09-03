"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          email: form.get("email"),
          password: form.get("password"),
          displayName: form.get("displayName"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Αποτυχία εγγραφής");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Κάτι πήγε στραβά");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-sm space-y-4">
      <div>
        <label className="mb-1 block text-sm text-muted" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          required
          minLength={3}
          maxLength={20}
          pattern="[A-Za-z0-9_]+"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
          placeholder="nikos_22"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted" htmlFor="displayName">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          maxLength={80}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
          placeholder="Νίκος"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
          placeholder="you@email.com"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-muted" htmlFor="password">
          Κωδικός
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
        />
      </div>
      {error ? (
        <p className="rounded-lg bg-live/10 px-3 py-2 text-sm text-live">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-[#1a0d00] hover:bg-brand-2 disabled:opacity-60"
      >
        {loading ? "Δημιουργία…" : "Δημιουργία λογαριασμού"}
      </button>
      <p className="text-center text-sm text-muted">
        Έχεις ήδη λογαριασμό;{" "}
        <Link href="/login" className="font-semibold text-brand-2">
          Σύνδεση
        </Link>
      </p>
    </form>
  );
}
