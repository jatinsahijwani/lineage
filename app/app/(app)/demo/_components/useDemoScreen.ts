"use client";

import { useCallback, useState } from "react";
import type { AttributionReceipt } from "@lineage/shared";

import { useLineage } from "@/hooks/useLineage";

export type DemoStatus = "idle" | "running" | "settling" | "done";

export interface AgentSpec {
  id: string;
  name: string;
  modelTokenId: bigint;
  skills: bigint[];
  data: bigint[];
}

export const DEMO_AGENTS: AgentSpec[] = [
  {
    id: "news-summarizer",
    name: "News Summarizer",
    modelTokenId: 1n,
    skills: [3n],
    data: [7n],
  },
  {
    id: "code-assistant",
    name: "Code Assistant",
    modelTokenId: 2n,
    skills: [],
    data: [9n],
  },
];

export interface PayoutRow {
  recipient: string; // address-shaped or token-id label
  label: string;
  amount: number; // OG (already weighted)
  weight: number; // 0..1 (display only)
}

const DEMO_TOTAL_REVENUE_OG = 0.001;

export function useDemoScreen() {
  const { client, account, isReady } = useLineage();
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState<AgentSpec>(DEMO_AGENTS[0]!);
  const [prompt, setPrompt] = useState<string>(
    "Summarize today's top story about AI.",
  );
  const [receipt, setReceipt] = useState<AttributionReceipt | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setReceipt(null);
    setOutput(null);
    setPayouts([]);
  }, []);

  const run = useCallback(async () => {
    if (!isReady || !client || !account) {
      setError("Wallet not ready — connect on chainId 16602 first");
      return;
    }
    setError(null);
    setReceipt(null);
    setPayouts([]);
    setOutput(null);
    setStatus("running");
    try {
      const result = await client.runInference({
        modelTokenId: agent.modelTokenId,
        skills: agent.skills,
        input: prompt,
        agentAddress: account,
      });
      setReceipt(result.receipt);
      setOutput(result.output);
      setStatus("idle");
    } catch (err) {
      console.error("inference failed", err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("idle");
    }
  }, [client, account, isReady, agent, prompt]);

  const settle = useCallback(() => {
    if (!receipt) return;
    setStatus("settling");
    const { model, skills, data } = receipt.lineage;
    const rows: PayoutRow[] = [];
    rows.push({
      recipient: `model-${model.tokenId}`,
      label: `Model #${model.tokenId}`,
      weight: model.weight,
      amount: model.weight * DEMO_TOTAL_REVENUE_OG,
    });
    for (const s of skills) {
      rows.push({
        recipient: `skill-${s.tokenId}`,
        label: `Skill #${s.tokenId}`,
        weight: s.weight,
        amount: s.weight * DEMO_TOTAL_REVENUE_OG,
      });
    }
    for (const d of data) {
      rows.push({
        recipient: `data-${d.tokenId}`,
        label: `Data #${d.tokenId}`,
        weight: d.weight,
        amount: d.weight * DEMO_TOTAL_REVENUE_OG,
      });
    }
    setPayouts(rows);
    setStatus("done");
  }, [receipt]);

  return {
    status,
    error,
    agent,
    setAgent,
    prompt,
    setPrompt,
    receipt,
    output,
    payouts,
    run,
    settle,
    reset,
  };
}
