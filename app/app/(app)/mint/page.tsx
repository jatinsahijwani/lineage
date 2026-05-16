"use client";

import { useState } from "react";

import { Chapter, PageWrap } from "@/components/editorial";
import { cn } from "@/lib/utils";

import { MintForm } from "./_components/MintForm";

type Kind = "data" | "model" | "skill";

const TABS: { kind: Kind; label: string; copy: string }[] = [
  {
    kind: "data",
    label: "Data",
    copy: "A training dataset or single record. Royalty defaults to 2%, owner split 80/20.",
  },
  {
    kind: "model",
    label: "Model",
    copy: "Model weights or a checkpoint. Declare which Data or Model parents it was trained on, and the weight of each.",
  },
  {
    kind: "skill",
    label: "Skill",
    copy: "A composable adapter, prompt, or tool. Declare which Models or Skills it depends on.",
  },
];

export default function MintPage() {
  const [active, setActive] = useState<Kind>("data");
  const tab = TABS.find((t) => t.kind === active)!;

  return (
    <div className="pb-24 lg:pb-32">
      <PageWrap>
        <Chapter
          number="01"
          eyebrow="The contribution"
          title={
            <>
              Mint an iNFT.{" "}
              <em className="font-display italic text-copper">Declare your lineage.</em>
            </>
          }
          lede="Encrypt your artifact locally, push it to 0G Storage, and register it in the LineageRegistry. From this moment on, every inference that touches your iNFT owes you a share — measured in basis points, paid in OG."
          marginalia={
            <div className="space-y-3 border-l border-rule pl-5 text-[0.95rem] leading-[1.65] text-paper-dim">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-copper">
                Three kinds
              </p>
              <p>
                <span className="text-paper">Data</span> — raw datasets,
                single records, embeddings, eval sets.
              </p>
              <p>
                <span className="text-paper">Model</span> — trained
                checkpoints. Parents declare the data they derive from.
              </p>
              <p>
                <span className="text-paper">Skill</span> — adapters, prompts,
                tools, RAG indexes. Parents declare composition.
              </p>
            </div>
          }
        />

        {/* Tab strip — mono caps, hairline rule. */}
        <div className="mt-16 grid grid-cols-12 gap-x-6 gap-y-4 border-b border-rule pb-6">
          <div className="col-span-12 flex flex-wrap items-baseline gap-x-8 gap-y-3 lg:col-span-8">
            {TABS.map((t) => {
              const isActive = t.kind === active;
              return (
                <button
                  key={t.kind}
                  type="button"
                  onClick={() => setActive(t.kind)}
                  className={cn(
                    "group relative pb-2 font-mono text-xs uppercase tracking-[0.22em] transition-colors",
                    isActive
                      ? "text-paper"
                      : "text-paper-faint hover:text-paper-dim",
                  )}
                >
                  <span className="mr-2 text-paper-faint">
                    §{String(TABS.indexOf(t) + 1).padStart(2, "0")}
                  </span>
                  {t.label}
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute -bottom-[7px] left-0 right-0 h-px bg-copper"
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className="col-span-12 font-mono text-[11px] leading-relaxed text-paper-dim lg:col-span-4 lg:text-right">
            {tab.copy}
          </p>
        </div>

        {/* Body */}
        <div className="mt-10">
          <MintForm kind={tab.kind} title={tab.label} description={tab.copy} />
        </div>
      </PageWrap>
    </div>
  );
}
