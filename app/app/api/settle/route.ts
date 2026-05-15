/**
 * POST /api/settle
 *
 * Server-side counterpart to the demo's "Settle now" button.
 *
 * Flow:
 *   1. Validate the receipt with AttributionReceiptSchema.
 *   2. For every tokenId referenced in receipt.lineage.{model,skills,memory,data}
 *      (de-duplicated), read the on-chain royalty config from LineageRegistry —
 *      we never trust client-supplied royalty figures.
 *   3. Build the LineageNode / owner maps the settler expects. v1 assumption:
 *      we treat each referenced iNFT as a *terminal* node (parents: []) because
 *      the lineage tree the agent operator signed in the receipt already
 *      encodes the propagation weights from each contributor. The on-chain
 *      LineageRegistry also stores parent edges (so deeper-walk semantics are
 *      possible), but for v1 the receipt is the source of truth — see CLAUDE
 *      cuts §14.
 *   4. Pick a fresh batchId (latestBatchId + 1) and call aggregateReceipts →
 *      buildMerkleTree → RoyaltySplitter.postBatch. The deployed contract
 *      requires `batch.batchId > latestBatchId`.
 *   5. Compute per-recipient Merkle proofs, persist via proof-store, and
 *      return the batch summary so the demo UI can light up payouts.
 */

import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  zeroAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

import {
  AttributionReceiptSchema,
  ZG_TESTNET,
  type AttributionReceipt,
} from "@lineage/shared";
import { aggregateReceipts } from "@lineage/settler/attribute.js";
import { buildMerkleTree, getProof } from "@lineage/settler/merkle.js";
import type { LineageNode } from "@lineage/sdk/lineage-graph.js";

import { saveProofs, type ProofPayout } from "@/lib/proof-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGISTRY_ABI = [
  {
    type: "function",
    name: "getINFT",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "tokenId", type: "uint256" },
          { name: "storageRoot", type: "bytes32" },
          { name: "owner", type: "address" },
          { name: "iType", type: "uint8" },
          { name: "royaltyBps", type: "uint16" },
          { name: "royaltyReceiver", type: "address" },
          { name: "createdAt", type: "uint64" },
          { name: "paused", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getRoyaltyPolicy",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "totalRoyaltyBps", type: "uint16" },
          { name: "paymentToken", type: "address" },
          { name: "pauseUntil", type: "uint64" },
          { name: "ownerSplitBps", type: "uint16" },
        ],
      },
    ],
  },
] as const;

const SPLITTER_ABI = [
  {
    type: "function",
    name: "latestBatchId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "postBatch",
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

const BodySchema = z.object({
  receipt: AttributionReceiptSchema,
});

interface RegistryRecord {
  tokenId: bigint;
  owner: Hex;
  royaltyBps: number;
  royaltyReceiver: Hex;
  ownerSplitBps: number;
}

function uniqueTokenIds(receipt: AttributionReceipt): bigint[] {
  const ids = new Set<string>();
  ids.add(receipt.lineage.model.tokenId);
  for (const s of receipt.lineage.skills) ids.add(s.tokenId);
  for (const m of receipt.lineage.memory) ids.add(m.tokenId);
  for (const d of receipt.lineage.data) ids.add(d.tokenId);
  return Array.from(ids).map((s) => BigInt(s));
}

function jsonSafe<T>(value: T): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

export async function POST(req: Request): Promise<Response> {
  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid body" },
      { status: 400 },
    );
  }
  const receipt = parsed.receipt as AttributionReceipt;

  const operatorPrivateKey = process.env["OPERATOR_PRIVATE_KEY"] as
    | Hex
    | undefined;
  if (!operatorPrivateKey) {
    return NextResponse.json(
      { error: "OPERATOR_PRIVATE_KEY missing" },
      { status: 500 },
    );
  }

  const registryAddress = process.env[
    "NEXT_PUBLIC_LINEAGE_REGISTRY_ADDRESS"
  ] as Hex | undefined;
  const splitterAddress = process.env[
    "NEXT_PUBLIC_ROYALTY_SPLITTER_ADDRESS"
  ] as Hex | undefined;
  if (!registryAddress || !splitterAddress) {
    return NextResponse.json(
      {
        error:
          "missing NEXT_PUBLIC_LINEAGE_REGISTRY_ADDRESS or NEXT_PUBLIC_ROYALTY_SPLITTER_ADDRESS",
      },
      { status: 500 },
    );
  }

  const rpc = process.env["ZERO_G_RPC_URL"] ?? ZG_TESTNET.rpcUrl;
  const totalRevenueWei = BigInt(
    process.env["DEMO_TOTAL_REVENUE_WEI"] ?? "1000000000000000",
  );

  try {
    const publicClient = createPublicClient({
      chain: undefined,
      transport: http(rpc),
    });

    // ----- Resolve on-chain registry config for every referenced iNFT. -----
    const tokenIds = uniqueTokenIds(receipt);
    const records: RegistryRecord[] = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const [inftRecord, policy] = await Promise.all([
          publicClient.readContract({
            address: registryAddress,
            abi: REGISTRY_ABI,
            functionName: "getINFT",
            args: [tokenId],
          }),
          publicClient.readContract({
            address: registryAddress,
            abi: REGISTRY_ABI,
            functionName: "getRoyaltyPolicy",
            args: [tokenId],
          }),
        ]);
        return {
          tokenId,
          owner: inftRecord.owner,
          royaltyBps: Number(inftRecord.royaltyBps),
          royaltyReceiver: inftRecord.royaltyReceiver,
          ownerSplitBps: Number(policy.ownerSplitBps),
        };
      }),
    );

    // v1 assumption: terminal nodes. The receipt's lineage already encodes
    // every contributor that should be paid (the agent operator signed those
    // weights), so we don't walk the on-chain parent DAG further. Two knock-on
    // choices:
    //
    //   - ownerSplitBps is pinned to 10000 here. With edges=[] the off-chain
    //     lineage-graph would otherwise silently drop the upstream fraction;
    //     pinning 100% to the royaltyReceiver matches the v1 semantics where
    //     the receipt's per-token weight IS the final per-contributor share.
    //
    //   - totalRoyaltyBps comes from the on-chain registry (the iNFT's
    //     declared royaltyBps). That's the "platform cut" multiplier — what
    //     fraction of the inference revenue this token gets paid at all.
    //     If the iNFT was minted with royaltyBps=0 it silently earns nothing,
    //     which is the correct on-chain semantics.
    //
    // If v2 wants recursive royalty walks, populate `edges` here from
    // LineageRegistry.getParents(tokenId) and pass the real ownerSplitBps.
    const nodeMap = new Map<bigint, LineageNode>();
    const ownerMap = new Map<bigint, Hex>();
    for (const r of records) {
      nodeMap.set(r.tokenId, {
        tokenId: r.tokenId,
        ownerSplitBps: 10000,
        totalRoyaltyBps: r.royaltyBps > 0 ? r.royaltyBps : 10000,
        edges: [],
      });
      ownerMap.set(r.tokenId, r.royaltyReceiver);
    }

    // ----- Aggregate payouts from the receipt's lineage. -----
    const payouts = await aggregateReceipts(
      [receipt],
      totalRevenueWei,
      zeroAddress as Hex,
      (id) => nodeMap.get(id),
      (id) => ownerMap.get(id) ?? (zeroAddress as Hex),
    );

    if (payouts.length === 0) {
      return NextResponse.json(
        { error: "no payouts produced — check registry royalty config" },
        { status: 500 },
      );
    }

    const account = privateKeyToAccount(operatorPrivateKey);
    const wallet = createWalletClient({
      account,
      chain: undefined,
      transport: http(rpc),
    });

    // Fund the splitter with the settlement amount so native-OG claims succeed.
    // postBatch() is not payable, so we send via the contract's receive() fallback
    // in a separate tx first. totalPayable uses the actual aggregated amounts
    // (bps math may shave a few wei off totalRevenueWei) so we never over-fund.
    const totalPayable = payouts.reduce((acc, p) => acc + p.amount, 0n);
    if (totalPayable > 0n) {
      const fundTx = await wallet.sendTransaction({
        to: splitterAddress,
        value: totalPayable,
        account,
        chain: undefined,
      });
      await publicClient.waitForTransactionReceipt({
        hash: fundTx,
        pollingInterval: 10000,
        retryCount: 30,
        timeout: 300_000,
      });
    }

    // ----- Pick a fresh batchId (must strictly exceed latestBatchId). -----
    const latest = (await publicClient.readContract({
      address: splitterAddress,
      abi: SPLITTER_ABI,
      functionName: "latestBatchId",
    })) as bigint;
    const batchId = latest + 1n;

    // ----- Build the Merkle tree over (batchId, recipient, token, amount). -----
    const leaves = payouts.map((p) => ({
      batchId,
      recipient: p.recipient,
      token: p.token,
      amount: p.amount,
    }));
    const { root, tree, encodedLeaves } = buildMerkleTree(leaves);

    // ----- Submit RoyaltySplitter.postBatch. -----
    const now = BigInt(Math.floor(Date.now() / 1000));
    const txHash = await wallet.writeContract({
      address: splitterAddress,
      abi: SPLITTER_ABI,
      functionName: "postBatch",
      args: [
        {
          batchId,
          merkleRoot: root,
          windowStart: now - 1n,
          windowEnd: now + 86400n,
          receiptCount: 1n,
          daPointer: {
            commitment:
              ("0x" + "00".repeat(32)) as Hex,
            blobIndex: 0n,
          },
        },
        "0x" as Hex,
      ],
      account,
      chain: undefined,
    });

    // Wait for inclusion so the frontend can immediately call balanceOf / claim.
    await publicClient.waitForTransactionReceipt({
      hash: txHash,
      pollingInterval: 10000,   // 10 seconds
      retryCount: 60,
      timeout: 900_000,         // 15 minutes
    });

    // ----- Build per-payout proofs and persist. -----
    const payoutsOut: Array<{
      recipient: Hex;
      token: Hex;
      amount: string;
      proof: Hex[];
    }> = [];
    const storeRecords: ProofPayout[] = [];
    for (let i = 0; i < payouts.length; ++i) {
      const proof = getProof(tree, encodedLeaves[i]!);
      payoutsOut.push({
        recipient: payouts[i]!.recipient,
        token: payouts[i]!.token,
        amount: payouts[i]!.amount.toString(),
        proof,
      });
      storeRecords.push({
        recipient: payouts[i]!.recipient,
        token: payouts[i]!.token,
        amount: payouts[i]!.amount,
        proof,
      });
    }
    await saveProofs(batchId, storeRecords, txHash);

    return NextResponse.json(
      jsonSafe({
        batchId: batchId.toString(),
        txHash,
        merkleRoot: root,
        payouts: payoutsOut,
      }),
    );
  } catch (err) {
    console.error("[/api/settle] failure:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
