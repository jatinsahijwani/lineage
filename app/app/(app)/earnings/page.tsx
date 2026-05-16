"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatEther } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import {
  Coins,
  AlertTriangle,
  Loader2,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { ZG_TESTNET } from "@lineage/shared";

import { GradientBg } from "@/components/shared/GradientBg";
import { GlowingBadge } from "@/components/shared/GlowingBadge";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { LineageConnectButton } from "@/components/connect-button";
import { useLineage } from "@/hooks/useLineage";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { ROYALTY_SPLITTER_ABI } from "@/lib/abis";
import {
  titleVariants,
  subtitleVariants,
  cardVariants,
} from "@/lib/animations";

const PRIMARY_CTA_CLASS =
  "group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50";

const ZERO_TOKEN = "0x0000000000000000000000000000000000000000" as const;

interface ProofPayload {
  batchId: string;
  token: `0x${string}`;
  amount: string;
  proof: `0x${string}`[];
}

interface ProofRecord {
  batchId: string;
  token: `0x${string}`;
  amount: string;
  proof: `0x${string}`[];
  txHash: `0x${string}`;
  postedAt: string;
  claimed: boolean;
}

interface ProofsResponse {
  proofs: ProofRecord[];
}

function shortBatch(id: string): string {
  if (id.length <= 8) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function shortHex(hex: string, head = 6, tail = 4): string {
  if (hex.length <= head + tail + 3) return hex;
  return `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

function formatPostedAt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function EarningsPage() {
  const { client, account, isConnected, chainOk, network, chain } = useLineage();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const splitterAddress =
    network?.contracts.RoyaltySplitter ?? CONTRACT_ADDRESSES.RoyaltySplitter;
  const explorerUrl =
    chain?.blockExplorers?.default?.url ??
    network?.blockExplorer ??
    ZG_TESTNET.blockExplorer;

  const [claimed, setClaimed] = useState<bigint | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [proofs, setProofs] = useState<ProofRecord[]>([]);
  const [proofsLoading, setProofsLoading] = useState(false);
  const [proofsError, setProofsError] = useState<string | null>(null);

  // Per-card claim state, keyed by `${batchId}:${token}`.
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [justClaimedKey, setJustClaimedKey] = useState<string | null>(null);
  const [cardError, setCardError] = useState<{ key: string; msg: string } | null>(
    null,
  );

  // Legacy paste-proof state.
  const [proofText, setProofText] = useState("");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTx, setClaimTx] = useState<`0x${string}` | null>(null);
  const [claiming, setClaiming] = useState(false);

  const refreshBalance = useCallback(async () => {
    if (!publicClient || !account) return;
    setLoading(true);
    setLoadError(null);
    try {
      const v = (await publicClient.readContract({
        address: splitterAddress,
        abi: ROYALTY_SPLITTER_ABI,
        functionName: "balanceOf",
        args: [account, ZERO_TOKEN],
      })) as bigint;
      setClaimed(v);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [publicClient, account]);

  const refreshProofs = useCallback(async () => {
    if (!account) return;
    setProofsLoading(true);
    setProofsError(null);
    try {
      const res = await fetch(`/api/proofs/${account}`);
      const payload = (await res.json()) as
        | ProofsResponse
        | { error: string };
      if (!res.ok || "error" in payload) {
        const msg =
          "error" in payload && payload.error
            ? payload.error
            : `failed to load proofs (HTTP ${res.status})`;
        throw new Error(msg);
      }
      setProofs(payload.proofs);
    } catch (err) {
      setProofsError(err instanceof Error ? err.message : String(err));
    } finally {
      setProofsLoading(false);
    }
  }, [account]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshBalance(), refreshProofs()]);
  }, [refreshBalance, refreshProofs]);

  useEffect(() => {
    if (isConnected && chainOk && account) {
      void refresh();
    }
  }, [isConnected, chainOk, account, refresh]);

  const formatted = useMemo(
    () => (claimed === null ? "—" : formatEther(claimed)),
    [claimed],
  );

  const claimRecord = useCallback(
    async (p: ProofRecord) => {
      const key = `${p.batchId}:${p.token.toLowerCase()}`;
      setCardError(null);
      if (!client || !account || !walletClient) {
        setCardError({
          key,
          msg: "Wallet not ready — connect on chainId 16602",
        });
        return;
      }
      setPendingKey(key);
      try {
        await client.claim({
          batchId: BigInt(p.batchId),
          token: p.token,
          amount: BigInt(p.amount),
          proof: p.proof,
          // viem types in the app's node_modules tree are duplicated under two
          // typescript versions due to pnpm peer-dependency resolution, so the
          // structurally-identical WalletClient/Account types appear distinct.
          // Cast at the SDK boundary to bridge the duplication.
          wallet: walletClient as unknown as Parameters<
            typeof client.claim
          >[0]["wallet"],
          account: {
            address: account,
            type: "json-rpc",
          } as unknown as Parameters<typeof client.claim>[0]["account"],
        });
        // Bookkeeping ping so the proof disappears from the next fetch.
        try {
          await fetch("/api/claims", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              recipient: account,
              batchId: p.batchId,
              token: p.token,
            }),
          });
        } catch {
          // Bookkeeping failure is non-fatal; the on-chain state is the source
          // of truth and the next refetch will heal eventually.
        }
        setJustClaimedKey(key);
        // brief success flash before refetch removes the card
        setTimeout(() => {
          setJustClaimedKey((cur) => (cur === key ? null : cur));
        }, 1500);
        await refresh();
      } catch (err) {
        setCardError({
          key,
          msg: err instanceof Error ? err.message : String(err),
        });
      } finally {
        setPendingKey((cur) => (cur === key ? null : cur));
      }
    },
    [client, account, walletClient, refresh],
  );

  const submitProof = useCallback(async () => {
    setClaimError(null);
    setClaimTx(null);
    if (!client || !account || !walletClient) {
      setClaimError("Wallet not ready — connect on chainId 16602");
      return;
    }
    let parsed: ProofPayload;
    try {
      parsed = JSON.parse(proofText) as ProofPayload;
    } catch {
      setClaimError("Could not parse JSON. Expected { batchId, token, amount, proof }.");
      return;
    }
    if (
      typeof parsed.batchId !== "string" ||
      typeof parsed.amount !== "string" ||
      !Array.isArray(parsed.proof)
    ) {
      setClaimError("Missing required fields: batchId (string), amount (string), proof (string[])");
      return;
    }
    setClaiming(true);
    try {
      const hash = await client.claim({
        batchId: BigInt(parsed.batchId),
        token: parsed.token,
        amount: BigInt(parsed.amount),
        proof: parsed.proof,
        wallet: walletClient as unknown as Parameters<typeof client.claim>[0]["wallet"],
        account: {
          address: account,
          type: "json-rpc",
        } as unknown as Parameters<typeof client.claim>[0]["account"],
      });
      setClaimTx(hash as `0x${string}`);
      await refresh();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : String(err));
    } finally {
      setClaiming(false);
    }
  }, [client, account, walletClient, proofText, refresh]);

  return (
    <GradientBg variant="subtle" className="min-h-[calc(100vh-4rem)]">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <motion.div initial="hidden" animate="visible" className="mb-10 flex flex-col gap-3">
          <motion.div variants={subtitleVariants}>
            <GlowingBadge variant="cyan">Earnings</GlowingBadge>
          </motion.div>
          <motion.h1
            variants={titleVariants}
            className="text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl"
          >
            Claim your royalties
          </motion.h1>
          <motion.p
            variants={subtitleVariants}
            className="max-w-2xl text-balance text-base text-white/60"
          >
            Royalties accrue every settlement window. The off-chain settler
            posts a Merkle root on-chain and serves a per-recipient proof you
            can submit here to claim.
          </motion.p>
        </motion.div>

        {(!isConnected || !chainOk) ? (
          <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="rounded-xl border border-white/10 glass-dark p-8"
          >
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-white/70">
                Connect a wallet on 0G Mainnet or 0G Galileo Testnet to view
                your claimable balance.
              </p>
              <LineageConnectButton />
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="rounded-xl border border-white/10 glass-dark p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
                  Claimed to date
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={refresh}
                    disabled={loading || proofsLoading}
                    aria-label="Refresh balance and proofs"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/[0.02] text-white/60 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${loading || proofsLoading ? "animate-spin" : ""}`}
                    />
                  </button>
                  <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/40">
                    <Coins className="h-3 w-3" /> native OG
                  </span>
                </div>
              </div>

              <div className="flex items-baseline gap-3">
                {loading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-white/60" />
                ) : (
                  <>
                    <span className="font-mono text-4xl font-semibold text-white">
                      {formatted}
                    </span>
                    <span className="text-base text-white/50">OG</span>
                  </>
                )}
              </div>
              <p className="mt-2 max-w-xl text-xs text-white/50">
                Pending claims appear below once the settler posts a batch.
                Click <span className="font-mono">Claim</span> on any card to
                submit the on-chain proof.
              </p>

              {loadError && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="break-words">{loadError}</span>
                </div>
              )}
            </motion.div>

            {/* Auto-fetched proofs list */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="rounded-xl border border-white/10 glass-dark p-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
                  Outstanding payouts
                </h3>
                <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                  {proofs.length} pending
                </span>
              </div>

              {proofsError && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="break-words">{proofsError}</span>
                </div>
              )}

              {proofsLoading && proofs.length === 0 ? (
                <div className="flex h-20 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white/40" />
                </div>
              ) : proofs.length === 0 ? (
                <p className="text-sm text-white/50">
                  No outstanding payouts for this address.
                </p>
              ) : (
                <ul className="space-y-2">
                  <AnimatePresence>
                    {proofs.map((p) => {
                      const key = `${p.batchId}:${p.token.toLowerCase()}`;
                      const isPending = pendingKey === key;
                      const isJustClaimed = justClaimedKey === key;
                      const isNative = p.token.toLowerCase() === ZERO_TOKEN;
                      const tokenLabel = isNative
                        ? "native OG"
                        : shortHex(p.token, 6, 4);
                      let amountFmt = "—";
                      try {
                        amountFmt = formatEther(BigInt(p.amount));
                      } catch {
                        amountFmt = p.amount;
                      }
                      const errMsg =
                        cardError && cardError.key === key
                          ? cardError.msg
                          : null;
                      return (
                        <motion.li
                          key={key}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.3 }}
                          className="flex flex-col gap-3 rounded-md border border-white/5 bg-white/[0.02] px-4 py-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-white/40">
                                  batch
                                </span>
                                <span className="font-mono text-sm text-white">
                                  #{shortBatch(p.batchId)}
                                </span>
                                <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
                                  · {tokenLabel}
                                </span>
                              </div>
                              <div className="mt-1 font-mono text-[10px] text-white/40">
                                posted {formatPostedAt(p.postedAt)}
                              </div>
                            </div>
                            <div className="flex items-baseline gap-1.5 text-right font-mono text-sm">
                              <span className="text-white">{amountFmt}</span>
                              <span className="text-white/40">OG</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <a
                              href={`${explorerUrl}/tx/${p.txHash}`}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-[10px] text-white/40 hover:text-white/70"
                            >
                              batch tx {shortHex(p.txHash, 8, 6)}
                            </a>
                            <button
                              type="button"
                              onClick={() => claimRecord(p)}
                              disabled={isPending || isJustClaimed}
                              className={PRIMARY_CTA_CLASS}
                            >
                              {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : isJustClaimed ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : (
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                              )}
                              {isPending
                                ? "Claiming…"
                                : isJustClaimed
                                  ? "Claimed ✓"
                                  : "Claim"}
                            </button>
                          </div>
                          {errMsg && (
                            <div className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-2 text-[11px] text-red-200">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span className="break-words">{errMsg}</span>
                            </div>
                          )}
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
              )}
            </motion.div>

            {/* Secondary affordance — paste proof manually */}
            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
            >
              <Collapsible>
                <CollapsibleTrigger className="group inline-flex items-center gap-2 text-xs text-white/40 hover:text-white/70">
                  <span className="underline decoration-dotted underline-offset-4">
                    Paste proof manually
                  </span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="rounded-xl border border-white/10 glass-dark p-6">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
                      Paste proof
                    </h3>
                    <p className="mt-1 text-xs text-white/50">
                      Submit a JSON object{" "}
                      <code className="font-mono text-white/70">
                        {"{ batchId, token, amount, proof: string[] }"}
                      </code>{" "}
                      supplied by the settler.
                    </p>
                    <Textarea
                      rows={6}
                      value={proofText}
                      onChange={(e) => setProofText(e.target.value)}
                      placeholder='{\n  "batchId": "1",\n  "token": "0x0000000000000000000000000000000000000000",\n  "amount": "1000000000000000",\n  "proof": ["0x…"]\n}'
                      className="mt-4 min-h-32 bg-white/[0.02] font-mono text-xs text-white"
                    />
                    {claimError && (
                      <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-200">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span className="break-words">{claimError}</span>
                      </div>
                    )}
                    {claimTx && (
                      <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-200">
                        Claim submitted ·{" "}
                        <a
                          href={`${explorerUrl}/tx/${claimTx}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-emerald-300 hover:underline"
                        >
                          {claimTx.slice(0, 10)}…{claimTx.slice(-6)}
                        </a>
                      </div>
                    )}
                    <div className="mt-4 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={submitProof}
                        disabled={claiming || !proofText.trim()}
                        className={PRIMARY_CTA_CLASS}
                      >
                        {claiming ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        )}
                        {claiming ? "Claiming…" : "Submit claim"}
                      </button>
                      <button
                        type="button"
                        onClick={refresh}
                        className="text-sm text-white/50 hover:text-white"
                      >
                        Refresh balance
                      </button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          </div>
        )}
      </div>
    </GradientBg>
  );
}
