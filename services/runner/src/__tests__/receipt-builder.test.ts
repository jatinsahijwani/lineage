import { describe, expect, it, vi } from "vitest";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { recoverMessageAddress } from "viem";
import {
  AttributionReceiptSchema,
  type AttributionReceipt,
  type DAPointer,
} from "@lineage/shared";
import { buildAndPostReceipt } from "../receipt-builder.js";
import { verifyLineageBlock } from "../lineage-signer.js";
import type { ReceiptSink } from "../receipt-sink.js";

function makeStubSink(): {
  sink: ReceiptSink;
  captured: { receipt?: AttributionReceipt };
  pointer: DAPointer;
} {
  const captured: { receipt?: AttributionReceipt } = {};
  const pointer: DAPointer = {
    commitment: ("0x" + "ab".repeat(32)) as `0x${string}`,
    blobIndex: 42,
  };
  const sink: ReceiptSink = {
    post: vi.fn(async (receipt: AttributionReceipt) => {
      captured.receipt = receipt;
      return pointer;
    }),
    read: vi.fn(async () => {
      throw new Error("not used in this test");
    }),
  };
  return { sink, captured, pointer };
}

describe("buildAndPostReceipt", () => {
  it("produces a dual-attested receipt that round-trips through the schema and both signature paths", async () => {
    const operatorPk = generatePrivateKey();
    const operatorAddress = privateKeyToAccount(operatorPk).address;
    const { sink, captured, pointer } = makeStubSink();

    const result = await buildAndPostReceipt(
      {
        inferenceId: "inf-test-1",
        agentId: "agent-1",
        agentRunner: "runner-1",
        input: "hello world",
        output: "goodbye world",
        agentOperator: operatorAddress,
        operatorPrivateKey: operatorPk,
        model: { tokenId: "1", weight: 0.7 },
        skills: [
          { tokenId: "2", weight: 0.2 },
          { tokenId: "3", weight: 0.05 },
        ],
        memory: [{ tokenId: "4", weight: 0.03 }],
        data: [{ tokenId: "5", weight: 0.02 }],
        mockTEE: true,
      },
      sink,
    );

    // Sink got the same receipt and its pointer was returned.
    expect(captured.receipt).toBeDefined();
    expect(captured.receipt).toBe(result.receipt);
    expect(result.daPointer).toEqual(pointer);

    // Schema parse passes (covers weight-sum, hex shape, version literal, etc.).
    expect(() => AttributionReceiptSchema.parse(result.receipt)).not.toThrow();

    // Operator signature recovers to operatorAddress.
    const lineageOk = await verifyLineageBlock(
      result.receipt.lineage,
      operatorAddress,
    );
    expect(lineageOk).toBe(true);

    // TEE signer recovers from attestation.text and matches signing_address.
    const att = result.receipt.computeProof.attestation;
    expect(att).toBeDefined();
    if (!att) throw new Error("attestation missing");
    const recoveredTee = await recoverMessageAddress({
      message: att.text,
      signature: att.signature,
    });
    expect(recoveredTee.toLowerCase()).toBe(att.signing_address.toLowerCase());

    // attestation.text first two ":" fields == receipt input/output digests.
    const fields = att.text.split(":");
    expect(fields.length).toBe(5);
    expect(fields[0]).toBe(result.receipt.inputDigest);
    expect(fields[1]).toBe(result.receipt.outputDigest);

    // Digests are sha256 hex (64 lowercase chars, no 0x).
    expect(result.receipt.inputDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(result.receipt.outputDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws when lineage weights do not sum to 1.0 (before signing or posting)", async () => {
    const operatorPk = generatePrivateKey();
    const operatorAddress = privateKeyToAccount(operatorPk).address;
    const { sink } = makeStubSink();

    await expect(
      buildAndPostReceipt(
        {
          inferenceId: "inf-bad-weights",
          agentId: "agent-1",
          agentRunner: "runner-1",
          input: "x",
          output: "y",
          agentOperator: operatorAddress,
          operatorPrivateKey: operatorPk,
          model: { tokenId: "1", weight: 0.5 },
          skills: [{ tokenId: "2", weight: 0.2 }],
          memory: [],
          data: [],
          mockTEE: true,
        },
        sink,
      ),
    ).rejects.toThrow(/sum to 1\.0/);
  });

  it("throws when agentOperator does not match operatorPrivateKey", async () => {
    const operatorPk = generatePrivateKey();
    const wrongAddress =
      "0x0000000000000000000000000000000000000001" as `0x${string}`;
    const { sink } = makeStubSink();

    await expect(
      buildAndPostReceipt(
        {
          inferenceId: "inf-mismatch",
          agentId: "agent-1",
          agentRunner: "runner-1",
          input: "x",
          output: "y",
          agentOperator: wrongAddress,
          operatorPrivateKey: operatorPk,
          model: { tokenId: "1", weight: 1.0 },
          skills: [],
          memory: [],
          data: [],
          mockTEE: true,
        },
        sink,
      ),
    ).rejects.toThrow(/does not match address/);
  });
});
