"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ChevronDown } from "lucide-react";

const PILL =
  "inline-flex items-center gap-2 border border-rule px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-paper transition-colors hover:border-rule-strong hover:text-copper-bright";

const PRIMARY =
  "inline-flex items-center gap-2 border border-copper bg-copper px-5 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-ink transition-colors hover:bg-copper-bright hover:border-copper-bright";

const WARN =
  "inline-flex items-center gap-2 border border-rust/40 bg-rust/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-rust transition-colors hover:bg-rust/20";

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
                    className={PRIMARY}
                  >
                    Connect wallet
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    type="button"
                    onClick={openChainModal}
                    className={WARN}
                  >
                    Wrong network
                  </button>
                );
              }

              // RainbowKit's chain object doesn't expose `testnet` here, so
              // we infer from chainId (Galileo testnet = 16602).
              const isTestnet = chain.id === 16602;
              return (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openChainModal}
                    className={PILL}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${isTestnet ? "bg-copper" : "bg-moss"}`}
                      aria-hidden
                    />
                    <span className="hidden sm:inline">{chain.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={openAccountModal}
                    className={PILL}
                  >
                    <span className="tabular">
                      {shortAddress(account.address)}
                    </span>
                    <ChevronDown className="h-3 w-3 text-paper-faint" />
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
