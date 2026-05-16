"use client";

import { ArrowUpRight, CheckCircle2, AlertTriangle } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { LineageConnectButton } from "@/components/connect-button";
import { useLineage } from "@/hooks/useLineage";
import { ZG_TESTNET } from "@lineage/shared";
import {
  Badge,
  Button,
  Card,
  Field,
  LinkButton,
} from "@/components/editorial";

import { FileDropzone } from "./FileDropzone";
import { ParentsPicker } from "./ParentsPicker";
import { useMintScreen, type MintKind } from "./useMintScreen";

interface MintFormProps {
  kind: MintKind;
  title: string;
  description: string;
}

const STATUS_LABEL: Record<string, string> = {
  idle: "Standing by",
  preparing: "Encrypting & hashing",
  uploading: "Pushing to 0G Storage",
  minting: "Registering on-chain",
  success: "Registered",
  error: "Halted",
};

export function MintForm({ kind, title, description }: MintFormProps) {
  const { isConnected, chainOk, chain, network } = useLineage();
  const screen = useMintScreen(kind);
  const showParents = kind !== "data";
  const explorerUrl =
    chain?.blockExplorers?.default?.url ??
    network?.blockExplorer ??
    ZG_TESTNET.blockExplorer;

  const inFlight =
    screen.status === "preparing" ||
    screen.status === "uploading" ||
    screen.status === "minting";

  // ── Wallet gate ─────────────────────────────────────────────────────────
  if (!isConnected || !chainOk) {
    return (
      <Card eyebrow="Wallet required" meta="§ pre-roll">
        <p className="display text-3xl text-paper" style={{ fontVariationSettings: '"opsz" 72' }}>
          {!isConnected ? "Connect a wallet to begin." : "Switch network to continue."}
        </p>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-paper-dim">
          Lineage runs on 0G Mainnet (chainId&nbsp;16661) and 0G Galileo
          Testnet (chainId&nbsp;16602). Pick a network from the masthead and
          we'll resume here.
        </p>
        <div className="mt-6">
          <LineageConnectButton />
        </div>
      </Card>
    );
  }

  // ── Success state ───────────────────────────────────────────────────────
  if (screen.status === "success" && screen.result) {
    return (
      <Card
        eyebrow="Registered on-chain"
        meta={`§ token #${screen.result.tokenId.toString()}`}
        accent
      >
        <h3
          className="display text-3xl text-paper lg:text-4xl"
          style={{ fontVariationSettings: '"opsz" 96' }}
        >
          {title} iNFT minted —{" "}
          <em className="text-copper">welcome to the lineage.</em>
        </h3>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-paper-dim">
          From this transaction forward, every inference that touches your
          contribution owes you a share. Royalties accrue under your address;
          claim them from §03 · Earnings.
        </p>

        <dl className="mt-8 grid grid-cols-1 gap-px bg-rule md:grid-cols-2">
          <div className="bg-ink p-5">
            <div className="label mb-2">Token id</div>
            <p
              className="display-upright tabular text-3xl text-paper"
              style={{ fontVariationSettings: '"opsz" 96' }}
            >
              #{screen.result.tokenId.toString()}
            </p>
          </div>
          <div className="bg-ink p-5">
            <div className="label mb-2">Tx hash</div>
            <a
              href={`${explorerUrl}/tx/${screen.result.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="link-copper block break-all font-mono text-xs tabular text-paper"
            >
              {screen.result.txHash}
            </a>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button onClick={screen.reset} variant="primary" size="lg">
            Mint another <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
          <LinkButton
            href={`${explorerUrl}/tx/${screen.result.txHash}`}
            variant="ghost"
            external
          >
            View on explorer ↗
          </LinkButton>
          <LinkButton href="/demo" variant="ghost">
            Or run an inference against it ↗
          </LinkButton>
        </div>
      </Card>
    );
  }

  // ── Compose state ───────────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-12 gap-x-6 gap-y-10">
      {/* Left column — the form */}
      <div className="col-span-12 lg:col-span-8">
        <div className="editorial-card relative">
          {/* Status strip */}
          <div className="flex items-center justify-between border-b border-rule px-6 py-3 lg:px-8">
            <span className="label label-copper">{title} · compose</span>
            <span className="label tabular">
              {STATUS_LABEL[screen.status] ?? screen.status}
            </span>
          </div>

          <div className="space-y-8 p-6 lg:p-8">
            <Field
              label="Artifact"
              hint="Encrypted client-side with libsodium. Plaintext never leaves your browser. We push the ciphertext to 0G Storage and anchor its root in LineageRegistry."
            >
              <FileDropzone
                file={screen.file}
                onChange={screen.setFile}
                disabled={inFlight}
              />
            </Field>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <Field
                label="Royalty rate"
                meta={`${(screen.royaltyBps / 100).toFixed(2)}%`}
                hint="Total royalty taken from each downstream payout. Range 0–20%. Editable later behind a 24h timelock."
              >
                <Slider
                  value={[screen.royaltyBps]}
                  onValueChange={(v) => screen.setRoyaltyBps(v[0] ?? 0)}
                  min={0}
                  max={2000}
                  step={10}
                  disabled={inFlight}
                />
              </Field>

              <Field
                label="Owner / upstream split"
                meta={`owner ${(screen.ownerSplitBps / 100).toFixed(0)}% · upstream ${((10000 - screen.ownerSplitBps) / 100).toFixed(0)}%`}
                hint="How your royalty divides between you and the upstream contributors you declared as parents."
              >
                <Slider
                  value={[screen.ownerSplitBps]}
                  onValueChange={(v) => screen.setOwnerSplitBps(v[0] ?? 0)}
                  min={0}
                  max={10000}
                  step={100}
                  disabled={inFlight}
                />
              </Field>
            </div>

            {showParents && (
              <Field
                label="Upstream lineage"
                hint="Declare the iNFTs this work was derived from. Weights must sum to 10000 bps. You can leave this empty for an unattributed mint, but downstream contributors won't credit you."
              >
                <div className="border border-rule p-4">
                  <ParentsPicker
                    parents={screen.parents}
                    onChange={screen.setParents}
                  />
                </div>
              </Field>
            )}

            {screen.status === "error" && screen.error && (
              <div className="border border-rust/40 bg-rust/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-rust" />
                  <span className="label" style={{ color: "var(--rust)" }}>
                    Mint halted
                  </span>
                </div>
                <p className="break-words font-mono text-xs leading-relaxed text-paper">
                  {screen.error}
                </p>
                <div className="mt-4">
                  <Button onClick={screen.mint} variant="danger" size="sm">
                    Retry
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 border-t border-rule pt-6">
              <Button
                onClick={screen.mint}
                disabled={!screen.file}
                loading={inFlight}
                variant="primary"
                size="lg"
              >
                {inFlight
                  ? STATUS_LABEL[screen.status]
                  : screen.status === "success"
                    ? "Minted"
                    : `Mint ${title}`}
                {!inFlight && screen.status !== "success" && (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                )}
                {screen.status === "success" && (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Right column — process notes (a sidebar of the protocol's own copy) */}
      <aside className="col-span-12 space-y-8 lg:col-span-4">
        <div>
          <div className="label mb-4">The process</div>
          <ol className="space-y-5 border-l border-rule pl-5 text-[0.95rem] leading-[1.65] text-paper-dim">
            <li className="flex gap-3">
              <span className="font-mono text-[12px] tabular text-copper-dim shrink-0 pt-0.5">
                i.
              </span>
              <span>
                <span className="text-paper">Encrypt</span> the artifact with
                a one-time symmetric key (XSalsa20-Poly1305).
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-[12px] tabular text-copper-dim shrink-0 pt-0.5">
                ii.
              </span>
              <span>
                <span className="text-paper">Upload</span> the ciphertext to
                0G Storage via the Lineage Agent Host. You sign zero gas; the
                host covers the storage fee.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-[12px] tabular text-copper-dim shrink-0 pt-0.5">
                iii.
              </span>
              <span>
                <span className="text-paper">Register</span> the storage
                root, royalty policy, and parents in{" "}
                <span className="font-mono text-[13px] text-paper">
                  LineageRegistry.mintWithLineage
                </span>{" "}
                from your wallet. One transaction.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-[12px] tabular text-copper-dim shrink-0 pt-0.5">
                iv.
              </span>
              <span>
                <span className="text-paper">Earn.</span> Every inference that
                composes your contribution streams royalties under your
                address.
              </span>
            </li>
          </ol>
        </div>

        <div className="border-t border-rule pt-6">
          <div className="flex items-baseline justify-between">
            <span className="label">Network</span>
            <Badge tone={chain && chain.id === 16602 ? "copper" : "moss"}>
              {chain?.name ?? "—"}
            </Badge>
          </div>
        </div>
      </aside>
    </div>
  );
}
