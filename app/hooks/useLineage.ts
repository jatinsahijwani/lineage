"use client";

import { useMemo } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { LineageClient } from "@lineage/sdk";

import { getNetwork } from "@/lib/network";

/**
 * Lazily-instantiated SDK client bound to the connected wallet AND the active
 * chain. Returns null until the user is connected on a supported chain
 * (mainnet 16661 or Galileo testnet 16602).
 *
 * The SDK transitively imports `@lineage/crypto` -> libsodium-wrappers. The
 * Next.js webpack alias in app/next.config.mjs forces libsodium to its CJS
 * bundle to dodge the broken ESM publish in 0.7.16.
 */
export function useLineage() {
  const { address, chainId, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();

  const network = getNetwork(chainId);
  const chainOk = network !== null;
  const isReady = isConnected && chainOk && !!walletClient;

  const client = useMemo(() => {
    if (!isReady || !network) return null;
    return new LineageClient({
      rpc: network.rpcUrl,
      storage: network.storageIndexerUrl,
      da: network.daUrl,
      compute:
        process.env.NEXT_PUBLIC_ZERO_G_COMPUTE_URL ??
        "https://compute-testnet.0g.ai",
      registry: network.contracts.LineageRegistry,
      dataINFT: network.contracts.DataINFT,
      modelINFT: network.contracts.ModelINFT,
      skillINFT: network.contracts.SkillINFT,
      splitter: network.contracts.RoyaltySplitter,
      verifier: network.contracts.AttributionVerifier,
      teePublicKey: "0x83df4B8EbA7c0B3B740019b8c9a77fff77D508cF",
      mockTEE: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, network?.chainId]);

  return {
    client,
    account: address,
    walletClient,
    chainId,
    chain,
    network,
    isConnected,
    chainOk,
    isReady,
  };
}
