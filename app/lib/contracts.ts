/**
 * Frontend contract address loader.
 *
 * IMPORTANT:
 * Next.js client-side env vars must be accessed statically.
 * Dynamic access like process.env[key] breaks in browser bundles.
 */

type Hex = `0x${string}`;

export const CONTRACT_ADDRESSES = {
  LineageRegistry:
    process.env.NEXT_PUBLIC_LINEAGE_REGISTRY_ADDRESS as Hex,

  DataINFT:
    process.env.NEXT_PUBLIC_DATA_INFT_ADDRESS as Hex,

  ModelINFT:
    process.env.NEXT_PUBLIC_MODEL_INFT_ADDRESS as Hex,

  SkillINFT:
    process.env.NEXT_PUBLIC_SKILL_INFT_ADDRESS as Hex,

  RoyaltySplitter:
    process.env.NEXT_PUBLIC_ROYALTY_SPLITTER_ADDRESS as Hex,

  AttributionVerifier:
    process.env.NEXT_PUBLIC_ATTRIBUTION_VERIFIER_ADDRESS as Hex,
} as const;

// Runtime validation
for (const [name, value] of Object.entries(CONTRACT_ADDRESSES)) {
  if (!value) {
    throw new Error(
      `Missing env for contract address: ${name}. Check app/.env.local`,
    );
  }
}

export type ContractAddresses = typeof CONTRACT_ADDRESSES;