"use client";

import deployments from "../../deployments.json";

const testnet = deployments.testnet.contracts;

export const CONTRACT_ADDRESSES = {
  registry:  (testnet.LineageRegistry    || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  dataINFT:  (testnet.DataINFT           || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  modelINFT: (testnet.ModelINFT          || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  skillINFT: (testnet.SkillINFT          || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  splitter:  (testnet.RoyaltySplitter    || "0x0000000000000000000000000000000000000000") as `0x${string}`,
  verifier:  (testnet.AttributionVerifier|| "0x0000000000000000000000000000000000000000") as `0x${string}`,
} as const;
