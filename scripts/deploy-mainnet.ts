/**
 * Deploys all Lineage contracts to 0G mainnet via forge.
 *
 * Reads from .env at repo root:
 *   - MAINNET_RPC_URL      (default: https://evmrpc-mainnet.0g.ai)
 *   - DEPLOYER_PRIVATE_KEY (required)
 *
 * Writes results to deployments-mainnet.json and prints a paste-ready
 * NEXT_PUBLIC_* env block for Vercel.
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const contractsRoot = resolve(root, "contracts");

// Load .env at repo root.
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
  // no .env file, rely on environment
}

const rpc = process.env["MAINNET_RPC_URL"] ?? "https://evmrpc-mainnet.0g.ai";
const privateKey =
  process.env["DEPLOYER_PRIVATE_KEY"] ?? process.env["PRIVATE_KEY"];

if (!privateKey) {
  console.error(
    "Error: DEPLOYER_PRIVATE_KEY not set. Add it to .env at repo root.",
  );
  process.exit(1);
}

console.log(`Deploying to mainnet RPC: ${rpc}`);

// Probe chainId via viem so we record the real chain we deployed to.
const publicClient = createPublicClient({ chain: undefined, transport: http(rpc) });
let chainId: number;
try {
  chainId = await publicClient.getChainId();
  console.log(`Detected chainId: ${chainId}`);
} catch (e) {
  console.error("Failed to reach RPC for chainId probe:", e);
  process.exit(1);
}

// forge script reads PRIVATE_KEY from env; copy DEPLOYER_PRIVATE_KEY into it.
process.env["PRIVATE_KEY"] = privateKey;

let output: string;
try {
  output = execSync(
    `forge script script/Deploy.s.sol:Deploy \
      --rpc-url "${rpc}" \
      --broadcast \
      --legacy \
      --gas-price 3000000000 \
      --private-key "${privateKey}"`,
    { cwd: contractsRoot, encoding: "utf-8" },
  );
  console.log(output);
} catch (e: any) {
  console.error("forge script failed:", e.message);
  if (e.stdout) console.error(e.stdout);
  if (e.stderr) console.error(e.stderr);
  process.exit(1);
}

function parseAddr(label: string): string {
  const regex = new RegExp(`${label}:\\s*(0x[0-9a-fA-F]{40})`);
  const m = output.match(regex);
  if (!m) throw new Error(`Could not find ${label} in forge output`);
  return m[1]!;
}

const contracts = {
  LineageRegistry: parseAddr("LineageRegistry"),
  DataINFT: parseAddr("DataINFT"),
  ModelINFT: parseAddr("ModelINFT"),
  SkillINFT: parseAddr("SkillINFT"),
  AttributionVerifier: parseAddr("AttributionVerifier"),
  RoyaltySplitter: parseAddr("RoyaltySplitter"),
};

// Verify each address responded with code on-chain.
for (const [name, addr] of Object.entries(contracts)) {
  const code = await publicClient.getCode({ address: addr as `0x${string}` });
  const ok = code && code !== "0x";
  console.log(`  ${ok ? "✓" : "✗"} ${name.padEnd(20)} ${addr}${ok ? "" : "  (no code at address!)"}`);
}

const normalizedKey = (
  privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
) as `0x${string}`;
const deployerAddress = privateKeyToAccount(normalizedKey).address;

const deploymentsPath = resolve(root, "deployments-mainnet.json");
let deployments: Record<string, any> = {};
try {
  deployments = JSON.parse(readFileSync(deploymentsPath, "utf-8"));
} catch {
  // start fresh
}

deployments.mainnet = {
  chainId,
  rpc,
  deployedAt: new Date().toISOString(),
  deployer: deployerAddress,
  contracts,
};

writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
console.log(`\n✓ ${deploymentsPath} updated`);

console.log("\n=== Vercel env block (paste into Vercel project settings) ===\n");
console.log(`NEXT_PUBLIC_ZERO_G_RPC_URL=${rpc}`);
console.log(`NEXT_PUBLIC_ZERO_G_CHAIN_ID=${chainId}`);
console.log(`NEXT_PUBLIC_LINEAGE_REGISTRY_ADDRESS=${contracts.LineageRegistry}`);
console.log(`NEXT_PUBLIC_DATA_INFT_ADDRESS=${contracts.DataINFT}`);
console.log(`NEXT_PUBLIC_MODEL_INFT_ADDRESS=${contracts.ModelINFT}`);
console.log(`NEXT_PUBLIC_SKILL_INFT_ADDRESS=${contracts.SkillINFT}`);
console.log(
  `NEXT_PUBLIC_ATTRIBUTION_VERIFIER_ADDRESS=${contracts.AttributionVerifier}`,
);
console.log(
  `NEXT_PUBLIC_ROYALTY_SPLITTER_ADDRESS=${contracts.RoyaltySplitter}`,
);
console.log("");
