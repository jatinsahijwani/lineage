"use client";

import { useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { LineageClient } from "@lineage/sdk";
import { zeroGTestnet } from "@/lib/wagmi";

interface ClaimableEntry {
  batchId: bigint;
  token: `0x${string}`;
  amount: bigint;
  proof: `0x${string}`[];
}

export default function EarningsPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [claimable, setClaimable] = useState<ClaimableEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const NATIVE_TOKEN = "0x0000000000000000000000000000000000000000" as `0x${string}`;

  const refresh = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const client = new LineageClient({
        rpc: zeroGTestnet.rpcUrls.default.http[0],
        storage: "",
        da: "",
        compute: "",
        ...CONTRACT_ADDRESSES,
        teePublicKey: "0x0000000000000000000000000000000000000000",
        mockTEE: true,
      });
      const bal = await client.getClaimableBalance(address, NATIVE_TOKEN);
      setBalance(bal);
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const claimAll = async () => {
    if (!walletClient || !address || claimable.length === 0) return;
    setClaiming(true);
    try {
      const client = new LineageClient({
        rpc: zeroGTestnet.rpcUrls.default.http[0],
        storage: "",
        da: "",
        compute: "",
        ...CONTRACT_ADDRESSES,
        teePublicKey: "0x0000000000000000000000000000000000000000",
        mockTEE: true,
      });
      const account = { address, type: "json-rpc" } as const;
      for (const entry of claimable) {
        await client.claim({
          batchId: entry.batchId,
          token: entry.token,
          amount: entry.amount,
          proof: entry.proof,
          wallet: walletClient,
          account,
        });
      }
      setStatus("Claimed successfully!");
      await refresh();
    } catch (e) {
      setStatus(`Error: ${String(e)}`);
    } finally {
      setClaiming(false);
    }
  };

  const formatAmount = (n: bigint) => {
    const eth = Number(n) / 1e18;
    return eth.toFixed(6);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-brand-900 mb-2">My Earnings</h1>
      <p className="text-gray-500 mb-8">Pending royalty payouts from your iNFTs. Withdraw anytime with a Merkle proof.</p>

      {!isConnected ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Connect your wallet to see earnings</p>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="border border-gray-200 rounded-xl p-6 bg-white">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Claimable Balance</h2>
              <button
                onClick={refresh}
                disabled={loading}
                className="text-sm text-brand-500 hover:underline disabled:opacity-50"
              >
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
            <div className="text-4xl font-bold text-brand-900">
              {balance !== null ? formatAmount(balance) : "—"} <span className="text-xl font-normal text-gray-500">0G</span>
            </div>
            {balance !== null && balance === 0n && (
              <p className="text-sm text-gray-500 mt-2">No claimable balance yet. Run some inferences to earn royalties.</p>
            )}
          </div>

          {claimable.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-4 bg-white">
              <h2 className="font-semibold text-gray-800 mb-3">Pending Claims ({claimable.length} batches)</h2>
              <div className="space-y-2">
                {claimable.map((c, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-600">Batch #{c.batchId.toString()}</span>
                    <span className="font-mono">{formatAmount(c.amount)} 0G</span>
                  </div>
                ))}
              </div>
              <button
                onClick={claimAll}
                disabled={claiming}
                className="mt-4 w-full py-2 bg-brand-500 text-white rounded-lg font-medium text-sm hover:bg-brand-900 transition-colors disabled:opacity-50"
              >
                {claiming ? "Claiming…" : "Claim All"}
              </button>
            </div>
          )}

          {status && (
            <div className="p-4 rounded-lg text-sm bg-blue-50 text-blue-700">{status}</div>
          )}

          <div className="border border-gray-100 rounded-xl p-4 bg-gray-50 text-sm text-gray-600">
            <p className="font-medium mb-1">How royalties work</p>
            <p>Every inference produces a receipt posted to 0G DA. The settlement worker (hourly) reads receipts, propagates weights through the lineage graph, and posts a Merkle root on-chain. You withdraw your share anytime — no gas cost until you claim.</p>
          </div>
        </div>
      )}
    </div>
  );
}
