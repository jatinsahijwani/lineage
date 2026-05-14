/**
 * Mints demo iNFTs on the testnet:
 *   - 3 DataINFTs (Alice's dataset, Bob's dataset, Carol's dataset)
 *   - 1 ModelINFT trained on Alice's + Bob's data (70/30 split)
 *   - 1 SkillINFT (web-search tool, depends on Model)
 *
 * On success, writes a deterministic `scripts/seed-output.json` manifest the
 * Next.js app consumes to wire `DEMO_AGENTS` to the real on-chain token ids.
 *
 * Requires: PRIVATE_KEY and contract addresses in .env
 */

 import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { LineageClient } from "../packages/sdk/src/client.js";
import { zeroGTestnet } from "../app/lib/wagmi.js";
import deployments from "../deployments.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));

const pk = (process.env["PRIVATE_KEY"] ?? "") as `0x${string}`;
if (!pk || pk === "0x") {
  console.error("Set PRIVATE_KEY in .env");
  process.exit(1);
}

const account = privateKeyToAccount(pk);
const wallet = createWalletClient({ account, transport: http(process.env["ZERO_G_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai") });

const contracts = deployments.testnet.contracts;
const client = new LineageClient({
  rpc: process.env["ZERO_G_RPC_URL"] ?? "https://evmrpc-testnet.0g.ai",
  storage: process.env["ZERO_G_STORAGE_URL"] ?? "",
  da: process.env["ZERO_G_DA_URL"] ?? "",
  compute: process.env["ZERO_G_COMPUTE_URL"] ?? "",
  registry:  contracts.LineageRegistry     as `0x${string}`,
  dataINFT:  contracts.DataINFT            as `0x${string}`,
  modelINFT: contracts.ModelINFT           as `0x${string}`,
  skillINFT: contracts.SkillINFT           as `0x${string}`,
  splitter:  contracts.RoyaltySplitter     as `0x${string}`,
  verifier:  contracts.AttributionVerifier as `0x${string}`,
  teePublicKey: "0x0000000000000000000000000000000000000000",
  mockTEE: true,
});

// Mint specs — these are the single source of truth for both the on-chain
// mint calls and the off-chain seed-output.json manifest. Don't duplicate
// names/royaltyBps below.
const DATASETS = [
  { name: "Alice's News Headlines Dataset", data: "headline1,headline2,headline3", royaltyBps: 200 },
  { name: "Bob's Financial Data",           data: "price1,price2,price3",           royaltyBps: 300 },
  { name: "Carol's Sentiment Data",         data: "positive,negative,neutral",      royaltyBps: 150 },
] as const;

const MODEL_SPEC = {
  name: "NewsModel-v1",
  weights: "fake-model-weights-v1",
  royaltyBps: 500,
  ownerSplitBps: 6000,
} as const;

const SKILL_SPEC = {
  name: "WebSearch",
  artifact: '{"name":"web-search","description":"Searches the web for recent news"}',
  royaltyBps: 200,
  ownerSplitBps: 5000,
} as const;

const AGENT_SPEC = {
  id: "news-summarizer",
  name: "News Summarizer",
  description: "Summarises news articles using a web-search skill.",
} as const;

interface TokenEntry {
  id: string;
  name: string;
  owner: `0x${string}`;
  royaltyBps: number;
}

interface SeedOutput {
  deployer: `0x${string}`;
  mintedAt: string;
  tokens: {
    data: TokenEntry[];
    model: TokenEntry[];
    skill: TokenEntry[];
    memory: TokenEntry[];
  };
  agents: Array<{
    id: string;
    name: string;
    description: string;
    modelTokenId: string;
    skills: string[];
    data: string[];
    memory: string[];
  }>;
}

async function seed() {
  console.log("Seeding testnet with demo iNFTs…\n");

  // 3 DataINFTs
  const dataIds: bigint[] = [];
  for (const ds of DATASETS) {
    const blob = new TextEncoder().encode(ds.data);
    const { tokenId } = await client.mintData({
      blob,
      encrypt: true,
      royaltyBps: ds.royaltyBps,
      ownerSplitBps: 8000,
      wallet,
      account,
    });
    dataIds.push(tokenId);
    console.log(`DataINFT "${ds.name}" → tokenId ${tokenId}`);
  }

  // 1 ModelINFT trained on Alice's + Bob's data
  const modelBlob = new TextEncoder().encode(MODEL_SPEC.weights);
  const { tokenId: modelId } = await client.mintModel({
    weights: modelBlob,
    encrypt: true,
    parents: [
      { tokenId: dataIds[0]!, weightBps: 7000, edgeType: "TrainedOn" },
      { tokenId: dataIds[1]!, weightBps: 3000, edgeType: "TrainedOn" },
    ],
    royaltyBps: MODEL_SPEC.royaltyBps,
    ownerSplitBps: MODEL_SPEC.ownerSplitBps,
    wallet,
    account,
  });
  console.log(`ModelINFT "${MODEL_SPEC.name}" → tokenId ${modelId}`);

  // 1 SkillINFT
  const skillBlob = new TextEncoder().encode(SKILL_SPEC.artifact);
  const { tokenId: skillId } = await client.mintSkill({
    artifact: skillBlob,
    encrypt: false,
    parents: [
      { tokenId: modelId, weightBps: 10000, edgeType: "Composes" },
    ],
    royaltyBps: SKILL_SPEC.royaltyBps,
    ownerSplitBps: SKILL_SPEC.ownerSplitBps,
    wallet,
    account,
  });
  console.log(`SkillINFT "${SKILL_SPEC.name}" → tokenId ${skillId}`);

  console.log("\nSeed complete!");
  console.log("iNFT IDs:", { data: dataIds.map(String), model: modelId.toString(), skill: skillId.toString() });

  // ---- write scripts/seed-output.json ----
  const owner = account.address;
  const output: SeedOutput = {
    deployer: owner,
    mintedAt: new Date().toISOString(),
    tokens: {
      data: DATASETS.map((ds, i) => ({
        id: dataIds[i]!.toString(),
        name: ds.name,
        owner,
        royaltyBps: ds.royaltyBps,
      })),
      model: [
        {
          id: modelId.toString(),
          name: MODEL_SPEC.name,
          owner,
          royaltyBps: MODEL_SPEC.royaltyBps,
        },
      ],
      skill: [
        {
          id: skillId.toString(),
          name: SKILL_SPEC.name,
          owner,
          royaltyBps: SKILL_SPEC.royaltyBps,
        },
      ],
      memory: [],
    },
    agents: [
      {
        id: AGENT_SPEC.id,
        name: AGENT_SPEC.name,
        description: AGENT_SPEC.description,
        modelTokenId: modelId.toString(),
        skills: [skillId.toString()],
        data: dataIds.map((id) => id.toString()),
        memory: [],
      },
    ],
  };

  const outPath = resolve(__dirname, "seed-output.json");
  await writeFile(outPath, JSON.stringify(output, null, 2) + "\n", "utf-8");
  console.log("wrote scripts/seed-output.json");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
