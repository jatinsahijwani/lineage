/**
 * Operator-side signer for AgentLineageAttestation.
 *
 * The agent operator is the one who knows which iNFTs (model / skills / memory
 * / data) actually contributed to an inference; the 0G TEE only signs a
 * 5-field text covering input/output digests + provider metadata. To bind
 * lineage to a particular inference the operator separately signs canonical
 * CBOR of the lineage block (with the `signature` field omitted) using
 * eth_sign / EIP-191 personal_sign.
 *
 * Canonicalisation: cbor-x does NOT sort object keys automatically. Two
 * machines encoding the same logical object can produce different bytes
 * unless we sort first. We therefore recursively sort all object keys
 * lexicographically before handing the value to cbor-x's `Encoder`. The
 * encoder is configured with `useRecords: false` (no shared structure tag —
 * stable across sessions) and `mapsAsObjects: true` (decode side gets plain
 * objects, but more importantly we never rely on insertion-order maps).
 *
 * No extra domain separator is prepended: the AttributionReceipt JSDoc in
 * @lineage/shared explicitly defines the signing scheme as "eth_sign over
 * canonical CBOR of the struct with signature omitted". Adding a domain
 * separator here would deviate from that contract.
 */

import { Encoder } from "cbor-x";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256, recoverMessageAddress, type Hex } from "viem";
import type { AgentLineageAttestation } from "@lineage/shared";

const encoder = new Encoder({ useRecords: false, mapsAsObjects: true });

/**
 * Recursively sort object keys lexicographically. Arrays are preserved in
 * order (CBOR arrays are inherently ordered); primitives pass through.
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
 * Canonical CBOR-encode the lineage block (signature stripped). Exported so
 * verifyLineageBlock and tests can reproduce the exact bytes.
 */
export function encodeLineageBlockCanonical(
  block: Omit<AgentLineageAttestation, "signature">,
): Uint8Array {
  const sorted = sortKeysDeep(block);
  // cbor-x's Encoder.encode returns a Buffer; copy into a fresh Uint8Array so
  // callers don't observe Buffer-specific behaviour.
  const buf = encoder.encode(sorted);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Compute the 32-byte envelope hash of the lineage block (canonical CBOR →
 * keccak256). Off-chain runner and on-chain AttributionVerifier MUST agree
 * on this exact value: the operator signs `eth_sign(envelopeHash)`, and the
 * contract recovers via `MessageHashUtils.toEthSignedMessageHash(bytes32)`
 * + `ECDSA.recover`. Hashing first keeps calldata bounded to 32 bytes.
 */
export function envelopeHash(
  block: Omit<AgentLineageAttestation, "signature">,
): `0x${string}` {
  const cborBytes = encodeLineageBlockCanonical(block);
  return keccak256(cborBytes);
}

/**
 * Sign the lineage envelope hash using EIP-191 personal_sign over the 32-byte
 * keccak256 of canonical CBOR. Returns a 0x-prefixed 132-char (65-byte) sig.
 *
 * The hash-first scheme (rather than signing the raw CBOR bytes directly) is
 * required so the on-chain AttributionVerifier can recover the signer from a
 * single 32-byte parameter via `MessageHashUtils.toEthSignedMessageHash`.
 * Keccak-then-eth_sign matches `toEthSignedMessageHash(bytes32)` exactly.
 */
export async function signLineageBlock(
  block: Omit<AgentLineageAttestation, "signature">,
  privateKey: Hex,
): Promise<`0x${string}`> {
  const hash = envelopeHash(block);
  const account = privateKeyToAccount(privateKey);
  // viem's signMessage({ message: { raw: 0x<32bytes> } }) applies the EIP-191
  // prefix + keccak256 — equivalent to toEthSignedMessageHash(hash) on-chain.
  const signature = await account.signMessage({ message: { raw: hash } });
  return signature;
}

/**
 * Verify an operator-signed lineage attestation. Strips the signature,
 * re-encodes canonically, hashes, and recovers via the same eth_sign(hash)
 * scheme used by the on-chain verifier.
 */
export async function verifyLineageBlock(
  attestation: AgentLineageAttestation,
  expectedOperator: `0x${string}`,
): Promise<boolean> {
  const { signature, ...rest } = attestation;
  const hash = envelopeHash(rest);
  const recovered = await recoverMessageAddress({
    message: { raw: hash },
    signature,
  });
  return recovered.toLowerCase() === expectedOperator.toLowerCase();
}
