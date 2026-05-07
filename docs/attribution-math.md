# Lineage — Attribution Math

## v1: Declared Weights (No Shapley)

In v1, all attribution weights are declared at mint time. There is no runtime computation of Shapley values or marginal contributions. This is an explicit design choice: Shapley attribution is expensive (exponential in participants) and requires a trusted oracle; declared weights can be verified on-chain in O(1).

---

## Weight Semantics

**`weightBps` on a `LineageEdge`** (0–10000, sums to 10000 per child):

When a ModelINFT lists DataINFT A at `weightBps=7000` and DataINFT B at `weightBps=3000`, it declares:
- 70% of the upstream royalty flow from this model goes to A's subtree
- 30% goes to B's subtree

**`ownerSplitBps` on a `RoyaltyPolicy`** (0–10000):

When a ModelINFT has `ownerSplitBps=6000`, it means:
- 60% of the royalty that reaches this node stays with the model owner
- 40% passes upstream to parent nodes (weighted by `weightBps`)

**`totalRoyaltyBps` on a `RoyaltyPolicy`** (0–10000):

The fraction of each inference payment that goes to this iNFT's royalty pool. For a 2% royalty, `totalRoyaltyBps=200`.

---

## Propagation Algorithm

`propagateWeights(roots, getNode, getOwner)` in `packages/sdk/src/lineage-graph.ts`:

```
function visit(tokenId, incomingWeight):
  node = getNode(tokenId)
  ownerFraction = node.ownerSplitBps / 10000
  upstreamFraction = 1 - ownerFraction

  // Owner keeps ownerFraction of incomingWeight
  ownerShare = incomingWeight × ownerFraction
  add ownerShare to contributions[getOwner(tokenId)]

  // Remaining flows upstream to parents
  for each edge in node.edges:
    parentWeight = incomingWeight × upstreamFraction × (edge.weightBps / 10000)
    visit(edge.parent, parentWeight)
```

The algorithm is a DFS that starts from the root set (the model + skills + memory used in an inference) and walks upward. Each node retains `ownerSplitBps/10000` of the incoming weight and distributes the remainder proportionally to parents.

---

## Worked Example

```
DataINFT A (owner Alice, royaltyBps=200, ownerSplitBps=10000)
DataINFT B (owner Bob,   royaltyBps=300, ownerSplitBps=10000)
ModelINFT M (owner Mia,  royaltyBps=500, ownerSplitBps=6000,
             parents: A→7000bps, B→3000bps)
```

Inference uses M. Payment = 1 ETH. M.totalRoyaltyBps = 500 → royalty pool = 0.05 ETH.

`propagateWeights(roots=[{M, weight=1.0}], ...)`:

1. Visit M (incomingWeight=1.0):
   - ownerFraction = 0.6 → Mia gets 0.6 × 1.0 = **0.6** (effective weight)
   - upstreamFraction = 0.4
   - → Visit A (incomingWeight = 0.4 × 0.7 = 0.28)
   - → Visit B (incomingWeight = 0.4 × 0.3 = 0.12)

2. Visit A (incomingWeight=0.28):
   - ownerFraction = 1.0 → Alice gets **0.28** (effective weight)
   - No parents.

3. Visit B (incomingWeight=0.12):
   - ownerFraction = 1.0 → Bob gets **0.12** (effective weight)
   - No parents.

`computePayouts(contributors, 0.05 ETH)`:
- Mia:   0.6  × 0.05 ETH = **0.030 ETH**
- Alice: 0.28 × 0.05 ETH = **0.014 ETH**
- Bob:   0.12 × 0.05 ETH = **0.006 ETH**
- Total: 0.05 ETH ✓

---

## Invariants

- Weights at each node must sum to 10000 (enforced by `LineageRegistry.registerINFT`).
- The DAG is acyclic (DFS enforcement at mint). No infinite loops in propagation.
- Max lineage depth is 32 (bounded by `MAX_DEPTH` in `LineageRegistry`).
- Effective weights always sum to ≤ 1.0 (they sum to exactly 1.0 when there are no precision losses).
- Receipt weights must sum to 1.0 ± 1e-6 (`validateReceipt` in `packages/sdk/src/receipt.ts`).

---

## v2 Roadmap: Shapley Attribution

In v2, we plan to compute Shapley values off-chain in the TEE:
- For each subset of contributors S, measure the model quality with and without S
- TEE signs the Shapley vector alongside the receipt
- On-chain verifier checks the TEE signature and uses the Shapley weights instead

This replaces declared weights with measured contributions. The on-chain trust model remains the same (TEE-signed receipt) — only the weight computation moves from mint-time to inference-time.

Deferred from v1 because: (a) requires repeated evaluation per inference, (b) needs standardized quality metric, (c) needs a secure evaluation oracle.
