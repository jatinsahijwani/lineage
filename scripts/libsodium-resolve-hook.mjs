// Resolve hook: redirect "libsodium-wrappers" to its CJS bundle. See
// libsodium-shim.mjs for context.

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "libsodium-wrappers") {
    try {
      const cjsPath = require.resolve("libsodium-wrappers");
      return {
        url: pathToFileURL(cjsPath).href,
        format: "commonjs",
        shortCircuit: true,
      };
    } catch {
      // fall through to default resolution
    }
  }
  return nextResolve(specifier, context);
}
