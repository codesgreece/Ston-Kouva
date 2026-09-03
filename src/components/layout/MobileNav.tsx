"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/live", label: "Live", icon: "🔴" },
  { href: "/matches", label: "Create", icon: "➕", emphasize: true },
  { href: "/live", label: "Chats", icon: "💬", chat: true },
  { href: "/profile/demo_user", label: "Profile", icon: "👤" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-[#0c0c0c]/95 backdrop-blur md:hidden"
      aria-label="Mobile"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href) && !item.chat;

          return (
            <li key={item.label} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium ${
                  active ? "text-brand" : "text-muted"
                }`}
              >
                <span
                  className={`text-lg leading-none ${item.emphasize ? "flex h-9 w-9 items-center justify-center rounded-full bg-brand text-base text-[#1a0d00]" : ""}`}
                >
                  {item.icon}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
