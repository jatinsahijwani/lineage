"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatEther } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import {
  AlertTriangle,
  Loader2,
  ArrowUpRight,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { ZG_TESTNET } from "@lineage/shared";

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
  Button,
  Chapter,
  Marginalia,
  PageWrap,
} from "@/components/editorial";

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

  // Compact display: trim long fractional tails so the giant hero number
  // doesn't push "OG · native" off the line. ≥1 OG → 4 decimals. Anything
  // smaller → up to 8 significant decimals with trailing zeros stripped.
  // Tooltip surfaces the full wei-precision value.
  const formatted = useMemo(() => {
    if (claimed === null) return "—";
    const exact = formatEther(claimed);
    const og = Number(exact);
    if (!Number.isFinite(og)) return exact;
    if (og === 0) return "0";
    if (og >= 1) return og.toFixed(4);
    const truncated = og.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    return truncated || "0";
  }, [claimed]);

  const formattedExact = useMemo(
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
    <div className="pb-24 lg:pb-32">
      <PageWrap>
        <Chapter
          number="03"
          eyebrow="The ledger"
          title={
            <>
              Claim what's <em className="font-display italic text-copper">owed</em> to you.
            </>
          }
          lede="Royalties accrue every settlement window. The off-chain settler posts a Merkle root on-chain and serves a per-recipient proof you can submit here. One claim per batch per token — the contract enforces it."
          marginalia={
            <Marginalia>
              <p className="mb-2 text-copper">Pulls, not pushes.</p>
              <p>
                The splitter never sends funds. You submit a Merkle proof and
                the contract verifies, then transfers. Gas-efficient and
                replayable.
              </p>
            </Marginalia>
          }
        />

        {(!isConnected || !chainOk) ? (
          <div className="editorial-card mt-16 p-8 lg:p-10">
            <p
              className="display text-2xl text-paper lg:text-3xl"
              style={{ fontVariationSettings: '"opsz" 72' }}
            >
              Connect a wallet to view your ledger.
            </p>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-paper-dim">
              Lineage runs on 0G Mainnet (chainId&nbsp;16661) and Galileo
              Testnet (chainId&nbsp;16602). Switch via the masthead.
            </p>
            <div className="mt-6">
              <LineageConnectButton />
            </div>
          </div>
        ) : (
          <div className="mt-16 grid grid-cols-12 gap-x-6 gap-y-10">
            {/* ── Claimed-to-date hero ─────────────────────────────── */}
            <section className="col-span-12 lg:col-span-8">
              <div className="flex items-baseline justify-between border-b border-rule pb-3">
                <span className="label label-copper">Claimed to date</span>
                <button
                  type="button"
                  onClick={refresh}
                  disabled={loading || proofsLoading}
                  aria-label="Refresh balance and proofs"
                  className="inline-flex h-7 w-7 items-center justify-center border border-rule text-paper-faint transition-colors hover:border-copper hover:text-copper disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${loading || proofsLoading ? "animate-spin" : ""}`}
                  />
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                {loading ? (
                  <Loader2 className="h-9 w-9 animate-spin text-paper-faint" />
                ) : (
                  <>
                    <span
                      className="display-upright tabular text-[clamp(2.75rem,6.5vw,4.75rem)] leading-[1.05] text-paper"
                      style={{ fontVariationSettings: '"opsz" 144' }}
                      title={`exact: ${formattedExact} OG`}
                    >
                      {formatted}
                    </span>
                    <span className="font-mono text-sm uppercase tracking-[0.22em] text-paper-faint">
                      OG · native
                    </span>
                  </>
                )}
              </div>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-paper-dim">
                Pending claims appear below once the settler posts a batch.
                Each row is one proof; one click per row.
              </p>

              {loadError && (
                <div className="mt-4 flex items-start gap-2 border border-copper/40 bg-copper/5 p-3 font-mono text-[11px] text-copper">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="break-words">{loadError}</span>
                </div>
              )}
            </section>

            {/* ── Network sidebar ──────────────────────────────────── */}
            <aside className="col-span-12 space-y-6 lg:col-span-3 lg:col-start-10">
              <div className="border-l border-rule pl-4">
                <span className="label">On</span>
                <p
                  className="mt-2 display text-2xl text-paper"
                  style={{ fontVariationSettings: '"opsz" 72' }}
                >
                  {chain?.name ?? "—"}
                </p>
                <p className="mt-1 font-mono text-[11px] tabular text-paper-faint">
                  chainId {chain?.id ?? "—"}
                </p>
              </div>
              <div className="border-l border-rule pl-4">
                <span className="label">Outstanding</span>
                <p
                  className="mt-2 display-upright tabular text-3xl text-paper"
                  style={{ fontVariationSettings: '"opsz" 96' }}
                >
                  {proofs.length}
                </p>
                <p className="mt-1 font-mono text-[11px] text-paper-faint">
                  unclaimed proofs
                </p>
              </div>
            </aside>

            {/* ── Outstanding payouts ──────────────────────────────── */}
            <section className="col-span-12">
              <div className="editorial-card">
                <div className="flex items-baseline justify-between border-b border-rule px-6 py-3 lg:px-8">
                  <span className="label label-copper">Outstanding payouts</span>
                  <span className="label tabular">{proofs.length} pending</span>
                </div>

                {proofsError && (
                  <div className="mx-6 mt-4 flex items-start gap-2 border border-rust/40 bg-rust/5 p-3 font-mono text-[11px] text-rust lg:mx-8">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="break-words">{proofsError}</span>
                  </div>
                )}

                {proofsLoading && proofs.length === 0 ? (
                  <div className="flex h-24 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-paper-faint" />
                  </div>
                ) : proofs.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center px-6 text-center">
                    <p
                      className="display italic text-2xl text-paper-faint"
                      style={{ fontVariationSettings: '"opsz" 72' }}
                    >
                      Nothing pending.
                    </p>
                    <p className="mt-1 font-mono text-[11px] text-paper-mute">
                      no outstanding payouts for this address
                    </p>
                  </div>
                ) : (
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>§ Batch</th>
                        <th>Posted</th>
                        <th>Token</th>
                        <th className="text-right">Amount</th>
                        <th className="text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proofs.map((p, i) => {
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
                          <tr key={key}>
                            <td>
                              <div className="flex flex-col">
                                <span className="chapter-mark">
                                  §{String(i + 1).padStart(2, "0")}
                                </span>
                                <span className="font-mono text-sm tabular text-paper">
                                  #{shortBatch(p.batchId)}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className="font-mono text-[11px] text-paper-faint">
                                {formatPostedAt(p.postedAt)}
                              </span>
                              <div className="mt-1">
                                <a
                                  href={`${explorerUrl}/tx/${p.txHash}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="link-copper font-mono text-[10px] tabular"
                                >
                                  {shortHex(p.txHash, 6, 4)} ↗
                                </a>
                              </div>
                            </td>
                            <td>
                              <span className="font-mono text-xs text-paper">
                                {tokenLabel}
                              </span>
                            </td>
                            <td className="text-right">
                              <div className="flex items-baseline justify-end gap-1.5">
                                <span className="display-upright tabular text-lg text-paper">
                                  {amountFmt}
                                </span>
                                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-paper-faint">
                                  OG
                                </span>
                              </div>
                              {errMsg && (
                                <div className="mt-2 flex items-start justify-end gap-1.5 font-mono text-[10px] text-rust">
                                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                                  <span className="max-w-[20ch] truncate">
                                    {errMsg}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="text-right">
                              <Button
                                type="button"
                                onClick={() => claimRecord(p)}
                                disabled={isPending || isJustClaimed}
                                loading={isPending}
                                variant={isJustClaimed ? "secondary" : "primary"}
                                size="sm"
                              >
                                {isPending ? (
                                  "Claiming"
                                ) : isJustClaimed ? (
                                  <>
                                    Claimed <CheckCircle2 className="h-3 w-3" />
                                  </>
                                ) : (
                                  <>
                                    Claim <ArrowUpRight className="h-3 w-3" />
                                  </>
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* ── Paste-proof appendix ─────────────────────────────── */}
            <section className="col-span-12">
              <Collapsible>
                <CollapsibleTrigger className="group inline-flex items-baseline gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-paper-faint transition-colors hover:text-copper">
                  <span>Appendix · paste proof manually</span>
                  <span className="text-paper-mute group-hover:text-copper">↓</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4">
                  <div className="editorial-card p-6 lg:p-8">
                    <span className="label">Manual claim</span>
                    <p
                      className="mt-3 display text-2xl text-paper"
                      style={{ fontVariationSettings: '"opsz" 72' }}
                    >
                      Submit a proof by hand.
                    </p>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-paper-dim">
                      Paste a JSON object{" "}
                      <code className="font-mono text-copper">
                        {"{ batchId, token, amount, proof: string[] }"}
                      </code>{" "}
                      from the settler. Use this when the automatic list is
                      missing a batch you know is yours.
                    </p>
                    <Textarea
                      rows={6}
                      value={proofText}
                      onChange={(e) => setProofText(e.target.value)}
                      placeholder='{\n  "batchId": "1",\n  "token": "0x0000000000000000000000000000000000000000",\n  "amount": "1000000000000000",\n  "proof": ["0x…"]\n}'
                      className="mt-4 min-h-32 rounded-none border-0 border-b border-rule bg-transparent px-0 font-mono text-xs text-paper placeholder:text-paper-faint focus-visible:border-copper focus-visible:ring-0"
                    />
                    {claimError && (
                      <div className="mt-3 flex items-start gap-2 border border-rust/40 bg-rust/5 p-3 font-mono text-[11px] text-rust">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="break-words">{claimError}</span>
                      </div>
                    )}
                    {claimTx && (
                      <div className="mt-3 border border-moss/40 bg-moss/5 p-3 font-mono text-[11px]" style={{ color: "var(--moss)" }}>
                        Claim submitted ·{" "}
                        <a
                          href={`${explorerUrl}/tx/${claimTx}`}
                          target="_blank"
                          rel="noreferrer"
                          className="link-copper tabular"
                        >
                          {claimTx.slice(0, 10)}…{claimTx.slice(-6)}
                        </a>
                      </div>
                    )}
                    <div className="mt-6 flex items-center gap-3">
                      <Button
                        type="button"
                        onClick={submitProof}
                        disabled={!proofText.trim()}
                        loading={claiming}
                        variant="primary"
                        size="md"
                      >
                        {claiming ? "Claiming" : "Submit claim"}
                        {!claiming && <ArrowUpRight className="h-3 w-3" />}
                      </Button>
                      <button
                        type="button"
                        onClick={refresh}
                        className="font-mono text-[11px] uppercase tracking-[0.22em] text-paper-faint transition-colors hover:text-paper"
                      >
                        Refresh balance
                      </button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </section>
          </div>
        )}
      </PageWrap>
    </div>
  );
}
