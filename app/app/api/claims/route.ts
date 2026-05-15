/**
 * POST /api/claims
 *
 * Called by /earnings after a successful claim tx so the matching proof row
 * disappears on the next refetch. Strictly bookkeeping — the on-chain
 * RoyaltySplitter is already source of truth for whether a (batchId, msgSender,
 * token) tuple has been claimed.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { markClaimed } from "@/lib/proof-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  recipient: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  batchId: z.string().min(1),
  token: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

export async function POST(req: Request): Promise<Response> {
  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid body" },
      { status: 400 },
    );
  }
  try {
    await markClaimed(
      body.recipient,
      body.batchId,
      body.token as `0x${string}`,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/claims] failure:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
