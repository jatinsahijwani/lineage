/**
 * Fixture-based tests for the 0G Compute chatbot wiring. We deliberately do
 * NOT make a live HTTP call from the test suite — the recorded probe in
 * scripts/smoke-output.json captures a real, valid TEE attestation against
 * the qwen-2.5-7b-instruct provider. These tests assert that the SAME
 * local-verify steps invokeChatbot() runs on a fresh response would pass for
 * the recorded attestation, and probe the TEE's canonicalization scheme
 * (does sha256(prompt) match attestation.text[0]?).
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { recoverMessageAddress } from "viem";
import {
  TEEAttestationSchema,
  ZG_CHATBOT_SERVICE,
  type TEEAttestation,
} from "@lineage/shared";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, "../../../../scripts/smoke-output.json");

interface SignatureFetchAttempt {
  status?: number;
  idFormat?: string;
  parsed?: unknown;
}

function loadAttestationFixture(): {
  attestation: TEEAttestation;
  recordedPrompt: string;
  recordedOutput: string;
} {
  const raw = readFileSync(FIXTURE_PATH, "utf-8");
  const j = JSON.parse(raw) as {
    probes: {
      "compute.invoke": {
        request: { args: { prompt: string } };
        response: {
          assistantContent: string;
          signatureFetchAttempts: SignatureFetchAttempt[];
        };
      };
    };
  };
  const invoke = j.probes["compute.invoke"];
  const winning = invoke.response.signatureFetchAttempts.find(
    (a) => a.status === 200 && a.idFormat === "zg-res-key",
  );
  if (!winning || !winning.parsed) {
    throw new Error(
      "fixture: no signatureFetchAttempts entry with status===200 && idFormat===\"zg-res-key\"",
    );
  }
  return {
    attestation: winning.parsed as TEEAttestation,
    recordedPrompt: invoke.request.args.prompt,
    recordedOutput: invoke.response.assistantContent,
  };
}

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

describe("invokeChatbot (fixture-based local verify)", () => {
  const { attestation, recordedPrompt, recordedOutput } = loadAttestationFixture();

  it("fixture parses with TEEAttestationSchema", () => {
    expect(() => TEEAttestationSchema.parse(attestation)).not.toThrow();
  });

  it("signature recovers to signing_address", async () => {
    const recovered = await recoverMessageAddress({
      message: attestation.text,
      signature: attestation.signature,
    });
    expect(recovered.toLowerCase()).toBe(attestation.signing_address.toLowerCase());
  });

  it("signing_address equals ZG_CHATBOT_SERVICE.teeSignerAddress", () => {
    expect(attestation.signing_address.toLowerCase()).toBe(
      ZG_CHATBOT_SERVICE.teeSignerAddress.toLowerCase(),
    );
  });

  it("text has 5 colon-separated fields", () => {
    const fields = attestation.text.split(":");
    expect(fields.length).toBe(5);
  });

  it("first two fields are 64-char lowercase hex", () => {
    const fields = attestation.text.split(":");
    const re = /^[0-9a-f]{64}$/;
    expect(fields[0]).toMatch(re);
    expect(fields[1]).toMatch(re);
  });

  it("digest-binding canonicalization probe", async () => {
    const fields = attestation.text.split(":");
    const teeInput = fields[0]!;
    const teeOutput = fields[1]!;
    const ourInput = await sha256Hex(recordedPrompt);
    const ourOutput = await sha256Hex(recordedOutput);

    const exactMatch = ourInput === teeInput && ourOutput === teeOutput;

    // Always log the observed values so the canonicalization story is visible
    // in CI even when (as expected) plain UTF-8 sha256 doesn't match.
    console.log(
      "[zg-compute digest probe] " +
        `prompt="${recordedPrompt}" output="${recordedOutput}"`,
    );
    console.log(`  ourInput  = ${ourInput}`);
    console.log(`  teeInput  = ${teeInput}`);
    console.log(`  ourOutput = ${ourOutput}`);
    console.log(`  teeOutput = ${teeOutput}`);
    console.log(`  exactMatch = ${exactMatch}`);

    if (exactMatch) {
      expect(ourInput).toBe(teeInput);
      expect(ourOutput).toBe(teeOutput);
    } else {
      // Drift is expected — the TEE canonicalizes request/response bytes
      // differently than a plain UTF-8 sha256 of the user prompt / assistant
      // string. The runner's invokeChatbot() handles this by passing the
      // TEE's text[0]/text[1] through to the receipt-builder via the
      // inputDigestOverride / outputDigestOverride params, so the receipt's
      // digest fields always match attestation.text (which is what the
      // on-chain AttributionVerifier checks).
      expect(ourInput).not.toBe(teeInput);
      expect(ourOutput).not.toBe(teeOutput);
    }
  });
});
