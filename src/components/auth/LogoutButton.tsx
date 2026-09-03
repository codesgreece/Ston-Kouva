"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:border-live/40 hover:text-live"
    >
      Αποσύνδεση
    </button>
  );
}
