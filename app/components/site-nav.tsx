"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { LineageConnectButton } from "@/components/connect-button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/mint", label: "Mint" },
  { href: "/demo", label: "Demo" },
  { href: "/earnings", label: "Earnings" },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 h-16 w-full border-b border-white/5 glass-dark backdrop-blur-lg">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icon.svg"
            alt="Lineage"
            width={28}
            height={28}
            className="rounded"
            priority
          />
          <span className="font-sans text-lg font-semibold tracking-tight text-white">
            Lineage
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
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "text-white bg-white/5"
                    : "text-white/60 hover:text-white hover:bg-white/5",
                )}
              >
                {item.label}
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
