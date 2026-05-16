"use client";

import type { AttributionReceipt } from "@lineage/shared";
import { Badge } from "@/components/editorial";
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

  const stateTone: "default" | "copper" | "moss" = isRunning
    ? "copper"
    : receipt
      ? "moss"
      : "default";
  const stateLabel = isRunning
    ? status === "attestation"
      ? "attesting"
      : status === "persisting"
        ? "persisting"
        : "computing"
    : receipt
      ? "signed"
      : "idle";

  const rows: [string, string][] = receipt
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
    <article className="editorial-card relative">
      <div className="flex items-center justify-between border-b border-rule px-6 py-3 lg:px-8">
        <span className="label label-copper">Attribution receipt</span>
        <Badge tone={stateTone}>{stateLabel}</Badge>
      </div>

      {receipt ? (
        <dl className="divide-y divide-rule">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-4 px-6 py-2.5 font-mono text-xs lg:px-8"
            >
              <dt className="shrink-0 text-paper-faint">{label}</dt>
              <dd className="truncate text-right tabular text-paper">{value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="flex h-44 flex-col items-center justify-center gap-1 px-6 text-center">
          <p
            className="display italic text-2xl text-paper-faint"
            style={{ fontVariationSettings: '"opsz" 72' }}
          >
            {isRunning ? "Submitting to 0G Compute…" : "No receipt yet."}
          </p>
          <p className="font-mono text-[11px] text-paper-mute">
            {isRunning ? "the TEE will sign in a moment" : "run an inference to produce one"}
          </p>
        </div>
      )}
    </article>
  );
}
