/**
 * GET /api/tokens
 *
 * Live on-chain token discovery for the demo's contributor pickers. Scans
 * LineageRegistry from tokenId 1 upward in parallel batches; stops as soon
 * as a `getINFT` call reverts (the registry's id counter is sequential, so
 * the first revert marks the end of the minted range). Skips paused tokens.
 * Groups the survivors by `iType` (0=Data, 1=Model, 2=Skill, 3=Agent).
 *
 * Always returns fresh data — `Cache-Control: no-store` — so a token minted
 * from /mint shows up in /demo without a redeploy.
 */

import { NextResponse } from "next/server";
import { createPublicClient, http, type Hex } from "viem";

import { ZG_TESTNET } from "@lineage/shared";

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
] as const;

const BATCH_SIZE = 25;
const MAX_TOKEN_ID = 300;

interface TokenEntry {
  tokenId: string;
  owner: string;
  royaltyBps: number;
}

interface TokensResponse {
  models: TokenEntry[];
  skills: TokenEntry[];
  data: TokenEntry[];
}

interface INFTRecord {
  tokenId: bigint;
  storageRoot: Hex;
  owner: Hex;
  iType: number;
  royaltyBps: number;
  royaltyReceiver: Hex;
  createdAt: bigint;
  paused: boolean;
}

export async function GET(): Promise<Response> {
  const registryAddress = process.env[
    "NEXT_PUBLIC_LINEAGE_REGISTRY_ADDRESS"
  ] as Hex | undefined;
  if (!registryAddress) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_LINEAGE_REGISTRY_ADDRESS missing" },
      { status: 500 },
    );
  }

  const rpc = process.env["ZERO_G_RPC_URL"] ?? ZG_TESTNET.rpcUrl;

  try {
    const publicClient = createPublicClient({
      chain: undefined,
      transport: http(rpc),
    });

    const records: INFTRecord[] = [];

    outer: for (
      let start = 1;
      start <= MAX_TOKEN_ID;
      start += BATCH_SIZE
    ) {
      const ids: bigint[] = [];
      for (let i = 0; i < BATCH_SIZE && start + i <= MAX_TOKEN_ID; ++i) {
        ids.push(BigInt(start + i));
      }
      const settled = await Promise.allSettled(
        ids.map((id) =>
          publicClient.readContract({
            address: registryAddress,
            abi: REGISTRY_ABI,
            functionName: "getINFT",
            args: [id],
          }),
        ),
      );
      for (let i = 0; i < settled.length; ++i) {
        const r = settled[i];
        if (!r || r.status === "rejected") {
          // First revert in sequence → end of counter.
          break outer;
        }
        records.push(r.value as INFTRecord);
      }
    }

    const out: TokensResponse = { models: [], skills: [], data: [] };

    for (const rec of records) {
      if (rec.paused) continue;
      const entry: TokenEntry = {
        tokenId: rec.tokenId.toString(),
        owner: rec.owner,
        royaltyBps: Number(rec.royaltyBps),
      };
      // iType: 0=Data, 1=Model, 2=Skill, 3=Agent (v1 doesn't expose Agent UI).
      if (rec.iType === 0) out.data.push(entry);
      else if (rec.iType === 1) out.models.push(entry);
      else if (rec.iType === 2) out.skills.push(entry);
      // iType=3 (Agent) and any unknown variants are intentionally ignored.
    }

    return new NextResponse(JSON.stringify(out), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[/api/tokens] failure:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
