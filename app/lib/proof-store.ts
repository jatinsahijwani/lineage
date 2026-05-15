// Single-process JSON store. v2: replace with sqlite/redis if multi-process.

/**
 * File-backed proof store. Records the per-recipient Merkle proofs emitted by
 * `/api/settle` so `/earnings` can serve them back without re-running the
 * settler on demand.
 *
 * The store is keyed by lower-cased recipient address. Each record carries
 * everything the recipient needs to call `RoyaltySplitter.claim` plus a
 * `claimed` flag flipped via `/api/claims` once the claim tx lands.
 *
 * Concurrency: this is a naive read-modify-write JSON file. Safe for the
 * single-process Next dev server; not safe for multi-replica deployments.
 * If we ever go multi-process, swap to sqlite or redis.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

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

type Store = Record<string, ProofRecord[]>;

function storePath(): string {
  return (
    process.env["PROOF_STORE_PATH"] ??
    path.join(process.cwd(), ".proofs.json")
  );
}

async function readStore(): Promise<Store> {
  const file = storePath();
  try {
    const raw = await fs.readFile(file, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw) as Store;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

async function writeStore(data: Store): Promise<void> {
  const file = storePath();
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export async function saveProofs(
  batchId: bigint,
  payouts: ProofPayout[],
  txHash: Hex,
): Promise<void> {
  const store = await readStore();
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
  await writeStore(store);
}

export async function getProofsForRecipient(
  address: string,
): Promise<ProofRecord[]> {
  const store = await readStore();
  const key = address.toLowerCase();
  const records = store[key] ?? [];
  return records.filter((r) => !r.claimed);
}

export async function markClaimed(
  address: string,
  batchId: string,
  token: Hex,
): Promise<void> {
  const store = await readStore();
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
  await writeStore(store);
}

export async function listAllRecipients(): Promise<string[]> {
  const store = await readStore();
  return Object.keys(store);
}
