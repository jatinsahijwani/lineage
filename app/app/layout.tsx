import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { SiteNav } from "@/components/site-nav";

// Editorial display — Fraunces, italic by default in headlines.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

// Body copy. Plex Sans is warm, mechanical, pairs with the mono.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
});

// Mono for addresses, hashes, mono caps labels, code.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Lineage — the provenance & royalty protocol for AI agents on 0G",
  description:
    "Every output is owed to someone upstream. Every dataset, model, and skill is an iNFT; every inference produces a signed attribution receipt; royalties stream to every contributor in the lineage.",
  icons: {
    icon: [
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0d0c0a" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="bg-ink text-paper antialiased font-sans grain">
        <Providers>
          <SiteNav />
          {children}
        </Providers>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  );
}
