/**
 * Lineage end-to-end dual-attestation demo on local anvil.
 *
 * Pipeline:
 *   1. Pre-flight checks (anvil + forge available).
 *   2. Deploy all 6 contracts via `forge script Deploy.s.sol`.
 *   3. Seed the deployer as a trusted operator on AttributionVerifier.
 *   4. Mint a 3-iNFT lineage (Data -> Model -> Skill).
 *   5. Build and post a dual-attested AttributionReceipt
 *      (TEE-signed compute proof + operator-signed lineage block).
 *   6. Register the ephemeral mock-TEE signer as trusted.
 *   7. Run the settler with on-chain trust source so receipts pass off-chain
 *      verification before Merkle aggregation.
 *   8. Pre-fund the splitter, then claim royalties using the proof.
 *   9. Print a clean summary.
 *
 * Prerequisite (the user must run this in another terminal first):
 *   anvil --port 8545
 */

// E2E demo runs entirely on local anvil. Force the runner's mock-TEE path
// before any module that reads MOCK_TEE at import time loads. The default
// flipped from "mock if not set" to "real 0G Compute if not set" in gate 1
// (see services/runner/README.md).
process.env["MOCK_TEE"] = "1";

import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { LineageClient } from "../packages/sdk/src/client.js";
import type { LineageNode } from "../packages/sdk/src/lineage-graph.js";
import { buildAndPostReceipt } from "../services/runner/src/receipt-builder.js";
import { MemoryReceiptSink } from "../services/runner/src/receipt-sink.js";
import {
  runSettlement,
  makeChainTrustedSource,
} from "../services/settler/src/index.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANVIL_RPC = "http://127.0.0.1:8545";
// Canonical first anvil account. NOT the user's testnet PRIVATE_KEY from .env —
// this script always runs against local anvil.
const ANVIL_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as `0x${string}`;
const PAYMENT_TOKEN =
  "0x0000000000000000000000000000000000000000" as `0x${string}`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

// ABIs
const VERIFIER_ABI = [
  {
    name: "setTrustedTEESigner",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "signer", type: "address" },
      { name: "trusted", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "setTrustedOperator",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "trusted", type: "bool" },
    ],
    outputs: [],
  },
] as const;

// ---------------------------------------------------------------------------
// Pre-flight helpers
// ---------------------------------------------------------------------------

async function checkAnvil(): Promise<void> {
  try {
    const res = await fetch(ANVIL_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
    });
    const json = (await res.json()) as { result?: string };
    const chainId = json.result ? parseInt(json.result, 16) : NaN;
    if (chainId !== 31337) {
      throw new Error(
        `anvil chainId ${chainId} != 31337 — start anvil first: anvil --port 8545`,
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`anvil unreachable at ${ANVIL_RPC}: ${msg}\n  start anvil first: anvil --port 8545`);
  }
}

function checkForge(): void {
  try {
    execSync("forge --version", { stdio: "ignore" });
  } catch {
    // Try foundry's default install location.
    const home = process.env["HOME"] ?? "";
    const foundryBin = `${home}/.foundry/bin`;
    process.env["PATH"] = `${foundryBin}:${process.env["PATH"] ?? ""}`;
    try {
      execSync("forge --version", { stdio: "ignore" });
    } catch {
      throw new Error(
        "forge not on PATH and not at ~/.foundry/bin — install foundry: https://getfoundry.sh",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Deploy helpers
// ---------------------------------------------------------------------------

interface DeployedContracts {
  LineageRegistry: `0x${string}`;
  DataINFT: `0x${string}`;
  ModelINFT: `0x${string}`;
  SkillINFT: `0x${string}`;
  AttributionVerifier: `0x${string}`;
  RoyaltySplitter: `0x${string}`;
}

function deployContracts(): DeployedContracts {
  console.log("[deploy] running forge script Deploy.s.sol on anvil...");
  let output: string;
  try {
    output = execSync(
      `forge script script/Deploy.s.sol:Deploy --rpc-url ${ANVIL_RPC} --broadcast --private-key ${ANVIL_KEY}`,
      {
        cwd: resolve(REPO_ROOT, "contracts"),
        encoding: "utf-8",
        env: { ...process.env, PRIVATE_KEY: ANVIL_KEY },
      },
    );
  } catch (err: unknown) {
    const e = err as { message?: string; stdout?: string; stderr?: string };
    console.error("[deploy] forge script failed");
    if (e.stdout) console.error(e.stdout);
    if (e.stderr) console.error(e.stderr);
    throw new Error(`forge script failed: ${e.message ?? "unknown"}`);
  }

  function parseAddr(label: string): `0x${string}` {
    const re = new RegExp(`${label}:\\s*(0x[0-9a-fA-F]{40})`);
    const m = output.match(re);
    if (!m || !m[1]) {
      throw new Error(`could not find ${label} in forge output`);
    }
    return m[1] as `0x${string}`;
  }

  return {
    LineageRegistry: parseAddr("LineageRegistry"),
    DataINFT: parseAddr("DataINFT"),
    ModelINFT: parseAddr("ModelINFT"),
    SkillINFT: parseAddr("SkillINFT"),
    AttributionVerifier: parseAddr("AttributionVerifier"),
    RoyaltySplitter: parseAddr("RoyaltySplitter"),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("=== Lineage E2E (dual-attestation) — booting ===\n");

  // ---- step 1: pre-flight checks ----
  checkForge();
  await checkAnvil();
  console.log("[preflight] anvil reachable, forge available\n");

  const account = privateKeyToAccount(ANVIL_KEY);
  const wallet = createWalletClient({ account, transport: http(ANVIL_RPC) });
  const publicClient = createPublicClient({ transport: http(ANVIL_RPC) });

  // ---- step 2: deploy contracts ----
  const contracts = deployContracts();
  console.log("[deploy] addresses parsed:");
  for (const [name, addr] of Object.entries(contracts)) {
    console.log(`         ${name}: ${addr}`);
  }
  console.log("");

  // ---- step 3: seed trusted operator ----
  console.log("[seed] registering deployer as trusted operator...");
  {
    const hash = await wallet.writeContract({
      address: contracts.AttributionVerifier,
      abi: VERIFIER_ABI,
      functionName: "setTrustedOperator",
      args: [account.address, true],
      account,
      chain: undefined,
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
  console.log(`[seed] operator ${account.address} trusted\n`);

  // ---- step 4: mint 3-iNFT lineage ----
  const clientConfig = {
    rpc: ANVIL_RPC,
    storage: "",
    da: "",
    compute: "",
    registry: contracts.LineageRegistry,
    dataINFT: contracts.DataINFT,
    modelINFT: contracts.ModelINFT,
    skillINFT: contracts.SkillINFT,
    splitter: contracts.RoyaltySplitter,
    verifier: contracts.AttributionVerifier,
    teePublicKey: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    mockTEE: true,
  };
  const lineage = new LineageClient(clientConfig);

  console.log("[mint] DataINFT...");
  const { tokenId: dataTokenId } = await lineage.mintData({
    blob: new TextEncoder().encode("news-headlines-dataset"),
    encrypt: false,
    royaltyBps: 200,
    ownerSplitBps: 8000,
    wallet,
    account,
  });
  console.log(`       tokenId=${dataTokenId}`);

  console.log("[mint] ModelINFT...");
  const { tokenId: modelTokenId } = await lineage.mintModel({
    weights: new TextEncoder().encode("model-weights"),
    encrypt: false,
    parents: [
      { tokenId: dataTokenId, weightBps: 10000, edgeType: "TrainedOn" },
    ],
    royaltyBps: 500,
    ownerSplitBps: 6000,
    wallet,
    account,
  });
  console.log(`       tokenId=${modelTokenId}`);

  console.log("[mint] SkillINFT...");
  const { tokenId: skillTokenId } = await lineage.mintSkill({
    artifact: new TextEncoder().encode("skill-artifact"),
    encrypt: false,
    parents: [
      { tokenId: modelTokenId, weightBps: 10000, edgeType: "Composes" },
    ],
    royaltyBps: 200,
    ownerSplitBps: 5000,
    wallet,
    account,
  });
  console.log(`       tokenId=${skillTokenId}\n`);

  // ---- step 5: build dual-attested receipt ----
  console.log("[receipt] building dual-attested receipt (mock TEE)...");
  const sink = new MemoryReceiptSink();
  const inferenceId = `inf-${Date.now()}`;
  const { receipt, daPointer } = await buildAndPostReceipt(
    {
      inferenceId,
      agentId: account.address,
      agentRunner: account.address,
      input: "Summarize today's news",
      output: "[mock summary]",
      agentOperator: account.address,
      operatorPrivateKey: ANVIL_KEY,
      model: { tokenId: modelTokenId.toString(), weight: 0.6 },
      skills: [{ tokenId: skillTokenId.toString(), weight: 0.3 }],
      memory: [],
      data: [{ tokenId: dataTokenId.toString(), weight: 0.1 }],
      mockTEE: true,
    },
    sink,
  );
  const teeSigner = receipt.computeProof.attestation!.signing_address;
  console.log(`[receipt] commitment=${daPointer.commitment} blobIndex=${daPointer.blobIndex}`);
  console.log(`[receipt] ephemeral TEE signer=${teeSigner}\n`);

  // ---- step 6: register ephemeral TEE signer as trusted ----
  console.log("[seed] registering ephemeral TEE signer as trusted...");
  {
    const hash = await wallet.writeContract({
      address: contracts.AttributionVerifier,
      abi: VERIFIER_ABI,
      functionName: "setTrustedTEESigner",
      args: [teeSigner, true],
      account,
      chain: undefined,
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
  console.log("[seed] TEE signer trusted\n");

  // ---- step 7: build node/owner maps and run settlement ----
  console.log("[settle] reading lineage graph from registry...");
  const nodeMap = new Map<bigint, LineageNode>();
  const ownerMap = new Map<bigint, `0x${string}`>();

  for (const tokenId of [dataTokenId, modelTokenId, skillTokenId]) {
    const { record, parents, policy } = await lineage.getLineageGraph(tokenId);
    const r = record as { owner: `0x${string}` };
    const p = policy as { totalRoyaltyBps: number; ownerSplitBps: number };
    const edges = parents as Array<{
      child: bigint;
      parent: bigint;
      weightBps: number;
      eType: number;
    }>;
    const edgeNames = ["TrainedOn", "FineTunedFrom", "Composes", "DependsOn"] as const;
    nodeMap.set(tokenId, {
      tokenId,
      ownerSplitBps: p.ownerSplitBps,
      totalRoyaltyBps: p.totalRoyaltyBps,
      edges: edges.map((e) => ({
        child: e.child,
        parent: e.parent,
        weightBps: e.weightBps,
        eType: edgeNames[e.eType] ?? "TrainedOn",
      })),
    });
    ownerMap.set(tokenId, r.owner);
  }

  console.log("[settle] running settlement with on-chain trust source...");
  const trustedSource = makeChainTrustedSource({
    rpc: ANVIL_RPC,
    verifierAddress: contracts.AttributionVerifier,
  });

  const windowEnd = BigInt(Math.floor(Date.now() / 1000));
  const windowStart = windowEnd - 3600n;
  const totalRevenuePerReceipt = parseEther("0.001");

  const { hash: batchHash, root, payouts, proofCache } = await runSettlement({
    batchId: 1n,
    receipts: [receipt],
    windowStart,
    windowEnd,
    daPointer,
    totalRevenuePerReceipt,
    paymentToken: PAYMENT_TOKEN,
    splitterAddress: contracts.RoyaltySplitter,
    rpc: ANVIL_RPC,
    privateKey: ANVIL_KEY,
    nodeMap,
    ownerMap,
    verifier: trustedSource,
  });
  await publicClient.waitForTransactionReceipt({ hash: batchHash });

  console.log(`[settle] merkle root=${root}`);
  console.log(`[settle] batch tx=${batchHash}`);
  console.log(`[settle] payouts: ${payouts.length}`);
  for (const p of payouts) {
    console.log(`         ${p.recipient} -> ${formatEther(p.amount)} ETH`);
  }
  console.log("");

  // ---- step 8: pre-fund splitter and claim ----
  console.log("[fund] pre-funding splitter with 0.1 ETH...");
  {
    const hash = await wallet.sendTransaction({
      to: contracts.RoyaltySplitter,
      value: parseEther("0.1"),
      account,
      chain: undefined,
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  // The deployer owns all 3 iNFTs, so all royalty flows to the deployer.
  const deployerPayout = payouts.find(
    (p) => p.recipient.toLowerCase() === account.address.toLowerCase(),
  );
  if (!deployerPayout) {
    throw new Error("expected a payout entry for the deployer (owner of all 3 iNFTs)");
  }
  const proofKey = `${deployerPayout.recipient}:1`;
  const proof = proofCache.get(proofKey);
  if (!proof) {
    throw new Error(`no merkle proof in cache for key ${proofKey}`);
  }

  console.log("[claim] submitting claim...");
  const claimHash = await lineage.claim({
    batchId: 1n,
    token: PAYMENT_TOKEN,
    amount: deployerPayout.amount,
    proof,
    wallet,
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: claimHash });
  console.log(`[claim] tx=${claimHash}\n`);

  // ---- step 9: summary ----
  console.log("=== Lineage E2E (dual-attestation) ===");
  console.log(`  Deployer / operator:  ${account.address}`);
  console.log(`  LineageRegistry:      ${contracts.LineageRegistry}`);
  console.log(`  RoyaltySplitter:      ${contracts.RoyaltySplitter}`);
  console.log(`  AttributionVerifier:  ${contracts.AttributionVerifier}`);
  console.log(`  DataINFT:             #${dataTokenId}`);
  console.log(`  ModelINFT:            #${modelTokenId}`);
  console.log(`  SkillINFT:            #${skillTokenId}`);
  console.log(`  Receipt commitment:   ${daPointer.commitment} (blobIndex ${daPointer.blobIndex})`);
  console.log(`  TEE signer:           ${teeSigner} (ephemeral, registered as trusted)`);
  console.log(`  Operator:             ${account.address} (registered as trusted)`);
  console.log(`  Off-chain verify:     ok`);
  console.log(`  Merkle root:          ${root}`);
  console.log(`  Batch tx:             ${batchHash}`);
  console.log(`  Payout to deployer:   ${formatEther(deployerPayout.amount)} ETH`);
  console.log(`  Claim tx:             ${claimHash}`);
  console.log("=== E2E complete ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
