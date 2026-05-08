/**
 * AttributionReceipt builder + poster for the runner. Produces dual-attested
 * receipts: a TEE-signed compute proof (5-field colon-separated text covering
 * input/output digests + provider metadata) plus an operator-signed lineage
 * attestation (canonical CBOR, eth_sign).
 *
 * Sub-step 4B replaces the old placeholder `buildReceipt` — the legacy
 * `computeNodeId` parameter is gone (the receipt envelope no longer carries
 * that field).
 */

import {
  AttributionReceiptSchema,
  type AttributionReceipt,
  type AgentLineageAttestation,
  type ComputeInferenceProof,
  type DAPointer,
  type TEEAttestation,
} from "@lineage/shared";

/**
 * Inline sha256 (lowercase hex, no 0x). Avoids pulling in @lineage/crypto's
 * libsodium dependency just for hashing — keeps the runner test path cheap
 * and dodges a libsodium-wrappers ESM resolution bug under vitest.
 */
async function sha256Hex(data: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", data);
  const arr = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < arr.length; i++) {
    const byte = arr[i] as number;
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { recoverMessageAddress, type Hex } from "viem";
import { signLineageBlock, verifyLineageBlock } from "./lineage-signer.js";
import type { ReceiptSink } from "./receipt-sink.js";

export interface WeightedToken {
  tokenId: string;
  weight: number;
}

export interface BuildAndPostParams {
  /** Inference identifier (sha256 hex of input bytes is computed locally). */
  inferenceId: string;
  agentId: string;
  agentRunner: string;
  /** Canonical input bytes (or string) — sha256 hashed locally. */
  input: string;
  /** Canonical output bytes (or string) — sha256 hashed locally. */
  output: string;

  /** Operator address (must match the address derived from operatorPrivateKey). */
  agentOperator: `0x${string}`;
  /** Operator EOA private key — signs the lineage block (EIP-191 over canonical CBOR). */
  operatorPrivateKey: Hex;

  /** Lineage iNFTs that contributed to this inference. Weights must sum to 1.0 ± 1e-6. */
  model: WeightedToken;
  skills: WeightedToken[];
  memory: WeightedToken[];
  data: WeightedToken[];

  /**
   * Production path: caller provides a real TEE attestation fetched from
   * 0G Compute via /v1/proxy/signature/{zg-res-key}. Mutually exclusive with
   * `mockTEE: true`.
   */
  teeAttestation?: TEEAttestation;
  /** Provider address (matches TEEAttestation.signing_address in production). */
  computeProvider?: `0x${string}`;
  /** OpenAI-format chat id, e.g. "chatcmpl-<uuid>". */
  chatId?: string;
  /** zg-res-key response header value — the real lookup key for the proof. */
  zgResKey?: string;

  /**
   * Mock path for local dev / tests: synthesise a TEEAttestation by signing
   * the canonical 5-field text with a fresh ephemeral key. The ephemeral
   * signer's address is stashed in `attestation.signing_address` so tests can
   * assert recovery against it. Mutually exclusive with `teeAttestation`.
   */
  mockTEE?: boolean;
  /** Override the synthetic provider_type (mock only). Defaults to "centralized". */
  mockProviderType?: "centralized" | "decentralized";
  /** Override the synthetic provider_identity (mock only). Defaults to "mock-tee". */
  mockProviderIdentity?: string;
  /** Override the synthetic tls_cert_fingerprint (mock only). Defaults to 64 zero hex. */
  mockTlsCertFingerprint?: string;

  /**
   * Production path overrides for the receipt's top-level digest fields. When
   * a real TEE attestation is supplied, the receipt's inputDigest /
   * outputDigest MUST equal the first two ":"-separated fields of
   * attestation.text — otherwise the step-6c digest-binding check fails. The
   * TEE may canonicalize input/output bytes differently than a plain UTF-8
   * sha256 (see services/runner/src/zg-compute.ts for the live probe), so the
   * caller passes the TEE's claimed values through here. If omitted, the
   * builder falls back to sha256(input) / sha256(output) (mock path behavior).
   * Both must be 64-char lowercase hex with no 0x prefix.
   */
  inputDigestOverride?: string;
  outputDigestOverride?: string;
}

function newReceiptId(): `0x${string}` {
  return `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;
}

function assertWeightSum(
  model: WeightedToken,
  skills: WeightedToken[],
  memory: WeightedToken[],
  data: WeightedToken[],
): void {
  const total =
    model.weight +
    skills.reduce((s, x) => s + x.weight, 0) +
    memory.reduce((s, x) => s + x.weight, 0) +
    data.reduce((s, x) => s + x.weight, 0);
  if (Math.abs(total - 1.0) > 1e-6) {
    throw new Error(
      `lineage weights must sum to 1.0 ± 1e-6 — got ${total} (model=${model.weight}, ` +
        `skills=${skills.length}, memory=${memory.length}, data=${data.length})`,
    );
  }
}

/**
 * Build, locally verify, and post an AttributionReceipt to the supplied sink.
 *
 * Pipeline:
 *   1. sha256 input/output → lowercase hex (no 0x).
 *   2. Obtain TEE attestation (real `params.teeAttestation` or synthesised
 *      via `params.mockTEE`).
 *   3. Validate lineage weight sum (== 1.0 ± 1e-6). Throws BEFORE signing.
 *   4. Operator-sign canonical CBOR of the lineage block.
 *   5. Assemble the AttributionReceipt envelope.
 *   6. Local end-to-end verification:
 *        - TEE signer recovered from attestation.text == attestation.signing_address
 *        - Operator recovered from lineage signature == lineage.agentOperator
 *        - receipt.inputDigest / outputDigest == first two ":" fields of attestation.text
 *        - AttributionReceiptSchema.parse(receipt) (catches weight drift, hex shape, etc.)
 *   7. sink.post(receipt) and return { receipt, daPointer }.
 */
export async function buildAndPostReceipt(
  params: BuildAndPostParams,
  sink: ReceiptSink,
): Promise<{ receipt: AttributionReceipt; daPointer: DAPointer }> {
  // -------------------------------------------------------------------------
  // 1. Digests. Production path: prefer the TEE-signed values via overrides
  // (the TEE may canonicalize differently than plain UTF-8 sha256, and the
  // receipt's digest fields must match attestation.text[0]/[1]). Mock /
  // legacy path: sha256 the supplied input/output strings directly.
  // -------------------------------------------------------------------------
  const HEX64_LOWER = /^[0-9a-f]{64}$/;
  if (params.inputDigestOverride !== undefined && !HEX64_LOWER.test(params.inputDigestOverride)) {
    throw new Error(
      `inputDigestOverride must be 64-char lowercase hex (no 0x): ${params.inputDigestOverride}`,
    );
  }
  if (params.outputDigestOverride !== undefined && !HEX64_LOWER.test(params.outputDigestOverride)) {
    throw new Error(
      `outputDigestOverride must be 64-char lowercase hex (no 0x): ${params.outputDigestOverride}`,
    );
  }
  const inputDigest =
    params.inputDigestOverride ??
    (await sha256Hex(new TextEncoder().encode(params.input)));
  const outputDigest =
    params.outputDigestOverride ??
    (await sha256Hex(new TextEncoder().encode(params.output)));

  // -------------------------------------------------------------------------
  // 2. TEE attestation (real or mock).
  // -------------------------------------------------------------------------
  if (params.teeAttestation && params.mockTEE) {
    throw new Error(
      "buildAndPostReceipt: pass either teeAttestation OR mockTEE, not both",
    );
  }

  let attestation: TEEAttestation;
  let computeProof: ComputeInferenceProof;

  if (params.teeAttestation) {
    attestation = params.teeAttestation;
    computeProof = {
      provider: params.computeProvider ?? attestation.signing_address,
      chatId: params.chatId ?? `chatcmpl-${params.inferenceId}`,
      zgResKey: params.zgResKey ?? params.inferenceId,
      attestation,
    };
  } else if (params.mockTEE) {
    // Per-call ephemeral key so signing_address is well-defined and tests can
    // recover-and-assert against it. The key is discarded after signing — no
    // persistent identity is implied.
    const ephemeralPk = generatePrivateKey();
    const ephemeralAccount = privateKeyToAccount(ephemeralPk);
    const providerType = params.mockProviderType ?? "centralized";
    const providerIdentity = params.mockProviderIdentity ?? "mock-tee";
    const tlsCertFingerprint =
      params.mockTlsCertFingerprint ?? "00".repeat(32);
    const text =
      `${inputDigest}:${outputDigest}:${providerType}:${providerIdentity}:${tlsCertFingerprint}`;
    const teeSig = await ephemeralAccount.signMessage({ message: text });
    attestation = {
      text,
      signature: teeSig,
      signing_address: ephemeralAccount.address,
      signing_algo: "ecdsa",
      provider_type: providerType,
      provider_identity: providerIdentity,
      tls_cert_fingerprint: tlsCertFingerprint,
    };
    computeProof = {
      provider: params.computeProvider ?? ephemeralAccount.address,
      chatId: params.chatId ?? `chatcmpl-${params.inferenceId}`,
      zgResKey: params.zgResKey ?? params.inferenceId,
      attestation,
    };
  } else {
    throw new Error(
      "buildAndPostReceipt: provide either params.teeAttestation or params.mockTEE: true",
    );
  }

  // -------------------------------------------------------------------------
  // 3. Validate lineage weight sum BEFORE signing.
  // -------------------------------------------------------------------------
  assertWeightSum(params.model, params.skills, params.memory, params.data);

  // Cross-check operator address vs supplied private key — fail fast if the
  // caller passed mismatched identities (cheap, avoids posting a receipt that
  // would later fail verifyLineageBlock).
  const operatorAccount = privateKeyToAccount(params.operatorPrivateKey);
  if (operatorAccount.address.toLowerCase() !== params.agentOperator.toLowerCase()) {
    throw new Error(
      `agentOperator ${params.agentOperator} does not match address ` +
        `derived from operatorPrivateKey (${operatorAccount.address})`,
    );
  }

  // -------------------------------------------------------------------------
  // 4. Operator signs canonical CBOR of the lineage block (no signature).
  // -------------------------------------------------------------------------
  const lineageNoSig: Omit<AgentLineageAttestation, "signature"> = {
    agentOperator: params.agentOperator,
    model: params.model,
    skills: params.skills,
    memory: params.memory,
    data: params.data,
  };
  const lineageSig = await signLineageBlock(
    lineageNoSig,
    params.operatorPrivateKey,
  );
  const lineage: AgentLineageAttestation = {
    ...lineageNoSig,
    signature: lineageSig,
  };

  // -------------------------------------------------------------------------
  // 5. Assemble envelope.
  // -------------------------------------------------------------------------
  const receipt: AttributionReceipt = {
    version: "lineage/v1",
    receiptId: newReceiptId(),
    agentId: params.agentId,
    agentRunner: params.agentRunner,
    inferenceId: params.inferenceId,
    timestamp: Math.floor(Date.now() / 1000),
    inputDigest,
    outputDigest,
    computeProof,
    lineage,
  };

  // -------------------------------------------------------------------------
  // 6. End-to-end local verification.
  // -------------------------------------------------------------------------

  // 6a. TEE signer recovery.
  const recoveredTee = await recoverMessageAddress({
    message: attestation.text,
    signature: attestation.signature,
  });
  if (recoveredTee.toLowerCase() !== attestation.signing_address.toLowerCase()) {
    throw new Error(
      `local verify (tee): recovered ${recoveredTee} != signing_address ${attestation.signing_address}`,
    );
  }

  // 6b. Operator signature recovery.
  const operatorOk = await verifyLineageBlock(lineage, params.agentOperator);
  if (!operatorOk) {
    throw new Error(
      `local verify (operator): lineage signature does not recover to ${params.agentOperator}`,
    );
  }

  // 6c. attestation.text first two ":"-separated fields == receipt digests.
  const fields = attestation.text.split(":");
  if (fields.length < 5) {
    throw new Error(
      `local verify (text shape): attestation.text has ${fields.length} fields, expected 5`,
    );
  }
  if (fields[0] !== receipt.inputDigest) {
    throw new Error(
      `local verify (digest binding): attestation.text[0]=${fields[0]} != receipt.inputDigest=${receipt.inputDigest}`,
    );
  }
  if (fields[1] !== receipt.outputDigest) {
    throw new Error(
      `local verify (digest binding): attestation.text[1]=${fields[1]} != receipt.outputDigest=${receipt.outputDigest}`,
    );
  }

  // 6d. Schema parse — catches weight drift, hex shape, missing fields, etc.
  AttributionReceiptSchema.parse(receipt);

  // -------------------------------------------------------------------------
  // 7. Post to sink.
  // -------------------------------------------------------------------------
  const daPointer = await sink.post(receipt);
  return { receipt, daPointer };
}
