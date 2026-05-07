import type { LineageEdge, RoyaltyPolicy } from "@lineage/shared";

export interface LineageNode {
  tokenId: bigint;
  ownerSplitBps: number;
  totalRoyaltyBps: number;
  edges: LineageEdge[];
}

export interface WeightedContributor {
  tokenId: bigint;
  owner: `0x${string}`;
  effectiveWeight: number;
  royaltyBps: number;
}

/// Walk the lineage DAG upward from a set of iNFTs used in an inference,
/// propagating weights through ownerSplitBps to compute per-contributor payouts.
export function propagateWeights(
  roots: Array<{ tokenId: bigint; weight: number }>,
  getNode: (id: bigint) => LineageNode | undefined,
  getOwner: (id: bigint) => `0x${string}`,
): WeightedContributor[] {
  const contributions = new Map<string, WeightedContributor>();

  function visit(tokenId: bigint, incomingWeight: number) {
    const node = getNode(tokenId);
    if (!node) return;

    const ownerFraction = node.ownerSplitBps / 10000;
    const upstreamFraction = 1 - ownerFraction;
    const ownerContribution = incomingWeight * ownerFraction;

    const key = tokenId.toString();
    const existing = contributions.get(key);
    if (existing) {
      existing.effectiveWeight += ownerContribution;
    } else {
      contributions.set(key, {
        tokenId,
        owner: getOwner(tokenId),
        effectiveWeight: ownerContribution,
        royaltyBps: node.totalRoyaltyBps,
      });
    }

    if (node.edges.length > 0 && upstreamFraction > 0) {
      for (const edge of node.edges) {
        const parentWeight = incomingWeight * upstreamFraction * (edge.weightBps / 10000);
        visit(edge.parent, parentWeight);
      }
    }
  }

  for (const root of roots) {
    visit(root.tokenId, root.weight);
  }

  return Array.from(contributions.values());
}

/// Compute the payout amount for each contributor given a total inference revenue.
export function computePayouts(
  contributors: WeightedContributor[],
  totalRevenue: bigint,
): Map<`0x${string}`, bigint> {
  const payouts = new Map<`0x${string}`, bigint>();
  for (const c of contributors) {
    const payout = BigInt(Math.floor(Number(totalRevenue) * c.effectiveWeight * c.royaltyBps / 10000));
    if (payout > 0n) {
      const existing = payouts.get(c.owner) ?? 0n;
      payouts.set(c.owner, existing + payout);
    }
  }
  return payouts;
}
