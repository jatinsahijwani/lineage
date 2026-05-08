/**
 * Mints demo iNFTs on the testnet:
 *   - 3 DataINFTs (Alice's dataset, Bob's dataset, Carol's dataset)
 *   - 1 ModelINFT trained on Alice's + Bob's data (70/30 split)
 *   - 1 SkillINFT (web-search tool, depends on Model)
 *
 * Requires: PRIVATE_KEY and contract addresses in .env
 */

 import "dotenv/config";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { LineageClient } from "../packages/sdk/src/client.js";
import { zeroGTestnet } from "../app/lib/wagmi.js";
import deployments from "../deployments.json" with { type: "json" };

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

async function seed() {
  console.log("Seeding testnet with demo iNFTs…\n");

  // 3 DataINFTs
  const datasets = [
    { name: "Alice's News Headlines Dataset", data: "headline1,headline2,headline3", royaltyBps: 200 },
    { name: "Bob's Financial Data", data: "price1,price2,price3", royaltyBps: 300 },
    { name: "Carol's Sentiment Data", data: "positive,negative,neutral", royaltyBps: 150 },
  ];

  const dataIds: bigint[] = [];
  for (const ds of datasets) {
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
  const modelBlob = new TextEncoder().encode("fake-model-weights-v1");
  const { tokenId: modelId } = await client.mintModel({
    weights: modelBlob,
    encrypt: true,
    parents: [
      { tokenId: dataIds[0]!, weightBps: 7000, edgeType: "TrainedOn" },
      { tokenId: dataIds[1]!, weightBps: 3000, edgeType: "TrainedOn" },
    ],
    royaltyBps: 500,
    ownerSplitBps: 6000,
    wallet,
    account,
  });
  console.log(`ModelINFT "NewsModel-v1" → tokenId ${modelId}`);

  // 1 SkillINFT
  const skillBlob = new TextEncoder().encode('{"name":"web-search","description":"Searches the web for recent news"}');
  const { tokenId: skillId } = await client.mintSkill({
    artifact: skillBlob,
    encrypt: false,
    parents: [
      { tokenId: modelId, weightBps: 10000, edgeType: "Composes" },
    ],
    royaltyBps: 200,
    ownerSplitBps: 5000,
    wallet,
    account,
  });
  console.log(`SkillINFT "WebSearch" → tokenId ${skillId}`);

  console.log("\nSeed complete!");
  console.log("iNFT IDs:", { data: dataIds.map(String), model: modelId.toString(), skill: skillId.toString() });
}

seed().catch(console.error);
