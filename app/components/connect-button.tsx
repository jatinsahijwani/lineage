"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDown } from "lucide-react";

const PRIMARY_CTA_CLASS =
  "group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25";

const WARN_CTA_CLASS =
  "inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition-all hover:bg-red-500/20";

const GLASS_PILL_CLASS =
  "inline-flex items-center gap-2 rounded-lg glass-dark border border-white/10 px-3.5 py-2 text-sm font-medium text-white transition-all hover:border-white/20";

function shortAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr ?? "";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function LineageConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          !!account &&
          !!chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className={PRIMARY_CTA_CLASS}
                  >
                    Connect Wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className={WARN_CTA_CLASS}
                  >
                    Wrong network
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openChainModal}
                    className={GLASS_PILL_CLASS}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full bg-emerald-400"
                      aria-hidden
                    />
                    <span className="text-white/80">{chain.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={openAccountModal}
                    className={GLASS_PILL_CLASS}
                  >
                    <span className="font-mono">
                      {shortAddress(account.address)}
                    </span>
                    <ChevronDown className="h-4 w-4 text-white/60" />
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
