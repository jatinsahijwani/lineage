import type { AttributionReceipt, DAPointer } from "@lineage/shared";
import { aggregateReceipts } from "./attribute.js";
import { buildMerkleTree } from "./merkle.js";
import { verifyReceiptOffchain, type TrustedSource } from "./verifier.js";
import type { LineageNode } from "@lineage/sdk/lineage-graph.js";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export {
  verifyReceiptOffchain,
  makeChainTrustedSource,
  envelopeHash,
  encodeLineageBlockCanonical,
} from "./verifier.js";
export type {
  TrustedSource,
  VerificationFailure,
  VerificationResult,
} from "./verifier.js";

// Minimal local copy of the runner's ReceiptSink interface to avoid a
// services-to-services dependency. Settler only needs `read`.
export interface ReceiptSource {
  read(pointer: DAPointer): Promise<AttributionReceipt>;
}

const SPLITTER_ABI = [
  {
    name: "postBatch",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "batch",
        type: "tuple",
        components: [
          { name: "batchId", type: "uint256" },
          { name: "merkleRoot", type: "bytes32" },
          { name: "windowStart", type: "uint64" },
          { name: "windowEnd", type: "uint64" },
          { name: "receiptCount", type: "uint256" },
          {
            name: "daPointer",
            type: "tuple",
            components: [
              { name: "commitment", type: "bytes32" },
              { name: "blobIndex", type: "uint64" },
            ],
          },
        ],
      },
      { name: "operatorSig", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export async function runSettlement(params: {
  batchId: bigint;
  /** Either pre-fetched receipts, or pointers + a ReceiptSource to read them. */
  receipts?: AttributionReceipt[];
  pointers?: DAPointer[];
  sink?: ReceiptSource;
  windowStart: bigint;
  windowEnd: bigint;
  /**
   * Optional: explicit pointer to write into SettlementBatch.daPointer.
   * If omitted, derived from the first entry of `pointers`.
   */
  daPointer?: DAPointer;
  totalRevenuePerReceipt: bigint;
  paymentToken: `0x${string}`;
  splitterAddress: `0x${string}`;
  rpc: string;
  privateKey: `0x${string}`;
  nodeMap: Map<bigint, LineageNode>;
  ownerMap: Map<bigint, `0x${string}`>;
  /**
   * Optional dual-attestation verifier. When provided, every receipt is
   * checked off-chain (TEE + operator signatures, trusted-source membership,
   * digest binding) and only surviving receipts feed the Merkle aggregation.
   * If omitted, behaviour is preserved (no filtering — used by the existing
   * e2e demo path until 4E rewires it).
   */
  verifier?: TrustedSource;
}) {
  const {
    batchId, windowStart, windowEnd,
    totalRevenuePerReceipt, paymentToken, splitterAddress, rpc, privateKey,
    nodeMap, ownerMap, verifier,
  } = params;

  // Resolve receipts: either passed inline, or fetched from the sink via pointers
  let receipts: AttributionReceipt[];
  if (params.receipts) {
    receipts = params.receipts;
  } else if (params.pointers && params.sink) {
    receipts = await Promise.all(params.pointers.map((p) => params.sink!.read(p)));
  } else {
    throw new Error("runSettlement: must provide either receipts[] or pointers[]+sink");
  }

  // Resolve daPointer: explicit > first pointer in batch > zero
  const daPointer: DAPointer =
    params.daPointer ??
    params.pointers?.[0] ??
    { commitment: ("0x" + "00".repeat(32)) as `0x${string}`, blobIndex: 0 };

  console.log(`[settler] running batch ${batchId} with ${receipts.length} receipts`);

  // Optional dual-attestation filter — drop receipts that fail off-chain
  // verification before they enter Merkle aggregation. The on-chain verifier
  // is only invoked at claim time, so filtering here is the only line of
  // defence between malformed/malicious receipts and the batch root.
  let filtered = receipts;
  if (verifier) {
    const survivors: AttributionReceipt[] = [];
    for (const receipt of receipts) {
      const result = await verifyReceiptOffchain(receipt, verifier);
      if (result.ok) {
        survivors.push(receipt);
      } else {
        const detail = result.detail ? ` [${result.detail}]` : "";
        console.log(`[settler] rejected receipt: ${result.reason}${detail}`);
      }
    }
    if (survivors.length === 0) {
      throw new Error("no receipts passed verification");
    }
    filtered = survivors;
  }

  const payouts = await aggregateReceipts(
    filtered,
    totalRevenuePerReceipt,
    paymentToken,
    (id) => nodeMap.get(id),
    (id) => ownerMap.get(id) ?? "0x0000000000000000000000000000000000000000",
  );

  console.log(`[settler] computed ${payouts.length} payout entries`);

  const leaves = payouts.map((p) => ({ batchId, recipient: p.recipient, token: p.token, amount: p.amount }));
  const { root, tree, encodedLeaves } = buildMerkleTree(leaves);

  console.log(`[settler] merkle root: ${root}`);

  const account = privateKeyToAccount(privateKey);
  const wallet = createWalletClient({ account, transport: http(rpc) });

  const hash = await wallet.writeContract({
    address: splitterAddress,
    abi: SPLITTER_ABI,
    functionName: "postBatch",
    args: [
      {
        batchId,
        merkleRoot: root,
        windowStart,
        windowEnd,
        receiptCount: BigInt(filtered.length),
        daPointer: { commitment: daPointer.commitment, blobIndex: BigInt(daPointer.blobIndex) },
      },
      "0x",
    ],
    account,
    chain: undefined,
  });

  console.log(`[settler] batch posted: ${hash}`);

  // Return proof cache so the frontend can serve claims
  const proofCache = new Map<string, `0x${string}`[]>();
  for (let i = 0; i < leaves.length; ++i) {
    const leaf = encodedLeaves[i]!;
    const proof = tree.getHexProof(leaf) as `0x${string}`[];
    const key = `${leaves[i]!.recipient}:${batchId}`;
    proofCache.set(key, proof);
  }

  return { root, hash, proofCache, payouts };
}
