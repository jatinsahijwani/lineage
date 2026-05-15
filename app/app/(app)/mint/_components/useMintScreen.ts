"use client";

import { useCallback, useState } from "react";
import { usePublicClient } from "wagmi";
import { decodeEventLog, type Hex } from "viem";
import type { EdgeType } from "@lineage/shared";
import {
  encrypt,
  generateKey,
  sha256,
  serializeBlob,
} from "@lineage/crypto";

import { useLineage } from "@/hooks/useLineage";
import { CONTRACT_ADDRESSES } from "@/lib/contracts";
import {
  DATA_INFT_ABI,
  MODEL_INFT_ABI,
  SKILL_INFT_ABI,
  LINEAGE_REGISTRY_ABI,
} from "@/lib/abis";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const EDGE_TYPE_MAP: Record<string, number> = {
  TrainedOn: 0,
  FineTunedFrom: 1,
  Composes: 2,
  DependsOn: 3,
};

function toBase64(bytes: Uint8Array): string {
  // Browser-safe: avoid Buffer (not in client bundle).
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

async function uploadToStorage(
  payloadBytes: Uint8Array,
): Promise<{ rootHash: Hex; txHash: Hex; txSeq: number }> {
  const res = await fetch("/api/storage-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: toBase64(payloadBytes) }),
  });
  const data = (await res.json()) as
    | { rootHash: Hex; txHash: Hex; txSeq: number }
    | { error: string };
  if (!res.ok || "error" in data) {
    const msg =
      "error" in data && data.error
        ? data.error
        : `0G Storage upload failed (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Parse the tokenId emitted by LineageRegistry.INFTRegistered in the mint
 * receipt. The registry event is more reliable than the ERC-721 Transfer log
 * because Transfer's tokenId topic is the registry-assigned id, which we want
 * either way — but parsing the named event also validates we hit the right
 * contract path.
 */
function parseTokenId(logs: readonly { address: string; topics: readonly Hex[]; data: Hex }[]): bigint {
  const registryAddr = CONTRACT_ADDRESSES.LineageRegistry.toLowerCase();
  for (const log of logs) {
    if (log.address.toLowerCase() !== registryAddr) continue;
    try {
      const decoded = decodeEventLog({
        abi: LINEAGE_REGISTRY_ABI,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (decoded.eventName === "INFTRegistered") {
        return (decoded.args as { tokenId: bigint }).tokenId;
      }
    } catch {
      // not our event — keep scanning
    }
  }
  throw new Error("Could not parse tokenId from mint receipt");
}

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
  const { account, walletClient, isReady } = useLineage();
  const publicClient = usePublicClient();

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
    if (!isReady || !account || !walletClient || !publicClient) {
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
      // 1. Encrypt locally so plaintext never leaves the browser.
      setStatus("preparing");
      const buffer = await file!.arrayBuffer();
      const plaintext = new Uint8Array(buffer);

      const key = await generateKey();
      const encrypted = await encrypt(plaintext, key);
      const serialized = serializeBlob(encrypted);
      const encryptedMetaHash = await sha256(serialized);

      // 2. POST encrypted bytes to /api/storage-upload — the operator wallet
      //    pays the 0G Storage fee, mirroring the receipt-upload flow.
      setStatus("uploading");
      const uploaded = await uploadToStorage(serialized);
      const storageRoot = uploaded.rootHash;

      // 3. Mint on-chain from the user's wallet. We bypass the SDK because it
      //    computes its own `storageRoot = encrypted.keyHash` and we want the
      //    real 0G Storage root that resolves to the uploaded blob.
      setStatus("minting");

      const policy = {
        totalRoyaltyBps: royaltyBps,
        paymentToken: ZERO_ADDRESS,
        pauseUntil: 0n,
        ownerSplitBps,
      } as const;

      const parentEdges = parents.map((p) => ({
        child: 0n,
        parent: BigInt(p.tokenId),
        weightBps: p.weightBps,
        eType: EDGE_TYPE_MAP[p.edgeType] ?? 0,
      }));

      let inftAddress: `0x${string}`;
      let abi: typeof DATA_INFT_ABI | typeof MODEL_INFT_ABI | typeof SKILL_INFT_ABI;
      if (kind === "data") {
        inftAddress = CONTRACT_ADDRESSES.DataINFT;
        abi = DATA_INFT_ABI;
      } else if (kind === "model") {
        inftAddress = CONTRACT_ADDRESSES.ModelINFT;
        abi = MODEL_INFT_ABI;
      } else {
        inftAddress = CONTRACT_ADDRESSES.SkillINFT;
        abi = SKILL_INFT_ABI;
      }

      const hash = await walletClient.writeContract({
        address: inftAddress,
        abi,
        functionName: "mintWithLineage",
        args: [account, storageRoot, encryptedMetaHash, parentEdges, policy],
        account,
        chain: undefined,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        pollingInterval: 8000,
        retryCount: 50,
        timeout: 480_000,
      });

      const tokenId = parseTokenId(receipt.logs);
      setResult({ tokenId, txHash: hash });
      setStatus("success");
    } catch (err) {
      console.error("mint failed", err);
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [
    account,
    walletClient,
    publicClient,
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
