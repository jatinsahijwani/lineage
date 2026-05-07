import type { AttributionReceipt } from "@lineage/shared";
import { propagateWeights, computePayouts } from "@lineage/sdk/lineage-graph.js";

export interface SettlerConfig {
  registryUrl: string;
  rpc: string;
}

export interface PayoutEntry {
  recipient: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
}

/// Aggregate receipts into per-contributor payout amounts.
/// Uses declared weights from the registry (v1 — no Shapley).
export async function aggregateReceipts(
  receipts: AttributionReceipt[],
  totalRevenuePerReceipt: bigint,
  paymentToken: `0x${string}`,
  getNode: Parameters<typeof propagateWeights>[1],
  getOwner: Parameters<typeof propagateWeights>[2],
): Promise<PayoutEntry[]> {
  const accumulated = new Map<`0x${string}`, bigint>();

  for (const receipt of receipts) {
    const lineage = receipt.lineage;
    const roots = [
      { tokenId: BigInt(lineage.model.tokenId), weight: lineage.model.weight },
      ...lineage.skills.map((s) => ({ tokenId: BigInt(s.tokenId), weight: s.weight })),
      ...lineage.memory.map((m) => ({ tokenId: BigInt(m.tokenId), weight: m.weight })),
      ...lineage.data.map((d) => ({ tokenId: BigInt(d.tokenId), weight: d.weight })),
    ];

    const contributors = propagateWeights(roots, getNode, getOwner);
    const payouts = computePayouts(contributors, totalRevenuePerReceipt);

    for (const [owner, amount] of payouts) {
      const existing = accumulated.get(owner) ?? 0n;
      accumulated.set(owner, existing + amount);
    }
  }

  return Array.from(accumulated.entries()).map(([recipient, amount]) => ({
    recipient,
    token: paymentToken,
    amount,
  }));
}
