"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProgress } from "@/lib/progress";

const NAV = [
  { href: "/learn", label: "Learn" },
  { href: "/diagnostic", label: "Diagnostic" },
  { href: "/assessment", label: "Assessments" },
  { href: "/dashboard", label: "Progress" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { streakDays, ready } = useProgress();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--kx-border)] bg-[var(--kx-bg)]/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 pr-2 text-lg font-bold tracking-tight">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-black text-white"
          >
            K
          </span>
          Katchi
        </Link>

        <nav className="flex flex-1 items-center gap-0.5 overflow-x-auto" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap transition ${
                  active
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                    : "text-[var(--kx-muted)] hover:bg-[var(--kx-surface-2)] hover:text-[var(--kx-text)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {ready && streakDays > 0 && (
          <span
            className="kx-chip bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            title={`${streakDays}-day practice streak`}
          >
            🔥 {streakDays}
          </span>
        )}
      </div>
    </header>
  );
}
