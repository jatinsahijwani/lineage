import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lineage Protocol",
  description: "Provenance & royalty layer for AI agents on 0G",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <a href="/" className="font-bold text-lg text-brand-900">Lineage</a>
              <div className="flex gap-6 text-sm font-medium">
                <a href="/mint" className="hover:text-brand-500 transition-colors">Mint iNFT</a>
                <a href="/demo" className="hover:text-brand-500 transition-colors">Demo</a>
                <a href="/earnings" className="hover:text-brand-500 transition-colors">Earnings</a>
              </div>
            </div>
          </nav>
          <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
