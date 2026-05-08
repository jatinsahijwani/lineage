/**
 * Thin shim around `buildAndPostReceipt` and `invokeChatbot`. Selects between
 * the real 0G Compute path (default) and the mock-TEE path (offline tests /
 * anvil e2e) based on `process.env.MOCK_TEE === "1"` or an explicit
 * `request.useMock === true` override.
 *
 * Real path: invokeChatbot() calls the live qwen-2.5-7b-instruct provider,
 * fetches the async TEE signature, locally verifies it, and returns the
 * (output, attestation, computeProof) tuple. The receipt-builder then pins
 * the receipt's digest fields to attestation.text[0] / attestation.text[1]
 * via the new digest-override params (the TEE's canonicalization wins, since
 * those are the values that were actually TEE-signed).
 */

import type {
  AttributionReceipt,
  DAPointer,
  TEEAttestation,
} from "@lineage/shared";
import type { Hex } from "viem";
import { buildAndPostReceipt, type WeightedToken } from "./receipt-builder.js";
import type { ReceiptSink } from "./receipt-sink.js";
import { invokeChatbot } from "./zg-compute.js";

export interface InferenceConfig {
  computeUrl: string;
  /** When true, bypass real Compute and synthesise a mock TEEAttestation. */
  mockTEE: boolean;
  teePublicKey: string;
}

export interface InferenceRequest {
  /** Required for envelope provenance fields. */
  agentId: string;
  agentRunner: string;
  /** Operator EOA whose private key signs the lineage block. */
  agentOperator: `0x${string}`;
  /** Inference input (UTF-8). For real Compute: sent as the user message. */
  input: string;

  /** Lineage iNFTs that contributed to this inference. Weights must sum to 1.0. */
  model: WeightedToken;
  skills: WeightedToken[];
  memory: WeightedToken[];
  data: WeightedToken[];

  /**
   * Optional production-path TEE attestation already fetched from 0G Compute.
   * If supplied, the runner skips invokeChatbot() entirely (caller has done
   * the work). Mostly useful for replaying a recorded inference.
   */
  teeAttestation?: TEEAttestation;
  /** Optional explicit chat / proof identifiers (production replay path). */
  chatId?: string;
  zgResKey?: string;
  computeProvider?: `0x${string}`;
  /** Optional explicit assistant output (production replay path). */
  output?: string;

  /**
   * Per-request override of the global MOCK_TEE flag. `true` forces the mock
   * path even if MOCK_TEE is unset — used by anvil e2e and offline tests.
   */
  useMock?: boolean;
}

export interface InferenceResponse {
  output: string;
  receipt: AttributionReceipt;
  daPointer: DAPointer;
}

/**
 * Run an inference and persist the dual-attested receipt.
 *
 * Routing:
 *   - request.teeAttestation present  -> replay path (caller pre-fetched)
 *   - request.useMock || config.mockTEE -> mock path (synthesised TEE)
 *   - otherwise                       -> real 0G Compute (default)
 */
export async function runInference(
  request: InferenceRequest,
  config: InferenceConfig,
  inferenceId: string,
  operatorPrivateKey: Hex,
  sink: ReceiptSink,
): Promise<InferenceResponse> {
  const useMock = request.useMock === true || config.mockTEE === true;

  // -- Replay path: caller already has the attestation. ---------------------
  if (request.teeAttestation) {
    const fields = request.teeAttestation.text.split(":");
    const teeInputDigest = fields[0];
    const teeOutputDigest = fields[1];
    const output = request.output ?? request.input;
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
        teeAttestation: request.teeAttestation,
        ...(request.chatId !== undefined ? { chatId: request.chatId } : {}),
        ...(request.zgResKey !== undefined ? { zgResKey: request.zgResKey } : {}),
        ...(request.computeProvider !== undefined
          ? { computeProvider: request.computeProvider }
          : {}),
        ...(teeInputDigest !== undefined
          ? { inputDigestOverride: teeInputDigest }
          : {}),
        ...(teeOutputDigest !== undefined
          ? { outputDigestOverride: teeOutputDigest }
          : {}),
      },
      sink,
    );
    return { output, receipt, daPointer };
  }

  // -- Mock path: synthesise an ephemeral TEE signer. -----------------------
  if (useMock) {
    const output = `[Mock TEE output for model ${request.model.tokenId}]: ${request.input}`;
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
        mockTEE: true,
      },
      sink,
    );
    return { output, receipt, daPointer };
  }

  // -- Real path: invoke 0G Compute chatbot service. ------------------------
  const invocation = await invokeChatbot({
    operatorPrivateKey,
    input: request.input,
  });
  const { receipt, daPointer } = await buildAndPostReceipt(
    {
      inferenceId,
      agentId: request.agentId,
      agentRunner: request.agentRunner,
      input: request.input,
      output: invocation.output,
      agentOperator: request.agentOperator,
      operatorPrivateKey,
      model: request.model,
      skills: request.skills,
      memory: request.memory,
      data: request.data,
      teeAttestation: invocation.attestation,
      computeProvider: invocation.computeProof.provider,
      chatId: invocation.computeProof.chatId,
      zgResKey: invocation.computeProof.zgResKey,
      // Pin the receipt's digest fields to the TEE-signed values — the only
      // values guaranteed to match attestation.text on the on-chain verifier.
      inputDigestOverride: invocation.teeInputDigest,
      outputDigestOverride: invocation.teeOutputDigest,
    },
    sink,
  );
  return { output: invocation.output, receipt, daPointer };
}
