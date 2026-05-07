import { encode as cborEncode, decode as cborDecode } from "cbor-x";
import type { AttributionReceipt, AgentLineageAttestation } from "@lineage/shared";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const ZERO_SIGNATURE = ("0x" + "00".repeat(65)) as `0x${string}`;

export function encodeReceipt(receipt: AttributionReceipt): Uint8Array {
  // Canonical key ordering — matches the AttributionReceipt interface in
  // @lineage/shared. cbor-x is configured for deterministic map encoding.
  const canonical = {
    version: receipt.version,
    receiptId: receipt.receiptId,
    agentId: receipt.agentId,
    agentRunner: receipt.agentRunner,
    inferenceId: receipt.inferenceId,
    timestamp: receipt.timestamp,
    inputDigest: receipt.inputDigest,
    outputDigest: receipt.outputDigest,
    computeProof: receipt.computeProof,
    lineage: receipt.lineage,
  };
  return cborEncode(canonical);
}

export function decodeReceipt(encoded: Uint8Array): AttributionReceipt {
  return cborDecode(encoded) as AttributionReceipt;
}

export function validateReceipt(receipt: AttributionReceipt): void {
  const { model, skills, memory, data } = receipt.lineage;
  const totalWeight =
    model.weight +
    skills.reduce((s, x) => s + x.weight, 0) +
    memory.reduce((s, x) => s + x.weight, 0) +
    data.reduce((s, x) => s + x.weight, 0);
  if (Math.abs(totalWeight - 1.0) > 1e-6) {
    throw new Error(`Receipt weights must sum to 1.0, got ${totalWeight}`);
  }
}

/**
 * Strip a leading 0x and lowercase a hex digest. Receipts store sha256 hex
 * without the 0x prefix (per AttributionReceipt jsdoc); upstream callers
 * sometimes hand us the @lineage/crypto sha256() output which is 0x-prefixed.
 */
function normalizeDigest(hex: string): string {
  const stripped = hex.startsWith("0x") ? hex.slice(2) : hex;
  return stripped.toLowerCase();
}

export function buildMockReceipt(params: {
  modelTokenId: string;
  skills: string[];
  inferenceId: string;
  inputDigest: string;
  outputDigest: string;
  agentId: string;
  agentRunner: string;
}): AttributionReceipt {
  const { modelTokenId, skills, inferenceId, inputDigest, outputDigest, agentId, agentRunner } = params;
  const skillWeight = skills.length > 0 ? 0.3 / skills.length : 0;
  const modelWeight = skills.length > 0 ? 0.7 : 1.0;

  const lineage: AgentLineageAttestation = {
    agentOperator: ZERO_ADDRESS,
    model: { tokenId: modelTokenId, weight: modelWeight },
    skills: skills.map((s) => ({ tokenId: s, weight: skillWeight })),
    memory: [],
    data: [],
    signature: ZERO_SIGNATURE,
  };

  return {
    version: "lineage/v1",
    receiptId: `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`,
    agentId,
    agentRunner,
    inferenceId,
    timestamp: Math.floor(Date.now() / 1000),
    inputDigest: normalizeDigest(inputDigest),
    outputDigest: normalizeDigest(outputDigest),
    computeProof: {
      provider: ZERO_ADDRESS,
      chatId: `mock-${inferenceId}`,
      zgResKey: `mock-${inferenceId}`,
      // attestation intentionally omitted — populated lazily by the runner
      // when the real TEE signature is available.
    },
    lineage,
  };
}
