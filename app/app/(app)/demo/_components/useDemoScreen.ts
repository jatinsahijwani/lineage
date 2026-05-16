"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSendTransaction } from "wagmi";
import { parseEther } from "viem";
import type { AttributionReceipt } from "@lineage/shared";

import { useLineage } from "@/hooks/useLineage";

/**
 * Demo state machine.
 *
 *   idle             — nothing in flight; user can click "Run inference".
 *   paying           — wallet popup awaiting the 0.001 OG payment.
 *   compute          — /api/inference dispatched, awaiting 0G Compute.
 *   attestation      — UX sub-phase: TEE attestation being fetched server-side.
 *   persisting       — UX sub-phase: receipt being written to 0G Storage.
 *   ready-to-settle  — receipt persisted; user can click "Settle now".
 *   settling         — /api/settle dispatched, awaiting RoyaltySplitter.postBatch.
 *   done             — payouts populated; ready for contributors to claim.
 */
export type DemoStatus =
  | "idle"
  | "paying"
  | "compute"
  | "attestation"
  | "persisting"
  | "ready-to-settle"
  | "settling"
  | "done";

export interface AgentSpec {
  id: string;
  name: string;
  description?: string;
  modelTokenId: bigint;
  skills: bigint[];
  data: bigint[];
  memory: bigint[];
}

export interface TokenSummary {
  tokenId: string;
  owner: string;
  royaltyBps: number;
}

export interface AvailableTokens {
  models: TokenSummary[];
  skills: TokenSummary[];
  data: TokenSummary[];
}

const EMPTY_TOKENS: AvailableTokens = { models: [], skills: [], data: [] };

/**
 * A single per-recipient row in the Payouts card.
 *
 * After the /api/settle refactor:
 *   - `recipient` is a real on-chain address (lower-cased), not a synthetic
 *     "data-7" label.
 *   - `amount` is a wei-denominated bigint serialised as a string — the
 *     frontend renders it via formatEther.
 *   - `proof` is the Merkle proof for this payout (also persisted server-side
 *     so the recipient can claim from /earnings later).
 *   - `batchId` / `txHash` link the payout back to the on-chain batch tx.
 *
 * `weight` is kept as a float in [0, 1] purely for the display micro-bar.
 */
export interface PayoutRow {
  recipient: string;
  label: string;
  /** Wei amount as a decimal string. Use formatEther at render time. */
  amount: string;
  weight: number;
  proof: `0x${string}`[];
  batchId: string;
  txHash: `0x${string}`;
}

/**
 * Pointer returned by the receipt-sink (0G Storage / 0G DA). We surface it on
 * the demo screen so the VerificationPanel can render the on-chain storage
 * root that anchors the persisted receipt.
 */
export interface DemoDaPointer {
  commitment: `0x${string}`;
  blobIndex: number;
}

interface ApiInferenceResponse {
  output: string;
  receipt: AttributionReceipt;
  daPointer: DemoDaPointer;
}

export interface DemoSettleResult {
  batchId: string;
  txHash: `0x${string}`;
  merkleRoot: `0x${string}`;
}

interface ApiSettleResponse {
  batchId: string;
  txHash: `0x${string}`;
  merkleRoot: `0x${string}`;
  payouts: Array<{
    recipient: `0x${string}`;
    token: `0x${string}`;
    amount: string;
    proof: `0x${string}`[];
  }>;
}

export function useDemoScreen() {
  const { account, isReady, chainId, network } = useLineage();
  const { sendTransactionAsync } = useSendTransaction();
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [paymentTxHash, setPaymentTxHash] = useState<`0x${string}` | null>(null);

  const [availableTokens, setAvailableTokens] =
    useState<AvailableTokens>(EMPTY_TOKENS);
  const [tokensLoading, setTokensLoading] = useState<boolean>(true);
  const [tokensError, setTokensError] = useState<string | null>(null);

  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [selectedSkillIds, setSelectedSkillIds] = useState<string[]>([]);
  const [selectedDataIds, setSelectedDataIds] = useState<string[]>([]);

  const refreshTokens = useCallback(async () => {
    setTokensLoading(true);
    setTokensError(null);
    try {
      const tokensUrl = chainId
        ? `/api/tokens?chainId=${chainId}`
        : "/api/tokens";
      const res = await fetch(tokensUrl, { cache: "no-store" });
      const payload = (await res.json()) as
        | AvailableTokens
        | { error: string };
      if (!res.ok || "error" in payload) {
        const msg =
          "error" in payload && payload.error
            ? payload.error
            : `failed to load tokens (HTTP ${res.status})`;
        throw new Error(msg);
      }
      setAvailableTokens({
        models: payload.models,
        skills: payload.skills,
        data: payload.data,
      });
    } catch (err) {
      setTokensError(err instanceof Error ? err.message : String(err));
      setAvailableTokens(EMPTY_TOKENS);
    } finally {
      setTokensLoading(false);
    }
  }, [chainId]);

  useEffect(() => {
    void refreshTokens();
  }, [refreshTokens]);

  // Auto-select the first model whenever the set of available models changes
  // and the current selection no longer matches an on-chain id.
  useEffect(() => {
    if (availableTokens.models.length === 0) {
      if (selectedModelId !== null) setSelectedModelId(null);
      return;
    }
    const stillValid =
      selectedModelId !== null &&
      availableTokens.models.some((m) => m.tokenId === selectedModelId);
    if (!stillValid) {
      setSelectedModelId(availableTokens.models[0]!.tokenId);
    }
  }, [availableTokens.models, selectedModelId]);

  // Prune any stale selections that no longer correspond to an on-chain id.
  useEffect(() => {
    const skillIds = new Set(availableTokens.skills.map((s) => s.tokenId));
    setSelectedSkillIds((prev) => prev.filter((id) => skillIds.has(id)));
  }, [availableTokens.skills]);
  useEffect(() => {
    const dataIds = new Set(availableTokens.data.map((d) => d.tokenId));
    setSelectedDataIds((prev) => prev.filter((id) => dataIds.has(id)));
  }, [availableTokens.data]);

  const toggleSkill = useCallback((tokenId: string) => {
    setSelectedSkillIds((prev) =>
      prev.includes(tokenId)
        ? prev.filter((id) => id !== tokenId)
        : [...prev, tokenId],
    );
  }, []);
  const toggleData = useCallback((tokenId: string) => {
    setSelectedDataIds((prev) =>
      prev.includes(tokenId)
        ? prev.filter((id) => id !== tokenId)
        : [...prev, tokenId],
    );
  }, []);

  /**
   * Synthesised agent for backwards compatibility — LineageTreeSvg consumes
   * the AgentSpec shape and we don't want to restyle that component. It's
   * null when no model is selected (e.g. fresh deploy with zero iNFTs).
   */
  const agent: AgentSpec | null = useMemo(() => {
    if (!selectedModelId) return null;
    return {
      id: `live:${selectedModelId}`,
      name: `Model #${selectedModelId}`,
      modelTokenId: BigInt(selectedModelId),
      skills: selectedSkillIds.map((s) => BigInt(s)),
      data: selectedDataIds.map((d) => BigInt(d)),
      memory: [],
    };
  }, [selectedModelId, selectedSkillIds, selectedDataIds]);

  const [prompt, setPrompt] = useState<string>(
    "Summarize today's top story about AI.",
  );
  const [receipt, setReceipt] = useState<AttributionReceipt | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [settleTxHash, setSettleTxHash] = useState<`0x${string}` | null>(null);
  const [daPointer, setDaPointer] = useState<DemoDaPointer | null>(null);
  const [settleResult, setSettleResult] = useState<DemoSettleResult | null>(
    null,
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setReceipt(null);
    setOutput(null);
    setPayouts([]);
    setSettleTxHash(null);
    setDaPointer(null);
    setSettleResult(null);
    setPaymentTxHash(null);
  }, []);

  const run = useCallback(async () => {
    if (!isReady || !account) {
      setError("Wallet not ready — connect first");
      return;
    }
    if (!agent) {
      setError("Pick a model iNFT before running inference");
      return;
    }

    // reset all state
    setError(null);
    setReceipt(null);
    setPayouts([]);
    setOutput(null);
    setSettleTxHash(null);
    setDaPointer(null);
    setSettleResult(null);
    setPaymentTxHash(null);

    if (!network) {
      setError("Unsupported chain — switch to 0G Mainnet or Galileo Testnet");
      return;
    }
    const splitterAddress = network.contracts.RoyaltySplitter;
    if (splitterAddress === "0x0000000000000000000000000000000000000000") {
      setError(
        `Lineage contracts not yet deployed on ${network.name}. Switch to a network where they are deployed.`,
      );
      return;
    }

    try {
      // Step 1: User pays inference fee from their own wallet to RoyaltySplitter
      setStatus("paying");
      const payHash = await sendTransactionAsync({
        to: splitterAddress,
        value: parseEther("0.001"),
      });
      setPaymentTxHash(payHash);

      // Step 2: Inference (payment tx confirms in background during the LLM call)
      setStatus("compute");
      let phaseStep = 0;
      const phases: DemoStatus[] = ["attestation", "persisting"];
      const phaseTimer = setInterval(() => {
        const next = phases[phaseStep++];
        if (next) setStatus(next);
        else clearInterval(phaseTimer);
      }, 3000);

      let inferPayload: ApiInferenceResponse;
      try {
        const res = await fetch("/api/inference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelTokenId: agent.modelTokenId.toString(),
            skills: agent.skills.map((s) => s.toString()),
            data: agent.data.map((d) => d.toString()),
            memory: agent.memory.map((m) => m.toString()),
            prompt,
            agentAddress: account,
            chainId: network.chainId,
          }),
        });
        const raw = (await res.json()) as
          | ApiInferenceResponse
          | { error: string };
        if (!res.ok || "error" in raw)
          throw new Error(
            "error" in raw ? raw.error : `inference failed (${res.status})`,
          );
        inferPayload = raw;
      } finally {
        clearInterval(phaseTimer);
      }

      setReceipt(inferPayload.receipt);
      setOutput(inferPayload.output);
      setDaPointer(inferPayload.daPointer);
      // Receipt is in hand — wait for the user to click "Settle now".
      setStatus("ready-to-settle");
    } catch (err) {
      console.error("run failed", err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("idle");
    }
  }, [account, isReady, agent, prompt, sendTransactionAsync, network]);

  const settle = useCallback(async () => {
    if (!receipt) {
      setError("No receipt to settle — run inference first");
      return;
    }
    setError(null);
    setStatus("settling");
    try {
      const res = await fetch("/api/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          receipt,
          chainId: network?.chainId,
        }),
      });
      const payload = (await res.json()) as
        | ApiSettleResponse
        | { error: string };
      if (!res.ok || "error" in payload) {
        const msg =
          "error" in payload && payload.error
            ? payload.error
            : `settle failed (HTTP ${res.status})`;
        throw new Error(msg);
      }

      const total = payload.payouts.reduce(
        (acc, p) => acc + BigInt(p.amount),
        0n,
      );
      const rows: PayoutRow[] = payload.payouts.map((p) => {
        const weight =
          total === 0n
            ? 0
            : Number((BigInt(p.amount) * 10_000n) / total) / 10_000;
        return {
          recipient: p.recipient,
          label: `${p.recipient.slice(0, 6)}…${p.recipient.slice(-4)}`,
          amount: p.amount,
          weight,
          proof: p.proof,
          batchId: payload.batchId,
          txHash: payload.txHash,
        };
      });

      setPayouts(rows);
      setSettleTxHash(payload.txHash);
      setSettleResult({
        batchId: payload.batchId,
        txHash: payload.txHash,
        merkleRoot: payload.merkleRoot,
      });
      setStatus("done");
    } catch (err) {
      console.error("settle failed", err);
      setError(err instanceof Error ? err.message : String(err));
      // Stay at ready-to-settle so the user can retry without re-paying.
      setStatus("ready-to-settle");
    }
  }, [receipt, network]);

  return {
    status,
    error,
    agent,
    prompt,
    setPrompt,
    receipt,
    output,
    payouts,
    settleTxHash,
    paymentTxHash,
    daPointer,
    settleResult,
    run,
    settle,
    reset,

    // Live on-chain token discovery.
    availableTokens,
    tokensLoading,
    tokensError,
    refreshTokens,

    // Three-picker selection state.
    selectedModelId,
    setSelectedModelId,
    selectedSkillIds,
    toggleSkill,
    selectedDataIds,
    toggleData,
  };
}
