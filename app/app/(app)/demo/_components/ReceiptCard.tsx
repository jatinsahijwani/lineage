"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { AttributionReceipt } from "@lineage/shared";
import { GlowingBadge } from "@/components/shared/GlowingBadge";
import { cn } from "@/lib/utils";
import type { DemoStatus } from "./useDemoScreen";

interface ReceiptCardProps {
  receipt: AttributionReceipt | null;
  status: DemoStatus;
}

function trunc(value: string, head = 10, tail = 6): string {
  if (!value) return "";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function ReceiptCard({ receipt, status }: ReceiptCardProps) {
  const isRunning =
    status === "compute" ||
    status === "attestation" ||
    status === "persisting";
  const stateLabel = isRunning
    ? status === "attestation"
      ? "attesting…"
      : status === "persisting"
        ? "persisting…"
        : "computing…"
    : receipt
      ? "signed"
      : "idle";

  const stateVariant: "blue" | "purple" | "cyan" = isRunning
    ? "blue"
    : "purple";

  const rows = receipt
    ? [
        ["version", receipt.version],
        ["receiptId", trunc(receipt.receiptId, 8, 6)],
        ["model.tokenId", `#${receipt.lineage.model.tokenId}`],
        ["inputDigest", trunc(receipt.inputDigest, 10, 6)],
        ["outputDigest", trunc(receipt.outputDigest, 10, 6)],
        ["computeProof.chatId", trunc(receipt.computeProof.chatId, 10, 4)],
        ["computeProof.zgResKey", trunc(receipt.computeProof.zgResKey, 10, 4)],
        ["lineage.agentOperator", trunc(receipt.lineage.agentOperator, 10, 6)],
      ]
    : [];

  return (
    <div className="rounded-xl border border-white/10 glass-dark p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
          Attribution Receipt
        </h3>
        <GlowingBadge variant={stateVariant}>{stateLabel}</GlowingBadge>
      </div>
      {receipt ? (
        <ul className="space-y-1.5">
          <AnimatePresence>
            {rows.map(([label, value], i) => (
              <motion.li
                key={label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-md px-2 py-1 font-mono text-xs",
                )}
              >
                <span className="shrink-0 text-white/50">{label}</span>
                <span className="truncate text-right text-white">{value}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
          <div className="text-sm text-white/50">
            {isRunning
              ? "Submitting to 0G Compute…"
              : "Receipt will appear after you run inference."}
          </div>
        </div>
      )}
    </div>
  );
}
