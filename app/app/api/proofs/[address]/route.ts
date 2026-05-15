/**
 * GET /api/proofs/:address
 *
 * Returns unclaimed Merkle proofs for the given recipient. The proof-store is
 * written by /api/settle whenever a batch is posted to RoyaltySplitter. The
 * /earnings page consumes this endpoint on wallet connect.
 *
 * Note: in Next 16 dynamic route params are async, so `params` is a Promise.
 */

import { NextResponse } from "next/server";

import { getProofsForRecipient } from "@/lib/proof-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDRESS_RX = /^0x[0-9a-fA-F]{40}$/;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ address: string }> },
): Promise<Response> {
  const { address } = await ctx.params;
  if (!ADDRESS_RX.test(address)) {
    return NextResponse.json(
      { error: "invalid address" },
      { status: 400 },
    );
  }
  try {
    const proofs = await getProofsForRecipient(address);
    return NextResponse.json({ proofs });
  } catch (err) {
    console.error("[/api/proofs] failure:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
