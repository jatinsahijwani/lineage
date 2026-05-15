"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, Loader2, AlertTriangle, RefreshCw } from "lucide-react";

import { GradientBg } from "@/components/shared/GradientBg";
import { GlowingBadge } from "@/components/shared/GlowingBadge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LineageConnectButton } from "@/components/connect-button";
import { useLineage } from "@/hooks/useLineage";
import { ZG_TESTNET } from "@lineage/shared";
import {
  titleVariants,
  subtitleVariants,
  containerVariants,
  cardVariants,
} from "@/lib/animations";

import { useDemoScreen } from "./_components/useDemoScreen";
import { ReceiptCard } from "./_components/ReceiptCard";
import { LineageTreeSvg } from "./_components/LineageTreeSvg";
import { PayoutsCard } from "./_components/PayoutsCard";
import { VerificationPanel } from "./_components/VerificationPanel";

function shortAddr(addr: string): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const PRIMARY_CTA_CLASS =
  "group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600 disabled:hover:shadow-none";

const SECONDARY_CTA_CLASS =
  "inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-white transition-all hover:border-white/20 hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50";

export default function DemoPage() {
  const { isConnected, chainOk } = useLineage();
  const screen = useDemoScreen();

  const highlights = useMemo(() => {
    if (!screen.receipt) {
      return { model: false, skills: new Set<string>(), data: new Set<string>() };
    }
    return {
      model: true,
      skills: new Set(screen.receipt.lineage.skills.map((s) => s.tokenId)),
      data: new Set(screen.receipt.lineage.data.map((d) => d.tokenId)),
    };
  }, [screen.receipt]);

  const isRunning =
    screen.status === "compute" ||
    screen.status === "attestation" ||
    screen.status === "persisting";
  const isSettling = screen.status === "settling";
  const runningLabel =
    screen.status === "compute"
      ? "Calling 0G Compute…"
      : screen.status === "attestation"
        ? "Fetching TEE attestation…"
        : screen.status === "persisting"
          ? "Persisting receipt…"
          : "Running…";

  return (
    <GradientBg variant="intense" className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          className="mb-10 flex flex-col gap-3"
        >
          <motion.div variants={subtitleVariants}>
            <GlowingBadge variant="purple">Live demo</GlowingBadge>
          </motion.div>
          <motion.h1
            variants={titleVariants}
            className="text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl"
          >
            Run inference. Watch attribution flow.
          </motion.h1>
          <motion.p
            variants={subtitleVariants}
            className="max-w-2xl text-balance text-base text-white/60"
          >
            Pick an agent, send a prompt. The signed receipt arrives, the
            lineage graph lights up, and royalties stream to every contributor
            in real time.
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          {/* LEFT */}
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="lg:col-span-5"
          >
            <div className="rounded-xl border border-white/10 glass-dark p-6">
              <div className="space-y-5">
                {/* MODEL — single-select dropdown over live on-chain tokens. */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-white">
                      Model
                    </label>
                    <button
                      type="button"
                      onClick={screen.refreshTokens}
                      disabled={screen.tokensLoading}
                      aria-label="Refresh on-chain tokens"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-white/50 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`h-3 w-3 ${screen.tokensLoading ? "animate-spin" : ""}`}
                      />
                    </button>
                  </div>
                  {screen.availableTokens.models.length === 0 ? (
                    screen.tokensLoading ? (
                      <div className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-white/60">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading on-chain tokens…
                      </div>
                    ) : (
                      <p className="text-xs text-white/50">
                        No model iNFTs on-chain.{" "}
                        <Link href="/mint" className="text-blue-300 hover:underline">
                          Mint one
                        </Link>
                        .
                      </p>
                    )
                  ) : (
                    <Select
                      value={screen.selectedModelId ?? undefined}
                      onValueChange={(id) => screen.setSelectedModelId(id)}
                    >
                      <SelectTrigger className="w-full bg-white/[0.02] text-white">
                        <SelectValue placeholder="Pick a model" />
                      </SelectTrigger>
                      <SelectContent>
                        {screen.availableTokens.models.map((m) => (
                          <SelectItem key={m.tokenId} value={m.tokenId}>
                            Model #{m.tokenId}
                            {m.owner
                              ? ` (owner ${shortAddr(m.owner)}, ${m.royaltyBps} bps)`
                              : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* SKILLS — optional multi-select. */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">
                    Skills <span className="text-white/40">· optional</span>
                  </label>
                  {screen.availableTokens.skills.length === 0 ? (
                    <p className="text-xs text-white/50">
                      No skill iNFTs minted yet.{" "}
                      <Link href="/mint" className="text-blue-300 hover:underline">
                        Mint one
                      </Link>
                      .
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {screen.availableTokens.skills.map((s) => {
                        const checked = screen.selectedSkillIds.includes(s.tokenId);
                        return (
                          <li
                            key={s.tokenId}
                            className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5"
                          >
                            <Checkbox
                              id={`skill-${s.tokenId}`}
                              checked={checked}
                              onCheckedChange={() => screen.toggleSkill(s.tokenId)}
                            />
                            <label
                              htmlFor={`skill-${s.tokenId}`}
                              className="cursor-pointer select-none font-mono text-xs text-white/80"
                            >
                              #{s.tokenId}
                              {s.owner ? (
                                <span className="ml-1 text-white/40">
                                  {shortAddr(s.owner)} · {s.royaltyBps}bps
                                </span>
                              ) : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* DATA — optional multi-select. */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">
                    Data <span className="text-white/40">· optional</span>
                  </label>
                  {screen.availableTokens.data.length === 0 ? (
                    <p className="text-xs text-white/50">
                      No data iNFTs minted yet.{" "}
                      <Link href="/mint" className="text-blue-300 hover:underline">
                        Mint one
                      </Link>
                      .
                    </p>
                  ) : (
                    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {screen.availableTokens.data.map((d) => {
                        const checked = screen.selectedDataIds.includes(d.tokenId);
                        return (
                          <li
                            key={d.tokenId}
                            className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5"
                          >
                            <Checkbox
                              id={`data-${d.tokenId}`}
                              checked={checked}
                              onCheckedChange={() => screen.toggleData(d.tokenId)}
                            />
                            <label
                              htmlFor={`data-${d.tokenId}`}
                              className="cursor-pointer select-none font-mono text-xs text-white/80"
                            >
                              #{d.tokenId}
                              {d.owner ? (
                                <span className="ml-1 text-white/40">
                                  {shortAddr(d.owner)} · {d.royaltyBps}bps
                                </span>
                              ) : null}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {/* Aggregated cold-start hint when the chain has zero iNFTs. */}
                {!screen.tokensLoading &&
                  screen.availableTokens.models.length === 0 &&
                  screen.availableTokens.skills.length === 0 &&
                  screen.availableTokens.data.length === 0 && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
                      No iNFTs found on-chain.{" "}
                      <Link
                        href="/mint"
                        className="font-medium underline decoration-dotted underline-offset-4 hover:text-amber-100"
                      >
                        Mint some from the /mint page first
                      </Link>
                      .
                    </div>
                  )}

                {screen.tokensError && (
                  <p className="text-[11px] text-amber-300/80">
                    on-chain scan warning: {screen.tokensError}
                  </p>
                )}

                <div>
                  <label className="mb-2 block text-sm font-medium text-white">
                    Prompt
                  </label>
                  <Textarea
                    rows={4}
                    value={screen.prompt}
                    onChange={(e) => screen.setPrompt(e.target.value)}
                    className="min-h-28 bg-white/[0.02] text-white"
                  />
                </div>

                {screen.error && (
                  <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="break-words">{screen.error}</div>
                  </div>
                )}

                {!isConnected || !chainOk ? (
                  <div className="flex flex-col items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
                    <p className="text-sm text-white/70">
                      Connect a wallet on {ZG_TESTNET.name} (chainId{" "}
                      {ZG_TESTNET.chainId}) to run inference.
                    </p>
                    <LineageConnectButton />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={screen.run}
                      disabled={
                        isRunning ||
                        !screen.prompt.trim() ||
                        !screen.selectedModelId
                      }
                      className={PRIMARY_CTA_CLASS}
                    >
                      {isRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      {isRunning ? runningLabel : "Run inference"}
                    </button>
                    <button
                      type="button"
                      onClick={screen.settle}
                      disabled={!screen.receipt || isSettling}
                      className={SECONDARY_CTA_CLASS}
                    >
                      {isSettling ? "Settling on-chain…" : "Settle now"}
                    </button>
                    {screen.receipt && (
                      <button
                        type="button"
                        onClick={screen.reset}
                        className="text-sm text-white/50 hover:text-white"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}

                {screen.output && (
                  <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-white/40">
                      TEE-verified output
                    </div>
                    <div className="break-words text-sm text-white/80">
                      {screen.output}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* RIGHT */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6 lg:col-span-7"
          >
            <ReceiptCard receipt={screen.receipt} status={screen.status} />

            <VerificationPanel
              receipt={screen.receipt}
              daPointer={screen.daPointer}
              settleResult={screen.settleResult}
            />

            <div className="rounded-xl border border-white/10 glass-dark p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
                  Lineage Graph
                </h3>
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                  data → model ← skills
                </span>
              </div>
              <div className="aspect-[560/260] w-full">
                {screen.agent ? (
                  <LineageTreeSvg
                    agent={screen.agent}
                    highlights={highlights}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-white/40">
                    Pick a model to render its lineage graph.
                  </div>
                )}
              </div>
            </div>

            <PayoutsCard payouts={screen.payouts} />
          </motion.div>
        </div>
      </div>
    </GradientBg>
  );
}
