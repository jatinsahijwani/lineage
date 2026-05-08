# @lineage/runner

The runner produces dual-attested `AttributionReceipt`s for inferences served
by the 0G Compute chatbot service (`qwen-2.5-7b-instruct` on
`compute-network-6.integratenetwork.work`) and posts them to a
`ReceiptSink` (`StorageReceiptSink` for production, `MemoryReceiptSink` for
local anvil demos).

A receipt carries two independent signatures:

1. **TEE attestation** — produced by 0G Compute's TEE signer
   (`ZG_CHATBOT_SERVICE.teeSignerAddress`). Covers a 5-field colon-separated
   canonical text:
   `<inputHash>:<outputHash>:<providerType>:<providerIdentity>:<tlsCertFingerprint>`.
2. **Operator lineage signature** — produced by the agent operator's EOA over
   the canonical CBOR of the `AgentLineageAttestation` (model + skills +
   memory + data weights). EIP-191 personal_sign.

Both must verify before the on-chain `AttributionVerifier` will count the
receipt toward a settlement window.

## Auth flow

`broker.inference.getRequestHeaders(provider, content)` produces a JWT-style
header signed by the operator wallet. The unsigned payload is JSON:

```
{ address, provider, timestamp, expiresAt, nonce, generation, tokenId }
```

base64-encoded and concatenated with the wallet signature:

```
Authorization: Bearer app-sk-<base64-payload>|<wallet-signature>
```

Do NOT reimplement this — let the SDK sign it. See
`scripts/smoke-output.json` (`probes["compute.invoke"].response.requestHeaders`)
for a verified example.

## Inference call

POST to `${meta.endpoint}${ZG_INFERENCE_QUIRKS.chatCompletionsPath}` — i.e.
`${endpoint}/chat/completions`, **NOT** `${endpoint}/v1/chat/completions`.
The endpoint URL returned by `getServiceMetadata` already includes
`/v1/proxy`; appending `/v1/chat/completions` yields a 400.

Request body:

```jsonc
{
  "messages": [{ "role": "user", "content": "<input>" }],
  "model": "<meta.model>",         // "qwen2.5-7b-instruct" — note: differs
                                    // from the listing identifier
                                    // "qwen/qwen-2.5-7b-instruct"
  "max_tokens": 256,
  "temperature": 0
}
```

Curl-equivalent:

```bash
curl -X POST "https://compute-network-6.integratenetwork.work/v1/proxy/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer app-sk-..." \
  --data '{"messages":[{"role":"user","content":"Hi"}],"model":"qwen2.5-7b-instruct","max_tokens":8,"temperature":0}'
```

## Async TEE signature retrieval

The TEE signs the response asynchronously. Capture the **`zg-res-key`**
response header from the chat-completions call, then poll:

```
GET ${endpoint}/signature/${zg-res-key}
```

The SDK's `broker.inference.getChatSignatureDownloadLink(provider, chatId)`
builds the URL with `chatId` (`chatcmpl-<uuid>`) — that returns
`chat_id_not_found`. Always use the `zg-res-key` header value; this is the
documented SDK lie.

`invokeChatbot()` polls with an 8000ms total budget by default (configurable
via `signaturePollTimeoutMs`); first attempt is immediate, then 500ms, then
1000ms; max ~10 attempts.

## Local verification

`invokeChatbot()` runs three checks before returning:

1. `recoverMessageAddress({message: attestation.text, signature: attestation.signature})`
   equals `attestation.signing_address`. Throws otherwise.
2. `attestation.signing_address` equals `ZG_CHATBOT_SERVICE.teeSignerAddress`.
   Throws otherwise — protects against a hijacked provider.
3. Digest-binding probe: `sha256(input)` and `sha256(output)` compared to the
   first two `:`-separated fields of `attestation.text`. The TEE may
   canonicalize differently than a plain UTF-8 sha256; if they don't match,
   the runner logs a warning and surfaces the mismatch in `digestBinding`,
   but does NOT throw. The receipt-builder receives `text[0]` / `text[1]` as
   `inputDigestOverride` / `outputDigestOverride`, so the receipt's
   `inputDigest` / `outputDigest` fields always match what the TEE signed —
   which is what the on-chain verifier checks.

The receipt-builder re-runs steps 1 and 3 (defense in depth) before posting.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPERATOR_PRIVATE_KEY` | — | EOA that signs the broker auth header AND the lineage block. Required. |
| `ZERO_G_RPC_URL` | `https://evmrpc-testnet.0g.ai` | RPC for the broker chain (Galileo testnet, chainId 16602). |
| `MOCK_TEE` | unset | Set to `"1"` to bypass real Compute and synthesise a mock attestation with a fresh ephemeral key. Used by anvil e2e and offline tests. The default is **real Compute**. |
| `RECEIPT_SINK` | `storage` | `storage` (real 0G Storage upload) or `da` (stub). |
| `ZERO_G_STORAGE_URL` | `https://indexer-storage-testnet-turbo.0g.ai` | Storage indexer URL. |
| `PRIVATE_KEY` | — | Used by `StorageReceiptSink` to pay storage fees (can be the same key as `OPERATOR_PRIVATE_KEY`). |

## Cost

The operator wallet must have a funded compute ledger entry (≥ 3 OG) before
calls succeed. Establish it once via `pnpm smoke` (which calls
`broker.ledger.addLedger(3)` automatically). Each chat invocation bills
against that ledger at the provider's posted prices
(`inputPrice`/`outputPrice` in `compute.listService`). Ledger funding flows
are out of scope for this gate.

## References

- `scripts/smoke-output.json` — canonical reference for response shapes
  (request headers, response body, signature payload, signatureFetchAttempts).
- `packages/shared/src/0g-testnet.ts` — `ZG_CHATBOT_SERVICE`,
  `ZG_INFERENCE_QUIRKS`.
- `packages/shared/src/index.ts` — `TEEAttestationSchema`,
  `AttributionReceiptSchema`.
