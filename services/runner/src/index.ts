import { createServer } from "node:http";
import type { Hex } from "viem";
import { buildAndPostReceipt } from "./receipt-builder.js";
import type { InferenceRequest } from "./inference.js";
import { runInference, type InferenceConfig } from "./inference.js";
import { StorageReceiptSink, DAReceiptSink, type ReceiptSink } from "./receipt-sink.js";

const config: InferenceConfig = {
  computeUrl: process.env["ZERO_G_COMPUTE_URL"] ?? "mock://compute",
  // Real 0G Compute is the default; set MOCK_TEE=1 to bypass for offline tests.
  mockTEE: process.env["MOCK_TEE"] === "1",
  teePublicKey: process.env["TEE_PUBLIC_KEY"] ?? "0x0000000000000000000000000000000000000000",
};

const operatorPrivateKey = (process.env["OPERATOR_PRIVATE_KEY"] ??
  process.env["PRIVATE_KEY"] ??
  "0x") as Hex;

const sinkBackend = (process.env["RECEIPT_SINK"] ?? "storage").toLowerCase();
const sink: ReceiptSink = sinkBackend === "da"
  ? new DAReceiptSink({
      daUrl: process.env["ZERO_G_DA_URL"] ?? "https://da.0g.ai",
      namespace: "lineage.receipts.v1",
    })
  : new StorageReceiptSink({
      storageUrl: process.env["ZERO_G_STORAGE_URL"] ?? "https://indexer-storage-testnet-turbo.0g.ai",
      rpc: process.env["ZERO_G_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai",
      signer: (process.env["PRIVATE_KEY"] ?? "0x") as `0x${string}`,
    });

export async function handleInferenceRequest(request: InferenceRequest) {
  const inferenceId = crypto.randomUUID();

  console.log(`[runner] inference ${inferenceId} starting...`);

  // runInference is now a thin shim around buildAndPostReceipt — it both
  // signs (TEE + operator) and posts to the sink. validateReceipt is folded
  // into buildAndPostReceipt's local-verify step (AttributionReceiptSchema).
  const { output, receipt, daPointer } = await runInference(
    request,
    config,
    inferenceId,
    operatorPrivateKey,
    sink,
  );

  console.log(
    `[runner] receipt persisted: commitment=${daPointer.commitment} blobIndex=${daPointer.blobIndex}`,
  );

  return { output, receipt, daPointer };
}

// Re-export for downstream callers that previously imported from index.
export { buildAndPostReceipt };

// HTTP server (minimal, for demo)
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env["PORT"] ?? 3001);
  console.log(`[runner] starting on port ${port}`);

  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/infer") {
      res.writeHead(404).end("Not found");
      return;
    }
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body = JSON.parse(Buffer.concat(chunks).toString()) as InferenceRequest;
      const result = await handleInferenceRequest(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: String(e) }));
    }
  });

  server.listen(port, () => {
    console.log(`[runner] listening on http://localhost:${port}`);
  });
}
