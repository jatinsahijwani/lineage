import type { ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";

export default function AppRouteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <main>{children}</main>
    </div>
  );
}
