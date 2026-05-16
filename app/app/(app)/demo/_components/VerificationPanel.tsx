"use client";

/**
 * VerificationPanel — renders the cryptographic artifacts that anchor a
 * single inference. Reads:
 *
 *   - receipt.computeProof.attestation       (TEE signature + canonical text)
 *   - daPointer.commitment                   (0G Storage root the receipt sits at)
 *   - settleResult.{batchId, txHash, root}   (after Settle now)
 *
 * Performs a client-side `recoverMessageAddress` over the TEE signature and
 * compares the recovered address to `attestation.signing_address`. Result is
 * cached by (canonicalText, signature) so React re-renders don't refire the
 * recover call.
 *
 * Explorer base: ZG_TESTNET.blockExplorer (https://chainscan-galileo.0g.ai).
 * 0G does not have a public Storage blob explorer that ships in our constants,
 * so the storage root renders as a mono code block without a link.
 */

import { useEffect, useRef, useState } from "react";
import { recoverMessageAddress } from "viem";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

import { useAccount } from "wagmi";

import { ZG_TESTNET, type AttributionReceipt } from "@lineage/shared";

import type { DemoDaPointer, DemoSettleResult } from "./useDemoScreen";

interface VerificationPanelProps {
  receipt: AttributionReceipt | null;
  daPointer: DemoDaPointer | null;
  settleResult: DemoSettleResult | null;
  /**
   * Operator address. The shared schema doesn't expose a separate field for
   * the operator on the receipt — the lineage attestation carries
   * `lineage.agentOperator`, and that's what we surface here.
   */
  operatorAddress?: `0x${string}` | null;
}

function useExplorerBase(): string {
  const { chain } = useAccount();
  return chain?.blockExplorers?.default?.url ?? ZG_TESTNET.blockExplorer;
}

function trunc(value: string, head = 6, tail = 4): string {
  if (!value) return "";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

type VerifyState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; recovered: `0x${string}` }
  | { kind: "mismatch"; recovered: `0x${string}` }
  | { kind: "error"; message: string };

interface CacheKey {
  text: string;
  signature: `0x${string}`;
}

function sameKey(a: CacheKey | null, b: CacheKey | null): boolean {
  if (!a || !b) return false;
  return a.text === b.text && a.signature === b.signature;
}

function useTEEVerification(
  canonicalText: string | null,
  signature: `0x${string}` | null,
  expected: `0x${string}` | null,
): VerifyState {
  const [state, setState] = useState<VerifyState>({ kind: "idle" });
  const lastKeyRef = useRef<CacheKey | null>(null);

  useEffect(() => {
    if (!canonicalText || !signature || !expected) {
      setState({ kind: "idle" });
      lastKeyRef.current = null;
      return;
    }
    const key: CacheKey = { text: canonicalText, signature };
    if (sameKey(lastKeyRef.current, key)) {
      // Already verified this exact (text, sig); preserve state.
      return;
    }
    lastKeyRef.current = key;
    setState({ kind: "pending" });
    let cancelled = false;
    recoverMessageAddress({ message: canonicalText, signature })
      .then((recovered) => {
        if (cancelled) return;
        const ok = recovered.toLowerCase() === expected.toLowerCase();
        setState(
          ok
            ? { kind: "ok", recovered: recovered as `0x${string}` }
            : { kind: "mismatch", recovered: recovered as `0x${string}` },
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [canonicalText, signature, expected]);

  return state;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-white/40">
        {label}
      </span>
      <div className="min-w-0 break-all">{children}</div>
    </li>
  );
}

function ExplorerLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs text-blue-300 transition-colors hover:text-blue-200 hover:underline"
    >
      {children}
      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
    </a>
  );
}

export function VerificationPanel({
  receipt,
  daPointer,
  settleResult,
  operatorAddress,
}: VerificationPanelProps) {
  const EXPLORER_BASE = useExplorerBase();
  const attestation = receipt?.computeProof.attestation ?? null;
  // The TEE-signed `text` field IS the canonical 5-field colon-joined message
  // per @lineage/shared TEEAttestation comment: "<inputHash>:<outputHash>:
  // <providerType>:<providerIdentity>:<tlsCertFingerprint>".
  const canonicalText = attestation?.text ?? null;
  const signature = attestation?.signature ?? null;
  const teeSigningAddress = attestation?.signing_address ?? null;

  const verify = useTEEVerification(canonicalText, signature, teeSigningAddress);

  // Operator address: not separately encoded on the receipt envelope; surface
  // `lineage.agentOperator` as the operator identity.
  const op =
    operatorAddress ??
    (receipt?.lineage.agentOperator as `0x${string}` | undefined) ??
    null;

  const hasAnything =
    !!attestation ||
    !!daPointer ||
    !!settleResult ||
    !!op;

  if (!hasAnything) return null;

  return (
    <div className="rounded-xl border border-white/10 glass-dark p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-white/80">
          Verification
        </h3>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/40">
          <ShieldCheck className="h-3 w-3" /> dual-attestation
        </span>
      </div>

      <ul className="space-y-2">
        {daPointer && (
          <Row label="Storage root">
            <code className="font-mono text-xs text-white">
              {daPointer.commitment}
            </code>
            <div className="mt-1 font-mono text-[10px] text-white/40">
              blob index {daPointer.blobIndex}
            </div>
          </Row>
        )}

        {teeSigningAddress && (
          <Row label="TEE signing address">
            <ExplorerLink
              href={`${EXPLORER_BASE}/address/${teeSigningAddress}`}
            >
              {teeSigningAddress}
            </ExplorerLink>
          </Row>
        )}

        {canonicalText && (
          <Row label="Canonical TEE text">
            <code className="block whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-white/80">
              {canonicalText}
            </code>
          </Row>
        )}

        {signature && teeSigningAddress && (
          <Row label="TEE signature">
            {verify.kind === "pending" && (
              <div className="inline-flex items-center gap-2 text-xs text-white/60">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Verifying…
              </div>
            )}
            {verify.kind === "ok" && (
              <div className="inline-flex items-center gap-2 text-xs text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Signature verified
              </div>
            )}
            {verify.kind === "mismatch" && (
              <div className="flex flex-col gap-1">
                <div className="inline-flex items-center gap-2 text-xs text-red-300">
                  <XCircle className="h-3.5 w-3.5" />
                  Signature mismatch
                </div>
                <code className="font-mono text-[10px] text-white/40">
                  recovered {trunc(verify.recovered, 10, 6)}
                </code>
              </div>
            )}
            {verify.kind === "error" && (
              <div className="inline-flex items-center gap-2 text-xs text-amber-300">
                <XCircle className="h-3.5 w-3.5" />
                Verification error · {verify.message}
              </div>
            )}
            {verify.kind === "idle" && (
              <div className="text-xs text-white/40">No signature to verify.</div>
            )}
          </Row>
        )}

        {settleResult && (
          <Row label="Batch tx hash">
            <ExplorerLink
              href={`${EXPLORER_BASE}/tx/${settleResult.txHash}`}
            >
              {trunc(settleResult.txHash, 10, 8)} · View on Chainscan
            </ExplorerLink>
            <div className="mt-1 font-mono text-[10px] text-white/40">
              batch #{settleResult.batchId} · root {trunc(settleResult.merkleRoot, 10, 6)}
            </div>
          </Row>
        )}

        {op && (
          <Row label="Operator address">
            <ExplorerLink href={`${EXPLORER_BASE}/address/${op}`}>
              {op}
            </ExplorerLink>
          </Row>
        )}
      </ul>
    </div>
  );
}
