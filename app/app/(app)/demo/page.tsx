"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, ArrowUpRight } from "lucide-react";

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
  Badge,
  Button,
  Chapter,
  Field,
  Marginalia,
  PageWrap,
} from "@/components/editorial";

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

export default function DemoPage() {
  const { isConnected, chainOk, chain, network } = useLineage();
  const screen = useDemoScreen();
  const explorerUrl =
    chain?.blockExplorers?.default?.url ??
    network?.blockExplorer ??
    ZG_TESTNET.blockExplorer;

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
    screen.status === "paying" ||
    screen.status === "compute" ||
    screen.status === "attestation" ||
    screen.status === "persisting";
  const isSettling = screen.status === "settling";
  const canSettle =
    screen.status === "ready-to-settle" || screen.status === "settling";
  const runningLabel =
    screen.status === "paying"
      ? "Approve payment"
      : screen.status === "compute"
        ? "Calling 0G Compute"
        : screen.status === "attestation"
          ? "Fetching TEE attestation"
          : screen.status === "persisting"
            ? "Persisting receipt"
            : "Running";

  return (
    <div className="pb-24 lg:pb-32">
      <PageWrap>
        <Chapter
          number="02"
          eyebrow="The inference"
          title={
            <>
              Run an inference.{" "}
              <em className="font-display italic text-copper">Watch attribution flow.</em>
            </>
          }
          lede="Pick a model and any composed skills or data. Pay 0.001 OG. The agent host runs the inference inside a TEE, signs a receipt, and persists it to 0G Storage. Then settle the batch on-chain — every contributor's address is in the Merkle tree."
          marginalia={
            <Marginalia>
              <p className="mb-2 text-copper">The host's role</p>
              <p>
                Inference is hosted by a Lineage Agent operator. The host signs
                the attribution receipt and pays the 0G Compute &amp; 0G Storage
                fees. Your wallet pays only the 0.001 OG royalty pool that
                streams to every iNFT contributor in the lineage.
              </p>
            </Marginalia>
          }
        />

        <div className="mt-16 grid grid-cols-12 gap-x-6 gap-y-12">
          {/* ─── LEFT: composer ─────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-5">
            <div className="editorial-card">
              <div className="flex items-center justify-between border-b border-rule px-6 py-3 lg:px-8">
                <span className="label label-copper">Compose the call</span>
                <button
                  type="button"
                  onClick={screen.refreshTokens}
                  disabled={screen.tokensLoading}
                  aria-label="Refresh on-chain tokens"
                  className="inline-flex h-7 w-7 items-center justify-center border border-rule text-paper-faint transition-colors hover:border-copper hover:text-copper disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${screen.tokensLoading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>

              <div className="space-y-8 p-6 lg:p-8">
                {/* Model select */}
                <Field label="Model" meta="single select">
                  {screen.availableTokens.models.length === 0 ? (
                    <p className="font-mono text-[11px] text-paper-faint">
                      {screen.tokensLoading
                        ? "Scanning registry…"
                        : "No model iNFTs on this network. "}
                      {!screen.tokensLoading && (
                        <Link href="/mint" className="link-copper">
                          Mint one ↗
                        </Link>
                      )}
                    </p>
                  ) : (
                    <Select
                      value={screen.selectedModelId ?? undefined}
                      onValueChange={(id) => screen.setSelectedModelId(id)}
                    >
                      <SelectTrigger className="h-11 w-full rounded-none border-0 border-b border-rule bg-transparent px-0 font-mono text-sm text-paper hover:border-copper focus:border-copper focus:ring-0">
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
                </Field>

                {/* Skills multi-select */}
                <Field
                  label="Skills"
                  meta="optional · multi-select"
                  hint={
                    screen.availableTokens.skills.length === 0
                      ? "No skill iNFTs on this network."
                      : undefined
                  }
                >
                  {screen.availableTokens.skills.length > 0 && (
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {screen.availableTokens.skills.map((s) => {
                        const checked = screen.selectedSkillIds.includes(s.tokenId);
                        return (
                          <li
                            key={s.tokenId}
                            className="flex items-center gap-2 border border-rule px-3 py-2"
                          >
                            <Checkbox
                              id={`skill-${s.tokenId}`}
                              checked={checked}
                              onCheckedChange={() => screen.toggleSkill(s.tokenId)}
                            />
                            <label
                              htmlFor={`skill-${s.tokenId}`}
                              className="flex cursor-pointer select-none flex-col gap-0.5"
                            >
                              <span className="font-mono text-sm text-paper tabular">
                                #{s.tokenId}
                              </span>
                              {s.owner && (
                                <span className="font-mono text-[11px] tabular text-paper-dim">
                                  {shortAddr(s.owner)} ·{" "}
                                  <span className="text-copper">
                                    {s.royaltyBps}bps
                                  </span>
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Field>

                {/* Data multi-select */}
                <Field
                  label="Data"
                  meta="optional · multi-select"
                  hint={
                    screen.availableTokens.data.length === 0
                      ? "No data iNFTs on this network."
                      : undefined
                  }
                >
                  {screen.availableTokens.data.length > 0 && (
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {screen.availableTokens.data.map((d) => {
                        const checked = screen.selectedDataIds.includes(d.tokenId);
                        return (
                          <li
                            key={d.tokenId}
                            className="flex items-center gap-2 border border-rule px-3 py-2"
                          >
                            <Checkbox
                              id={`data-${d.tokenId}`}
                              checked={checked}
                              onCheckedChange={() => screen.toggleData(d.tokenId)}
                            />
                            <label
                              htmlFor={`data-${d.tokenId}`}
                              className="flex cursor-pointer select-none flex-col gap-0.5"
                            >
                              <span className="font-mono text-sm text-paper tabular">
                                #{d.tokenId}
                              </span>
                              {d.owner && (
                                <span className="font-mono text-[11px] tabular text-paper-dim">
                                  {shortAddr(d.owner)} ·{" "}
                                  <span className="text-copper">
                                    {d.royaltyBps}bps
                                  </span>
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Field>

                {/* Cold-start empty state */}
                {!screen.tokensLoading &&
                  screen.availableTokens.models.length === 0 &&
                  screen.availableTokens.skills.length === 0 &&
                  screen.availableTokens.data.length === 0 && (
                    <div className="border border-copper/40 bg-copper/5 p-4">
                      <span className="label label-copper">No iNFTs minted on this chain.</span>
                      <p className="mt-2 text-sm leading-relaxed text-paper-dim">
                        Head to{" "}
                        <Link href="/mint" className="link-copper">
                          §01 · Mint
                        </Link>{" "}
                        and create one — yours or any wallet's — then return.
                      </p>
                    </div>
                  )}

                {screen.tokensError && (
                  <p className="font-mono text-[11px] text-rust">
                    on-chain scan warning: {screen.tokensError}
                  </p>
                )}

                {/* Prompt */}
                <Field label="Prompt" meta="the input">
                  <Textarea
                    rows={4}
                    value={screen.prompt}
                    onChange={(e) => screen.setPrompt(e.target.value)}
                    className="min-h-28 rounded-none border-0 border-b border-rule bg-transparent px-0 font-mono text-sm text-paper placeholder:text-paper-faint focus-visible:border-copper focus-visible:ring-0"
                  />
                </Field>

                {/* Error */}
                {screen.error && (
                  <div className="border border-rust/40 bg-rust/5 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-rust" />
                      <span className="label" style={{ color: "var(--rust)" }}>
                        Halted
                      </span>
                    </div>
                    <p className="break-words font-mono text-xs leading-relaxed text-paper">
                      {screen.error}
                    </p>
                  </div>
                )}

                {/* Connection gate vs CTAs */}
                {!isConnected || !chainOk ? (
                  <div className="border border-rule p-5">
                    <p className="text-sm text-paper-dim">
                      Connect a wallet on 0G Mainnet or 0G Galileo Testnet to
                      run inference.
                    </p>
                    <div className="mt-4">
                      <LineageConnectButton />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      onClick={screen.run}
                      disabled={
                        isRunning ||
                        canSettle ||
                        screen.status === "done" ||
                        !screen.prompt.trim() ||
                        !screen.selectedModelId
                      }
                      loading={isRunning}
                      variant="primary"
                      size="lg"
                    >
                      {isRunning ? runningLabel : "Run inference"}
                      {!isRunning && <ArrowUpRight className="h-3.5 w-3.5" />}
                    </Button>
                    {canSettle && (
                      <Button
                        type="button"
                        onClick={screen.settle}
                        disabled={isSettling}
                        loading={isSettling}
                        variant="secondary"
                        size="lg"
                      >
                        {isSettling ? "Posting batch" : "Settle now"}
                      </Button>
                    )}
                    {screen.receipt && !isSettling && (
                      <button
                        type="button"
                        onClick={screen.reset}
                        className="font-mono text-[11px] uppercase tracking-[0.2em] text-paper-faint transition-colors hover:text-paper"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}

                {/* Payment hash */}
                {screen.paymentTxHash && (
                  <div className="border-t border-rule pt-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="label">Payment</span>
                      <a
                        href={`${explorerUrl}/tx/${screen.paymentTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="link-copper font-mono text-xs tabular"
                      >
                        0.001 OG · {`${screen.paymentTxHash.slice(0, 8)}…${screen.paymentTxHash.slice(-6)}`}
                      </a>
                    </div>
                  </div>
                )}

                {/* Output preview */}
                {screen.output && (
                  <div className="border border-rule">
                    <div className="border-b border-rule px-4 py-2">
                      <span className="label label-copper">TEE-verified output</span>
                    </div>
                    <div className="break-words p-4 font-display italic text-base leading-relaxed text-paper">
                      "{screen.output}"
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ─── RIGHT: receipt, lineage graph, payouts ──────────────── */}
          <div className="col-span-12 space-y-8 lg:col-span-7">
            <ReceiptCard receipt={screen.receipt} status={screen.status} />

            <VerificationPanel
              receipt={screen.receipt}
              daPointer={screen.daPointer}
              settleResult={screen.settleResult}
            />

            <div className="editorial-card">
              <div className="flex items-center justify-between border-b border-rule px-6 py-3 lg:px-8">
                <span className="label">Lineage graph</span>
                <span className="label text-paper-faint">data → model ← skills</span>
              </div>
              <div className="aspect-[560/260] w-full p-2">
                {screen.agent ? (
                  <LineageTreeSvg agent={screen.agent} highlights={highlights} />
                ) : (
                  <div className="flex h-full items-center justify-center font-display italic text-base text-paper-faint">
                    Pick a model to render its lineage.
                  </div>
                )}
              </div>
            </div>

            <PayoutsCard payouts={screen.payouts} />

            {/* Status footer */}
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-rule pt-4">
              <span className="label">Status</span>
              <Badge
                tone={
                  screen.status === "done"
                    ? "moss"
                    : screen.status === "idle"
                      ? "default"
                      : "copper"
                }
              >
                {screen.status === "done" ? "settled" : screen.status}
              </Badge>
            </div>
          </div>
        </div>
      </PageWrap>
    </div>
  );
}
