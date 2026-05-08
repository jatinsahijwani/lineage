/**
 * Real 0G Compute chatbot invocation. Replaces the mock-TEE leg of the
 * runner's dual-attestation flow with a live call to the qwen-2.5-7b-instruct
 * provider (see `ZG_CHATBOT_SERVICE` in @lineage/shared/0g-testnet).
 *
 * Reference flow: scripts/smoke.ts compute.invoke probe.
 *
 * Pipeline:
 *   1. Construct ethers Wallet + 0G compute broker.
 *   2. Idempotently acknowledge the provider signer (only if not already).
 *   3. Resolve service metadata (endpoint + model).
 *   4. Generate JWT-style auth headers via the SDK (do NOT reimplement).
 *   5. POST to `${endpoint}/chat/completions` (NOT /v1/chat/completions —
 *      the documented quirk; endpoint already includes /v1/proxy).
 *   6. Read the `zg-res-key` response header (NOT the chatId — the SDK's
 *      getChatSignatureDownloadLink builds the wrong URL on testnet).
 *   7. Poll `${endpoint}/signature/${zgResKey}` until 2xx.
 *   8. Validate the attestation against TEEAttestationSchema.
 *   9. Local-verify: signature recovers to signing_address, signing_address
 *      equals the registered chatbot service signer.
 *  10. Return ChatbotInvocation with the validated attestation + the TEE's
 *      claimed input/output digests (text[0]/text[1]) so the receipt-builder
 *      can pin the receipt's digest fields to what the TEE actually signed.
 */

import { Wallet, JsonRpcProvider } from "ethers";
import { recoverMessageAddress } from "viem";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import {
  TEEAttestationSchema,
  ZG_CHATBOT_SERVICE,
  ZG_INFERENCE_QUIRKS,
  ZG_TESTNET,
  type ComputeInferenceProof,
  type TEEAttestation,
} from "@lineage/shared";

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

export interface InvokeChatbotParams {
  /** Operator wallet (also used to sign the broker auth header). */
  operatorPrivateKey: `0x${string}`;
  /** Plain user prompt. The runner sends `{messages:[{role:"user",content:input}]}`. */
  input: string;
  /** Optional: bound the response so cost is predictable. Default 256. */
  maxTokens?: number;
  /** Optional: temperature for the model. Default 0 (deterministic). */
  temperature?: number;
  /** Optional: how long to wait for the async TEE signature. Default 8000ms total. */
  signaturePollTimeoutMs?: number;
}

/**
 * Outcome of the local digest-binding check. The TEE may canonicalize
 * request/response bytes differently than a plain UTF-8 sha256; if so we
 * surface that fact rather than throwing — the on-chain verifier checks the
 * receipt's digest fields against attestation.text, so as long as the
 * receipt-builder uses text[0]/text[1] (not local sha256) the dual-
 * attestation path is sound.
 */
export type DigestBinding =
  | { kind: "exact" }
  | {
      kind: "tee-canonical-mismatch";
      observed: {
        teeInput: string;
        teeOutput: string;
        ourInput: string;
        ourOutput: string;
      };
    };

export interface ChatbotInvocation {
  /** Assistant content from the OpenAI-style response body. */
  output: string;
  /** Validated TEE attestation, ready to feed into buildAndPostReceipt's teeAttestation field. */
  attestation: TEEAttestation;
  /** ComputeInferenceProof scaffold (chatId + zgResKey populated; attestation also attached). */
  computeProof: ComputeInferenceProof;
  /** Token usage from the response body for downstream metering. */
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  /** TEE-signed input digest (= attestation.text field 0). Use this for receipt.inputDigest. */
  teeInputDigest: string;
  /** TEE-signed output digest (= attestation.text field 1). Use this for receipt.outputDigest. */
  teeOutputDigest: string;
  /** Result of the local digest-binding probe (exact match vs canonical drift). */
  digestBinding: DigestBinding;
}

export interface ZGComputeConfig {
  /** EVM RPC URL for the broker chain (defaults to ZG_TESTNET.rpcUrl). */
  rpc?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const HEX64_LOWER = /^[0-9a-f]{64}$/;

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const arr = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < arr.length; i++) {
    const byte = arr[i] as number;
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface ChatResponseBody {
  id: string;
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

function isChatResponseBody(x: unknown): x is ChatResponseBody {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o["id"] !== "string") return false;
  const choices = o["choices"];
  if (!Array.isArray(choices) || choices.length === 0) return false;
  const first = choices[0] as { message?: { content?: unknown } } | undefined;
  if (!first || !first.message || typeof first.message.content !== "string") return false;
  const usage = o["usage"] as { [k: string]: unknown } | undefined;
  if (!usage || typeof usage["prompt_tokens"] !== "number") return false;
  if (typeof usage["completion_tokens"] !== "number") return false;
  if (typeof usage["total_tokens"] !== "number") return false;
  return true;
}

/**
 * Poll `${endpoint}/signature/${zgResKey}` for the TEE attestation. Uses the
 * zg-res-key header value (not chatId) — see ZG_INFERENCE_QUIRKS.
 *
 * Strategy: budget (default 8000ms). First attempt immediate, then 500ms,
 * then back off to 1000ms; cap at ~10 attempts.
 */
async function pollSignature(
  baseEndpoint: string,
  zgResKey: string,
  authHeaders: Record<string, string>,
  totalBudgetMs: number,
): Promise<{ status: number; body: string; parsed: unknown }> {
  const url = `${baseEndpoint.replace(/\/$/, "")}/signature/${zgResKey}`;
  const start = Date.now();
  let attempt = 0;
  let lastStatus = 0;
  let lastBody = "";
  while (Date.now() - start < totalBudgetMs && attempt < 10) {
    if (attempt > 0) {
      const delay = attempt === 1 ? 500 : 1000;
      const remaining = totalBudgetMs - (Date.now() - start);
      if (remaining <= 0) break;
      await sleep(Math.min(delay, remaining));
    }
    attempt++;
    try {
      const res = await fetch(url, {
        headers: { ...authHeaders },
        signal: AbortSignal.timeout(15000),
      });
      const body = await res.text();
      lastStatus = res.status;
      lastBody = body;
      if (res.status >= 200 && res.status < 300 && body.length > 0) {
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(body);
        } catch {
          /* keep null */
        }
        return { status: res.status, body, parsed };
      }
    } catch (e) {
      lastBody = `(fetch error) ${(e as Error).message}`;
    }
  }
  throw new Error(
    `invokeChatbot: TEE signature poll timed out after ${totalBudgetMs}ms ` +
      `(attempts=${attempt}, lastStatus=${lastStatus}, lastBody=${lastBody.slice(0, 200)})`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function invokeChatbot(
  params: InvokeChatbotParams,
  config: ZGComputeConfig = {},
): Promise<ChatbotInvocation> {
  // 1. Wallet + broker.
  const provider = new JsonRpcProvider(config.rpc ?? ZG_TESTNET.rpcUrl);
  const wallet = new Wallet(params.operatorPrivateKey, provider);
  // Dual-package ethers Signer hazard — same `as never` cast smoke.ts uses.
  const broker = await createZGComputeNetworkBroker(wallet as never);

  // 2. Acknowledge provider signer if not already (avoid a wasteful tx).
  const ackStatus = await broker.inference.checkProviderSignerStatus(
    ZG_CHATBOT_SERVICE.provider,
  );
  if (!ackStatus.isAcknowledged) {
    await broker.inference.acknowledgeProviderSigner(ZG_CHATBOT_SERVICE.provider);
  }

  // 3. Service metadata. Use meta.model for the request body — the chatbot's
  // canonical model name ("qwen2.5-7b-instruct") differs from the provider-
  // listing identifier ("qwen/qwen-2.5-7b-instruct").
  const meta = await broker.inference.getServiceMetadata(
    ZG_CHATBOT_SERVICE.provider,
  );
  if (meta.model !== ZG_CHATBOT_SERVICE.model) {
    console.warn(
      `[zg-compute] meta.model="${meta.model}" differs from constant ` +
        `ZG_CHATBOT_SERVICE.model="${ZG_CHATBOT_SERVICE.model}" — using meta.model`,
    );
  }

  // 4. Auth headers (JWT-style: `Authorization: Bearer app-sk-<b64>|<sig>`).
  const headersRaw = await broker.inference.getRequestHeaders(
    ZG_CHATBOT_SERVICE.provider,
    params.input,
  );
  const authHeaders = headersRaw as unknown as Record<string, string>;

  // 5. Inference call. NOTE: meta.endpoint already includes "/v1/proxy"; the
  // documented quirk is that we must append "/chat/completions" (NOT
  // "/v1/chat/completions").
  const requestBody = {
    messages: [{ role: "user", content: params.input }],
    model: meta.model,
    max_tokens: params.maxTokens ?? 256,
    temperature: params.temperature ?? 0,
  };
  const url =
    meta.endpoint.replace(/\/$/, "") + ZG_INFERENCE_QUIRKS.chatCompletionsPath;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(60000),
  });
  const rawBody = await res.text();
  if (!res.ok) {
    throw new Error(
      `invokeChatbot: chat completions returned status ${res.status}: ` +
        `${rawBody.slice(0, 300)}`,
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(rawBody);
  } catch (e) {
    throw new Error(
      `invokeChatbot: response body is not valid JSON: ${(e as Error).message}; ` +
        `body=${rawBody.slice(0, 300)}`,
    );
  }
  if (!isChatResponseBody(parsedBody)) {
    throw new Error(
      `invokeChatbot: response body missing required fields ` +
        `(id, choices[0].message.content, usage): ${rawBody.slice(0, 300)}`,
    );
  }
  const chatId = parsedBody.id;
  const assistantContent = parsedBody.choices[0]!.message.content;
  const usage = parsedBody.usage;

  // 6. zg-res-key — the real signature lookup key. The SDK lies (it builds
  // the URL with chatId, which 400s as chat_id_not_found).
  const zgResKey = res.headers.get(ZG_INFERENCE_QUIRKS.signatureLookupHeader);
  if (!zgResKey) {
    throw new Error(
      `invokeChatbot: response missing the \`${ZG_INFERENCE_QUIRKS.signatureLookupHeader}\` ` +
        `header — cannot fetch the TEE signature without it`,
    );
  }

  // 7. Poll for the async TEE signature.
  const budget = params.signaturePollTimeoutMs ?? 8000;
  const sigResp = await pollSignature(meta.endpoint, zgResKey, authHeaders, budget);
  const sigParsed = sigResp.parsed;
  if (!sigParsed || typeof sigParsed !== "object") {
    throw new Error(
      `invokeChatbot: signature endpoint returned non-JSON or empty body: ${sigResp.body.slice(0, 300)}`,
    );
  }

  // 8. Validate as TEEAttestation.
  let attestation: TEEAttestation;
  try {
    attestation = TEEAttestationSchema.parse(sigParsed) as TEEAttestation;
  } catch (e) {
    throw new Error(
      `chatbot returned malformed attestation: ${(e as Error).message}`,
    );
  }

  // 9a. Recover signature → signing_address.
  const recovered = await recoverMessageAddress({
    message: attestation.text,
    signature: attestation.signature,
  });
  if (recovered.toLowerCase() !== attestation.signing_address.toLowerCase()) {
    throw new Error(
      "local verify: TEE signature does not recover to claimed signer " +
        `(recovered=${recovered}, claimed=${attestation.signing_address})`,
    );
  }

  // 9b. signing_address must match the registered chatbot service signer.
  if (
    attestation.signing_address.toLowerCase() !==
    ZG_CHATBOT_SERVICE.teeSignerAddress.toLowerCase()
  ) {
    throw new Error(
      "local verify: TEE signer is not the registered chatbot service signer " +
        `(got=${attestation.signing_address}, expected=${ZG_CHATBOT_SERVICE.teeSignerAddress})`,
    );
  }

  // 9c. Text shape — at least 5 colon-separated fields.
  const fields = attestation.text.split(":");
  if (fields.length < 5) {
    throw new Error(
      `local verify: attestation.text has ${fields.length} fields, expected >= 5`,
    );
  }
  const teeInputDigest = fields[0]!;
  const teeOutputDigest = fields[1]!;
  if (!HEX64_LOWER.test(teeInputDigest) || !HEX64_LOWER.test(teeOutputDigest)) {
    throw new Error(
      `local verify: attestation.text first two fields are not 64-char lowercase hex ` +
        `(input="${teeInputDigest}", output="${teeOutputDigest}")`,
    );
  }

  // 9d. Digest-binding probe. The TEE may canonicalize differently than a
  // plain UTF-8 sha256; if so we surface that fact and fall back to using
  // the TEE's values (the receipt-builder must use them, not local sha256).
  const ourInput = await sha256Hex(params.input);
  const ourOutput = await sha256Hex(assistantContent);
  let digestBinding: DigestBinding;
  if (ourInput === teeInputDigest && ourOutput === teeOutputDigest) {
    digestBinding = { kind: "exact" };
  } else {
    console.warn(
      `[zg-compute] digest-binding canonicalization mismatch — ` +
        `ourInput=${ourInput} teeInput=${teeInputDigest} ` +
        `ourOutput=${ourOutput} teeOutput=${teeOutputDigest}. ` +
        `Falling back to TEE-signed digests for receipt envelope.`,
    );
    digestBinding = {
      kind: "tee-canonical-mismatch",
      observed: { teeInput: teeInputDigest, teeOutput: teeOutputDigest, ourInput, ourOutput },
    };
  }

  // 10. Assemble.
  const computeProof: ComputeInferenceProof = {
    provider: ZG_CHATBOT_SERVICE.provider,
    chatId,
    zgResKey,
    attestation,
  };

  return {
    output: assistantContent,
    attestation,
    computeProof,
    usage,
    teeInputDigest,
    teeOutputDigest,
    digestBinding,
  };
}
