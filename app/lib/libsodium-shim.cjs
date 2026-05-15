// Shim that re-exports the libsodium-wrappers CJS bundle directly. The package
// publishes a broken ESM entry (0.7.16 omits dist/modules-esm/libsodium.mjs
// from `files`), so we bypass the package's `exports` map entirely by importing
// the CJS file via its filesystem path and re-exporting it.
//
// Aliased from `libsodium-wrappers` in next.config.mjs (both webpack and
// turbopack `resolveAlias`) so the SDK's @lineage/crypto -> libsodium-wrappers
// import resolves to this file under Next.js bundling.
const sodium = require("libsodium-wrappers/dist/modules/libsodium-wrappers.js");
module.exports = sodium;
module.exports.default = sodium;
