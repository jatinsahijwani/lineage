/**
 * POST /api/storage-upload
 *
 * Uploads already-encrypted bytes to 0G Storage on behalf of a minting user.
 * The operator wallet pays the storage fee, matching the "Agent Host" role
 * the operator plays for receipt persistence in /api/inference.
 *
 * Request:  { payload: string }  — base64-encoded `serializeBlob(encrypted)` bytes
 * Response: { rootHash, txHash, txSeq } on success; { error } with 4xx/5xx on failure.
 *
 * The browser never sends plaintext — encryption happens client-side in
 * useMintScreen via @lineage/crypto. The server only sees ciphertext + nonce.
 */

import { NextResponse } from "next/server";
import { Wallet, JsonRpcProvider } from "ethers";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";
import { z } from "zod";

import { ZG_TESTNET } from "@lineage/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  payload: z.string().min(1),
});

export async function POST(req: Request): Promise<Response> {
  let body: { payload: string };
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "invalid body" },
      { status: 400 },
    );
  }

  const operatorPrivateKey = process.env["OPERATOR_PRIVATE_KEY"];
  if (!operatorPrivateKey) {
    return NextResponse.json(
      { error: "OPERATOR_PRIVATE_KEY missing on server" },
      { status: 500 },
    );
  }

  const rpc = process.env["ZERO_G_RPC_URL"] ?? ZG_TESTNET.rpcUrl;
  const storageUrl =
    process.env["ZERO_G_STORAGE_URL"] ?? ZG_TESTNET.storageIndexerUrl;

  let bytes: Buffer;
  try {
    bytes = Buffer.from(body.payload, "base64");
  } catch {
    return NextResponse.json(
      { error: "payload is not valid base64" },
      { status: 400 },
    );
  }
  if (bytes.length === 0) {
    return NextResponse.json(
      { error: "payload decoded to zero bytes" },
      { status: 400 },
    );
  }

  try {
    const signer = new Wallet(operatorPrivateKey, new JsonRpcProvider(rpc));
    const indexer = new Indexer(storageUrl);
    const file = new MemData(new Uint8Array(bytes));

    // dual-package hazard: storage SDK ships its own ethers Signer type.
    const [resp, err] = await indexer.upload(
      file,
      rpc,
      signer as never,
    );
    if (err) throw err;
    if (!resp) throw new Error("storage indexer returned null response");

    if ("rootHashes" in (resp as object)) {
      throw new Error(
        "fragmented upload not supported — payload exceeded single-blob threshold",
      );
    }
    const single = resp as {
      rootHash: string;
      txHash: string;
      txSeq: number;
    };

    return NextResponse.json({
      rootHash: single.rootHash,
      txHash: single.txHash,
      txSeq: single.txSeq,
    });
  } catch (err) {
    console.error("[/api/storage-upload] failure:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
