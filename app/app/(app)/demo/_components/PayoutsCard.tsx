"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatEther } from "viem";
import type { PayoutRow } from "./useDemoScreen";

interface PayoutsCardProps {
  payouts: PayoutRow[];
}

function useEaseOut(target: number, durationMs = 800): number {
  const [v, setV] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number>(0);

  useEffect(() => {
    fromRef.current = v;
    startRef.current = null;
    let raf = 0;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const p = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(fromRef.current + (target - fromRef.current) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return v;
}

function PayoutRowItem({ row, rank }: { row: PayoutRow; rank: number }) {
  const targetOg = useMemo(() => {
    try {
      return Number(formatEther(BigInt(row.amount)));
    } catch {
      return 0;
    }
  }, [row.amount]);
  const animated = useEaseOut(targetOg, 800);
  return (
    <tr>
      <td className="w-16 align-baseline">
        <span className="chapter-mark">
          §{String(rank).padStart(2, "0")}
        </span>
      </td>
      <td>
        <div className="flex flex-col">
          <span className="font-mono text-sm tabular text-paper">{row.label}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-paper-faint tabular">
            weight {(row.weight * 100).toFixed(1)}%
          </span>
        </div>
      </td>
      <td className="text-right">
        <span className="display-upright tabular text-lg text-paper">
          {animated.toFixed(6)}
        </span>
        <span className="ml-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-paper-faint">
          OG
        </span>
      </td>
    </tr>
  );
}

export function PayoutsCard({ payouts }: PayoutsCardProps) {
  return (
    <article className="editorial-card">
      <div className="flex items-center justify-between border-b border-rule px-6 py-3 lg:px-8">
        <span className="label label-copper">The ledger · royalties</span>
        <span className="label text-paper-faint">
          {payouts.length > 0 ? `${payouts.length} recipient(s)` : "awaiting batch"}
        </span>
      </div>

      {payouts.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center px-6 text-center">
          <p
            className="display italic text-2xl text-paper-faint"
            style={{ fontVariationSettings: '"opsz" 72' }}
          >
            Nothing settled yet.
          </p>
          <p className="mt-1 font-mono text-[11px] text-paper-mute">
            payouts appear after you click <span className="text-copper">Settle now</span>
          </p>
        </div>
      ) : (
        <div className="px-6 py-2 lg:px-8">
          <table className="print-table">
            <thead>
              <tr>
                <th>§</th>
                <th>Recipient</th>
                <th className="text-right">Payout</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p, i) => (
                <PayoutRowItem key={p.recipient} row={p} rank={i + 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
