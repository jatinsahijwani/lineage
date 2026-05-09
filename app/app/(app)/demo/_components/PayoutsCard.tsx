"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

function PayoutRowItem({ row }: { row: PayoutRow }) {
  const animatedAmount = useEaseOut(row.amount, 800);
  const initial = row.label.replace(/[^A-Za-z0-9]/g, "").slice(0, 2) || "??";
  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-between gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/30 to-purple-500/30 text-xs font-semibold text-white">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm text-white">{row.label}</div>
          <div className="font-mono text-[10px] text-white/40">
            weight {(row.weight * 100).toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="text-right font-mono text-sm">
        <span className="text-white">{animatedAmount.toFixed(6)}</span>
        <span className="ml-1 text-white/40">OG</span>
      </div>
    </motion.li>
  );
}

export function PayoutsCard({ payouts }: PayoutsCardProps) {
  return (
    <div className="rounded-xl border border-white/10 glass-dark p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
          Royalties Streaming
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
          demo · client-side mock
        </span>
      </div>
      {payouts.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2 text-center text-sm text-white/50">
          Payouts appear after you click <span className="font-mono">Settle now</span>.
        </div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence>
            {payouts.map((p) => (
              <PayoutRowItem key={p.recipient} row={p} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
