import { getCurrentSession } from "@/lib/auth";
import { DesktopHeader, MobileHeader } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";

export const dynamic = "force-dynamic";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <DesktopHeader user={session?.user ?? null} />
      <MobileHeader />
      <div className="mx-auto grid max-w-6xl gap-6 px-3 py-4 md:grid-cols-[200px_minmax(0,1fr)_260px] md:px-4 md:py-6">
        <aside className="hidden md:block">
          <nav className="sticky top-20 space-y-1 text-sm">
            {[
              ["/", "🏠 Home"],
              ["/live", "🔴 Live"],
              ["/matches", "⚽ Matches"],
              ["/explore", "🧭 Explore"],
              [session?.user ? `/profile/${session.user.username}` : "/login", "👤 Profile"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="block rounded-xl px-3 py-2 text-muted transition hover:bg-surface hover:text-text"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
        <aside className="hidden md:block">
          <div className="sticky top-20 space-y-4">
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                Live τώρα
              </h2>
              <p className="text-sm text-muted">
                Οι live αγώνες εμφανίζονται στο feed. Μπες στον Κουβά.
              </p>
            </section>
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                Trending
              </h2>
              <p className="text-sm text-muted">Η δραστηριότητα χτίζεται από πραγματικά rooms.</p>
            </section>
          </div>
        </aside>
      </div>
      <MobileNav />
    </div>
  );
}
