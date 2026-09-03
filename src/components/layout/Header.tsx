import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import type { PublicUser } from "@/types";

const navLeft = [
  { href: "/", label: "Home" },
  { href: "/live", label: "Live" },
  { href: "/matches", label: "Matches" },
  { href: "/explore", label: "Explore" },
];

export function DesktopHeader({ user }: { user: PublicUser | null }) {
  return (
    <header className="sticky top-0 z-40 hidden border-b border-border/80 bg-[#0a0a0a]/85 backdrop-blur-md md:block">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-8 px-4">
        <Logo />
        <nav className="flex items-center gap-1" aria-label="Main">
          {navLeft.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/search"
            className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-text"
          >
            Search
          </Link>
          <Link
            href="/notifications"
            className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-text"
          >
            Notifications
          </Link>
          {user ? (
            <Link
              href={`/profile/${user.username}`}
              className="rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-semibold text-brand-2 hover:bg-surface-3"
            >
              @{user.username}
            </Link>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-[#1a0d00] hover:bg-brand-2"
            >
              Σύνδεση
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border/80 bg-[#0a0a0a]/90 px-3 backdrop-blur md:hidden">
      <Logo size={24} />
      <div className="flex items-center gap-2">
        <Link href="/search" className="rounded-lg px-2 py-1 text-sm text-muted">
          🔍
        </Link>
        <Link href="/notifications" className="rounded-lg px-2 py-1 text-sm text-muted">
          🔔
        </Link>
      </div>
    </header>
  );
}
