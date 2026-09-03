"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: form.get("login"),
          password: form.get("password"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Αποτυχία σύνδεσης");
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
        <label className="mb-1 block text-sm text-muted" htmlFor="login">
          Email ή username
        </label>
        <input
          id="login"
          name="login"
          required
          autoComplete="username"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
          placeholder="demo_user"
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
          autoComplete="current-password"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
          placeholder="••••••••"
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
        {loading ? "Σύνδεση…" : "Σύνδεση"}
      </button>
      <p className="text-center text-sm text-muted">
        Νέος στον Κουβά;{" "}
        <Link href="/register" className="font-semibold text-brand-2">
          Εγγραφή
        </Link>
      </p>
    </form>
  );
}
