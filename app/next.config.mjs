import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

// libsodium-wrappers@0.7.16 ships a broken ESM bundle (its `files` whitelist
// omits dist/modules-esm/libsodium.mjs internally), but the CJS bundle works.
// The bundler would otherwise resolve the ESM entry from `exports`, fail on a
// missing module, and the SDK chain (@lineage/sdk -> @lineage/crypto) breaks.
// Force-resolve to the CJS bundle. Mirrors scripts/libsodium-resolve-hook.mjs.
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let libsodiumCjsAbs;
try {
  libsodiumCjsAbs = require.resolve("libsodium-wrappers", {
    paths: [path.resolve(__dirname, "../packages/crypto")],
  });
} catch {
  libsodiumCjsAbs = path.resolve(
    __dirname,
    "../node_modules/.pnpm/libsodium-wrappers@0.7.16/node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js",
  );
}
// Turbopack's resolveAlias requires project-relative paths beginning with "./".
const libsodiumCjsRel = "./" + path.relative(__dirname, libsodiumCjsAbs);

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Tell Next.js to trace files one level up (the monorepo root) so that
  // workspace packages in packages/ and services/ are included in the
  // serverless function bundles that Vercel deploys.
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  // Next.js 16 uses Turbopack by default. Turbopack's resolveAlias supports
  // project-relative file paths beginning with "./".
  turbopack: {
    resolveAlias: {
      "libsodium-wrappers": libsodiumCjsRel,
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "libsodium-wrappers": libsodiumCjsAbs,
    };
    return config;
  },
};

export default nextConfig;