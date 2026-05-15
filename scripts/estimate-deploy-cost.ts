/**
 * Estimate the OG needed to deploy + bootstrap Lineage on 0G mainnet.
 *
 * - Reads gas price from MAINNET_RPC_URL (or ZERO_G_RPC_URL fallback).
 * - For each contract, prefers `contracts/out/<Name>.sol/<Name>.json` bytecode
 *   and estimates deployment gas via `eth_estimateGas`. If artifacts are
 *   missing, falls back to a hardcoded per-contract gas estimate.
 * - Also estimates seed (5 iNFTs), register-operator, and 10 postBatch calls.
 *
 * Prints a clean breakdown table and a recommended top-up (2× total).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, formatEther, http, type Hex } from "viem";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const contractsRoot = resolve(root, "contracts");

// Load .env.
try {
  const env = readFileSync(resolve(root, ".env"), "utf-8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = val;
  }
} catch {
  // no .env
}

const rpc =
  process.env["MAINNET_RPC_URL"] ??
  process.env["ZERO_G_RPC_URL"] ??
  "https://evmrpc-mainnet.0g.ai";

interface ContractSpec {
  name: string;
  fallbackGas: bigint;
}

// Fallback gas estimates derived from typical Solidity contract sizes when
// no compiled artifacts are available. Real `forge build` artifacts will
// produce more accurate numbers.
const CONTRACTS: ContractSpec[] = [
  { name: "LineageRegistry", fallbackGas: 2_400_000n },
  { name: "DataINFT", fallbackGas: 1_800_000n },
  { name: "ModelINFT", fallbackGas: 1_800_000n },
  { name: "SkillINFT", fallbackGas: 1_800_000n },
  { name: "AttributionVerifier", fallbackGas: 2_200_000n },
  { name: "RoyaltySplitter", fallbackGas: 2_600_000n },
];

function loadBytecode(name: string): Hex | null {
  const artifactPath = resolve(
    contractsRoot,
    "out",
    `${name}.sol`,
    `${name}.json`,
  );
  if (!existsSync(artifactPath)) return null;
  try {
    const json = JSON.parse(readFileSync(artifactPath, "utf-8"));
    const obj = json.bytecode?.object ?? json.bytecode;
    if (typeof obj !== "string" || !obj.startsWith("0x")) return null;
    return obj as Hex;
  } catch {
    return null;
  }
}

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function fmtGas(g: bigint): string {
  return g.toLocaleString("en-US");
}

function fmtOg(wei: bigint): string {
  const ether = Number(formatEther(wei));
  return ether.toFixed(4);
}

const publicClient = createPublicClient({
  chain: undefined,
  transport: http(rpc),
});

const chainId = await publicClient.getChainId().catch(() => 0);
const gasPrice = await publicClient.getGasPrice().catch(() => 0n);

if (gasPrice === 0n) {
  console.error(`Failed to read gas price from ${rpc}. Aborting.`);
  process.exit(1);
}

const gasPriceGwei = Number(gasPrice) / 1e9;

console.log("=== Lineage Mainnet Deploy Cost Estimate ===\n");
console.log(`Network: 0G Mainnet (chainId: ${chainId})`);
console.log(`RPC: ${rpc}`);
console.log(`Gas price: ${gasPriceGwei.toFixed(4)} gwei\n`);

let total = 0n;
const deployRows: Array<{ name: string; gas: bigint; wei: bigint; source: string }> = [];

console.log("Contract deployments:");
for (const c of CONTRACTS) {
  const bytecode = loadBytecode(c.name);
  let gas = c.fallbackGas;
  let source = "fallback";
  if (bytecode) {
    try {
      gas = await publicClient.estimateGas({
        data: bytecode,
      });
      source = "estimated";
    } catch {
      // eth_estimateGas can fail for contracts with constructor args; keep fallback.
      source = "fallback (estimate failed)";
    }
  }
  const wei = gas * gasPrice;
  total += wei;
  deployRows.push({ name: c.name, gas, wei, source });
  console.log(
    `  ${pad(c.name + ":", 22)} ~${pad(fmtGas(gas), 12)} gas  →  ${fmtOg(wei)} OG  (${source})`,
  );
}

// Post-deploy setup: seed iNFTs (mint × 5) + register operator.
const SEED_GAS_PER_INFT = 250_000n;
const SEED_GAS_TOTAL = SEED_GAS_PER_INFT * 5n;
const REGISTER_OPERATOR_GAS = 50_000n;

const seedWei = SEED_GAS_TOTAL * gasPrice;
const regWei = REGISTER_OPERATOR_GAS * gasPrice;
total += seedWei + regWei;

console.log("\nPost-deploy setup:");
console.log(
  `  ${pad("Seed (5 iNFTs):", 22)} ~${pad(fmtGas(SEED_GAS_TOTAL), 12)} gas  →  ${fmtOg(seedWei)} OG`,
);
console.log(
  `  ${pad("Register operator:", 22)} ~${pad(fmtGas(REGISTER_OPERATOR_GAS), 12)} gas  →  ${fmtOg(regWei)} OG`,
);

// Demo operations: 10 postBatch tx (~100k gas each is a reasonable estimate).
const POST_BATCH_GAS = 110_000n;
const POST_BATCH_TOTAL = POST_BATCH_GAS * 10n;
const postBatchWei = POST_BATCH_TOTAL * gasPrice;
total += postBatchWei;

console.log("\nDemo operations (10 runs):");
console.log(
  `  ${pad("postBatch × 10:", 22)} ~${pad(fmtGas(POST_BATCH_GAS), 12)} gas ea →  ${fmtOg(postBatchWei)} OG total`,
);

console.log("\n──────────────────────────────────────────");
console.log(`  ${pad("TOTAL NEEDED:", 38)} ${fmtOg(total)} OG`);
console.log(`  ${pad("RECOMMENDED (2× buffer):", 38)} ${fmtOg(total * 2n)} OG`);
console.log("");
