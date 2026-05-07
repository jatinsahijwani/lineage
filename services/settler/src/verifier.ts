/**
 * Off-chain TS port of `AttributionVerifier.verifyReceipt` (sub-step 4D).
 *
 * The settler runs this against every receipt in a window before Merkle
 * aggregation. Failing receipts are dropped and not paid out — the on-chain
 * verifier is only invoked at claim time, so filtering early keeps malicious /
 * malformed receipts out of the batch root entirely.
 *
 * The check ordering mirrors the on-chain contract exactly, with a single
 * additional leading check (`missing attestation`) that the contract doesn't
 * need because Solidity can't have absent struct fields. This keeps the failure
 * modes a strict superset of on-chain failures, so any receipt the off-chain
 * verifier accepts will also pass on-chain.
 *
 * The canonical CBOR encoding here MUST stay byte-identical to the runner's
 * `services/runner/src/lineage-signer.ts:encodeLineageBlockCanonical` — the
 * operator signed those exact bytes, so any drift breaks signature recovery.
 * Duplication is deliberate v1 scope: extracting to a shared package is
 * scope creep for 4D, and a vitest assertion in __tests__/verifier.test.ts
 * proves byte-equality across the two services.
 */

import { Encoder } from "cbor-x";
import {
  createPublicClient,
  http,
  keccak256,
  recoverMessageAddress,
} from "viem";
import {
  AttributionReceiptSchema,
  type AttributionReceipt,
  type AgentLineageAttestation,
} from "@lineage/shared";

// ---------------------------------------------------------------------------
// Trusted-source abstraction.
// ---------------------------------------------------------------------------

export interface TrustedSource {
  isTrustedTEESigner(address: `0x${string}`): Promise<boolean>;
  isTrustedOperator(address: `0x${string}`): Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Result shape.
// ---------------------------------------------------------------------------

export type VerificationFailure =
  | "missing attestation"
  | "tee sig mismatch"
  | "tee not trusted"
  | "op sig mismatch"
  | "op not trusted"
  | "input digest mismatch"
  | "output digest mismatch"
  | "schema invalid";

export type VerificationResult =
  | { ok: true }
  | { ok: false; reason: VerificationFailure; detail?: string };

// ---------------------------------------------------------------------------
// Canonical CBOR — MUST stay byte-identical to
// services/runner/src/lineage-signer.ts:encodeLineageBlockCanonical.
// Any drift here invalidates every operator signature.
// ---------------------------------------------------------------------------

const encoder = new Encoder({ useRecords: false, mapsAsObjects: true });

/**
 * Recursively sort object keys lexicographically. Arrays are preserved in
 * order (CBOR arrays are inherently ordered); primitives pass through.
 *
 * MUST stay byte-identical to services/runner/src/lineage-signer.ts:sortKeysDeep.
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => sortKeysDeep(v));
  }
  if (value !== null && typeof value === "object") {
    const sorted: Record<string, unknown> = {};
    const keys = Object.keys(value as Record<string, unknown>).sort();
    for (const k of keys) {
      sorted[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
    }
    return sorted;
  }
  return value;
}

/**
 * Canonical CBOR-encode the lineage block (signature stripped).
 *
 * MUST stay byte-identical to
 * services/runner/src/lineage-signer.ts:encodeLineageBlockCanonical.
 */
export function encodeLineageBlockCanonical(
  block: Omit<AgentLineageAttestation, "signature">,
): Uint8Array {
  const sorted = sortKeysDeep(block);
  const buf = encoder.encode(sorted);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * 32-byte envelope hash of the lineage block (canonical CBOR → keccak256).
 *
 * MUST stay byte-identical to services/runner/src/lineage-signer.ts:envelopeHash.
 */
export function envelopeHash(
  block: Omit<AgentLineageAttestation, "signature">,
): `0x${string}` {
  return keccak256(encodeLineageBlockCanonical(block));
}

// ---------------------------------------------------------------------------
// Off-chain verifier.
// ---------------------------------------------------------------------------

/**
 * Verify a receipt off-chain. Mirrors `AttributionVerifier.verifyReceipt` plus
 * a leading `missing attestation` presence check and a leading schema parse.
 *
 * Order:
 *   1. attestation presence (off-chain only)
 *   2. schema parse (off-chain only — fails fast on malformed envelopes)
 *   3. TEE recover + trusted
 *   4. Operator recover + trusted
 *   5. Digest binding (input + output)
 */
export async function verifyReceiptOffchain(
  receipt: AttributionReceipt,
  trusted: TrustedSource,
): Promise<VerificationResult> {
  // 1. Attestation must be present.
  const attestation = receipt.computeProof.attestation;
  if (!attestation) {
    return { ok: false, reason: "missing attestation" };
  }

  // 2. Schema parse. Run this before signature work so a malformed envelope
  //    (bad weights, missing fields, wrong hex) fails fast and cheaply.
  try {
    AttributionReceiptSchema.parse(receipt);
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "unknown schema error";
    return { ok: false, reason: "schema invalid", detail };
  }

  // 3. TEE recover and trusted.
  let recoveredTee: `0x${string}`;
  try {
    recoveredTee = await recoverMessageAddress({
      message: attestation.text,
      signature: attestation.signature,
    });
  } catch (err) {
    return {
      ok: false,
      reason: "tee sig mismatch",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  if (recoveredTee.toLowerCase() !== attestation.signing_address.toLowerCase()) {
    return {
      ok: false,
      reason: "tee sig mismatch",
      detail: `recovered ${recoveredTee} != ${attestation.signing_address}`,
    };
  }
  if (!(await trusted.isTrustedTEESigner(attestation.signing_address))) {
    return {
      ok: false,
      reason: "tee not trusted",
      detail: attestation.signing_address,
    };
  }

  // 4. Operator recover and trusted. Strip signature, recompute envelope hash
  //    via the same canonical CBOR path the runner used, then recover via
  //    EIP-191 over the 32-byte hash (matches the on-chain
  //    `MessageHashUtils.toEthSignedMessageHash(bytes32)` + ECDSA.recover).
  const { signature: opSig, ...lineageNoSig } = receipt.lineage;
  const opHash = envelopeHash(lineageNoSig);
  let recoveredOp: `0x${string}`;
  try {
    recoveredOp = await recoverMessageAddress({
      message: { raw: opHash },
      signature: opSig,
    });
  } catch (err) {
    return {
      ok: false,
      reason: "op sig mismatch",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  if (recoveredOp.toLowerCase() !== receipt.lineage.agentOperator.toLowerCase()) {
    return {
      ok: false,
      reason: "op sig mismatch",
      detail: `recovered ${recoveredOp} != ${receipt.lineage.agentOperator}`,
    };
  }
  if (!(await trusted.isTrustedOperator(receipt.lineage.agentOperator))) {
    return {
      ok: false,
      reason: "op not trusted",
      detail: receipt.lineage.agentOperator,
    };
  }

  // 5. Digest binding — first two ":"-separated fields of the TEE-signed text
  //    must equal the receipt's top-level digests. DigestSchema already
  //    enforces lowercase no-0x; we compare strings directly.
  const fields = attestation.text.split(":");
  if (fields[0] !== receipt.inputDigest) {
    return {
      ok: false,
      reason: "input digest mismatch",
      detail: `text[0]=${fields[0]} != inputDigest=${receipt.inputDigest}`,
    };
  }
  if (fields[1] !== receipt.outputDigest) {
    return {
      ok: false,
      reason: "output digest mismatch",
      detail: `text[1]=${fields[1]} != outputDigest=${receipt.outputDigest}`,
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Production wiring helper — chain-backed TrustedSource.
// ---------------------------------------------------------------------------

const VERIFIER_ABI = [
  {
    name: "trustedTEESigners",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "signer", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "trustedOperators",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "operator", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/**
 * Returns a TrustedSource backed by `AttributionVerifier` view calls. Caches
 * results per-address per-source so a batch with N receipts from the same
 * operator/TEE only hits the RPC twice.
 *
 * The cache lifetime is tied to the returned object — callers should
 * instantiate one per settlement window so trust changes between windows are
 * picked up.
 */
export function makeChainTrustedSource(args: {
  rpc: string;
  verifierAddress: `0x${string}`;
}): TrustedSource {
  const client = createPublicClient({ transport: http(args.rpc) });
  const teeCache = new Map<string, boolean>();
  const opCache = new Map<string, boolean>();

  return {
    async isTrustedTEESigner(address) {
      const key = address.toLowerCase();
      const cached = teeCache.get(key);
      if (cached !== undefined) return cached;
      const result = (await client.readContract({
        address: args.verifierAddress,
        abi: VERIFIER_ABI,
        functionName: "trustedTEESigners",
        args: [address],
      })) as boolean;
      teeCache.set(key, result);
      return result;
    },
    async isTrustedOperator(address) {
      const key = address.toLowerCase();
      const cached = opCache.get(key);
      if (cached !== undefined) return cached;
      const result = (await client.readContract({
        address: args.verifierAddress,
        abi: VERIFIER_ABI,
        functionName: "trustedOperators",
        args: [address],
      })) as boolean;
      opCache.set(key, result);
      return result;
    },
  };
}
