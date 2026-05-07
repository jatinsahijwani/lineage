"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LineageClient } from "@lineage/sdk";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { zeroGTestnet } from "@/lib/wagmi";
import type { AttributionReceipt } from "@lineage/shared";

interface RoyaltyTick {
  contributor: string;
  amount: number;
  iNFT: string;
  timestamp: number;
}

const DEMO_AGENTS = [
  { label: "News Summarizer", modelTokenId: "1", skillTokenIds: ["3"] },
  { label: "Code Assistant", modelTokenId: "2", skillTokenIds: [] },
];

export default function DemoPage() {
  const { address } = useAccount();
  const [selectedAgent, setSelectedAgent] = useState(0);
  const [query, setQuery] = useState("Summarize today's top story about AI.");
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<AttributionReceipt | null>(null);
  const [ticks, setTicks] = useState<RoyaltyTick[]>([]);

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setOutput(null);
    setReceipt(null);
    setTicks([]);

    const agent = DEMO_AGENTS[selectedAgent]!;

    const client = new LineageClient({
      rpc: zeroGTestnet.rpcUrls.default.http[0],
      storage: process.env["NEXT_PUBLIC_ZERO_G_STORAGE_URL"] ?? "",
      da: process.env["NEXT_PUBLIC_ZERO_G_DA_URL"] ?? "",
      compute: process.env["NEXT_PUBLIC_ZERO_G_COMPUTE_URL"] ?? "",
      ...CONTRACT_ADDRESSES,
      teePublicKey: "0x0000000000000000000000000000000000000000",
      mockTEE: true,
    });

    try {
      const result = await client.runInference({
        modelTokenId: BigInt(agent.modelTokenId),
        skills: agent.skillTokenIds.map(BigInt),
        input: query,
        agentAddress: address ?? "0x0000000000000000000000000000000000000000",
      });

      setOutput(result.output);
      setReceipt(result.receipt);

      // Animate royalty ticks
      const allItems = [
        result.receipt.lineage.model,
        ...result.receipt.lineage.skills,
        ...result.receipt.lineage.data,
        ...result.receipt.lineage.memory,
      ];
      for (let i = 0; i < allItems.length; i++) {
        setTimeout(() => {
          setTicks((prev) => [
            ...prev,
            {
              contributor: `iNFT #${allItems[i]!.tokenId}`,
              amount: Math.round(allItems[i]!.weight * 0.001 * 1e6) / 1e6,
              iNFT: allItems[i]!.tokenId,
              timestamp: Date.now(),
            },
          ]);
        }, i * 400 + 300);
      }
    } catch (e) {
      setOutput(`Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-brand-900 mb-2">Inference Demo</h1>
      <p className="text-gray-500 mb-8">Run a query, watch the attribution receipt, and see royalties flowing live.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
          <select
            className="border rounded-lg px-3 py-2 w-full text-sm"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(Number(e.target.value))}
          >
            {DEMO_AGENTS.map((a, i) => (
              <option key={i} value={i}>{a.label} (model #{a.modelTokenId})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Query</label>
          <textarea
            rows={3}
            className="border rounded-lg px-3 py-2 w-full text-sm resize-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <button
          onClick={run}
          disabled={loading || !query.trim()}
          className="w-full py-3 bg-brand-500 text-white rounded-lg font-semibold hover:bg-brand-900 transition-colors disabled:opacity-40"
        >
          {loading ? "Running inference…" : "Run Inference"}
        </button>
      </div>

      {output && (
        <div className="mt-8 space-y-6">
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <h2 className="font-semibold text-gray-800 mb-2">Output</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{output}</p>
          </div>

          {receipt && (
            <div className="border border-brand-200 rounded-xl p-4 bg-brand-50">
              <h2 className="font-semibold text-brand-900 mb-3">Attribution Receipt</h2>
              <div className="font-mono text-xs text-brand-800 space-y-1">
                <div><span className="text-gray-500">receiptId:</span> {receipt.receiptId.slice(0, 20)}…</div>
                <div><span className="text-gray-500">model:</span> #{receipt.lineage.model.tokenId} (weight: {(receipt.lineage.model.weight * 100).toFixed(0)}%)</div>
                {receipt.lineage.skills.map((s) => (
                  <div key={s.tokenId}><span className="text-gray-500">skill:</span> #{s.tokenId} (weight: {(s.weight * 100).toFixed(0)}%)</div>
                ))}
                <div><span className="text-gray-500">timestamp:</span> {new Date(receipt.timestamp * 1000).toISOString()}</div>
                <div><span className="text-gray-500">computeNode:</span> {receipt.computeProof.chatId}</div>
              </div>
            </div>
          )}

          {ticks.length > 0 && (
            <div className="border border-green-200 rounded-xl p-4 bg-green-50">
              <h2 className="font-semibold text-green-800 mb-3">Royalties Flowing</h2>
              <div className="space-y-2">
                {ticks.map((tick, i) => (
                  <div key={i} className="flex items-center justify-between text-sm animate-pulse-once">
                    <span className="font-mono text-green-700">{tick.contributor}</span>
                    <span className="font-semibold text-green-800">+{tick.amount} USDC</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
