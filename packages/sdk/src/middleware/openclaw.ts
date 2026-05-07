/**
 * OpenClaw middleware for Lineage.
 *
 * Drop-in middleware that intercepts OpenClaw agent calls, runs inference
 * through the Lineage runner (mock or real 0G Compute), emits a signed
 * attribution receipt to 0G DA, and attaches it to the result.
 *
 * Usage:
 *   import { lineageMiddleware } from "@lineage/sdk/middleware/openclaw.js";
 *
 *   const agent = new OpenClawAgent({ ... });
 *   agent.use(lineageMiddleware({
 *     modelTokenId: 1n,
 *     skills: [3n],
 *     agentAddress: "0x...",
 *     client: lineageClient,
 *     onReceipt: async (receipt) => { ... },
 *   }));
 */

import type { LineageClient } from "../client.js";
import type { InferenceResult } from "@lineage/shared";

// Minimal OpenClaw-compatible interfaces (framework-agnostic)
export interface OpenClawContext {
  input: string;
  agentAddress?: string;
  metadata?: Record<string, unknown>;
}

export interface OpenClawResult {
  output: string;
  metadata?: Record<string, unknown>;
}

export type OpenClawNext = (ctx: OpenClawContext) => Promise<OpenClawResult>;

export type OpenClawMiddlewareFn = (
  ctx: OpenClawContext,
  next: OpenClawNext
) => Promise<OpenClawResult>;

export interface LineageMiddlewareOptions {
  /** The model iNFT token ID used for inference */
  modelTokenId: bigint;
  /** Skill iNFT token IDs composed during inference */
  skills?: bigint[];
  /** The address credited as the agent runner (receives compute fees) */
  agentAddress: `0x${string}`;
  /** Initialized LineageClient */
  client: LineageClient;
  /** Optional callback invoked after the receipt is built */
  onReceipt?: (result: InferenceResult) => Promise<void>;
}

/**
 * Returns an OpenClaw-compatible middleware function that wraps inference
 * calls with Lineage attribution receipt generation.
 *
 * The middleware calls `next()` to get the agent output, then issues an
 * attribution receipt via the Lineage runner and attaches it to the result
 * metadata so downstream middleware can access it.
 */
export function lineageMiddleware(opts: LineageMiddlewareOptions): OpenClawMiddlewareFn {
  const { modelTokenId, skills = [], agentAddress, client, onReceipt } = opts;

  return async (ctx: OpenClawContext, next: OpenClawNext): Promise<OpenClawResult> => {
    // Let the upstream OpenClaw pipeline produce the output first
    const upstream = await next(ctx);

    // Issue attribution receipt (mock or real TEE depending on client config)
    const inferenceResult = await client.runInference({
      modelTokenId,
      skills,
      input: ctx.input,
      agentAddress,
    });

    if (onReceipt) {
      await onReceipt(inferenceResult);
    }

    return {
      output: upstream.output,
      metadata: {
        ...upstream.metadata,
        lineage: {
          receiptId: inferenceResult.receipt.receiptId,
          daPointer: inferenceResult.daPointer,
          model: inferenceResult.receipt.lineage.model,
          skills: inferenceResult.receipt.lineage.skills,
          timestamp: inferenceResult.receipt.timestamp,
        },
      },
    };
  };
}

/**
 * Convenience builder that creates a reusable middleware factory.
 * Identical to `lineageMiddleware` but wraps it for frameworks that expect
 * a factory pattern (e.g. `agent.use(lineage.middleware.openclaw(opts))`).
 */
export const openclaw = {
  middleware: lineageMiddleware,
};
