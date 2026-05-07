// libsodium-wrappers@0.7.16 publishes a broken ESM bundle: its package.json
// `files` whitelist omits `dist/modules-esm/libsodium.mjs`, so an ESM import
// of "libsodium-wrappers" fails with ERR_MODULE_NOT_FOUND. The CJS bundle
// (dist/modules/libsodium-wrappers.js) is intact, so we redirect ESM imports
// of the package to the CJS bundle via a Node module-resolve hook.
//
// Used by `scripts/e2e-demo.ts` (transitively imports @lineage/crypto via
// the LineageClient). The runner avoids @lineage/crypto entirely; the SDK
// + the e2e script need this shim until libsodium-wrappers ships a fixed
// ESM bundle.

import { register } from "node:module";

register(new URL("./libsodium-resolve-hook.mjs", import.meta.url));
