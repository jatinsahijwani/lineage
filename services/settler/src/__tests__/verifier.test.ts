/**
 * Tests for verifyReceiptOffchain (sub-step 4D).
 *
 * Each test mints fresh ephemeral keys for TEE + operator, builds a receipt
 * by hand (so we can corrupt individual fields), and runs it through the
 * verifier with a stub TrustedSource. The happy path is also cross-validated
 * by feeding a runner-produced receipt back through the verifier — this is
 * the byte-equality assertion called out in the verifier.ts docstring.
 */

import { describe, expect, it, vi } from "vitest";
import {
  generatePrivateKey,
  privateKeyToAccount,
} from "viem/accounts";
import type { Hex } from "viem";
import type {
  AttributionReceipt,
  AgentLineageAttestation,
  ComputeInferenceProof,
  TEEAttestation,
} from "@lineage/shared";
import {
  signLineageBlock,
  encodeLineageBlockCanonical as runnerEncode,
} from "@lineage/runner/dist/lineage-signer.js";
import { buildAndPostReceipt } from "@lineage/runner/dist/receipt-builder.js";
import type { ReceiptSink } from "@lineage/runner/dist/receipt-sink.js";
import {
  verifyReceiptOffchain,
  encodeLineageBlockCanonical,
  type TrustedSource,
  type VerificationResult,
} from "../verifier.js";

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

function makeTrustedSource(args: {
  trustedTEEs: Set<string>;
  trustedOps: Set<string>;
}): TrustedSource {
  return {
    isTrustedTEESigner: async (a) =>
      args.trustedTEEs.has(a.toLowerCase()),
    isTrustedOperator: async (a) => args.trustedOps.has(a.toLowerCase()),
  };
}

const ZERO64 = "00".repeat(32); // 64 lowercase hex chars
const ONE64 = "11".repeat(32);

function digest(label: number): string {
  // Produce a 64-char lowercase hex digest deterministically.
  const byte = label.toString(16).padStart(2, "0");
  return byte.repeat(32);
}

interface BuildReceiptArgs {
  operatorPk: Hex;
  teePk: Hex;
  inputDigest?: string;
  outputDigest?: string;
  /** Override the canonical text the TEE actually signs. */
  teeTextOverride?: string;
  /** Override the lineage block the operator actually signs. */
  operatorSignsBlock?: Omit<AgentLineageAttestation, "signature">;
  /** Override individual lineage fields after signing. */
  lineageOverride?: Partial<AgentLineageAttestation>;
  /** Drop the attestation entirely. */
  dropAttestation?: boolean;
}

async function buildReceipt(args: BuildReceiptArgs): Promise<AttributionReceipt> {
  const opAccount = privateKeyToAccount(args.operatorPk);
  const teeAccount = privateKeyToAccount(args.teePk);

  const inputDigest = args.inputDigest ?? digest(0xaa);
  const outputDigest = args.outputDigest ?? digest(0xbb);

  const providerType = "centralized";
  const providerIdentity = "mock-tee";
  const tlsFp = ZERO64;
  const text =
    args.teeTextOverride ??
    `${inputDigest}:${outputDigest}:${providerType}:${providerIdentity}:${tlsFp}`;
  const teeSig = await teeAccount.signMessage({ message: text });

  const attestation: TEEAttestation = {
    text,
    signature: teeSig,
    signing_address: teeAccount.address,
    signing_algo: "ecdsa",
    provider_type: providerType,
    provider_identity: providerIdentity,
    tls_cert_fingerprint: tlsFp,
  };

  const lineageNoSig: Omit<AgentLineageAttestation, "signature"> = {
    agentOperator: opAccount.address,
    model: { tokenId: "1", weight: 0.6 },
    skills: [{ tokenId: "2", weight: 0.3 }],
    memory: [{ tokenId: "3", weight: 0.05 }],
    data: [{ tokenId: "4", weight: 0.05 }],
  };
  const blockToSign = args.operatorSignsBlock ?? lineageNoSig;
  const lineageSig = await signLineageBlock(blockToSign, args.operatorPk);

  const lineage: AgentLineageAttestation = {
    ...lineageNoSig,
    signature: lineageSig,
    ...(args.lineageOverride ?? {}),
  };

  const computeProof: ComputeInferenceProof = args.dropAttestation
    ? {
        provider: teeAccount.address,
        chatId: "chatcmpl-test",
        zgResKey: "zg-res-key-test",
      }
    : {
        provider: teeAccount.address,
        chatId: "chatcmpl-test",
        zgResKey: "zg-res-key-test",
        attestation,
      };

  return {
    version: "lineage/v1",
    receiptId: ("0x" + "ab".repeat(32)) as `0x${string}`,
    agentId: "agent-1",
    agentRunner: "runner-1",
    inferenceId: "inf-test",
    timestamp: 1_700_000_000,
    inputDigest,
    outputDigest,
    computeProof,
    lineage,
  };
}

function expectFailure(
  result: VerificationResult,
  reason: string,
): void {
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.reason).toBe(reason);
  }
}

// ---------------------------------------------------------------------------
// Byte-equality between settler and runner canonical CBOR.
// This is the assertion called out in verifier.ts: any drift here
// invalidates every operator signature across the runner-settler-contract
// triple.
// ---------------------------------------------------------------------------

describe("canonical CBOR byte-equality", () => {
  it("settler.encodeLineageBlockCanonical == runner.encodeLineageBlockCanonical", () => {
    const block: Omit<AgentLineageAttestation, "signature"> = {
      agentOperator: "0x1234567890123456789012345678901234567890",
      model: { tokenId: "1", weight: 0.5 },
      skills: [{ tokenId: "2", weight: 0.25 }],
      memory: [],
      data: [{ tokenId: "3", weight: 0.25 }],
    };
    const settlerBytes = encodeLineageBlockCanonical(block);
    const runnerBytes = runnerEncode(block);
    expect(Buffer.from(settlerBytes).equals(Buffer.from(runnerBytes))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// verifyReceiptOffchain.
// ---------------------------------------------------------------------------

describe("verifyReceiptOffchain", () => {
  it("happy path: trusted TEE + operator, valid signatures, matching digests", async () => {
    const operatorPk = generatePrivateKey();
    const teePk = generatePrivateKey();
    const opAddr = privateKeyToAccount(operatorPk).address;
    const teeAddr = privateKeyToAccount(teePk).address;

    const receipt = await buildReceipt({ operatorPk, teePk });
    const trusted = makeTrustedSource({
      trustedTEEs: new Set([teeAddr.toLowerCase()]),
      trustedOps: new Set([opAddr.toLowerCase()]),
    });

    const result = await verifyReceiptOffchain(receipt, trusted);
    expect(result).toEqual({ ok: true });
  });

  it("missing attestation → 'missing attestation'", async () => {
    const operatorPk = generatePrivateKey();
    const teePk = generatePrivateKey();
    const opAddr = privateKeyToAccount(operatorPk).address;
    const teeAddr = privateKeyToAccount(teePk).address;

    const receipt = await buildReceipt({
      operatorPk,
      teePk,
      dropAttestation: true,
    });
    const trusted = makeTrustedSource({
      trustedTEEs: new Set([teeAddr.toLowerCase()]),
      trustedOps: new Set([opAddr.toLowerCase()]),
    });

    expectFailure(
      await verifyReceiptOffchain(receipt, trusted),
      "missing attestation",
    );
  });

  it("schema invalid: weights summing to 1.5 → 'schema invalid'", async () => {
    const operatorPk = generatePrivateKey();
    const teePk = generatePrivateKey();
    const opAddr = privateKeyToAccount(operatorPk).address;
    const teeAddr = privateKeyToAccount(teePk).address;

    const valid = await buildReceipt({ operatorPk, teePk });
    const broken: AttributionReceipt = {
      ...valid,
      lineage: {
        ...valid.lineage,
        skills: [{ tokenId: "2", weight: 0.8 }], // total now 0.6 + 0.8 + 0.05 + 0.05 = 1.5
      },
    };
    const trusted = makeTrustedSource({
      trustedTEEs: new Set([teeAddr.toLowerCase()]),
      trustedOps: new Set([opAddr.toLowerCase()]),
    });

    expectFailure(
      await verifyReceiptOffchain(broken, trusted),
      "schema invalid",
    );
  });

  it("tee sig mismatch: TEE signature was made over a different text → 'tee sig mismatch'", async () => {
    const operatorPk = generatePrivateKey();
    const teePk = generatePrivateKey();
    const opAddr = privateKeyToAccount(operatorPk).address;
    const teeAddr = privateKeyToAccount(teePk).address;

    // Build a normal receipt, then overwrite attestation.text with something
    // the TEE signature does NOT cover. signing_address still points at the
    // real TEE key, but recovery from `text` will yield a different address.
    const receipt = await buildReceipt({ operatorPk, teePk });
    receipt.computeProof.attestation!.text =
      `${digest(0xcc)}:${digest(0xdd)}:centralized:mock-tee:${ZERO64}`;
    // Also fix the digests on the envelope so the test fails on signature
    // recovery, not on digest binding (digest binding is checked later).
    receipt.inputDigest = digest(0xcc);
    receipt.outputDigest = digest(0xdd);

    const trusted = makeTrustedSource({
      trustedTEEs: new Set([teeAddr.toLowerCase()]),
      trustedOps: new Set([opAddr.toLowerCase()]),
    });

    expectFailure(
      await verifyReceiptOffchain(receipt, trusted),
      "tee sig mismatch",
    );
  });

  it("tee not trusted: valid TEE recovery, isTrustedTEESigner=false → 'tee not trusted'", async () => {
    const operatorPk = generatePrivateKey();
    const teePk = generatePrivateKey();
    const opAddr = privateKeyToAccount(operatorPk).address;

    const receipt = await buildReceipt({ operatorPk, teePk });
    const trusted = makeTrustedSource({
      trustedTEEs: new Set(), // TEE not in trust set
      trustedOps: new Set([opAddr.toLowerCase()]),
    });

    expectFailure(
      await verifyReceiptOffchain(receipt, trusted),
      "tee not trusted",
    );
  });

  it("op sig mismatch: operator signed a different lineage block → 'op sig mismatch'", async () => {
    const operatorPk = generatePrivateKey();
    const teePk = generatePrivateKey();
    const opAddr = privateKeyToAccount(operatorPk).address;
    const teeAddr = privateKeyToAccount(teePk).address;

    // Operator signs a block with a different model token; receipt carries
    // the original block. Recovery from the receipt's bytes will yield a
    // different address than the one stamped on the lineage.
    const opAccount = privateKeyToAccount(operatorPk);
    const decoyBlock: Omit<AgentLineageAttestation, "signature"> = {
      agentOperator: opAccount.address,
      model: { tokenId: "999", weight: 1.0 },
      skills: [],
      memory: [],
      data: [],
    };
    const receipt = await buildReceipt({
      operatorPk,
      teePk,
      operatorSignsBlock: decoyBlock,
    });
    const trusted = makeTrustedSource({
      trustedTEEs: new Set([teeAddr.toLowerCase()]),
      trustedOps: new Set([opAddr.toLowerCase()]),
    });

    expectFailure(
      await verifyReceiptOffchain(receipt, trusted),
      "op sig mismatch",
    );
  });

  it("op not trusted: valid operator recovery, isTrustedOperator=false → 'op not trusted'", async () => {
    const operatorPk = generatePrivateKey();
    const teePk = generatePrivateKey();
    const teeAddr = privateKeyToAccount(teePk).address;

    const receipt = await buildReceipt({ operatorPk, teePk });
    const trusted = makeTrustedSource({
      trustedTEEs: new Set([teeAddr.toLowerCase()]),
      trustedOps: new Set(), // operator not trusted
    });

    expectFailure(
      await verifyReceiptOffchain(receipt, trusted),
      "op not trusted",
    );
  });

  it("input digest mismatch: receipt.inputDigest != attestation.text[0] → 'input digest mismatch'", async () => {
    const operatorPk = generatePrivateKey();
    const teePk = generatePrivateKey();
    const opAddr = privateKeyToAccount(operatorPk).address;
    const teeAddr = privateKeyToAccount(teePk).address;

    // Build a normal valid receipt, then mutate the envelope inputDigest. The
    // TEE signature still verifies (it covers `text`), and the attestation is
    // trusted; only the digest binding step fails. We must replace with a
    // different valid 64-char hex so schema parse still passes.
    const receipt = await buildReceipt({ operatorPk, teePk });
    receipt.inputDigest = ONE64;

    const trusted = makeTrustedSource({
      trustedTEEs: new Set([teeAddr.toLowerCase()]),
      trustedOps: new Set([opAddr.toLowerCase()]),
    });

    expectFailure(
      await verifyReceiptOffchain(receipt, trusted),
      "input digest mismatch",
    );
  });

  it("output digest mismatch: receipt.outputDigest != attestation.text[1] → 'output digest mismatch'", async () => {
    const operatorPk = generatePrivateKey();
    const teePk = generatePrivateKey();
    const opAddr = privateKeyToAccount(operatorPk).address;
    const teeAddr = privateKeyToAccount(teePk).address;

    const receipt = await buildReceipt({ operatorPk, teePk });
    receipt.outputDigest = ONE64;

    const trusted = makeTrustedSource({
      trustedTEEs: new Set([teeAddr.toLowerCase()]),
      trustedOps: new Set([opAddr.toLowerCase()]),
    });

    expectFailure(
      await verifyReceiptOffchain(receipt, trusted),
      "output digest mismatch",
    );
  });
});

// ---------------------------------------------------------------------------
// Round-trip from the runner: this proves that the canonical CBOR byte
// sequence the runner signs is what the settler recomputes — without this,
// the byte-equality test above could match in isolation but a mock-TEE
// receipt could still fail in production.
// ---------------------------------------------------------------------------

describe("runner round-trip", () => {
  it("buildAndPostReceipt(mockTEE: true) → verifyReceiptOffchain → ok", async () => {
    const operatorPk = generatePrivateKey();
    const opAddr = privateKeyToAccount(operatorPk).address;

    let captured: AttributionReceipt | undefined;
    const stubSink: ReceiptSink = {
      post: vi.fn(async (r) => {
        captured = r;
        return {
          commitment: ("0x" + "cd".repeat(32)) as `0x${string}`,
          blobIndex: 1,
        };
      }),
      read: vi.fn(async () => {
        throw new Error("not used");
      }),
    };

    const { receipt } = await buildAndPostReceipt(
      {
        inferenceId: "inf-rt",
        agentId: "agent-1",
        agentRunner: "runner-1",
        input: "hello",
        output: "world",
        agentOperator: opAddr,
        operatorPrivateKey: operatorPk,
        model: { tokenId: "1", weight: 0.7 },
        skills: [{ tokenId: "2", weight: 0.3 }],
        memory: [],
        data: [],
        mockTEE: true,
      },
      stubSink,
    );
    expect(captured).toBe(receipt);

    // Trust the synthesised TEE address + the operator.
    const teeAddr = receipt.computeProof.attestation!.signing_address;
    const trusted = makeTrustedSource({
      trustedTEEs: new Set([teeAddr.toLowerCase()]),
      trustedOps: new Set([opAddr.toLowerCase()]),
    });

    const result = await verifyReceiptOffchain(receipt, trusted);
    expect(result).toEqual({ ok: true });
  });
});
