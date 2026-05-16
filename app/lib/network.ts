/**
 * Per-chain network resolver. Picks RPC / storage / contract addresses
 * for the active chain. Works both client-side (Next.js inlines
 * NEXT_PUBLIC_* at build time) and server-side (reads process.env directly).
 *
 * Backward compatibility:
 *   - When NEXT_PUBLIC_*_MAINNET_ADDRESS is not set, mainnet contracts are
 *     all-zero — the build still compiles, but on-chain calls will fail
 *     until `pnpm deploy:mainnet` is run and the env block is filled in.
 *   - Testnet defaults still come from the original NEXT_PUBLIC_*_ADDRESS
 *     env vars (no rename required).
 */

import { ZG_MAINNET, ZG_TESTNET } from "@lineage/shared";

type Hex = `0x${string}`;

export interface NetworkContracts {
  LineageRegistry: Hex;
  DataINFT: Hex;
  ModelINFT: Hex;
  SkillINFT: Hex;
  RoyaltySplitter: Hex;
  AttributionVerifier: Hex;
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  storageIndexerUrl: string;
  daUrl: string;
  blockExplorer: string;
  contracts: NetworkContracts;
  isTestnet: boolean;
}

const ZERO = "0x0000000000000000000000000000000000000000" as Hex;

// Testnet defaults mirror deployments.json so the build resolves to working
// addresses without any env config — the demo flow keeps working as-is.
const TESTNET_DEFAULTS: NetworkContracts = {
  LineageRegistry: "0x5Ba9010bf4A6E13F098d1ce5DBAF52c22E21B3f5",
  DataINFT: "0x7986F719737Cbd377Aa436092a0614bda988F18D",
  ModelINFT: "0xb54bcd09aAEfF92369D3f722dC8CBfdD6f861892",
  SkillINFT: "0x90135721Bd43e07955CA1AA5DeD4516CDAf46bcB",
  RoyaltySplitter: "0x4F27E90880E6b28525d7f7Eb8785273F11b0D0DE",
  AttributionVerifier: "0x74A7D64b84F3D36494f0Abf7641Dd79E9dfb986E",
};

const TESTNET_CONTRACTS: NetworkContracts = {
  LineageRegistry:
    (process.env.NEXT_PUBLIC_LINEAGE_REGISTRY_ADDRESS ||
      TESTNET_DEFAULTS.LineageRegistry) as Hex,
  DataINFT:
    (process.env.NEXT_PUBLIC_DATA_INFT_ADDRESS ||
      TESTNET_DEFAULTS.DataINFT) as Hex,
  ModelINFT:
    (process.env.NEXT_PUBLIC_MODEL_INFT_ADDRESS ||
      TESTNET_DEFAULTS.ModelINFT) as Hex,
  SkillINFT:
    (process.env.NEXT_PUBLIC_SKILL_INFT_ADDRESS ||
      TESTNET_DEFAULTS.SkillINFT) as Hex,
  RoyaltySplitter:
    (process.env.NEXT_PUBLIC_ROYALTY_SPLITTER_ADDRESS ||
      TESTNET_DEFAULTS.RoyaltySplitter) as Hex,
  AttributionVerifier:
    (process.env.NEXT_PUBLIC_ATTRIBUTION_VERIFIER_ADDRESS ||
      TESTNET_DEFAULTS.AttributionVerifier) as Hex,
};

const MAINNET_CONTRACTS: NetworkContracts = {
  LineageRegistry: (process.env.NEXT_PUBLIC_LINEAGE_REGISTRY_ADDRESS_MAINNET ||
    ZERO) as Hex,
  DataINFT: (process.env.NEXT_PUBLIC_DATA_INFT_ADDRESS_MAINNET || ZERO) as Hex,
  ModelINFT: (process.env.NEXT_PUBLIC_MODEL_INFT_ADDRESS_MAINNET ||
    ZERO) as Hex,
  SkillINFT: (process.env.NEXT_PUBLIC_SKILL_INFT_ADDRESS_MAINNET ||
    ZERO) as Hex,
  RoyaltySplitter: (process.env.NEXT_PUBLIC_ROYALTY_SPLITTER_ADDRESS_MAINNET ||
    ZERO) as Hex,
  AttributionVerifier:
    (process.env.NEXT_PUBLIC_ATTRIBUTION_VERIFIER_ADDRESS_MAINNET ||
      ZERO) as Hex,
};

export const NETWORKS: Record<number, NetworkConfig> = {
  [ZG_TESTNET.chainId]: {
    chainId: ZG_TESTNET.chainId,
    name: ZG_TESTNET.name,
    rpcUrl:
      process.env.NEXT_PUBLIC_ZERO_G_TESTNET_RPC_URL ??
      process.env.NEXT_PUBLIC_ZERO_G_RPC_URL ??
      process.env.ZERO_G_TESTNET_RPC_URL ??
      process.env.ZERO_G_RPC_URL ??
      ZG_TESTNET.rpcUrl,
    storageIndexerUrl:
      process.env.NEXT_PUBLIC_ZERO_G_TESTNET_STORAGE_URL ??
      process.env.NEXT_PUBLIC_ZERO_G_STORAGE_URL ??
      process.env.ZERO_G_TESTNET_STORAGE_URL ??
      process.env.ZERO_G_STORAGE_URL ??
      ZG_TESTNET.storageIndexerUrl,
    daUrl:
      process.env.NEXT_PUBLIC_ZERO_G_DA_URL ??
      process.env.ZERO_G_DA_URL ??
      ZG_TESTNET.daUrl,
    blockExplorer: ZG_TESTNET.blockExplorer,
    contracts: TESTNET_CONTRACTS,
    isTestnet: true,
  },
  [ZG_MAINNET.chainId]: {
    chainId: ZG_MAINNET.chainId,
    name: ZG_MAINNET.name,
    rpcUrl:
      process.env.NEXT_PUBLIC_ZERO_G_MAINNET_RPC_URL ??
      process.env.ZERO_G_MAINNET_RPC_URL ??
      ZG_MAINNET.rpcUrl,
    storageIndexerUrl:
      process.env.NEXT_PUBLIC_ZERO_G_MAINNET_STORAGE_URL ??
      process.env.ZERO_G_MAINNET_STORAGE_URL ??
      ZG_MAINNET.storageIndexerUrl,
    daUrl:
      process.env.NEXT_PUBLIC_ZERO_G_MAINNET_DA_URL ??
      process.env.ZERO_G_MAINNET_DA_URL ??
      ZG_MAINNET.daUrl,
    blockExplorer: ZG_MAINNET.blockExplorer,
    contracts: MAINNET_CONTRACTS,
    isTestnet: false,
  },
};

export const SUPPORTED_CHAIN_IDS: readonly number[] = Object.keys(NETWORKS).map(
  Number,
);

/** Returns network config for the given chainId, or null if unsupported. */
export function getNetwork(chainId: number | undefined): NetworkConfig | null {
  if (chainId === undefined) return null;
  return NETWORKS[chainId] ?? null;
}

/** Strict variant — throws on unsupported chain. Use server-side. */
export function requireNetwork(chainId: number): NetworkConfig {
  const net = NETWORKS[chainId];
  if (!net) {
    throw new Error(
      `unsupported chainId ${chainId} — expected one of ${SUPPORTED_CHAIN_IDS.join(", ")}`,
    );
  }
  return net;
}

/** Convenience: contracts for the given chainId (testnet default). */
export function getContractsForChain(
  chainId: number | undefined,
): NetworkContracts {
  if (chainId !== undefined) {
    const net = NETWORKS[chainId];
    if (net) return net.contracts;
  }
  return TESTNET_CONTRACTS;
}
