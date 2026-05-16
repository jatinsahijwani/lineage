/**
 * Frontend contract address loader.
 *
 * Single-chain consumers can keep importing `CONTRACT_ADDRESSES` — it
 * resolves to the testnet defaults (same as before the mainnet rollout).
 *
 * Chain-aware consumers should call `getContractsForChain(chainId)` from
 * `@/lib/network` instead — that returns the testnet or mainnet contract
 * set based on the connected chain.
 *
 * IMPORTANT:
 * Next.js client-side env vars must be accessed statically.
 * Dynamic access like process.env[key] breaks in browser bundles.
 */

export { getContractsForChain } from "./network";
import { NETWORKS } from "./network";
import { ZG_TESTNET } from "@lineage/shared";

export const CONTRACT_ADDRESSES = NETWORKS[ZG_TESTNET.chainId]!.contracts;

export type ContractAddresses = typeof CONTRACT_ADDRESSES;
