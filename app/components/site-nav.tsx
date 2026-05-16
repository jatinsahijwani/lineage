"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LineageConnectButton } from "@/components/connect-button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/mint", label: "Mint", chapter: "01" },
  { href: "/demo", label: "Demo", chapter: "02" },
  { href: "/earnings", label: "Earnings", chapter: "03" },
] as const;

/**
 * Unified masthead. Appears on every route (landing + /(app)/*).
 *
 * Layout: wordmark italic-serif left, mono caps middle with chapter numerals,
 * connect button right. A hairline rule under it gives the masthead its
 * editorial feel. On scroll it gets a subtle blur via glass-dark.
 */
export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-rule bg-ink/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6 lg:px-10">
        <Link href="/" className="group flex items-baseline gap-3">
          <span
            className="text-2xl font-display italic text-paper transition-colors group-hover:text-copper-bright"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            Lineage
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-paper-faint sm:inline">
            vol. i — 2026
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-baseline gap-2 px-4 py-2 transition-colors",
                )}
              >
                <span
                  className={cn(
                    "font-mono text-[10px] tracking-[0.25em]",
                    active ? "text-copper" : "text-paper-faint",
                  )}
                >
                  §{item.chapter}
                </span>
                <span
                  className={cn(
                    "font-mono text-xs uppercase tracking-[0.18em] transition-colors",
                    active
                      ? "text-paper"
                      : "text-paper-dim group-hover:text-paper",
                  )}
                >
                  {item.label}
                </span>
                {active && (
                  <span
                    aria-hidden
                    className="absolute -bottom-[1px] left-4 right-4 h-px bg-copper"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <LineageConnectButton />
        </div>
      </div>
    </header>
  );
}
