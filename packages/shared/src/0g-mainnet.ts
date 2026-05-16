/**
 * 0G mainnet (chainId 16661) live constants.
 *
 * Values supplied by the foundation; mirrors the shape of ZG_TESTNET so the
 * `network` helper can pick either at runtime by chainId. 0G Compute contract
 * addresses are auto-resolved by @0gfoundation/0g-compute-ts-sdk from the
 * chainId, so we don't mirror them here.
 *
 * Last verified: 2026-05-16 (user-supplied).
 */

export const ZG_MAINNET = {
  chainId: 16661,
  name: "0G Mainnet",
  symbol: "OG",
  rpcUrl: "https://evmrpc.0g.ai",
  blockExplorer: "https://chainscan.0g.ai",
  storageIndexerUrl: "https://indexer-storage-turbo.0g.ai",
  /**
   * 0G DA mainnet disperser is gRPC-only and the JS SDK has not shipped, just
   * like on testnet. DAReceiptSink stays stubbed; this is kept for shape parity.
   */
  daUrl: "https://da.0g.ai",
} as const;

export type ZGMainnet = typeof ZG_MAINNET;
