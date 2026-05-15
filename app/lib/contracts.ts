/**
 * Frontend contract address loader.
 *
 * IMPORTANT:
 * Next.js client-side env vars must be accessed statically.
 * Dynamic access like process.env[key] breaks in browser bundles.
 */

type Hex = `0x${string}`;

// Testnet defaults mirror deployments.json so the build (and any preview env
// without explicit NEXT_PUBLIC_* overrides) resolves to working addresses.
const TESTNET_DEFAULTS = {
  LineageRegistry: "0x5Ba9010bf4A6E13F098d1ce5DBAF52c22E21B3f5",
  DataINFT: "0x7986F719737Cbd377Aa436092a0614bda988F18D",
  ModelINFT: "0xb54bcd09aAEfF92369D3f722dC8CBfdD6f861892",
  SkillINFT: "0x90135721Bd43e07955CA1AA5DeD4516CDAf46bcB",
  RoyaltySplitter: "0x4F27E90880E6b28525d7f7Eb8785273F11b0D0DE",
  AttributionVerifier: "0x74A7D64b84F3D36494f0Abf7641Dd79E9dfb986E",
} as const satisfies Record<string, Hex>;

export const CONTRACT_ADDRESSES = {
  LineageRegistry:
    (process.env.NEXT_PUBLIC_LINEAGE_REGISTRY_ADDRESS ||
      TESTNET_DEFAULTS.LineageRegistry) as Hex,

  DataINFT:
    (process.env.NEXT_PUBLIC_DATA_INFT_ADDRESS ||
      TESTNET_DEFAULTS.DataINFT) as Hex,

  ModelINFT:
    (process.env.NEXT_PUBLIC_MODEL_INFT_ADDRESS ||
      TESTNET_DEFAULTS.ModelINFT) as Hex,

  SkillINFT:
    (process.env.NEXT_PUBLIC_SKILL_INFT_ADDRESS ||
      TESTNET_DEFAULTS.SkillINFT) as Hex,

  RoyaltySplitter:
    (process.env.NEXT_PUBLIC_ROYALTY_SPLITTER_ADDRESS ||
      TESTNET_DEFAULTS.RoyaltySplitter) as Hex,

  AttributionVerifier:
    (process.env.NEXT_PUBLIC_ATTRIBUTION_VERIFIER_ADDRESS ||
      TESTNET_DEFAULTS.AttributionVerifier) as Hex,
} as const;

export type ContractAddresses = typeof CONTRACT_ADDRESSES;