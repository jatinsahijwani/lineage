"use client";

import { useEffect, useMemo, useState } from "react";
import { decodeEventLog, type Log } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import type { EdgeType } from "@lineage/shared";
import { Plus, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getContractsForChain } from "@/lib/network";
import { LINEAGE_REGISTRY_ABI } from "@/lib/abis";
import type { ParentEntry } from "./useMintScreen";

const EDGE_TYPES: EdgeType[] = [
  "TrainedOn",
  "FineTunedFrom",
  "Composes",
  "DependsOn",
];

interface ParentsPickerProps {
  parents: ParentEntry[];
  onChange: (parents: ParentEntry[]) => void;
}

interface KnownINFT {
  tokenId: string;
  iType: string;
}

const I_TYPE_LABELS: Record<number, string> = {
  0: "Data",
  1: "Model",
  2: "Skill",
  3: "Agent",
};

export function ParentsPicker({ parents, onChange }: ParentsPickerProps) {
  const publicClient = usePublicClient();
  const { chainId } = useAccount();
  const registryAddress = getContractsForChain(chainId).LineageRegistry;
  const [known, setKnown] = useState<KnownINFT[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string>("");
  const [draftWeight, setDraftWeight] = useState<number>(0);
  const [draftEdge, setDraftEdge] = useState<EdgeType>("TrainedOn");

  useEffect(() => {
    if (!publicClient) return;
    let cancelled = false;
    (async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        const fromBlock =
          latest > 50_000n ? latest - 50_000n : 0n;
        const logs: Log[] = await publicClient.getLogs({
          address: registryAddress,
          fromBlock,
          toBlock: latest,
          // Filter by event name via decode-after; getLogs `event` typing is finicky cross-versions
        });
        const parsed: KnownINFT[] = [];
        for (const l of logs) {
          try {
            const decoded = decodeEventLog({
              abi: LINEAGE_REGISTRY_ABI,
              data: l.data,
              topics: l.topics,
            });
            if (decoded.eventName === "INFTRegistered") {
              const args = decoded.args as unknown as {
                tokenId: bigint;
                iType: number;
              };
              parsed.push({
                tokenId: args.tokenId.toString(),
                iType: I_TYPE_LABELS[Number(args.iType)] ?? "Unknown",
              });
            }
          } catch {
            // not our event, skip
          }
        }
        if (!cancelled) {
          // dedupe by tokenId, newest first
          const seen = new Set<string>();
          const unique = parsed.reverse().filter((x) => {
            if (seen.has(x.tokenId)) return false;
            seen.add(x.tokenId);
            return true;
          });
          setKnown(unique.slice(0, 50));
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(
            err instanceof Error ? err.message : "Failed to load parents",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, registryAddress]);

  const totalWeight = useMemo(
    () => parents.reduce((s, p) => s + p.weightBps, 0),
    [parents],
  );

  const sumOk = parents.length === 0 || totalWeight === 10000;

  const addParent = () => {
    if (!draftId || draftWeight <= 0) return;
    onChange([
      ...parents,
      {
        id: crypto.randomUUID(),
        tokenId: draftId,
        weightBps: draftWeight,
        edgeType: draftEdge,
      },
    ]);
    setDraftId("");
    setDraftWeight(0);
  };

  const removeParent = (id: string) => {
    onChange(parents.filter((p) => p.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">
          Lineage parents
        </span>
        <span
          className={
            "text-xs " +
            (parents.length === 0
              ? "text-white/40"
              : sumOk
                ? "text-emerald-400"
                : "text-amber-400")
          }
        >
          {parents.length === 0
            ? "Optional · weights must sum to 10000 bps"
            : `${totalWeight} / 10000 bps`}
        </span>
      </div>

      {parents.length > 0 && (
        <ul className="space-y-2">
          {parents.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.02] px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-3 text-sm">
                <span className="font-mono text-white">#{p.tokenId}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/70">{p.edgeType}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/70">{p.weightBps} bps</span>
              </div>
              <button
                type="button"
                onClick={() => removeParent(p.id)}
                className="rounded-md p-1.5 text-white/40 hover:bg-white/5 hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_120px_160px_auto]">
        <Input
          list="known-tokens"
          placeholder="Token id (e.g. 1)"
          value={draftId}
          onChange={(e) => setDraftId(e.target.value)}
          className="bg-white/[0.02] text-white"
        />
        <datalist id="known-tokens">
          {known.map((k) => (
            <option key={k.tokenId} value={k.tokenId}>
              {`${k.iType} #${k.tokenId}`}
            </option>
          ))}
        </datalist>
        <Input
          type="number"
          placeholder="Weight bps"
          min={0}
          max={10000}
          value={draftWeight || ""}
          onChange={(e) => setDraftWeight(Number(e.target.value) || 0)}
          className="bg-white/[0.02] text-white"
        />
        <Select
          value={draftEdge}
          onValueChange={(v) => setDraftEdge(v as EdgeType)}
        >
          <SelectTrigger className="w-full bg-white/[0.02] text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EDGE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={addParent}
          className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white hover:bg-white/[0.08]"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {loadError && (
        <p className="text-xs text-amber-400/80">
          Couldn&apos;t load known iNFTs from the registry: {loadError}
        </p>
      )}
      {!loadError && known.length > 0 && (
        <p className="text-xs text-white/40">
          {known.length} recently-registered iNFT{known.length === 1 ? "" : "s"}{" "}
          available — type a token id above to autocomplete.
        </p>
      )}
    </div>
  );
}
