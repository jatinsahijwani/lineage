/**
 * Proof store for per-recipient Merkle proofs emitted by `/api/settle`.
 *
 * Two backends, picked at runtime by `pickStore()`:
 *
 *   RedisProofStore — used when `KV_REST_API_URL` (Vercel KV) or
 *     `UPSTASH_REDIS_REST_URL` is set. Required for any multi-instance
 *     deployment (Vercel serverless, etc.) because the file-system fallback
 *     lives in /tmp, which is per-invocation and not shared across cold
 *     starts. Without Redis, the cross-wallet demo silently breaks: Person B
 *     settles in one Lambda, Person A's /earnings hits a different Lambda
 *     and finds nothing.
 *
 *   FsProofStore — single-process JSON file. Used for local dev, when no
 *     Redis env vars are configured. Concurrency is naive read-modify-write;
 *     this is fine for `next dev` but unsafe for multi-process.
 *
 * Records are keyed by lower-cased recipient address. Each carries everything
 * the recipient needs to call `RoyaltySplitter.claim` plus a `claimed` flag
 * flipped via `/api/claims` once the claim tx lands.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";

export type Hex = `0x${string}`;

export interface ProofRecord {
  batchId: string;
  token: Hex;
  /** Wei amount as a decimal string. */
  amount: string;
  proof: Hex[];
  txHash: Hex;
  postedAt: string;
  claimed: boolean;
}

export interface ProofPayout {
  recipient: Hex;
  token: Hex;
  amount: bigint;
  proof: Hex[];
}

interface ProofStore {
  saveProofs(batchId: bigint, payouts: ProofPayout[], txHash: Hex): Promise<void>;
  getProofsForRecipient(address: string): Promise<ProofRecord[]>;
  markClaimed(address: string, batchId: string, token: Hex): Promise<void>;
  listAllRecipients(): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Redis (Upstash / Vercel KV) implementation
// ---------------------------------------------------------------------------

class RedisProofStore implements ProofStore {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  private recordKey(address: string): string {
    return `proofs:${address.toLowerCase()}`;
  }

  private readonly recipientsSetKey = "proofs:recipients";

  async saveProofs(
    batchId: bigint,
    payouts: ProofPayout[],
    txHash: Hex,
  ): Promise<void> {
    const postedAt = new Date().toISOString();
    for (const p of payouts) {
      const key = this.recordKey(p.recipient);
      const record: ProofRecord = {
        batchId: batchId.toString(),
        token: p.token,
        amount: p.amount.toString(),
        proof: p.proof,
        txHash,
        postedAt,
        claimed: false,
      };
      await this.redis.rpush(key, JSON.stringify(record));
      await this.redis.sadd(this.recipientsSetKey, p.recipient.toLowerCase());
    }
  }

  async getProofsForRecipient(address: string): Promise<ProofRecord[]> {
    const key = this.recordKey(address);
    const raw = await this.redis.lrange(key, 0, -1);
    const records = raw
      .map((entry) => parseRedisRecord(entry))
      .filter((r): r is ProofRecord => r !== null);
    return records.filter((r) => !r.claimed);
  }

  async markClaimed(
    address: string,
    batchId: string,
    token: Hex,
  ): Promise<void> {
    const key = this.recordKey(address);
    const raw = await this.redis.lrange(key, 0, -1);
    if (raw.length === 0) return;
    const tokenLower = token.toLowerCase();
    const updated: string[] = [];
    let changed = false;
    for (const entry of raw) {
      const record = parseRedisRecord(entry);
      if (!record) {
        updated.push(typeof entry === "string" ? entry : JSON.stringify(entry));
        continue;
      }
      if (
        record.batchId === batchId &&
        record.token.toLowerCase() === tokenLower &&
        !record.claimed
      ) {
        record.claimed = true;
        changed = true;
      }
      updated.push(JSON.stringify(record));
    }
    if (!changed) return;
    // Replace the list atomically: delete + rpush. Acceptable since claim
    // marking is rare (one tx per recipient per batch) and there's no
    // concurrent writer on the same key in the demo flow.
    await this.redis.del(key);
    if (updated.length > 0) {
      await this.redis.rpush(key, ...updated);
    }
  }

  async listAllRecipients(): Promise<string[]> {
    const members = await this.redis.smembers(this.recipientsSetKey);
    return members;
  }
}

function parseRedisRecord(entry: unknown): ProofRecord | null {
  if (entry === null || entry === undefined) return null;
  // Upstash auto-parses JSON when stored via SDK helpers; defensive on both.
  if (typeof entry === "object") return entry as ProofRecord;
  if (typeof entry !== "string") return null;
  try {
    return JSON.parse(entry) as ProofRecord;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// File-system fallback (local dev)
// ---------------------------------------------------------------------------

type Store = Record<string, ProofRecord[]>;

function fsPath(): string {
  if (process.env["PROOF_STORE_PATH"]) {
    return process.env["PROOF_STORE_PATH"];
  }
  const isServerless =
    process.env["VERCEL"] === "1" ||
    process.env["AWS_LAMBDA_FUNCTION_NAME"] !== undefined;
  return isServerless
    ? "/tmp/.proofs.json"
    : path.join(process.cwd(), ".proofs.json");
}

class FsProofStore implements ProofStore {
  private async read(): Promise<Store> {
    try {
      const raw = await fs.readFile(fsPath(), "utf8");
      if (!raw.trim()) return {};
      return JSON.parse(raw) as Store;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw err;
    }
  }

  private async write(data: Store): Promise<void> {
    await fs.writeFile(fsPath(), JSON.stringify(data, null, 2) + "\n", "utf8");
  }

  async saveProofs(
    batchId: bigint,
    payouts: ProofPayout[],
    txHash: Hex,
  ): Promise<void> {
    const store = await this.read();
    const postedAt = new Date().toISOString();
    for (const p of payouts) {
      const key = p.recipient.toLowerCase();
      const record: ProofRecord = {
        batchId: batchId.toString(),
        token: p.token,
        amount: p.amount.toString(),
        proof: p.proof,
        txHash,
        postedAt,
        claimed: false,
      };
      const existing = store[key] ?? [];
      existing.push(record);
      store[key] = existing;
    }
    await this.write(store);
  }

  async getProofsForRecipient(address: string): Promise<ProofRecord[]> {
    const store = await this.read();
    const records = store[address.toLowerCase()] ?? [];
    return records.filter((r) => !r.claimed);
  }

  async markClaimed(
    address: string,
    batchId: string,
    token: Hex,
  ): Promise<void> {
    const store = await this.read();
    const key = address.toLowerCase();
    const records = store[key];
    if (!records) return;
    const tokenLower = token.toLowerCase();
    for (const r of records) {
      if (r.batchId === batchId && r.token.toLowerCase() === tokenLower) {
        r.claimed = true;
      }
    }
    store[key] = records;
    await this.write(store);
  }

  async listAllRecipients(): Promise<string[]> {
    const store = await this.read();
    return Object.keys(store);
  }
}

// ---------------------------------------------------------------------------
// Backend selection
// ---------------------------------------------------------------------------

let cached: ProofStore | null = null;

function pickStore(): ProofStore {
  if (cached) return cached;

  // Vercel KV injects KV_REST_API_URL / KV_REST_API_TOKEN.
  // Upstash's own naming is UPSTASH_REDIS_REST_URL / _TOKEN. Support both.
  const url =
    process.env["KV_REST_API_URL"] ?? process.env["UPSTASH_REDIS_REST_URL"];
  const token =
    process.env["KV_REST_API_TOKEN"] ?? process.env["UPSTASH_REDIS_REST_TOKEN"];

  if (url && token) {
    const redis = new Redis({ url, token });
    cached = new RedisProofStore(redis);
  } else {
    cached = new FsProofStore();
  }
  return cached;
}

// ---------------------------------------------------------------------------
// Public helpers — preserve the original module surface so callers don't change.
// ---------------------------------------------------------------------------

export async function saveProofs(
  batchId: bigint,
  payouts: ProofPayout[],
  txHash: Hex,
): Promise<void> {
  return pickStore().saveProofs(batchId, payouts, txHash);
}

export async function getProofsForRecipient(
  address: string,
): Promise<ProofRecord[]> {
  return pickStore().getProofsForRecipient(address);
}

export async function markClaimed(
  address: string,
  batchId: string,
  token: Hex,
): Promise<void> {
  return pickStore().markClaimed(address, batchId, token);
}

export async function listAllRecipients(): Promise<string[]> {
  return pickStore().listAllRecipients();
}
