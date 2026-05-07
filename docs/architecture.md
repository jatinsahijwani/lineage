# Lineage — Architecture

## Overview

Lineage is a five-layer provenance and royalty protocol for AI agents on 0G. Every dataset, model, and skill is an iNFT; every inference emits a signed attribution receipt on 0G DA; royalties flow to all contributors via a Merkle-batch pull splitter.

```
┌─────────────────────────────────────────────────────────┐
│                   Frontend (Next.js)                    │
│  Mint iNFT  │  Run Inference Demo  │  Claim Earnings   │
└──────────────────────┬──────────────────────────────────┘
                       │ @lineage/sdk
┌──────────────────────▼──────────────────────────────────┐
│               @lineage/sdk  (LineageClient)              │
│  mintData / mintModel / mintSkill / runInference / claim │
└────┬──────────────┬──────────────┬───────────────────────┘
     │              │              │
     ▼              ▼              ▼
  0G Storage    0G DA          0G Chain (EVM)
  (blobs)     (receipts)      contracts
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        LineageRegistry  RoyaltySplitter  iNFTs (DataINFT,
        (on-chain DAG)   (Merkle claims)  ModelINFT, SkillINFT)
```

---

## Layer 1 — Identity (iNFTs on 0G Chain)

All identity lives in five contracts:

| Contract | Role |
|----------|------|
| `LineageRegistry` | Canonical DAG. Global token ID counter. Acyclic enforcement. Royalty policy with 24-hour timelock. |
| `ERC7857Lineage` | Abstract base for all iNFTs. Extends OpenZeppelin ERC-721. Token ID assigned by registry (globally unique across all types). |
| `DataINFT` | Wraps datasets. No parents allowed. |
| `ModelINFT` | Wraps model weights. Parents must be Data or Model. |
| `SkillINFT` | Wraps tools/skills. Parents can be any iNFT type. |
| `RoyaltySplitter` | Merkle-root batch settlement. Pull-only claims. |
| `AttributionVerifier` | ECDSA TEE signature verification. Replay protection. |

**Global token ID space.** The registry owns `_globalIdCounter`. `registerINFT()` increments it and returns the assigned ID, which becomes the ERC-721 `tokenId`. This prevents ID collisions across DataINFT, ModelINFT, and SkillINFT contracts.

**Acyclic enforcement.** On every `registerINFT()` call, `_isAcyclic()` runs a depth-bounded DFS (max depth 32) from each proposed parent to verify no path reaches the new child. This is O(edges) per mint — acceptable for v1 where minting is infrequent.

**Royalty policy timelock.** `updateRoyaltyPolicy()` records a pending update with `pendingEffectiveAt = block.timestamp + 24 hours`. `finalizeRoyaltyUpdate()` applies it only after the delay. This protects active inference batches from a creator suddenly changing their split.

---

## Layer 2 — Storage (0G Storage)

All artifact blobs (weights, datasets, skill artifacts) are uploaded to 0G Storage. The on-chain iNFT stores only the content root (`storageRoot`). 

**Encryption.** Private artifacts are encrypted with `libsodium secretbox` (XSalsa20-Poly1305) before upload. The `encryptedMetaHash` stored on-chain is the SHA-256 of the serialized ciphertext — a commitment without revealing the key.

---

## Layer 3 — Attribution Receipts (0G DA)

Every inference produces an `AttributionReceipt` (JSON, CBOR-encoded for canonical byte representation):

```json
{
  "receiptId":     "<uuid>",
  "model":         { "tokenId": "1", "weight": 0.7 },
  "skills":        [{ "tokenId": "3", "weight": 0.3 }],
  "data":          [],
  "memory":        [],
  "inputDigest":   "0x...",
  "outputDigest":  "0x...",
  "timestamp":     1700000000,
  "computeNodeId": "mock://compute",
  "signature":     "0x..."
}
```

Weights are declared at mint time (v1). They must sum to 1.0 across all contributors.

The receipt is CBOR-encoded (deterministic, canonical) before the TEE signs it. This ensures the on-chain verifier can recompute the digest from the raw bytes.

The settled `RoyaltyPolicy.totalRoyaltyBps` is applied to the payment amount first, then split across contributors proportional to `weight × ownerSplitBps`.

---

## Layer 4 — Settlement (RoyaltySplitter)

**Batch settlement flow:**
1. The settler aggregates receipts in a time window
2. For each receipt, `propagateWeights()` walks the lineage DAG upward, multiplying `ownerSplitBps` fractions
3. Per-contributor amounts accumulate across all receipts
4. A Merkle tree is built (leaf = `keccak256(abi.encodePacked(batchId, recipient, token, amount))`)
5. The operator calls `postBatch()` with the Merkle root
6. Contributors call `claim()` with their proof — pull-only, no push

**Leaf encoding matches the Solidity verifier exactly:**
```
keccak256(abi.encodePacked(batchId_uint256, recipient_address, token_address, amount_uint256))
```
Uint256 values are right-padded to 32 bytes. Address values are 20 bytes.

---

## Layer 5 — Frontend

Three pages:
- `/mint` — drag-drop artifact, declare parents, set royalty sliders, sign mint tx
- `/demo` — pick agent, run query, see receipt + animated royalty ticks
- `/earnings` — show claimable balance, claim all button

Stack: Next.js 14 App Router, wagmi v2, RainbowKit v2, Tailwind CSS.

---

## Data Flow: End-to-End

```
Creator mints DataINFT (blob → 0G Storage, root → 0G Chain)
    ↓
Creator mints ModelINFT (weights → 0G Storage, parents=[DataINFT])
    ↓
Agent calls runInference()
    ↓ (mock TEE or real 0G Compute)
Receipt (CBOR-encoded, TEE-signed) → 0G DA
    ↓ (settler cron, hourly)
Settler reads receipts from DA
    ↓
propagateWeights() on lineage DAG
    ↓
Merkle tree of payouts → postBatch() on-chain
    ↓
Contributors call claim() with Merkle proof
```
