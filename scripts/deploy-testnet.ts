/**
 * Deploys all Lineage contracts to 0G testnet (or local anvil) via forge
 * and writes addresses to deployments.json.
 *
 * Prerequisites:
 *   - PRIVATE_KEY in .env
 *   - ZERO_G_RPC_URL in .env (defaults to 0G testnet)
 *   - foundry installed
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const contractsRoot = resolve(__dirname, "..", "contracts");

// Load .env
try {
  const env = readFileSync(resolve(root, ".env"), "utf-8");
  for (const line of env.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    process.env[key] = val;
  }
} catch {
  // no .env file, rely on environment
}

const rpc = process.env["ZERO_G_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai";
const privateKey = process.env["PRIVATE_KEY"];

if (!privateKey) {
  console.error("Error: PRIVATE_KEY not set. Add it to .env");
  process.exit(1);
}

console.log(`Deploying to: ${rpc}`);

// Run forge script
let output: string;
try {
  output = execSync(
    `forge script script/Deploy.s.sol:Deploy \
      --rpc-url "${rpc}" \
      --broadcast \
       --legacy \
      --gas-price 3000000000 \
      --private-key "${privateKey}"`,
    { cwd: contractsRoot, encoding: "utf-8" }
  );
  console.log(output);
} catch (e: any) {
  console.error("forge script failed:", e.message);
  process.exit(1);
}

// Parse addresses from forge output
function parseAddr(label: string): string {
  const regex = new RegExp(`${label}:\\s*(0x[0-9a-fA-F]{40})`);
  const m = output.match(regex);
  if (!m) throw new Error(`Could not find ${label} in forge output`);
  return m[1]!;
}

const contracts = {
  LineageRegistry:    parseAddr("LineageRegistry"),
  DataINFT:           parseAddr("DataINFT"),
  ModelINFT:          parseAddr("ModelINFT"),
  SkillINFT:          parseAddr("SkillINFT"),
  AttributionVerifier: parseAddr("AttributionVerifier"),
  RoyaltySplitter:    parseAddr("RoyaltySplitter"),
};

// Read current deployments.json and update testnet section
const deploymentsPath = resolve(root, "deployments.json");
let deployments: Record<string, any> = {};
try {
  deployments = JSON.parse(readFileSync(deploymentsPath, "utf-8"));
} catch {
  // start fresh
}

deployments.testnet = {
  chainId: rpc.includes("testnet.0g.ai") ? 16602 : 31337,
  rpc,
  deployedAt: new Date().toISOString(),
  contracts,
};

writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
console.log("\n✓ deployments.json updated:");
console.log(JSON.stringify(contracts, null, 2));
