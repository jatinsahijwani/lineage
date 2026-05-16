import type { ReactNode } from "react";

export default function AppRouteLayout({ children }: { children: ReactNode }) {
  return <main>{children}</main>;
}
