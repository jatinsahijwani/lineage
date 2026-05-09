"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { GlowingBadge } from "@/components/shared/GlowingBadge";
import { LineageConnectButton } from "@/components/connect-button";
import { useLineage } from "@/hooks/useLineage";
import { ZG_TESTNET } from "@lineage/shared";
import { cardVariants } from "@/lib/animations";

import { FileDropzone } from "./FileDropzone";
import { ParentsPicker } from "./ParentsPicker";
import { useMintScreen, type MintKind } from "./useMintScreen";

interface MintFormProps {
  kind: MintKind;
  title: string;
  description: string;
}

const PRIMARY_CTA_CLASS =
  "group inline-flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-3.5 font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600 disabled:hover:shadow-none";

const STATUS_LABELS: Record<string, string> = {
  idle: "Ready",
  preparing: "Encrypting & hashing…",
  uploading: "Uploading to 0G Storage…",
  minting: "Submitting mint transaction…",
  success: "Minted",
  error: "Error",
};

export function MintForm({ kind, title, description }: MintFormProps) {
  const { isConnected, chainOk } = useLineage();
  const screen = useMintScreen(kind);
  const showParents = kind !== "data";

  const inFlight =
    screen.status === "preparing" ||
    screen.status === "uploading" ||
    screen.status === "minting";

  if (!isConnected || !chainOk) {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="rounded-xl border border-white/10 glass-dark p-8"
      >
        <div className="flex flex-col items-start gap-4">
          <GlowingBadge variant="purple">Wallet required</GlowingBadge>
          <h3 className="text-xl font-semibold text-white">{title}</h3>
          <p className="text-sm text-white/60">
            {!isConnected
              ? "Connect a wallet to begin."
              : `Switch to ${ZG_TESTNET.name} (chainId ${ZG_TESTNET.chainId}) to continue.`}
          </p>
          <LineageConnectButton />
        </div>
      </motion.div>
    );
  }

  if (screen.status === "success" && screen.result) {
    return (
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="rounded-xl border border-cyan-500/20 glass-dark p-8"
      >
        <div className="flex flex-col gap-4">
          <GlowingBadge variant="cyan">Mint confirmed</GlowingBadge>
          <h3 className="text-xl font-semibold text-white">
            {title} iNFT minted
          </h3>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div className="grid grid-cols-1 gap-3 font-mono text-xs text-white/80 md:grid-cols-2">
              <div>
                <div className="text-white/40">Token id</div>
                <div className="mt-1 text-white">
                  #{screen.result.tokenId.toString()}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-white/40">Tx hash</div>
                <a
                  href={`${ZG_TESTNET.blockExplorer}/tx/${screen.result.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block truncate text-cyan-300 hover:underline"
                >
                  {screen.result.txHash}
                </a>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={screen.reset}
              className={PRIMARY_CTA_CLASS}
            >
              Mint another
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <a
              href={`${ZG_TESTNET.blockExplorer}/tx/${screen.result.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-white/60 hover:text-white"
            >
              View on explorer →
            </a>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="rounded-xl border border-white/10 glass-dark p-6 md:p-8"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-white/60">{description}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white/60">
          {STATUS_LABELS[screen.status] ?? screen.status}
        </span>
      </div>

      <div className="space-y-6">
        <FileDropzone
          file={screen.file}
          onChange={screen.setFile}
          disabled={inFlight}
        />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-white">Royalty rate</Label>
              <span className="font-mono text-sm text-cyan-300">
                {(screen.royaltyBps / 100).toFixed(2)}%
              </span>
            </div>
            <p className="mt-1 text-xs text-white/40">
              Total royalty taken from each downstream payout. Range 0–20%.
            </p>
            <div className="mt-3">
              <Slider
                value={[screen.royaltyBps]}
                onValueChange={(v) => screen.setRoyaltyBps(v[0] ?? 0)}
                min={0}
                max={2000}
                step={10}
                disabled={inFlight}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label className="text-white">Owner / upstream split</Label>
              <span className="font-mono text-sm text-cyan-300">
                owner {(screen.ownerSplitBps / 100).toFixed(0)}% · upstream{" "}
                {((10000 - screen.ownerSplitBps) / 100).toFixed(0)}%
              </span>
            </div>
            <p className="mt-1 text-xs text-white/40">
              How the royalty splits between you (owner) and your upstream
              contributors.
            </p>
            <div className="mt-3">
              <Slider
                value={[screen.ownerSplitBps]}
                onValueChange={(v) => screen.setOwnerSplitBps(v[0] ?? 0)}
                min={0}
                max={10000}
                step={100}
                disabled={inFlight}
              />
            </div>
          </div>
        </div>

        {showParents && (
          <div className="rounded-lg border border-white/5 bg-white/[0.01] p-4">
            <ParentsPicker
              parents={screen.parents}
              onChange={screen.setParents}
            />
          </div>
        )}

        {screen.status === "error" && screen.error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div className="flex-1 text-sm text-red-200">
              <div className="font-medium">Mint failed</div>
              <div className="mt-1 break-words text-red-200/80">
                {screen.error}
              </div>
              <button
                type="button"
                onClick={screen.mint}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 hover:bg-red-500/20"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={screen.mint}
            disabled={inFlight || !screen.file}
            className={PRIMARY_CTA_CLASS}
          >
            {inFlight ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : screen.status === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            )}
            {inFlight ? "Minting…" : `Mint ${title}`}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
