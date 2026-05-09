"use client";

import { useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { LineageClient } from "@lineage/sdk";
import { ZG_TESTNET } from "@lineage/shared";

import { CONTRACT_ADDRESSES } from "@/lib/contracts";

/**
 * Lazily-instantiated SDK client bound to the connected wallet. Returns null
 * until the user is connected on chainId 16602.
 *
 * The SDK transitively imports `@lineage/crypto` -> libsodium-wrappers. The
 * Next.js webpack alias in app/next.config.mjs forces libsodium to its CJS
 * bundle to dodge the broken ESM publish in 0.7.16.
 */
export function useLineage() {
  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

  const chainOk = chainId === ZG_TESTNET.chainId;
  const isReady = isConnected && chainOk && !!walletClient;

  const client = useMemo(() => {
    if (!isReady) return null;
    return new LineageClient({
      rpc: ZG_TESTNET.rpcUrl,
      storage:
        process.env.NEXT_PUBLIC_ZERO_G_STORAGE_URL ??
        ZG_TESTNET.storageIndexerUrl,
      da: process.env.NEXT_PUBLIC_ZERO_G_DA_URL ?? ZG_TESTNET.daUrl,
      compute:
        process.env.NEXT_PUBLIC_ZERO_G_COMPUTE_URL ??
        "https://compute-testnet.0g.ai",
      registry: CONTRACT_ADDRESSES.LineageRegistry,
      dataINFT: CONTRACT_ADDRESSES.DataINFT,
      modelINFT: CONTRACT_ADDRESSES.ModelINFT,
      skillINFT: CONTRACT_ADDRESSES.SkillINFT,
      splitter: CONTRACT_ADDRESSES.RoyaltySplitter,
      verifier: CONTRACT_ADDRESSES.AttributionVerifier,
      teePublicKey: "0x83df4B8EbA7c0B3B740019b8c9a77fff77D508cF",
      mockTEE: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady]);

  return {
    client,
    account: address,
    walletClient,
    chainId,
    isConnected,
    chainOk,
    isReady,
  };
}
