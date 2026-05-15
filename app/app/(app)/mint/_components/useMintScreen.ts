"use client";

import { useCallback, useState } from "react";
import type { EdgeType } from "@lineage/shared";

import { useLineage } from "@/hooks/useLineage";

export type MintKind = "data" | "model" | "skill";

export interface ParentEntry {
  id: string;
  tokenId: string;
  weightBps: number;
  edgeType: EdgeType;
}

export type MintStatus =
  | "idle"
  | "preparing"
  | "uploading"
  | "minting"
  | "success"
  | "error";

export interface MintResult {
  tokenId: bigint;
  txHash: `0x${string}`;
}

const DEFAULT_ROYALTY_BPS: Record<MintKind, number> = {
  data: 200,
  model: 500,
  skill: 300,
};

export function useMintScreen(kind: MintKind) {
  const { client, account, walletClient, isReady } = useLineage();

  const [status, setStatus] = useState<MintStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MintResult | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [royaltyBps, setRoyaltyBps] = useState<number>(
    DEFAULT_ROYALTY_BPS[kind],
  );
  const [ownerSplitBps, setOwnerSplitBps] = useState<number>(8000);
  const [parents, setParents] = useState<ParentEntry[]>([]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
    setFile(null);
    setRoyaltyBps(DEFAULT_ROYALTY_BPS[kind]);
    setOwnerSplitBps(8000);
    setParents([]);
  }, [kind]);

  const validate = useCallback((): string | null => {
    if (!file) return "Please choose a file to mint";
    if (royaltyBps < 0 || royaltyBps > 2000)
      return "Royalty must be between 0 and 2000 bps";
    if (ownerSplitBps < 0 || ownerSplitBps > 10000)
      return "Owner split must be between 0 and 10000 bps";
    if (kind !== "data") {
      const sum = parents.reduce((s, p) => s + p.weightBps, 0);
      if (parents.length > 0 && sum !== 10000) {
        return `Lineage parent weights must sum to 10000 bps (got ${sum})`;
      }
    }
    return null;
  }, [file, royaltyBps, ownerSplitBps, parents, kind]);

  const mint = useCallback(async () => {
    if (!isReady || !client || !account || !walletClient) {
      setError("Wallet not ready — connect on chainId 16602 first");
      setStatus("error");
      return;
    }
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setStatus("error");
      return;
    }

    setError(null);
    setResult(null);

    try {
      setStatus("preparing");
      const buffer = await file!.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // simulate upload step visually — the SDK's mock storage path doesn't
      // actually push bytes to 0G Storage in this codebase; the bytes feed
      // sha256 to derive a storage root.
      setStatus("uploading");
      await new Promise((r) => setTimeout(r, 600));

      setStatus("minting");
      // viem types in the app's node_modules tree are duplicated under two
      // typescript versions due to pnpm peer-dependency resolution, so the
      // structurally-identical WalletClient/Account types appear distinct.
      // Cast at the SDK boundary to bridge the duplication.
      const wallet = walletClient as unknown as Parameters<
        typeof client.mintData
      >[0]["wallet"];
      const accountObj = {
        address: account,
        type: "json-rpc" as const,
      } as unknown as Parameters<typeof client.mintData>[0]["account"];

      let mintResult: { tokenId: bigint; hash: `0x${string}` };
      if (kind === "data") {
        mintResult = await client.mintData({
          blob: bytes,
          encrypt: true,
          royaltyBps,
          ownerSplitBps,
          wallet,
          account: accountObj,
        });
      } else if (kind === "model") {
        mintResult = await client.mintModel({
          weights: bytes,
          encrypt: true,
          parents: parents.map((p) => ({
            tokenId: BigInt(p.tokenId),
            weightBps: p.weightBps,
            edgeType: p.edgeType,
          })),
          royaltyBps,
          ownerSplitBps,
          wallet,
          account: accountObj,
        });
      } else {
        mintResult = await client.mintSkill({
          artifact: bytes,
          encrypt: true,
          parents: parents.map((p) => ({
            tokenId: BigInt(p.tokenId),
            weightBps: p.weightBps,
            edgeType: p.edgeType,
          })),
          royaltyBps,
          ownerSplitBps,
          wallet,
          account: accountObj,
        });
      }

      setResult({ tokenId: mintResult.tokenId, txHash: mintResult.hash });
      setStatus("success");
    } catch (err) {
      console.error("mint failed", err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [
    client,
    account,
    walletClient,
    isReady,
    file,
    kind,
    parents,
    royaltyBps,
    ownerSplitBps,
    validate,
  ]);

  return {
    status,
    error,
    result,
    file,
    setFile,
    royaltyBps,
    setRoyaltyBps,
    ownerSplitBps,
    setOwnerSplitBps,
    parents,
    setParents,
    mint,
    reset,
  };
}
