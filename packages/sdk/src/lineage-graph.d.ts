import type { LineageEdge } from "@lineage/shared";
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
export declare function propagateWeights(roots: Array<{
    tokenId: bigint;
    weight: number;
}>, getNode: (id: bigint) => LineageNode | undefined, getOwner: (id: bigint) => `0x${string}`): WeightedContributor[];
export declare function computePayouts(contributors: WeightedContributor[], totalRevenue: bigint): Map<`0x${string}`, bigint>;
//# sourceMappingURL=lineage-graph.d.ts.map