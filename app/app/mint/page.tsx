"use client";

import { useState, useCallback } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import { LineageClient } from "@lineage/sdk";
import { zeroGTestnet } from "@/lib/wagmi";

type INFTKind = "data" | "model" | "skill";

const EDGE_TYPES = ["TrainedOn", "FineTunedFrom", "Composes", "DependsOn"] as const;

export default function MintPage() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [kind, setKind] = useState<INFTKind>("data");
  const [file, setFile] = useState<File | null>(null);
  const [royaltyBps, setRoyaltyBps] = useState(500);
  const [ownerSplitBps, setOwnerSplitBps] = useState(5000);
  const [parents, setParents] = useState<{ tokenId: string; weightBps: number; edgeType: string }[]>([]);
  const [status, setStatus] = useState<{ msg: string; ok?: boolean } | null>(null);
  const [minted, setMinted] = useState<{ tokenId: bigint; hash: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  const addParent = () => {
    setParents([...parents, { tokenId: "", weightBps: 10000, edgeType: "TrainedOn" }]);
  };

  const removeParent = (i: number) => {
    setParents(parents.filter((_, idx) => idx !== i));
  };

  const mint = async () => {
    if (!file || !walletClient || !address) return;

    const blob = new Uint8Array(await file.arrayBuffer());
    const client = new LineageClient({
      rpc: zeroGTestnet.rpcUrls.default.http[0],
      storage: process.env["NEXT_PUBLIC_ZERO_G_STORAGE_URL"] ?? "",
      da: process.env["NEXT_PUBLIC_ZERO_G_DA_URL"] ?? "",
      compute: process.env["NEXT_PUBLIC_ZERO_G_COMPUTE_URL"] ?? "",
      ...CONTRACT_ADDRESSES,
      teePublicKey: "0x0000000000000000000000000000000000000000",
      mockTEE: true,
    });

    const account = { address, type: "json-rpc" } as const;

    try {
      setStatus({ msg: "Uploading and minting…" });
      let result;

      if (kind === "data") {
        result = await client.mintData({ blob, encrypt: true, royaltyBps, ownerSplitBps, wallet: walletClient, account });
      } else {
        const parentEdges = parents.map((p) => ({
          tokenId: BigInt(p.tokenId || "0"),
          weightBps: p.weightBps,
          edgeType: p.edgeType as "TrainedOn" | "FineTunedFrom" | "Composes" | "DependsOn",
        }));

        if (kind === "model") {
          result = await client.mintModel({ weights: blob, encrypt: true, parents: parentEdges, royaltyBps, ownerSplitBps, wallet: walletClient, account });
        } else {
          result = await client.mintSkill({ artifact: blob, encrypt: true, parents: parentEdges, royaltyBps, ownerSplitBps, wallet: walletClient, account });
        }
      }

      setMinted(result);
      setStatus({ msg: `Minted! Token ID: ${result.tokenId}`, ok: true });
    } catch (e) {
      setStatus({ msg: String(e), ok: false });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-brand-900 mb-2">Mint an iNFT</h1>
      <p className="text-gray-500 mb-8">Upload your artifact, declare lineage parents, and set your royalty policy.</p>

      {!isConnected ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Connect your wallet to mint</p>
          <ConnectButton />
        </div>
      ) : (
        <div className="space-y-6">
          {/* iNFT kind */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">iNFT Type</label>
            <div className="flex gap-3">
              {(["data", "model", "skill"] as INFTKind[]).map((k) => (
                <button
                  key={k}
                  onClick={() => { setKind(k); setParents([]); }}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium capitalize transition-colors ${
                    kind === k ? "bg-brand-500 text-white border-brand-500" : "border-gray-300 text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {k} iNFT
                </button>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Artifact</label>
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                dragging ? "border-brand-500 bg-brand-50" : "border-gray-300 hover:border-brand-500"
              }`}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <input id="file-input" type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {file ? (
                <p className="text-brand-500 font-medium">{file.name} ({(file.size / 1024).toFixed(1)} KB)</p>
              ) : (
                <p className="text-gray-500">Drag & drop or click to upload</p>
              )}
            </div>
          </div>

          {/* Parents (model/skill only) */}
          {kind !== "data" && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Lineage Parents</label>
                <button onClick={addParent} className="text-sm text-brand-500 hover:underline">+ Add parent</button>
              </div>
              {parents.length === 0 && (
                <p className="text-sm text-gray-400">No parents — add at least one for a model/skill.</p>
              )}
              {parents.map((p, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    placeholder="Token ID"
                    value={p.tokenId}
                    onChange={(e) => setParents(parents.map((x, j) => j === i ? { ...x, tokenId: e.target.value } : x))}
                  />
                  <input
                    type="number" min={0} max={10000}
                    className="w-24 border rounded-lg px-3 py-2 text-sm"
                    value={p.weightBps}
                    onChange={(e) => setParents(parents.map((x, j) => j === i ? { ...x, weightBps: Number(e.target.value) } : x))}
                  />
                  <select
                    className="border rounded-lg px-2 py-2 text-sm"
                    value={p.edgeType}
                    onChange={(e) => setParents(parents.map((x, j) => j === i ? { ...x, edgeType: e.target.value } : x))}
                  >
                    {EDGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button onClick={() => removeParent(i)} className="text-red-400 hover:text-red-600 text-sm">✕</button>
                </div>
              ))}
            </div>
          )}

          {/* Royalty policy */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Royalty Rate: {(royaltyBps / 100).toFixed(1)}%
              </label>
              <input type="range" min={0} max={3000} step={10} value={royaltyBps}
                onChange={(e) => setRoyaltyBps(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner split: {(ownerSplitBps / 100).toFixed(0)}% (upstream: {((10000 - ownerSplitBps) / 100).toFixed(0)}%)
              </label>
              <input type="range" min={0} max={10000} step={100} value={ownerSplitBps}
                onChange={(e) => setOwnerSplitBps(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
            </div>
          </div>

          {/* Mint button */}
          <button
            onClick={mint}
            disabled={!file}
            className="w-full py-3 bg-brand-500 text-white rounded-lg font-semibold hover:bg-brand-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Mint {kind.charAt(0).toUpperCase() + kind.slice(1)} iNFT
          </button>

          {status && (
            <div className={`p-4 rounded-lg text-sm ${status.ok === false ? "bg-red-50 text-red-700" : status.ok ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
              {status.msg}
            </div>
          )}

          {minted && (
            <div className="border border-green-200 bg-green-50 rounded-xl p-4">
              <p className="font-semibold text-green-800">Successfully minted!</p>
              <p className="text-sm text-green-700 mt-1">Token ID: <span className="font-mono">{minted.tokenId.toString()}</span></p>
              <p className="text-sm text-green-700 font-mono break-all">Tx: {minted.hash}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
