/**
 * Receipt sink abstraction. Used by the runner to persist signed attribution
 * receipts and by the settler to fetch them back during settlement.
 *
 * Two implementations:
 *   - StorageReceiptSink: real, writes the canonical CBOR-encoded receipt as
 *     a 0G Storage blob and returns {commitment: rootHash, blobIndex: txSeq}.
 *   - DAReceiptSink: stub for 0G Data Availability. Throws — no public TS DA
 *     SDK ships yet (see scripts/smoke-output.json drift report).
 */

import type { DAPointer, SignedReceipt } from "@lineage/shared";
import { encode as cborEncode, decode as cborDecode } from "cbor-x";
import { keccak256 } from "viem";
import { Wallet, JsonRpcProvider, type Signer } from "ethers";
import { Indexer, MemData } from "@0gfoundation/0g-storage-ts-sdk";

export type { DAPointer, SignedReceipt };

export interface ReceiptSink {
  post(receipt: SignedReceipt): Promise<DAPointer>;
  read(pointer: DAPointer): Promise<SignedReceipt>;
}

// ---------------------------------------------------------------------------
// StorageReceiptSink — writes receipts to 0G Storage.
// ---------------------------------------------------------------------------

export interface StorageReceiptSinkConfig {
  /** 0G Storage indexer URL, e.g. https://indexer-storage-testnet-turbo.0g.ai */
  storageUrl: string;
  /** EVM RPC URL, e.g. https://evmrpc-testnet.0g.ai */
  rpc: string;
  /**
   * Either an ethers Signer (for tests) or a hex-prefixed private key. The
   * signer pays the storage fee for each receipt upload.
   */
  signer: Signer | `0x${string}`;
}

export class StorageReceiptSink implements ReceiptSink {
  private indexer: Indexer;
  private rpc: string;
  private signer: Signer;

  constructor(config: StorageReceiptSinkConfig) {
    this.indexer = new Indexer(config.storageUrl);
    this.rpc = config.rpc;
    this.signer = typeof config.signer === "string"
      ? new Wallet(config.signer, new JsonRpcProvider(config.rpc))
      : config.signer;
  }

  async post(receipt: SignedReceipt): Promise<DAPointer> {
    const encoded = cborEncode(receipt);
    const file = new MemData(encoded);

    // dual-package hazard: storage SDK ships its own ethers Signer type.
    const [resp, err] = await this.indexer.upload(file, this.rpc, this.signer as never);
    if (err) throw err;
    if (!resp) throw new Error("StorageReceiptSink: upload returned null");

    // Single-file form: { rootHash, txHash, txSeq }
    // Fragmented form (>4GB): { rootHashes[], txHashes[], txSeqs[] } — receipts are tiny so we never hit this
    if ("rootHashes" in (resp as object)) {
      throw new Error("StorageReceiptSink: receipt payload triggered fragmented upload — should never happen for a single CBOR receipt");
    }
    const single = resp as { rootHash: string; txHash: string; txSeq: number };
    return {
      commitment: single.rootHash as `0x${string}`,
      blobIndex: single.txSeq,
    };
  }

  async read(pointer: DAPointer): Promise<SignedReceipt> {
    const [blob, err] = await this.indexer.downloadToBlob(pointer.commitment);
    if (err) throw err;
    if (!blob) throw new Error(`StorageReceiptSink: download returned null for ${pointer.commitment}`);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    return cborDecode(bytes) as SignedReceipt;
  }
}

// ---------------------------------------------------------------------------
// DAReceiptSink — stub. 0G DA only ships a Go gRPC client today (see
// scripts/smoke-output.json compute.invoke and da.submit probes). When 0G
// publishes a JS DA SDK or a stable HTTP gateway, fill in this class.
// ---------------------------------------------------------------------------

export interface DAReceiptSinkConfig {
  /** 0G DA disperser URL — currently has no public HTTP/JS API */
  daUrl: string;
  /** DA namespace, e.g. "lineage.receipts.v1" */
  namespace: string;
}

export class DAReceiptSink implements ReceiptSink {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(_config: DAReceiptSinkConfig) {}

  async post(_receipt: SignedReceipt): Promise<DAPointer> {
    throw new Error("pending 0G DA gRPC SDK");
  }

  async read(_pointer: DAPointer): Promise<SignedReceipt> {
    throw new Error("pending 0G DA gRPC SDK");
  }
}

// ---------------------------------------------------------------------------
// MemoryReceiptSink — for local dev / e2e demos only.
//
// Real deployments use StorageReceiptSink (writes to 0G Storage). On a local
// anvil chain, posting to live 0G Storage would cross networks, take ~15s per
// upload, and burn funded testnet OG. The in-memory sink keeps the dual-
// attestation flow self-contained for repeatable on-anvil demos. Production
// must NOT use this — receipts are lost when the process exits.
// ---------------------------------------------------------------------------

export class MemoryReceiptSink implements ReceiptSink {
  private store = new Map<string, Uint8Array>();
  private nextIndex = 0;

  async post(receipt: SignedReceipt): Promise<DAPointer> {
    const buf = cborEncode(receipt);
    const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    const commitment = keccak256(bytes);
    this.store.set(commitment, bytes);
    return { commitment, blobIndex: this.nextIndex++ };
  }

  async read(pointer: DAPointer): Promise<SignedReceipt> {
    const bytes = this.store.get(pointer.commitment);
    if (!bytes) {
      throw new Error(`MemoryReceiptSink: no blob for ${pointer.commitment}`);
    }
    return cborDecode(bytes) as SignedReceipt;
  }
}
