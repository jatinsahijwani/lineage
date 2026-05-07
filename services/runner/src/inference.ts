/**
 * Thin shim around `buildAndPostReceipt`. The previous mock-TEE branch lived
 * here; sub-step 4B moves all signing + verification into receipt-builder.ts
 * so this module just shapes the InferenceRequest into BuildAndPostParams.
 *
 * The inference call itself (model invocation) is still simulated in mock
 * mode — when real 0G Compute is wired up, the runner will pass the resulting
 * `teeAttestation` through to `buildAndPostReceipt`.
 */

import type {
  AttributionReceipt,
  DAPointer,
  TEEAttestation,
} from "@lineage/shared";
import type { Hex } from "viem";
import { buildAndPostReceipt, type WeightedToken } from "./receipt-builder.js";
import type { ReceiptSink } from "./receipt-sink.js";

export interface InferenceConfig {
  computeUrl: string;
  mockTEE: boolean;
  teePublicKey: string;
}

export interface InferenceRequest {
  /** Required for envelope provenance fields. */
  agentId: string;
  agentRunner: string;
  /** Operator EOA whose private key signs the lineage block. */
  agentOperator: `0x${string}`;
  /** Inference input (UTF-8); sha256 hashed locally for the digest. */
  input: string;

  /** Lineage iNFTs that contributed to this inference. Weights must sum to 1.0. */
  model: WeightedToken;
  skills: WeightedToken[];
  memory: WeightedToken[];
  data: WeightedToken[];

  /** Optional production-path TEE attestation already fetched from 0G Compute. */
  teeAttestation?: TEEAttestation;
  /** Optional explicit chat / proof identifiers (production path). */
  chatId?: string;
  zgResKey?: string;
  computeProvider?: `0x${string}`;
}

export interface InferenceResponse {
  output: string;
  receipt: AttributionReceipt;
  daPointer: DAPointer;
}

/**
 * Run an inference and persist the dual-attested receipt. In mock mode the
 * output is a fixed deterministic string and `buildAndPostReceipt` synthesises
 * a TEEAttestation using a per-call ephemeral key.
 */
export async function runInference(
  request: InferenceRequest,
  config: InferenceConfig,
  inferenceId: string,
  operatorPrivateKey: Hex,
  sink: ReceiptSink,
): Promise<InferenceResponse> {
  let output: string;
  if (config.mockTEE && !request.teeAttestation) {
    output = `[Mock TEE output for model ${request.model.tokenId}]: ${request.input}`;
  } else if (request.teeAttestation) {
    // Production path: caller has already invoked 0G Compute and is passing
    // through the (input, output, attestation) tuple. We don't have the raw
    // output here separately — derive it from the digest binding by trusting
    // the attestation.text, but for response shape we just echo the input.
    // Real callers should pass output through a richer struct in v2.
    output = request.input;
  } else {
    throw new Error(
      "runInference: real 0G Compute path requires request.teeAttestation; " +
        "set MOCK_TEE=true (or omit it) for local dev",
    );
  }

  const { receipt, daPointer } = await buildAndPostReceipt(
    {
      inferenceId,
      agentId: request.agentId,
      agentRunner: request.agentRunner,
      input: request.input,
      output,
      agentOperator: request.agentOperator,
      operatorPrivateKey,
      model: request.model,
      skills: request.skills,
      memory: request.memory,
      data: request.data,
      ...(request.teeAttestation
        ? {
            teeAttestation: request.teeAttestation,
            ...(request.chatId !== undefined ? { chatId: request.chatId } : {}),
            ...(request.zgResKey !== undefined ? { zgResKey: request.zgResKey } : {}),
            ...(request.computeProvider !== undefined
              ? { computeProvider: request.computeProvider }
              : {}),
          }
        : { mockTEE: true }),
    },
    sink,
  );

  return { output, receipt, daPointer };
}
