/**
 * POST /api/inference
 *
 * Server-side wrapper around the runner's `runInference` shim. Keeps the
 * operator private key out of the browser. The connected wallet is only a
 * contributor / claimant — never an operator.
 *
 * Flow:
 *   1. Validate body with zod.
 *   2. Read OPERATOR_PRIVATE_KEY + 0G endpoint config from env (server-side
 *      only; never NEXT_PUBLIC_*).
 *   3. Build a StorageReceiptSink (0G Storage) and call
 *      `runInference({ useMock: false, ... })`.
 *   4. Serialise the response (bigints → strings) and return as JSON.
 */

import { NextResponse } from "next/server";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

import { ZG_TESTNET } from "@lineage/shared";
import {
  runInference,
  type InferenceConfig,
  type InferenceRequest,
} from "@lineage/runner/inference.js";
import { StorageReceiptSink } from "@lineage/runner/receipt-sink.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  modelTokenId: z.string().min(1),
  skills: z.array(z.string().min(1)).default([]),
  data: z.array(z.string().min(1)).default([]),
  memory: z.array(z.string().min(1)).default([]),
  prompt: z.string().min(1),
  agentAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

type Body = z.infer<typeof BodySchema>;

/**
 * Replacer that turns bigints into decimal strings so JSON.stringify doesn't
 * throw. Receipts may contain nested bigints (token ids, weights stay numbers,
 * but defensive against future drift).
 */
function jsonSafe<T>(value: T): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
}

/**
 * Build the WeightedToken lineage for the runner. The demo splits the total
 * weight evenly across the (model + skills + data + memory) set, with the
 * model getting a single share (== one of the equal slots). This is the same
 * convention used by the SDK's mock path so the receipt schema validation
 * (weights sum to 1.0 ± 1e-6) passes without further math.
 */
function buildWeights(body: Body): {
  model: { tokenId: string; weight: number };
  skills: Array<{ tokenId: string; weight: number }>;
  data: Array<{ tokenId: string; weight: number }>;
  memory: Array<{ tokenId: string; weight: number }>;
} {
  const total = 1 + body.skills.length + body.data.length + body.memory.length;
  const each = 1 / total;
  return {
    model: { tokenId: body.modelTokenId, weight: each },
    skills: body.skills.map((tokenId) => ({ tokenId, weight: each })),
    data: body.data.map((tokenId) => ({ tokenId, weight: each })),
    memory: body.memory.map((tokenId) => ({ tokenId, weight: each })),
  };
}

export async function POST(req: Request): Promise<Response> {
  let body: Body;
  try {
    const json = await req.json();
    body = BodySchema.parse(json);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid body" },
      { status: 400 },
    );
  }

  const operatorPrivateKey = process.env["OPERATOR_PRIVATE_KEY"] as
    | Hex
    | undefined;
  if (!operatorPrivateKey) {
    return NextResponse.json(
      { error: "OPERATOR_PRIVATE_KEY missing" },
      { status: 500 },
    );
  }

  const rpc = process.env["ZERO_G_RPC_URL"] ?? ZG_TESTNET.rpcUrl;
  const storageUrl =
    process.env["ZERO_G_STORAGE_URL"] ?? ZG_TESTNET.storageIndexerUrl;
  const computeUrl =
    process.env["ZERO_G_COMPUTE_URL"] ?? "https://compute-testnet.0g.ai";

  const config: InferenceConfig = {
    computeUrl,
    mockTEE: false,
    // The TEE public key is verified per-attestation from the response itself
    // (signing_address recovered from text). This field is informational.
    teePublicKey: "0x0000000000000000000000000000000000000000",
  };

  const sink = new StorageReceiptSink({
    storageUrl,
    rpc,
    signer: operatorPrivateKey,
  });

  // The receipt's `agentOperator` is the host that SIGNS the receipt — it
  // must match the address derived from OPERATOR_PRIVATE_KEY (the receipt
  // builder verifies this and rejects any mismatch). The end-user's wallet
  // is captured separately in `agentId` so attribution stays end-to-end.
  const operatorAddress = privateKeyToAccount(operatorPrivateKey).address;

  // Compose the WeightedToken graph and the runner request.
  const w = buildWeights(body);
  const request: InferenceRequest = {
    agentId: `agent:${body.agentAddress}`,
    agentRunner: "lineage-frontend",
    agentOperator: operatorAddress,
    input: body.prompt,
    model: w.model,
    skills: w.skills,
    memory: w.memory,
    data: w.data,
    useMock: false,
  };

  const inferenceId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `inf-${Date.now()}`;

  try {
    const result = await runInference(
      request,
      config,
      inferenceId,
      operatorPrivateKey,
      sink,
    );
    return NextResponse.json(jsonSafe(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/inference] failure:", err);
    const isTeeMismatch =
      /TEE|attestation|signing_address|signature/i.test(message);
    return NextResponse.json(
      isTeeMismatch
        ? { error: message, kind: "tee-mismatch" as const }
        : { error: message },
      { status: isTeeMismatch ? 502 : 500 },
    );
  }
}
