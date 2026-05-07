/**
 * scripts/smoke.ts — 0G Primitives Smoke Test
 *
 * Hits 0G Chain, Storage, DA, and Compute against the live testnet using the
 * SDKs our production code will depend on. For each call:
 *   1. Records the request and response shape.
 *   2. Diffs the observed shape against our assumed types in
 *      `packages/shared/src/index.ts` and `app/lib/wagmi.ts`.
 *   3. Writes everything to `scripts/smoke-output.json` for diffing on later
 *      runs.
 *
 * The script never throws — failures are recorded as `{ ok: false, error }`.
 * Always exits 0.
 *
 *   pnpm smoke
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { Wallet, JsonRpcProvider } from "ethers";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
// Note: @0glabs/0g-serving-broker is just a re-export shim of @0gfoundation/0g-compute-ts-sdk.
// Importing directly avoids a tsx loader bug with chained `export *` + aliased re-exports.
import {
  createReadOnlyInferenceBroker,
  createZGComputeNetworkBroker,
} from "@0gfoundation/0g-compute-ts-sdk";
import { encode as cborEncode } from "cbor-x";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Load .env (same parser as scripts/deploy-testnet.ts)
try {
  const env = readFileSync(resolve(root, ".env"), "utf-8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // No .env, rely on environment
}

const RPC_URL = process.env["ZERO_G_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
const STORAGE_URL = process.env["ZERO_G_STORAGE_URL"] ?? "https://indexer-storage-testnet-turbo.0g.ai";
const DA_URL = process.env["ZERO_G_DA_URL"] ?? "https://da.0g.ai";
const COMPUTE_URL = process.env["ZERO_G_COMPUTE_URL"] ?? "https://compute-testnet.0g.ai";
const PRIVATE_KEY = (process.env["PRIVATE_KEY"] ?? "") as `0x${string}`;
const HAS_KEY = PRIVATE_KEY.startsWith("0x") && PRIVATE_KEY.length === 66;

// ---------------------------------------------------------------------------
// Probe types
// ---------------------------------------------------------------------------

type Severity = "critical" | "warning" | "info";

interface DriftEntry {
  severity: Severity;
  ours: { file: string; symbol: string; type: string; value?: unknown };
  actual: { type: string; value?: unknown };
  note: string;
}

interface Probe {
  name: string;
  primitive: "chain" | "storage" | "da" | "compute";
  ok: boolean;
  durationMs: number;
  request: { method: string; args: unknown };
  response: unknown;
  observedShape: string;
  error?: { name: string; message: string; stack?: string };
  drift: DriftEntry[];
  skipped?: { reason: string };
}

const probes: Record<string, Probe> = {};

async function runProbe<T>(
  name: string,
  primitive: Probe["primitive"],
  request: Probe["request"],
  fn: () => Promise<{ response: T; observedShape: string; drift: DriftEntry[] }>
): Promise<T | undefined> {
  const t0 = Date.now();
  process.stdout.write(`  ${name.padEnd(32)} `);
  try {
    const { response, observedShape, drift } = await fn();
    const durationMs = Date.now() - t0;
    probes[name] = {
      name,
      primitive,
      ok: true,
      durationMs,
      request,
      response: jsonSafe(response),
      observedShape,
      drift,
    };
    const driftLabel =
      drift.length === 0
        ? "✓"
        : drift.some((d) => d.severity === "critical")
          ? `⚠ ${drift.length} drift (critical)`
          : `⚠ ${drift.length} drift`;
    console.log(`${driftLabel}  (${durationMs}ms)`);
    return response;
  } catch (e) {
    const err = e as Error;
    const durationMs = Date.now() - t0;
    probes[name] = {
      name,
      primitive,
      ok: false,
      durationMs,
      request,
      response: null,
      observedShape: "",
      error: { name: err.name, message: err.message, stack: err.stack },
      drift: [],
    };
    console.log(`✗ ${err.message.split("\n")[0]?.slice(0, 60)}  (${durationMs}ms)`);
    return undefined;
  }
}

function skip(name: string, primitive: Probe["primitive"], reason: string) {
  probes[name] = {
    name,
    primitive,
    ok: false,
    durationMs: 0,
    request: { method: "(skipped)", args: null },
    response: null,
    observedShape: "",
    drift: [],
    skipped: { reason },
  };
  console.log(`  ${name.padEnd(32)} -  skipped: ${reason}`);
}

// ---------------------------------------------------------------------------
// JSON-safe serialization (BigInt, typed arrays, ethers Result tuples)
// ---------------------------------------------------------------------------

function jsonSafe(v: unknown): unknown {
  return JSON.parse(
    JSON.stringify(v, (_k, val) => {
      if (typeof val === "bigint") return val.toString() + "n";
      if (val instanceof Uint8Array)
        return { __type: "Uint8Array", length: val.length, hex: "0x" + Buffer.from(val).toString("hex") };
      return val;
    })
  );
}

function describeShape(v: unknown, depth = 0): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "string") {
    if (/^0x[0-9a-fA-F]+$/.test(v)) return `hex(${(v.length - 2) / 2}B)`;
    return `string(${v.length})`;
  }
  if (typeof v === "number") return "number";
  if (typeof v === "bigint") return "bigint";
  if (typeof v === "boolean") return "boolean";
  if (Array.isArray(v)) {
    if (v.length === 0) return "[]";
    if (depth > 1) return `[…×${v.length}]`;
    return `[${describeShape(v[0], depth + 1)}×${v.length}]`;
  }
  if (typeof v === "object") {
    if (depth > 2) return "{…}";
    const entries = Object.entries(v as Record<string, unknown>)
      .filter(([k]) => !k.startsWith("_") && isNaN(Number(k))) // skip ethers Result numeric duplicates
      .map(([k, val]) => `${k}: ${describeShape(val, depth + 1)}`);
    return `{ ${entries.join(", ")} }`;
  }
  return typeof v;
}

// ---------------------------------------------------------------------------
// Drift helpers
// ---------------------------------------------------------------------------

// Our codebase's declared chainId (kept in sync with app/lib/wagmi.ts and deployments.json).
const OUR_CHAIN_ID = 16602; // Galileo testnet

function expectChainId(actual: number | bigint): DriftEntry[] {
  const actualNum = typeof actual === "bigint" ? Number(actual) : actual;
  if (actualNum === OUR_CHAIN_ID) return [];
  return [{
    severity: "critical",
    ours: { file: "app/lib/wagmi.ts + deployments.json", symbol: "chainId", type: `${OUR_CHAIN_ID}`, value: OUR_CHAIN_ID },
    actual: { type: `chainId(${actualNum})`, value: actualNum },
    note: `Live chainId is ${actualNum}; our codebase has ${OUR_CHAIN_ID}. Update both files to match the active testnet.`,
  }];
}

function expectHexN(value: unknown, expectedBytes: number, ours: DriftEntry["ours"]): DriftEntry[] {
  if (typeof value !== "string") {
    return [{
      severity: "critical",
      ours,
      actual: { type: typeof value, value },
      note: `Expected hex string, got ${typeof value}.`,
    }];
  }
  if (!value.startsWith("0x")) {
    return [{
      severity: "critical",
      ours,
      actual: { type: `string(${value.length}) without 0x prefix`, value },
      note: "Missing 0x prefix.",
    }];
  }
  const actualBytes = (value.length - 2) / 2;
  if (actualBytes !== expectedBytes) {
    return [{
      severity: "critical",
      ours,
      actual: { type: `hex(${actualBytes}B)`, value },
      note: `Field is bytes${expectedBytes} on-chain but the SDK returned a ${actualBytes}-byte value. The on-chain type cannot store this without a schema change.`,
    }];
  }
  return [];
}

function expectShape(
  actualKeys: string[],
  ourKeys: string[],
  ours: { file: string; symbol: string }
): DriftEntry[] {
  const drift: DriftEntry[] = [];
  const missing = ourKeys.filter((k) => !actualKeys.includes(k));
  const extra = actualKeys.filter((k) => !ourKeys.includes(k));
  for (const k of missing) {
    drift.push({
      severity: "critical",
      ours: { ...ours, type: `field "${k}"` },
      actual: { type: `actual keys: [${actualKeys.join(", ")}]` },
      note: `Field "${k}" exists in our type but not in the SDK response.`,
    });
  }
  for (const k of extra) {
    drift.push({
      severity: "info",
      ours: { ...ours, type: `(no field for "${k}")` },
      actual: { type: `field "${k}"` },
      note: `SDK returns a "${k}" field we don't model — extend our type if we need it.`,
    });
  }
  return drift;
}

// ---------------------------------------------------------------------------
// Probes
// ---------------------------------------------------------------------------

async function chainProbes() {
  console.log("\n[chain] readonly probes via viem");

  const publicClient = createPublicClient({ transport: http(RPC_URL) });

  await runProbe(
    "chain.getChainId",
    "chain",
    { method: "eth_chainId", args: {} },
    async () => {
      const chainId = await publicClient.getChainId();
      return {
        response: chainId,
        observedShape: `number(${chainId})`,
        drift: expectChainId(chainId),
      };
    }
  );

  await runProbe(
    "chain.getBlockNumber",
    "chain",
    { method: "eth_blockNumber", args: {} },
    async () => {
      const blockNumber = await publicClient.getBlockNumber();
      return { response: blockNumber, observedShape: "bigint", drift: [] };
    }
  );

  if (HAS_KEY) {
    const account = privateKeyToAccount(PRIVATE_KEY);
    await runProbe(
      "chain.getBalance",
      "chain",
      { method: "eth_getBalance", args: { address: account.address } },
      async () => {
        const balance = await publicClient.getBalance({ address: account.address });
        return {
          response: { address: account.address, wei: balance },
          observedShape: `{ address: hex(20B), wei: bigint }`,
          drift:
            balance === 0n
              ? [{
                  severity: "warning",
                  ours: { file: ".env", symbol: "PRIVATE_KEY", type: "address", value: account.address },
                  actual: { type: "balance(0)", value: "0 OG" },
                  note: "Wallet has zero balance. Storage upload probes will fail without testnet OG. Fund at https://faucet.0g.ai",
                }]
              : [],
        };
      }
    );
  } else {
    skip("chain.getBalance", "chain", "PRIVATE_KEY not set");
  }

  // chain.readContract — only if we have a deployed registry
  let deployments: any = {};
  try {
    deployments = JSON.parse(readFileSync(resolve(root, "deployments.json"), "utf-8"));
  } catch {}
  const registry = deployments?.testnet?.contracts?.LineageRegistry;
  if (registry && registry !== "" && registry !== "0x") {
    await runProbe(
      "chain.readContract",
      "chain",
      { method: "getINFT", args: { tokenId: 1n, address: registry } },
      async () => {
        const REGISTRY_ABI = [
          {
            name: "getINFT",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "tokenId", type: "uint256" }],
            outputs: [{
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
            }],
          },
        ] as const;
        const result = await publicClient.readContract({
          address: registry as `0x${string}`,
          abi: REGISTRY_ABI,
          functionName: "getINFT",
          args: [1n],
        });
        const ourKeys = ["tokenId", "storageRoot", "owner", "iType", "royaltyBps", "royaltyReceiver", "createdAt", "paused"];
        const actualKeys = Object.keys(result);
        return {
          response: result,
          observedShape: describeShape(result),
          drift: expectShape(actualKeys, ourKeys, { file: "packages/shared/src/index.ts", symbol: "INFTRecord" }),
        };
      }
    );
  } else {
    skip("chain.readContract", "chain", "no LineageRegistry in deployments.json — run pnpm deploy:testnet first");
  }
}

async function storageProbes() {
  console.log("\n[storage] @0gfoundation/0g-storage-ts-sdk");

  if (!HAS_KEY) {
    skip("storage.upload", "storage", "PRIVATE_KEY not set");
    skip("storage.download", "storage", "PRIVATE_KEY not set");
    return;
  }

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  const indexer = new Indexer(STORAGE_URL);

  // Tag the blob so we can identify our smoke uploads later
  const tag = `lineage-smoke-${new Date().toISOString()}`;
  const payload = new TextEncoder().encode(tag.padEnd(120, "."));
  const memFile = new MemData(payload);

  let uploadedRoot: string | undefined;

  await runProbe(
    "storage.upload",
    "storage",
    { method: "Indexer.upload", args: { blobBytes: payload.length, tag } },
    async () => {
      // Cast around dual-package hazard: storage SDK bundles its own ethers types
      const [resp, err] = await indexer.upload(memFile, RPC_URL, wallet as never);
      if (err) throw err;
      if (!resp) throw new Error("upload returned null response");

      // Capture the entire response object (could be either single or fragmented form)
      const isFragmented = "rootHashes" in (resp as any);
      const rootHash = isFragmented ? (resp as any).rootHashes[0] : (resp as any).rootHash;
      const txHash = isFragmented ? (resp as any).txHashes[0] : (resp as any).txHash;
      uploadedRoot = rootHash;

      const drift: DriftEntry[] = [];
      // Our INFTRecord.storageRoot is bytes32 = 32 bytes = 64 hex chars + 0x = 66 char string
      drift.push(...expectHexN(rootHash, 32, {
        file: "packages/shared/src/index.ts",
        symbol: "INFTRecord.storageRoot",
        type: "`0x${string}` (bytes32)",
      }));
      // Note: txHash is metadata; we don't store it on-chain
      if (typeof txHash !== "string" || !txHash.startsWith("0x")) {
        drift.push({
          severity: "warning",
          ours: { file: "(none)", symbol: "—", type: "we don't model the storage upload txHash" },
          actual: { type: typeof txHash, value: txHash },
          note: "Storage SDK returns a txHash for the on-chain submission. Worth surfacing in the SDK for observability.",
        });
      }

      return {
        response: resp,
        observedShape: describeShape(resp),
        drift,
      };
    }
  );

  if (uploadedRoot) {
    await runProbe(
      "storage.download",
      "storage",
      { method: "Indexer.downloadToBlob", args: { rootHash: uploadedRoot } },
      async () => {
        const [blob, err] = await indexer.downloadToBlob(uploadedRoot!);
        if (err) throw err;
        if (!blob) throw new Error("download returned null blob");
        const arr = new Uint8Array(await blob.arrayBuffer());
        const downloadedTag = new TextDecoder().decode(arr).replace(/\.+$/, "");
        const matches = downloadedTag === tag;
        return {
          response: { sizeBytes: arr.length, recoveredTag: downloadedTag, matches },
          observedShape: `Blob(${arr.length}B)`,
          drift: matches
            ? []
            : [{
                severity: "critical",
                ours: { file: "(test)", symbol: "uploaded blob", type: "Uint8Array", value: tag },
                actual: { type: "Uint8Array", value: downloadedTag },
                note: "Upload and download bytes do not match — storage round-trip is broken.",
              }],
        };
      }
    );
  } else {
    skip("storage.download", "storage", "upload failed — nothing to download");
  }
}

async function daProbe() {
  console.log("\n[da] raw HTTP probe (no TS SDK published)");

  // Build a small CBOR-encoded mock receipt — same shape as our AttributionReceipt
  // (post sub-step 4A dual-attestation refactor).
  const mockReceipt = {
    version: "lineage/v1",
    receiptId: "0x" + "ab".repeat(32),
    agentId: "0x" + "00".repeat(20),
    agentRunner: "0x" + "00".repeat(20),
    inferenceId: "smoke-test",
    timestamp: Math.floor(Date.now() / 1000),
    inputDigest: "00".repeat(32),
    outputDigest: "00".repeat(32),
    computeProof: {
      provider: "0x" + "00".repeat(20),
      chatId: "smoke-test",
      zgResKey: "smoke-test",
    },
    lineage: {
      agentOperator: "0x" + "00".repeat(20),
      model: { tokenId: "1", weight: 1.0 },
      skills: [],
      memory: [],
      data: [],
      signature: "0x" + "00".repeat(65),
    },
  };
  const body = cborEncode(mockReceipt);

  // Try a few common disperser HTTP paths — record each attempt's result
  const candidatePaths = [
    "/disperser/disperse_blob",
    "/v1/blob",
    "/da/v1/blob",
    "/", // baseline: does the host even respond?
  ];

  await runProbe(
    "da.submit",
    "da",
    { method: "POST", args: { url: DA_URL, paths: candidatePaths, payloadBytes: body.length } },
    async () => {
      const attempts: Array<{ path: string; status: number; contentType: string | null; bodyPreview: string; bodyLen: number }> = [];
      for (const path of candidatePaths) {
        try {
          const url = DA_URL.replace(/\/$/, "") + path;
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/cbor" },
            body: new Uint8Array(body),
            signal: AbortSignal.timeout(8000),
          });
          const text = await res.text();
          attempts.push({
            path,
            status: res.status,
            contentType: res.headers.get("content-type"),
            bodyPreview: text.slice(0, 200),
            bodyLen: text.length,
          });
        } catch (e) {
          attempts.push({
            path,
            status: 0,
            contentType: null,
            bodyPreview: `fetch error: ${(e as Error).message}`,
            bodyLen: 0,
          });
        }
      }

      const success = attempts.find((a) => a.status >= 200 && a.status < 300);
      const drift: DriftEntry[] = [];
      drift.push({
        severity: "critical",
        ours: {
          file: "services/runner/src/receipt-sink.ts",
          symbol: "DAReceiptSink",
          type: "throws 'pending 0G DA gRPC SDK'",
        },
        actual: {
          type: success ? `HTTP ${success.status} on ${success.path}` : "no working path found",
          value: success?.path ?? null,
        },
        note: success
          ? `DA endpoint responds on ${success.path}. Wire DAReceiptSink against this path. No published TS SDK — call via fetch.`
          : `None of the candidate paths returned 2xx. DA may not be live yet, or it expects a different protocol (gRPC). Inspect the per-path responses below.`,
      });
      // SettlementBatch.daPointer is now a struct (commitment, blobIndex). Verify
      // that whatever DA returns can populate both fields.
      drift.push({
        severity: "warning",
        ours: {
          file: "contracts/src/interfaces/IRoyaltySplitter.sol",
          symbol: "SettlementBatch.daPointer",
          type: "DAPointer { bytes32 commitment; uint64 blobIndex; }",
        },
        actual: { type: success ? `body(${success.bodyPreview.slice(0, 60)}…)` : "(no response)" },
        note: "Confirm the real DA response carries both a 32-byte commitment and a sequential blob index. If DA returns only a KZG commitment, blobIndex will need to be derived elsewhere.",
      });

      return {
        response: { attempts, workingPath: success?.path ?? null },
        observedShape: `attempts[${attempts.length}], workingPath=${success?.path ?? "none"}`,
        drift,
      };
    }
  );
}

async function computeProbes() {
  console.log("\n[compute] @0glabs/0g-serving-broker (read-only)");

  let services: unknown[] = [];

  await runProbe(
    "compute.listServices",
    "compute",
    { method: "createReadOnlyInferenceBroker(rpc).listService", args: { rpcUrl: RPC_URL } },
    async () => {
      const broker = await createReadOnlyInferenceBroker(RPC_URL);
      const list = await broker.listService();
      services = list as unknown[];

      const drift: DriftEntry[] = [];
      // Validate that ServiceStructOutput shape still matches ComputeService in @lineage/shared.
      const ourComputeServiceKeys = [
        "provider", "serviceType", "url", "inputPrice", "outputPrice",
        "updatedAt", "model", "verifiability", "additionalInfo",
        "teeSignerAddress", "teeSignerAcknowledged",
      ];
      if (list.length > 0) {
        const sample = list[0] as any;
        // ethers v6 Result is a Proxy: `in` and Object.keys both miss the named
        // accessors. Probe by direct access — undefined means the field is gone.
        for (const k of ourComputeServiceKeys) {
          if (sample[k] === undefined) {
            drift.push({
              severity: "critical",
              ours: { file: "packages/shared/src/index.ts", symbol: "ComputeService", type: `field "${k}"` },
              actual: { type: "undefined" },
              note: `Field "${k}" is in ComputeService but the SDK returned undefined for it.`,
            });
          }
        }
      }

      if (list.length === 0) {
        drift.push({
          severity: "warning",
          ours: { file: "—", symbol: "—", type: "—" },
          actual: { type: "ServiceStructOutput[]", value: "empty" },
          note: "No services registered on testnet at this moment. Cannot do compute.serviceMetadata probe.",
        });
      } else {
        const sample = list[0] as any;
        const ourReceiptKeys = ["computeProof.provider", "computeProof.attestation.signing_address"]; // what AttributionReceipt now records for compute
        const actualHasTeeSigner = "teeSignerAddress" in sample;
        if (actualHasTeeSigner) {
          drift.push({
            severity: "info",
            ours: {
              file: "packages/shared/src/index.ts",
              symbol: "AttributionReceipt.computeProof",
              type: "ComputeInferenceProof { provider, chatId, zgResKey, attestation? }",
              value: ourReceiptKeys,
            },
            actual: {
              type: "ServiceStructOutput.teeSignerAddress",
              value: sample.teeSignerAddress,
            },
            note: "Compute services expose teeSignerAddress on-chain. AttributionReceipt.computeProof.attestation.signing_address must equal this for on-chain verification to pass.",
          });
        }
      }

      return {
        response: list,
        observedShape: `ServiceStructOutput[${list.length}]`,
        drift,
      };
    }
  );

  if (services.length > 0) {
    const sample = services[0] as any;
    await runProbe(
      "compute.firstService",
      "compute",
      { method: "(inspect first ServiceStructOutput)", args: { provider: sample.provider } },
      async () => {
        // No additional API call — just record the first service in detail
        return {
          response: {
            provider: sample.provider,
            model: sample.model,
            serviceType: sample.serviceType,
            url: sample.url,
            inputPrice: sample.inputPrice?.toString?.() ?? sample.inputPrice,
            outputPrice: sample.outputPrice?.toString?.() ?? sample.outputPrice,
            verifiability: sample.verifiability,
            teeSignerAddress: sample.teeSignerAddress,
            teeSignerAcknowledged: sample.teeSignerAcknowledged,
            updatedAt: sample.updatedAt?.toString?.() ?? sample.updatedAt,
          },
          observedShape: describeShape(sample),
          drift: expectHexN(sample.teeSignerAddress, 20, {
            file: "packages/shared/src/index.ts",
            symbol: "LineageClientConfig.teePublicKey",
            type: "`0x${string}`",
          }),
        };
      }
    );
  } else {
    skip("compute.firstService", "compute", "no services returned by listService");
  }

  // -------------------------------------------------------------------------
  // compute.invoke — real inference against the chatbot service.
  // Spends a tiny amount of testnet OG via the ledger. Pre-flight checks:
  //   - PRIVATE_KEY set
  //   - ledger account exists (auto-create with 0.1 OG if not)
  //   - provider signer acknowledged (one-time)
  // Captures the full response: status, headers, body, parsed JSON, signature.
  // -------------------------------------------------------------------------
  const TARGET_PROVIDER = "0xa48f01287233509FD694a22Bf840225062E67836" as const;
  const TARGET_MODEL = "qwen/qwen-2.5-7b-instruct";

  if (!HAS_KEY) {
    skip("compute.invoke", "compute", "PRIVATE_KEY not set — inference invocation requires a funded ledger");
    return;
  }

  await runProbe(
    "compute.invoke",
    "compute",
    {
      method: "POST {endpoint}/v1/chat/completions",
      args: { provider: TARGET_PROVIDER, model: TARGET_MODEL, prompt: "Hi" },
    },
    async () => {
      const provider = new JsonRpcProvider(RPC_URL);
      const wallet = new Wallet(PRIVATE_KEY, provider);
      const broker = await createZGComputeNetworkBroker(wallet as never);

      // 0G ledger constraints (from SDK error message):
      const LEDGER_MIN_OG = 3;            // testnet ledger creation minimum
      const TOP_UP_OG = 0.5;              // small additional deposit when below threshold

      // Pre-flight: verify wallet can afford ledger creation
      const balance = await provider.getBalance(wallet.address);
      const requiredWei = BigInt(LEDGER_MIN_OG) * 10n ** 18n + 10n ** 17n; // +0.1 OG for gas
      if (balance < requiredWei) {
        throw new Error(
          `Wallet ${wallet.address} has ${(Number(balance) / 1e18).toFixed(4)} OG; ` +
          `need at least ${LEDGER_MIN_OG + 0.1} OG to create the compute ledger. ` +
          `Top up at https://faucet.0g.ai`
        );
      }

      // Step 1: Ensure ledger exists with sufficient balance
      let ledgerAction: "exists" | "created" | "topped-up" = "exists";
      let ledgerBefore: any = null;
      try {
        const ledger = await broker.ledger.getLedger();
        ledgerBefore = {
          totalBalance: ledger.totalBalance?.toString?.() ?? String(ledger.totalBalance),
          locked: (ledger as any).locked?.toString?.() ?? null,
        };
        const total = BigInt(ledgerBefore.totalBalance);
        // Top up if locked + balance is below 0.05 OG (50% of min keep buffer)
        if (total < 50_000_000_000_000_000n) {
          await broker.ledger.depositFund(TOP_UP_OG);
          ledgerAction = "topped-up";
        }
      } catch (e) {
        // No ledger yet — create with the platform minimum
        await broker.ledger.addLedger(LEDGER_MIN_OG);
        ledgerAction = "created";
        const ledger = await broker.ledger.getLedger();
        ledgerBefore = {
          totalBalance: ledger.totalBalance?.toString?.() ?? String(ledger.totalBalance),
        };
      }

      // Step 2: Acknowledge provider signer (idempotent — checks state first)
      let acknowledgedAction: "already" | "acknowledged" = "already";
      const ackStatus = await broker.inference.checkProviderSignerStatus(TARGET_PROVIDER);
      if (!ackStatus.isAcknowledged) {
        await broker.inference.acknowledgeProviderSigner(TARGET_PROVIDER);
        acknowledgedAction = "acknowledged";
      }

      // Step 3: Get service metadata (endpoint + model)
      const meta = await broker.inference.getServiceMetadata(TARGET_PROVIDER);

      // Step 4: Build request — keep prompt minimal (1 token: "Hi")
      const prompt = "Hi";
      const requestBody = {
        messages: [{ role: "user", content: prompt }],
        model: meta.model,
        max_tokens: 8,        // bound the output cost
        temperature: 0,        // deterministic
      };

      // Step 5: Get billing/auth headers
      const headers = await broker.inference.getRequestHeaders(TARGET_PROVIDER, prompt);

      // Step 6: Make the actual HTTP call — try /v1/chat/completions first, fall back
      const candidatePaths = ["/v1/chat/completions", "/chat/completions"];
      let httpResp: Response | null = null;
      let usedPath: string | null = null;
      let rawBody = "";
      let respHeaders: Record<string, string> = {};
      for (const path of candidatePaths) {
        const url = meta.endpoint.replace(/\/$/, "") + path;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(headers as unknown as Record<string, string>),
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(60000),
          });
          rawBody = await res.text();
          if (res.status >= 200 && res.status < 300) {
            httpResp = res;
            usedPath = path;
            res.headers.forEach((v, k) => { respHeaders[k] = v; });
            break;
          }
          // record the failed attempt and move on
          const failHeaders: Record<string, string> = {};
          res.headers.forEach((v, k) => { failHeaders[k] = v; });
          respHeaders = { ...failHeaders, [`__failed_${path}_status`]: String(res.status) };
        } catch (e) {
          respHeaders[`__error_${path}`] = (e as Error).message;
        }
      }

      if (!httpResp || !usedPath) {
        throw new Error(`All inference endpoints failed. Last response body: ${rawBody.slice(0, 200)}`);
      }

      // Step 7: Parse the response body
      let parsed: any = null;
      try { parsed = JSON.parse(rawBody); } catch { /* keep raw */ }

      // Step 8: Verify the TEE signature via processResponse (sync attempt)
      // Per SDK docs: pass chatID (from response.id) and the assistant content
      const chatId = parsed?.id;
      const assistantContent = parsed?.choices?.[0]?.message?.content;
      let signatureValid: boolean | null = null;
      let verifyError: string | null = null;
      try {
        signatureValid = await broker.inference.processResponse(
          TARGET_PROVIDER,
          chatId,
          assistantContent
        );
      } catch (e) {
        verifyError = (e as Error).message;
      }

      // Step 8b: Fetch the actual TEE signature via the async download link.
      // The TEE signs asynchronously after the response — wait briefly, then fetch.
      let signatureDownloadUrl: string | null = null;
      let signatureFetchAttempts: Array<{
        attempt: number;
        afterDelayMs: number;
        url?: string;
        status?: number;
        contentType?: string | null;
        bodyBytes?: number;
        bodyPreview?: string;
        parsed?: unknown;
        error?: string;
      }> = [];
      try {
        signatureDownloadUrl = await broker.inference.getChatSignatureDownloadLink(
          TARGET_PROVIDER,
          chatId
        );
      } catch (e) {
        signatureFetchAttempts.push({ attempt: 0, afterDelayMs: 0, error: `getChatSignatureDownloadLink: ${(e as Error).message}` });
      }
      if (signatureDownloadUrl) {
        // The SDK-generated URL uses the full chatId (chatcmpl-<uuid>). On testnet
        // that returns chat_id_not_found. Try every plausible ID format we have
        // until one resolves. Each candidate gets one immediate retry after a delay.
        const baseUrl = signatureDownloadUrl.replace(/\/[^/]+$/, "");
        const bareUuid = chatId?.replace(/^chatcmpl-/, "") ?? "";
        const zgResKey = respHeaders["zg-res-key"];
        const xRequestId = respHeaders["x-request-id"];

        const candidates: Array<{ label: string; url: string }> = [];
        if (chatId) candidates.push({ label: "full-chatId", url: `${baseUrl}/${chatId}` });
        if (bareUuid && bareUuid !== chatId) candidates.push({ label: "bare-uuid", url: `${baseUrl}/${bareUuid}` });
        if (zgResKey) candidates.push({ label: "zg-res-key", url: `${baseUrl}/${zgResKey}` });
        if (xRequestId && xRequestId !== bareUuid) candidates.push({ label: "x-request-id", url: `${baseUrl}/${xRequestId}` });

        // Also try via the SDK-generated URL untouched (in case the SDK adds extra query params)
        candidates.unshift({ label: "sdk-generated", url: signatureDownloadUrl });

        const delays = [0, 5000]; // immediate, then 5s wait
        for (const candidate of candidates) {
          for (let i = 0; i < delays.length; i++) {
            if (delays[i]! > 0) await new Promise((r) => setTimeout(r, delays[i]));
            try {
              // Some signature endpoints might still need the user's auth header
              const sigRes = await fetch(candidate.url, {
                headers: { ...(headers as unknown as Record<string, string>) },
                signal: AbortSignal.timeout(15000),
              });
              const sigBody = await sigRes.text();
              let sigParsed: unknown = null;
              try { sigParsed = JSON.parse(sigBody); } catch { /* keep raw */ }
              signatureFetchAttempts.push({
                attempt: signatureFetchAttempts.length + 1,
                afterDelayMs: delays.slice(0, i + 1).reduce((a, b) => a + b, 0),
                url: candidate.url,
                status: sigRes.status,
                contentType: sigRes.headers.get("content-type"),
                bodyBytes: sigBody.length,
                bodyPreview: sigBody.slice(0, 800),
                parsed: sigParsed,
                idFormat: candidate.label,
              } as never);
              // Stop everything if we got a non-empty 2xx response
              if (sigRes.status >= 200 && sigRes.status < 300 && sigBody.length > 0) {
                // breakout
                signatureDownloadUrl = candidate.url; // record the working URL
                i = delays.length; // inner break
                break;
              }
            } catch (e) {
              signatureFetchAttempts.push({
                attempt: signatureFetchAttempts.length + 1,
                afterDelayMs: delays.slice(0, i + 1).reduce((a, b) => a + b, 0),
                url: candidate.url,
                error: (e as Error).message,
                idFormat: candidate.label,
              } as never);
            }
          }
          // If the last attempt succeeded, stop trying other candidates
          const last = signatureFetchAttempts[signatureFetchAttempts.length - 1] as any;
          if (last?.status >= 200 && last?.status < 300) break;
        }
      }

      // Step 8c: After the async signature is available, retry processResponse
      let signatureValidAfterDelay: boolean | null = null;
      let verifyErrorAfterDelay: string | null = null;
      if (signatureValid === null && signatureFetchAttempts.some((a) => a.status && a.status >= 200 && a.status < 300)) {
        try {
          signatureValidAfterDelay = await broker.inference.processResponse(
            TARGET_PROVIDER,
            chatId,
            assistantContent
          );
        } catch (e) {
          verifyErrorAfterDelay = (e as Error).message;
        }
      }

      // Step 9: Locate the actual TEE signature in the response
      // We don't know exactly where it is — log every candidate spot
      const sigLocations: Record<string, unknown> = {};
      // Common header names
      for (const h of Object.keys(respHeaders)) {
        if (/sign|tee|attest|sig/i.test(h)) sigLocations[`header.${h}`] = respHeaders[h];
      }
      // Common body fields
      const bodyFieldsToInspect = [
        "tee_signature", "signature", "tee_attestation", "attestation",
        "fingerprint", "tee_fingerprint", "verifier_response",
      ];
      for (const f of bodyFieldsToInspect) {
        if (parsed && parsed[f] !== undefined) sigLocations[`body.${f}`] = parsed[f];
        if (parsed?.choices?.[0]?.[f] !== undefined) sigLocations[`body.choices[0].${f}`] = parsed.choices[0][f];
      }

      const drift: DriftEntry[] = [];
      // Compare what we found to what AttributionReceipt.computeProof.attestation expects
      drift.push({
        severity: "info",
        ours: {
          file: "packages/shared/src/index.ts",
          symbol: "AttributionReceipt.computeProof.attestation",
          type: "TEEAttestation { text, signature, signing_address, ... } (populated lazily)",
        },
        actual: {
          type: Object.keys(sigLocations).length === 0
            ? "(no signature surfaced in response — verification is async via processResponse + getChatSignatureDownloadLink)"
            : `signature locations: [${Object.keys(sigLocations).join(", ")}]`,
        },
        note: Object.keys(sigLocations).length === 0
          ? "The TEE signature isn't returned inline. broker.inference.processResponse(provider, chatId, content) verifies it server-side; the raw signature must be fetched via broker.inference.getChatSignatureDownloadLink(provider, chatId). AttributionReceipt stores chatId + provider in computeProof; the attestation field is hydrated once the async signature is available."
          : "Inline signature found — record exact field for the SDK wiring into computeProof.attestation.",
      });

      return {
        response: {
          ledger: { action: ledgerAction, balanceBefore: ledgerBefore },
          providerAck: { action: acknowledgedAction, teeSignerAddress: ackStatus.teeSignerAddress },
          serviceMetadata: meta,
          requestHeaders: headers,
          requestBody,
          httpStatus: httpResp.status,
          usedPath,
          responseHeaders: respHeaders,
          rawBodyBytes: rawBody.length,
          rawBodyPreview: rawBody.slice(0, 500),
          parsedBody: parsed,
          chatId,
          assistantContent,
          tokenUsage: parsed?.usage ?? null,
          signatureLocations: sigLocations,
          signatureValid,
          verifyError,
          signatureDownloadUrl,
          signatureFetchAttempts,
          signatureValidAfterDelay,
          verifyErrorAfterDelay,
        },
        observedShape: `{ status: ${httpResp.status}, bodyBytes: ${rawBody.length}, signatureValid: ${signatureValid ?? signatureValidAfterDelay}, sigDownloadUrl: ${signatureDownloadUrl ? "yes" : "no"} }`,
        drift,
      };
    }
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Lineage 0G Smoke Test ===");
  console.log(`  RPC:     ${RPC_URL}`);
  console.log(`  Storage: ${STORAGE_URL}`);
  console.log(`  DA:      ${DA_URL}`);
  console.log(`  Compute: ${COMPUTE_URL}`);
  console.log(`  Wallet:  ${HAS_KEY ? privateKeyToAccount(PRIVATE_KEY).address : "(no PRIVATE_KEY — read-only probes only)"}`);

  await chainProbes();
  await storageProbes();
  await daProbe();
  await computeProbes();

  // Aggregate drift report
  const driftReport: Array<DriftEntry & { probe: string }> = [];
  for (const [name, probe] of Object.entries(probes)) {
    for (const d of probe.drift) driftReport.push({ ...d, probe: name });
  }

  // Summary
  console.log("\n=== Summary ===");
  const total = Object.keys(probes).length;
  const ok = Object.values(probes).filter((p) => p.ok).length;
  const skipped = Object.values(probes).filter((p) => p.skipped).length;
  const failed = total - ok - skipped;
  const critical = driftReport.filter((d) => d.severity === "critical").length;
  const warnings = driftReport.filter((d) => d.severity === "warning").length;
  const infos = driftReport.filter((d) => d.severity === "info").length;
  console.log(`  Probes: ${ok} ok, ${failed} failed, ${skipped} skipped (${total} total)`);
  console.log(`  Drift:  ${critical} critical, ${warnings} warnings, ${infos} info`);

  if (driftReport.length > 0) {
    console.log("\n=== Drift Report ===");
    for (const d of driftReport) {
      const sigil = d.severity === "critical" ? "🛑" : d.severity === "warning" ? "⚠" : "ℹ";
      console.log(`  ${sigil} [${d.probe}] ${d.ours.file}#${d.ours.symbol}`);
      console.log(`     ours:   ${d.ours.type}`);
      console.log(`     actual: ${d.actual.type}`);
      console.log(`     note:   ${d.note}`);
    }
  }

  // Persist
  const out = {
    ranAt: new Date().toISOString(),
    endpoints: { rpc: RPC_URL, storage: STORAGE_URL, da: DA_URL, compute: COMPUTE_URL },
    wallet: HAS_KEY ? { address: privateKeyToAccount(PRIVATE_KEY).address } : null,
    summary: { total, ok, failed, skipped, critical, warnings, infos },
    probes,
    driftReport,
  };
  const outPath = resolve(root, "scripts/smoke-output.json");
  writeFileSync(outPath, JSON.stringify(jsonSafe(out), null, 2) + "\n");
  console.log(`\n✓ Written: scripts/smoke-output.json`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(0); // never fail CI
});
