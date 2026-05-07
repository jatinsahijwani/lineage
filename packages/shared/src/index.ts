// Shared types mirroring Solidity structs and the attribution receipt schema.

import { z } from "zod";

export * from "./0g-testnet.js";

export type INFTType = "Data" | "Model" | "Skill" | "Agent";
export type EdgeType = "TrainedOn" | "FineTunedFrom" | "Composes" | "DependsOn";

export interface INFTRecord {
  tokenId: bigint;
  storageRoot: `0x${string}`;
  owner: `0x${string}`;
  iType: INFTType;
  royaltyBps: number;
  royaltyReceiver: `0x${string}`;
  createdAt: bigint;
  paused: boolean;
}

export interface LineageEdge {
  child: bigint;
  parent: bigint;
  weightBps: number; // 0-10000
  eType: EdgeType;
}

export interface RoyaltyPolicy {
  totalRoyaltyBps: number;
  paymentToken: `0x${string}`;
  pauseUntil: bigint;
  ownerSplitBps: number;
}

export interface SettlementBatch {
  batchId: bigint;
  merkleRoot: `0x${string}`;
  windowStart: bigint;
  windowEnd: bigint;
  receiptCount: bigint;
  daCommitment: `0x${string}`;
}

/**
 * AgentLineageAttestation — operator-signed lineage assertion attached to every
 * AttributionReceipt. The 0G Compute TEE only signs a 5-field canonical text
 * (input/output hashes, provider type/identity, TLS cert fingerprint) and has
 * no knowledge of iNFT lineage. To bind a particular set of model/skill/
 * memory/data iNFTs to an inference, the agent operator separately signs this
 * struct.
 *
 * Signing scheme:
 *   - Encode the struct (with the `signature` field omitted) using canonical
 *     CBOR (cbor-x with deterministic key ordering).
 *   - Take eth_sign (EIP-191 personal_sign) of the resulting bytes.
 *   - Place the resulting 65-byte ECDSA signature (r||s||v, 0x-prefixed,
 *     132 hex chars total) in the `signature` field.
 *
 * Verifiers reconstruct the same canonical CBOR with `signature` omitted,
 * recover the signer, and check it equals `agentOperator`. They also assert
 * the receipt's top-level `inputDigest`/`outputDigest` match what the
 * `computeProof.attestation.text` covers — this is the linkage between the
 * TEE attestation and the operator-signed lineage.
 */
export interface AgentLineageAttestation {
  agentOperator: `0x${string}`;
  model: { tokenId: string; weight: number };
  skills: Array<{ tokenId: string; weight: number }>;
  memory: Array<{ tokenId: string; weight: number }>;
  data: Array<{ tokenId: string; weight: number }>;
  /**
   * eth_sign (personal_sign) over canonical CBOR of this struct WITH
   * `signature` omitted. 65 bytes (r||s||v) as 0x-prefixed hex (132 chars).
   */
  signature: `0x${string}`;
}

// Attribution Receipt — posted to 0G DA on every inference. Carries dual
// attestation: the TEE-signed compute proof plus the operator-signed lineage
// attestation. The `inputDigest`/`outputDigest` at this level must match what
// `computeProof.attestation.text` covers, asserting the linkage between the
// two signatures.
export interface AttributionReceipt {
  version: "lineage/v1";
  receiptId: string;
  agentId: string;
  agentRunner: string;
  inferenceId: string;
  timestamp: number;
  /** sha256 hex of canonical input bytes — no 0x prefix, lowercase. */
  inputDigest: string;
  /** sha256 hex of canonical output bytes — no 0x prefix, lowercase. */
  outputDigest: string;
  computeProof: ComputeInferenceProof;
  lineage: AgentLineageAttestation;
}

/**
 * Alias for AttributionReceipt. Used at the receipt-sink boundary to make the
 * pre-condition explicit: the receipt must be canonically CBOR-encoded and
 * carry both a TEE signature (in computeProof.attestation) and an operator
 * signature (in lineage.signature) before the sink will accept it.
 */
export type SignedReceipt = AttributionReceipt;

/**
 * Pointer returned by a ReceiptSink after persisting a receipt. Same shape for
 * 0G Storage and 0G DA so consumers don't need to branch on backend.
 *   - commitment: the content-addressed root (storage rootHash, or DA blob commitment).
 *     Stored on-chain in SettlementBatch.daCommitment.
 *   - blobIndex: the sequential index assigned by the underlying log
 *     (storage txSeq, or DA blob index). Used to fetch the blob back.
 */
export interface DAPointer {
  commitment: `0x${string}`;
  blobIndex: number;
}

export interface MintDataParams {
  blob: Uint8Array;
  encrypt: boolean;
  royaltyBps: number;
  ownerSplitBps: number;
  paymentToken?: `0x${string}`;
}

export interface MintModelParams {
  weights: Uint8Array;
  encrypt: boolean;
  parents: Array<{ tokenId: bigint; weightBps: number; edgeType: EdgeType }>;
  royaltyBps: number;
  ownerSplitBps: number;
  paymentToken?: `0x${string}`;
}

export interface MintSkillParams {
  artifact: Uint8Array;
  encrypt: boolean;
  parents: Array<{ tokenId: bigint; weightBps: number; edgeType: EdgeType }>;
  royaltyBps: number;
  ownerSplitBps: number;
  paymentToken?: `0x${string}`;
}

export interface InferenceParams {
  modelTokenId: bigint;
  skills?: bigint[];
  input: string;
}

export interface InferenceResult {
  output: string;
  receipt: AttributionReceipt;
  daPointer: DAPointer;
}

export interface LineageClientConfig {
  rpc: string;
  storage: string;
  da: string;
  compute: string;
  registry: `0x${string}`;
  dataINFT: `0x${string}`;
  modelINFT: `0x${string}`;
  skillINFT: `0x${string}`;
  splitter: `0x${string}`;
  verifier: `0x${string}`;
  teePublicKey: `0x${string}`;
  mockTEE?: boolean;
}

// 0G Compute service descriptor — mirrors ServiceStructOutput from
// @0gfoundation/0g-compute-ts-sdk (chainId 16602 inference contract).
// Verified against the live testnet response in scripts/smoke-output.json.
export interface ComputeService {
  provider: `0x${string}`;
  serviceType: string;          // e.g. "chatbot"
  url: string;                  // provider's inference endpoint
  inputPrice: bigint;           // wei per input token
  outputPrice: bigint;          // wei per output token
  updatedAt: bigint;            // unix seconds
  model: string;                // e.g. "qwen/qwen-2.5-7b-instruct"
  verifiability: "TeeML" | "";  // empty when not TEE-verified
  additionalInfo: string;       // JSON blob (TEE verifier metadata)
  teeSignerAddress: `0x${string}`;
  teeSignerAcknowledged: boolean;
}

// 0G Storage upload response — single-file form (most common).
// The SDK can also return the fragmented form (rootHashes[], txHashes[], txSeqs[]) for >4GB files.
export interface StorageUploadResult {
  rootHash: `0x${string}`;      // bytes32 — fits INFTRecord.storageRoot directly
  txHash: `0x${string}`;        // bytes32 — chain submission tx
  txSeq: number;                // sequential index assigned by storage contract
}

// 0G Compute TEE attestation as actually returned by the inference provider's
// /v1/proxy/signature/{zg-res-key} endpoint. Captured live in scripts/smoke-output.json
// from compute-network-6.integratenetwork.work running qwen-2.5-7b-instruct on aliyun.
export interface TEEAttestation {
  /**
   * Canonical 5-field colon-separated message that was signed:
   *   <inputHash>:<outputHash>:<providerType>:<providerIdentity>:<tlsCertFingerprint>
   * inputHash and outputHash are 32-byte sha256 digests as 64-char hex (no 0x).
   */
  text: string;
  signature: `0x${string}`;                  // 65 bytes — standard Ethereum ECDSA (r||s||v)
  signing_address: `0x${string}`;            // 20 bytes — matches ServiceStructOutput.teeSignerAddress
  signing_algo: "ecdsa";                     // currently always ecdsa
  provider_type: "centralized" | "decentralized";
  provider_identity: string;                  // e.g. "aliyun"
  tls_cert_fingerprint: string;              // 32-byte hex (no 0x) — TLS-cert binding
}

// Lookup key for the TEE attestation. The SDK exposes
// broker.inference.getChatSignatureDownloadLink(provider, chatId), but the
// returned URL is unauthenticated and the *real* key the server uses is the
// `zg-res-key` response header — not the OpenAI-style `chatcmpl-...` chat id.
// Always store zgResKey alongside chatId to be able to fetch the proof later.
export interface ComputeInferenceProof {
  provider: `0x${string}`;
  chatId: string;                  // OpenAI-format e.g. "chatcmpl-<uuid>"
  zgResKey: string;                // bare UUID from the `zg-res-key` response header
  attestation?: TEEAttestation;    // populated lazily after the TEE signs (async)
}

// ---------------------------------------------------------------------------
// Zod schemas for runtime validation of AttributionReceipt envelopes.
// Receipts arrive over the wire (DA blob fetch, runner -> settler RPC, etc.)
// and must be re-validated end-to-end before any payout logic runs.
// ---------------------------------------------------------------------------

const HEX_ANY = /^0x[0-9a-fA-F]+$/;
const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const HEX_BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const HEX_SIGNATURE = /^0x[0-9a-fA-F]{130}$/; // 65 bytes = 132 chars incl. 0x
const HEX_LOWER_NO_PREFIX_64 = /^[0-9a-f]{64}$/; // sha256 hex, no 0x, lowercase

const AddressSchema = z
  .string()
  .regex(HEX_ADDRESS, "expected 0x-prefixed 20-byte address (42 chars)");

// Exported for downstream consumers that may want to validate bytes32 fields
// (e.g. storageRoot, daCommitment) outside the receipt envelope.
export const Bytes32Schema = z
  .string()
  .regex(HEX_BYTES32, "expected 0x-prefixed 32-byte hex (66 chars)");

const SignatureSchema = z
  .string()
  .regex(HEX_SIGNATURE, "expected 0x-prefixed 65-byte ECDSA signature (132 chars)");

const DigestSchema = z
  .string()
  .regex(HEX_LOWER_NO_PREFIX_64, "expected sha256 hex (64 lowercase chars, no 0x prefix)");

const WeightedTokenSchema = z.object({
  tokenId: z.string().min(1),
  weight: z.number().finite(),
});

export const TEEAttestationSchema = z.object({
  text: z.string().min(1),
  signature: SignatureSchema,
  signing_address: AddressSchema,
  signing_algo: z.literal("ecdsa"),
  provider_type: z.union([z.literal("centralized"), z.literal("decentralized")]),
  provider_identity: z.string().min(1),
  tls_cert_fingerprint: z.string().min(1),
});

export const ComputeInferenceProofSchema = z.object({
  provider: AddressSchema,
  chatId: z.string().min(1),
  zgResKey: z.string().min(1),
  attestation: TEEAttestationSchema.optional(),
});

export const AgentLineageAttestationSchema = z.object({
  agentOperator: AddressSchema,
  model: WeightedTokenSchema,
  skills: z.array(WeightedTokenSchema),
  memory: z.array(WeightedTokenSchema),
  data: z.array(WeightedTokenSchema),
  signature: SignatureSchema,
});

export const AttributionReceiptSchema = z
  .object({
    version: z.literal("lineage/v1"),
    receiptId: z.string().regex(HEX_ANY).min(3),
    agentId: z.string().min(1),
    agentRunner: z.string().min(1),
    inferenceId: z.string().min(1),
    timestamp: z.number().int().nonnegative(),
    inputDigest: DigestSchema,
    outputDigest: DigestSchema,
    computeProof: ComputeInferenceProofSchema,
    lineage: AgentLineageAttestationSchema,
  })
  .superRefine((receipt, ctx) => {
    const { model, skills, memory, data } = receipt.lineage;
    const total =
      model.weight +
      skills.reduce((s, x) => s + x.weight, 0) +
      memory.reduce((s, x) => s + x.weight, 0) +
      data.reduce((s, x) => s + x.weight, 0);
    if (Math.abs(total - 1.0) > 1e-6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lineage weights must sum to 1.0 ± 1e-6",
        path: ["lineage"],
      });
    }
  });

/**
 * Parse-derived type. Prefer this for downstream consumers that want the type
 * to track the schema exactly (e.g. after `AttributionReceiptSchema.parse()`).
 */
export type AttributionReceiptValidated = z.infer<typeof AttributionReceiptSchema>;
