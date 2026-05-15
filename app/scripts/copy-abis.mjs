#!/usr/bin/env node
/**
 * Re-extract contract ABIs from `contracts/out/*.sol/*.json` into
 * `app/lib/abis/*.ts`. Run this after `forge build` in the contracts/ workspace.
 *
 * Usage:
 *   node app/scripts/copy-abis.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../");
const OUT_DIR = resolve(__dirname, "../lib/abis");

const CONTRACTS = [
  ["LineageRegistry", "lineage-registry", "LINEAGE_REGISTRY_ABI"],
  ["DataINFT", "data-inft", "DATA_INFT_ABI"],
  ["ModelINFT", "model-inft", "MODEL_INFT_ABI"],
  ["SkillINFT", "skill-inft", "SKILL_INFT_ABI"],
  ["RoyaltySplitter", "royalty-splitter", "ROYALTY_SPLITTER_ABI"],
  ["AttributionVerifier", "attribution-verifier", "ATTRIBUTION_VERIFIER_ABI"],
];

mkdirSync(OUT_DIR, { recursive: true });

const indexLines = ["// Re-export all contract ABIs."];

for (const [solName, fileStub, constName] of CONTRACTS) {
  const src = resolve(REPO_ROOT, `contracts/out/${solName}.sol/${solName}.json`);
  const data = JSON.parse(readFileSync(src, "utf8"));
  const body = JSON.stringify(data.abi, null, 2);
  const content = `// Auto-extracted from contracts/out/${solName}.sol/${solName}.json\n// Do not edit by hand. Re-run app/scripts/copy-abis.mjs to regenerate.\n\nexport const ${constName} = ${body} as const;\n`;
  writeFileSync(resolve(OUT_DIR, `${fileStub}.ts`), content);
  indexLines.push(`export { ${constName} } from "./${fileStub}";`);
  console.log(`wrote ${fileStub}.ts`);
}

writeFileSync(resolve(OUT_DIR, "index.ts"), indexLines.join("\n") + "\n");
console.log("wrote index.ts");
