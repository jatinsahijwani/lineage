/**
 * 0G testnet (Galileo, chainId 16602) live constants and quirks discovered
 * empirically via scripts/smoke.ts. Don't change a value here without first
 * re-running the smoke probe and updating scripts/smoke-output.json.
 *
 * Last verified: 2026-05-07 against the live testnet from the wallet
 * 0xbc74Ce51239F0165C931D72464bBbf8360aeA0C3.
 */

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

export const ZG_TESTNET = {
  /** Galileo testnet chainId. Newton (16600) is deprecated. */
  chainId: 16602,
  name: "0G Galileo Testnet",
  symbol: "OG",
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  blockExplorer: "https://chainscan-galileo.0g.ai",

  /**
   * 0G Storage indexer. The README and many third-party docs reference
   * "storage-testnet.0g.ai" — that host does not resolve. Use the foundation's
   * indexer instead. "turbo" is the default; "standard" is a slower fallback.
   */
  storageIndexerUrl: "https://indexer-storage-testnet-turbo.0g.ai",
  storageIndexerStandardUrl: "https://indexer-storage-testnet-standard.0g.ai",

  /**
   * 0G DA: there is NO public HTTP disperser as of 2026-05. da.0g.ai is a
   * marketing site; "da-testnet.0g.ai" doesn't resolve. The disperser is
   * gRPC-only and the JS SDK hasn't shipped. Track via DAReceiptSink stub.
   */
  daUrl: "https://da.0g.ai",
} as const;

// ---------------------------------------------------------------------------
// Compute (0G Serving) — auto-resolved by @0gfoundation/0g-compute-ts-sdk
// from chainId, but we mirror the constants here for off-chain code that
// doesn't load the SDK (e.g. UI labels).
// ---------------------------------------------------------------------------

export const ZG_COMPUTE_CONTRACTS = {
  ledger:     "0xE70830508dAc0A97e6c087c75f402f9Be669E406",
  inference:  "0xa79F4c8311FF93C06b8CfB403690cc987c93F91E",
  fineTuning: "0xC6C075D8039763C8f1EbE580be5ADdf2fd6941bA",
} as const;

/** Minimum balance (in OG) required to create a compute ledger account. */
export const ZG_LEDGER_MIN_OG = 3;

// ---------------------------------------------------------------------------
// Verified inference services
// ---------------------------------------------------------------------------

/**
 * Chatbot service used as the canonical reference in scripts/smoke.ts.
 * Captured live from broker.inference.listService() on 2026-05-07.
 */
export const ZG_CHATBOT_SERVICE = {
  /** Provider EOA — bills the user, settles via the inference contract */
  provider:         "0xa48f01287233509FD694a22Bf840225062E67836" as `0x${string}`,
  /** TEE signer — recovers from the attestation signature */
  teeSignerAddress: "0x83df4B8EbA7c0B3B740019b8c9a77ffF77D508cF" as `0x${string}`,
  serviceType:      "chatbot",
  model:            "qwen/qwen-2.5-7b-instruct",
  verifiability:    "TeeML" as const,
  providerType:     "centralized" as const,
  providerIdentity: "aliyun",
  /**
   * Provider's HTTP base URL as returned by getServiceMetadata. Note: this
   * already includes "/v1/proxy", so callers must append /chat/completions
   * (NOT /v1/chat/completions, which 400s — see endpointPathQuirk below).
   */
  endpoint: "https://compute-network-6.integratenetwork.work/v1/proxy",
} as const;

// ---------------------------------------------------------------------------
// Inference call quirks — wire these into any client that talks to a 0G
// provider directly. Not in the SDK docs; discovered via smoke.ts probes.
// ---------------------------------------------------------------------------

export const ZG_INFERENCE_QUIRKS = {
  /**
   * Append "/chat/completions" to the provider's endpoint, NOT
   * "/v1/chat/completions". The endpoint URL from getServiceMetadata already
   * carries "/v1/proxy"; the SDK example using `new OpenAI({ baseURL })` works
   * because the OpenAI client auto-appends /chat/completions (no extra /v1).
   * Hand-rolled fetch callers must use the path below.
   */
  chatCompletionsPath: "/chat/completions",

  /**
   * The TEE signature is fetched async from
   *   GET ${endpoint}/signature/${zg-res-key}
   * where {zg-res-key} is the value of the `zg-res-key` RESPONSE HEADER from
   * the inference call — NOT the OpenAI-style `chatcmpl-<uuid>` chat id, even
   * though broker.inference.getChatSignatureDownloadLink(provider, chatId)
   * builds the URL with chatId. That URL returns "chat_id_not_found".
   *
   * Always capture the zg-res-key header at inference time; use it for the
   * signature lookup later.
   */
  signatureLookupHeader: "zg-res-key",

  /**
   * Canonical text the TEE signs. Five colon-separated fields, lowercase
   * hex without "0x" prefix. The signature is over keccak256(
   *   "\x19Ethereum Signed Message:\n" + len(text) + text
   * ) (standard `eth_sign` digest), recovers to ServiceStructOutput.teeSignerAddress.
   */
  canonicalSignedText: "<inputHash>:<outputHash>:<providerType>:<providerIdentity>:<tlsCertFingerprint>",
  canonicalSignedTextFormat: {
    fields: ["inputHash", "outputHash", "providerType", "providerIdentity", "tlsCertFingerprint"] as const,
    separator: ":" as const,
    hexPrefixed: false,
    digestScheme: "eth_sign" as const,  // keccak256("\x19Ethereum Signed Message:\n" + len + text)
    signatureAlgo: "ecdsa" as const,
    signatureBytes: 65,
  },
} as const;

// ---------------------------------------------------------------------------
// Storage upload constraints
// ---------------------------------------------------------------------------

export const ZG_STORAGE = {
  /** Single-file upload (most common). Fragmented form kicks in above 4GB. */
  fragmentSizeBytes: 4 * 1024 * 1024 * 1024, // 4 GiB
  /** Default replica count selected by Indexer.upload */
  defaultReplicaCount: 1,
} as const;

// ---------------------------------------------------------------------------
// Type aliases for convenience
// ---------------------------------------------------------------------------

export type ZGTestnet = typeof ZG_TESTNET;
export type ZGChatbotService = typeof ZG_CHATBOT_SERVICE;
export type ZGInferenceQuirks = typeof ZG_INFERENCE_QUIRKS;
