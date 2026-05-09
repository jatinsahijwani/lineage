"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { formatEther } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { Coins, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { ZG_TESTNET } from "@lineage/shared";

import { GradientBg } from "@/components/shared/GradientBg";
import { GlowingBadge } from "@/components/shared/GlowingBadge";
import { Textarea } from "@/components/ui/textarea";
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

export default function EarningsPage() {
  const { client, account, isConnected, chainOk } = useLineage();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [claimed, setClaimed] = useState<bigint | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [proofText, setProofText] = useState("");
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimTx, setClaimTx] = useState<`0x${string}` | null>(null);
  const [claiming, setClaiming] = useState(false);

  const refresh = useCallback(async () => {
    if (!publicClient || !account) return;
    setLoading(true);
    setLoadError(null);
    try {
      const v = (await publicClient.readContract({
        address: CONTRACT_ADDRESSES.RoyaltySplitter,
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

  useEffect(() => {
    if (isConnected && chainOk && account) refresh();
  }, [isConnected, chainOk, account, refresh]);

  const formatted = useMemo(
    () => (claimed === null ? "—" : formatEther(claimed)),
    [claimed],
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
      // viem types in the app's node_modules tree are duplicated under two
      // typescript versions due to pnpm peer-dependency resolution, so the
      // structurally-identical WalletClient/Account types appear distinct.
      // Cast at the SDK boundary to bridge the duplication.
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
                Connect a wallet on {ZG_TESTNET.name} (chainId{" "}
                {ZG_TESTNET.chainId}) to view your claimable balance.
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
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/40">
                  <Coins className="h-3 w-3" /> native OG
                </span>
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
                Pending claims appear here once a batch is posted; click below
                to claim with the operator-supplied Merkle proof. (For the
                demo, proofs would be served by the off-chain settler — wire up
                via a separate API in v2.)
              </p>

              {loadError && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="break-words">{loadError}</span>
                </div>
              )}
            </motion.div>

            <motion.div
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              className="rounded-xl border border-white/10 glass-dark p-6"
            >
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
                    href={`${ZG_TESTNET.blockExplorer}/tx/${claimTx}`}
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
            </motion.div>
          </div>
        )}
      </div>
    </GradientBg>
  );
}
