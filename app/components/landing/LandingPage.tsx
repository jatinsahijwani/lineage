"use client";

/**
 * Lineage landing page — Volume I.
 *
 * Editorial dark. Each section is a chapter in the masthead. Real on-chain
 * numbers are pulled client-side via /api/tokens (currently-connected chain)
 * so the page is alive, not a deck.
 */

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { ArrowUpRight, BookOpen, Github } from "lucide-react";

import { ZG_MAINNET, ZG_TESTNET } from "@lineage/shared";
import {
  Badge,
  LinkButton,
  Marginalia,
  Ornament,
  PageWrap,
  Section,
  Stat,
} from "@/components/editorial";
import { XIcon } from "@/components/icons/XIcon";

interface TokenSet {
  models: { tokenId: string }[];
  skills: { tokenId: string }[];
  data: { tokenId: string }[];
}

interface ChainStats {
  chainId: number;
  name: string;
  models: number;
  skills: number;
  data: number;
  total: number;
  loading: boolean;
}

function useChainStats(chainId: number, name: string): ChainStats {
  const [stats, setStats] = useState<ChainStats>({
    chainId,
    name,
    models: 0,
    skills: 0,
    data: 0,
    total: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tokens?chainId=${chainId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((payload: TokenSet | { error: string }) => {
        if (cancelled) return;
        if ("error" in payload) {
          setStats((s) => ({ ...s, loading: false }));
          return;
        }
        const models = payload.models?.length ?? 0;
        const skills = payload.skills?.length ?? 0;
        const data = payload.data?.length ?? 0;
        setStats({
          chainId,
          name,
          models,
          skills,
          data,
          total: models + skills + data,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [chainId, name]);

  return stats;
}

export function LandingPage() {
  const { chain } = useAccount();
  const mainnet = useChainStats(ZG_MAINNET.chainId, ZG_MAINNET.name);
  const testnet = useChainStats(ZG_TESTNET.chainId, ZG_TESTNET.name);

  const today = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <main className="relative">
      {/* ── Cover ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-rule">
        <PageWrap className="relative grid grid-cols-12 gap-x-6 gap-y-12 pt-16 pb-20 lg:pt-28 lg:pb-32">
          {/* Masthead row */}
          <div className="col-span-12 flex items-baseline justify-between border-b border-rule pb-6">
            <span className="label" data-reveal>
              The Lineage Protocol · Volume I
            </span>
            <span
              className="label hidden sm:inline tabular"
              data-reveal
              data-reveal-delay="1"
            >
              {today}
            </span>
          </div>

          {/* The big italic statement */}
          <div className="col-span-12 lg:col-span-10">
            <h1
              data-reveal
              data-reveal-delay="2"
              className="display text-[clamp(3.25rem,9vw,9rem)] text-paper"
              style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100' }}
            >
              Every output{" "}
              <span className="text-copper">is owed</span>
              {" "}to someone{" "}
              <span className="display-upright not-italic">upstream</span>.
            </h1>
          </div>

          {/* Byline + standfirst */}
          <div className="col-span-12 grid grid-cols-12 gap-x-6 gap-y-8 lg:col-span-10">
            <div
              className="col-span-12 lg:col-span-7"
              data-reveal
              data-reveal-delay="3"
            >
              <p className="text-lg leading-relaxed text-paper-dim lg:text-xl">
                Lineage is the provenance &amp; royalty protocol for AI agents
                on 0G. Every dataset, model, and skill is an iNFT. Every
                inference produces a signed attribution receipt. Royalties
                stream — automatically — to every contributor in the lineage.
              </p>
            </div>
            <Marginalia
              className="col-span-12 lg:col-span-4 lg:col-start-9"
              data-reveal
              data-reveal-delay="4"
            >
              <p className="mb-1 text-paper-dim">An essay &amp; a working protocol.</p>
              <p>
                Built for the 0G APAC Hackathon. Live on 0G mainnet
                (chainId&nbsp;16661) and Galileo testnet (chainId&nbsp;16602).
                Switch networks via the masthead.
              </p>
            </Marginalia>
          </div>

          {/* CTA row */}
          <div
            className="col-span-12 mt-4 flex flex-wrap items-center gap-3"
            data-reveal
            data-reveal-delay="5"
          >
            <LinkButton href="/mint" variant="primary" size="lg">
              §01 · Mint <ArrowUpRight className="h-3.5 w-3.5" />
            </LinkButton>
            <LinkButton href="/demo" variant="secondary" size="lg">
              §02 · Demo <ArrowUpRight className="h-3.5 w-3.5" />
            </LinkButton>
            <LinkButton href="/earnings" variant="secondary" size="lg">
              §03 · Earnings <ArrowUpRight className="h-3.5 w-3.5" />
            </LinkButton>
          </div>

          {/* Live status strip */}
          <div
            className="col-span-12 mt-10 border-t border-rule pt-6"
            data-reveal
            data-reveal-delay="6"
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 lg:grid-cols-4">
              <LiveStat label="Mainnet iNFTs" stats={mainnet} />
              <LiveStat label="Testnet iNFTs" stats={testnet} />
              <Stat
                label="Connected"
                value={chain ? chain.name.split(" ")[0]! : "—"}
                unit={chain ? `id ${chain.id}` : "wallet"}
                hint={chain ? "active session" : "connect to mint"}
              />
              <Stat
                label="On-chain claim"
                value="0.000027"
                unit="OG"
                hint="settled to a contributor, verifiable on explorer"
              />
            </div>
          </div>
        </PageWrap>

        {/* Faint margin numerals — decorative */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-6 top-24 hidden font-display italic text-[8rem] leading-none text-paper-mute opacity-30 lg:block"
          style={{ fontVariationSettings: '"opsz" 144' }}
        >
          I
        </div>
      </section>

      {/* ── §01 The problem ───────────────────────────────────────────── */}
      <PageWrap>
        <Section eyebrow="§01 · The problem" title={null}>
          <div className="grid grid-cols-12 gap-x-6 gap-y-8">
            <div className="col-span-12 lg:col-span-8">
              <p className="dropcap text-lg leading-[1.75] text-paper lg:text-xl">
                AI in 2026 sits on top of a stack with no provenance.
                Contributors don't get paid. Models are trained on
                uncompensated data, fine-tuned with uncredited labels, and
                executed inside agents that compose tools and memories from
                many authors. Every dollar of agent revenue is built on
                uncredited work.
              </p>
              <p className="mt-6 text-base leading-[1.75] text-paper-dim lg:text-lg">
                Agent memory is under attack: $45M+ was lost in 2026 to
                memory-poisoning and tool-injection. iNFTs trade as opaque
                blobs — the moment one is used, attribution evaporates.
                These are three faces of the same gap. AI has no audit trail.
              </p>
            </div>
            <Marginalia className="col-span-12 lg:col-span-3 lg:col-start-10">
              <p className="mb-3 text-copper">Three concrete pains</p>
              <ol className="space-y-3 tabular text-paper-dim">
                <li>i.&nbsp;&nbsp;Contributors unpaid</li>
                <li>ii.&nbsp;&nbsp;Agent memory unverified</li>
                <li>iii.&nbsp;&nbsp;iNFTs trade as opaque blobs</li>
              </ol>
            </Marginalia>
          </div>
        </Section>
      </PageWrap>

      <PageWrap>
        <Ornament>§</Ornament>
      </PageWrap>

      {/* ── §02 The receipt ───────────────────────────────────────────── */}
      <PageWrap>
        <Section eyebrow="§02 · The receipt" title={null}>
          <div className="grid grid-cols-12 gap-x-6 gap-y-10">
            <div className="col-span-12 lg:col-span-7">
              <h2
                className="display text-[clamp(2rem,4.5vw,3.5rem)] text-paper"
                style={{ fontVariationSettings: '"opsz" 96' }}
              >
                Lineage gives <span className="text-copper">AI</span> an audit trail.
              </h2>
              <p className="mt-8 text-base leading-[1.75] text-paper-dim lg:text-lg">
                Every inference produces a signed{" "}
                <span className="text-paper">attribution receipt</span> — a
                JSON object listing every iNFT touched and its weight, signed
                by the TEE that ran the compute and the agent host that called
                it. Receipts are written to 0G Storage. A periodic settler
                reads them, computes the weighted payout, and posts a Merkle
                root on-chain.
              </p>
              <p className="mt-4 text-base leading-[1.75] text-paper-dim lg:text-lg">
                Contributors withdraw with a Merkle proof. Pulls, not pushes.
                The receipt is the record.
              </p>
            </div>

            {/* A mock receipt rendered as a printed page */}
            <div className="col-span-12 lg:col-span-5">
              <ReceiptSpecimen />
            </div>
          </div>
        </Section>
      </PageWrap>

      {/* ── §03 Attribution math ──────────────────────────────────────── */}
      <PageWrap>
        <Section
          eyebrow="§03 · Attribution math"
          title={
            <>
              How <em className="font-display italic text-copper">0.001 OG</em> becomes four payouts.
            </>
          }
        >
          <div className="grid grid-cols-12 gap-x-6 gap-y-10">
            <div className="col-span-12 lg:col-span-8">
              <p className="text-base leading-[1.75] text-paper-dim lg:text-lg">
                One inference uses Skill&nbsp;#37 (a web-search skill). It
                composes Model&nbsp;#36 (a news summariser), which was trained
                on Alice's DataINFT&nbsp;#33 (70%) and Bob's
                DataINFT&nbsp;#34 (30%). Revenue: 0.001 OG. Royalties cascade
                upstream:
              </p>

              <div className="mt-6 overflow-x-auto">
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Contributor</th>
                      <th>Calculation</th>
                      <th className="text-right">Payout</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    <tr>
                      <td>Skill owner</td>
                      <td className="font-mono text-xs text-paper-dim">
                        50% × 3% × 0.001
                      </td>
                      <td className="text-right text-paper">0.000015 OG</td>
                    </tr>
                    <tr>
                      <td>Model owner</td>
                      <td className="font-mono text-xs text-paper-dim">
                        (50%↑) × 60% × 5% × 0.001
                      </td>
                      <td className="text-right text-paper">0.000009 OG</td>
                    </tr>
                    <tr>
                      <td>Alice (data #33)</td>
                      <td className="font-mono text-xs text-paper-dim">
                        (40%↑) × 70% × 2% × 0.001
                      </td>
                      <td className="text-right text-paper">0.0000024 OG</td>
                    </tr>
                    <tr>
                      <td>Bob (data #34)</td>
                      <td className="font-mono text-xs text-paper-dim">
                        (40%↑) × 30% × 2% × 0.001
                      </td>
                      <td className="text-right text-paper">0.0000010 OG</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <Marginalia className="col-span-12 lg:col-span-3 lg:col-start-10">
              <p className="mb-3 text-copper">Every penny traceable.</p>
              <p>
                Royalty bps are declared at mint and locked behind a 24h
                timelock. The owner-split bps decide how much of a token's
                share goes to its declared receiver vs. propagates upstream.
              </p>
            </Marginalia>
          </div>
        </Section>
      </PageWrap>

      <PageWrap>
        <Ornament>§</Ornament>
      </PageWrap>

      {/* ── §04 Built on 0G ────────────────────────────────────────────── */}
      <PageWrap>
        <Section
          eyebrow="§04 · The stack"
          title={
            <>
              The full <em className="font-display italic text-copper">0G</em> stack, used end-to-end.
            </>
          }
        >
          <div className="grid grid-cols-1 gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {STACK_ENTRIES.map((entry, i) => (
              <article
                key={entry.layer}
                className="bg-ink p-6 lg:p-8"
                data-reveal
                data-reveal-delay={String(Math.min(i + 1, 6))}
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="label-copper label">
                    layer {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="label text-paper-faint">{entry.layer}</span>
                </div>
                <h3
                  className="display text-2xl text-paper"
                  style={{ fontVariationSettings: '"opsz" 72' }}
                >
                  {entry.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-paper-dim">
                  {entry.body}
                </p>
              </article>
            ))}
          </div>
        </Section>
      </PageWrap>

      {/* ── §05 Live on 0G ─────────────────────────────────────────────── */}
      <PageWrap>
        <Section
          eyebrow="§05 · Live on 0G"
          title={
            <>
              Two chains. <em className="font-display italic">Same protocol.</em>
            </>
          }
        >
          <div className="grid grid-cols-1 gap-px bg-rule lg:grid-cols-2">
            <ChainPanel
              eyebrow="0G Mainnet · chainId 16661"
              status="live"
              stats={mainnet}
              explorer="https://chainscan.0g.ai"
              contracts={MAINNET_CONTRACTS}
            />
            <ChainPanel
              eyebrow="0G Galileo Testnet · chainId 16602"
              status="live"
              stats={testnet}
              explorer="https://chainscan-galileo.0g.ai"
              contracts={TESTNET_CONTRACTS}
            />
          </div>
        </Section>
      </PageWrap>

      {/* ── §06 Use the protocol ──────────────────────────────────────── */}
      <PageWrap>
        <Section
          eyebrow="§06 · Use the protocol"
          title={
            <>
              The three-minute <em className="font-display italic text-copper">flow</em>.
            </>
          }
        >
          <div className="grid grid-cols-1 gap-px bg-rule md:grid-cols-3">
            <FlowCard
              chapter="01"
              href="/mint"
              title="Mint a contribution"
              body="Upload an artifact — dataset, model weights, a skill manifest. Declare upstream parents. Set your royalty %. Your iNFT is now an on-chain contributor."
              cta="Open the mint"
            />
            <FlowCard
              chapter="02"
              href="/demo"
              title="Run an inference"
              body="Pick a model, type a prompt. Your wallet sends 0.001 OG as the inference fee. The agent host returns a TEE-signed receipt and a Merkle batch posts on-chain."
              cta="Run the demo"
            />
            <FlowCard
              chapter="03"
              href="/earnings"
              title="Claim what's owed"
              body="If your iNFT was in the lineage, a proof is waiting under your address. Claim it. OG lands in your wallet."
              cta="View earnings"
            />
          </div>
        </Section>
      </PageWrap>

      {/* ── Colophon ──────────────────────────────────────────────────── */}
      <footer className="mt-20 border-t border-rule bg-ink-deep">
        <PageWrap>
          <div className="grid grid-cols-12 gap-x-6 gap-y-10 py-12 lg:py-16">
            <div className="col-span-12 lg:col-span-5">
              <p
                className="display text-3xl text-paper"
                style={{ fontVariationSettings: '"opsz" 96' }}
              >
                Lineage
              </p>
              <p className="mt-3 max-w-md text-sm text-paper-dim">
                The provenance &amp; royalty protocol for AI agents on 0G.
                The receipt is the record.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Badge tone="copper">v0.1</Badge>
                <Badge>Mainnet 16661</Badge>
                <Badge>Galileo 16602</Badge>
                <Badge>MIT</Badge>
              </div>
              <div className="mt-8 flex items-center gap-2">
                <a
                  href="https://github.com/jatinsahijwani/lineage"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub"
                  title="Source on GitHub"
                  className="inline-flex h-10 w-10 items-center justify-center border border-rule text-paper-dim transition-colors hover:border-copper hover:text-copper"
                >
                  <Github className="h-4 w-4" />
                </a>
                <a
                  href="https://lineage-5.gitbook.io/lineage/"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Documentation"
                  title="Docs on GitBook"
                  className="inline-flex h-10 w-10 items-center justify-center border border-rule text-paper-dim transition-colors hover:border-copper hover:text-copper"
                >
                  <BookOpen className="h-4 w-4" />
                </a>
                <a
                  href="https://x.com/lineage_0g"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="X · @lineage_0g"
                  title="@lineage_0g on X"
                  className="inline-flex h-10 w-10 items-center justify-center border border-rule text-paper-dim transition-colors hover:border-copper hover:text-copper"
                >
                  <XIcon size={15} />
                </a>
              </div>
            </div>

            <div className="col-span-6 lg:col-span-3 lg:col-start-7">
              <div className="label mb-3">Read</div>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a
                    href="https://github.com/jatinsahijwani/lineage"
                    target="_blank"
                    rel="noreferrer"
                    className="link-copper inline-flex items-baseline gap-2"
                  >
                    <Github className="h-3.5 w-3.5 self-center text-paper-faint" />
                    Source &amp; README ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://lineage-5.gitbook.io/lineage/"
                    target="_blank"
                    rel="noreferrer"
                    className="link-copper inline-flex items-baseline gap-2"
                  >
                    <BookOpen className="h-3.5 w-3.5 self-center text-paper-faint" />
                    Protocol docs ↗
                  </a>
                </li>
                <li>
                  <a
                    href="https://faucet.0g.ai"
                    target="_blank"
                    rel="noreferrer"
                    className="link-copper"
                  >
                    0G testnet faucet ↗
                  </a>
                </li>
              </ul>
            </div>

            <div className="col-span-6 lg:col-span-2">
              <div className="label mb-3">Follow</div>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a
                    href="https://x.com/lineage_0g"
                    target="_blank"
                    rel="noreferrer"
                    className="link-copper inline-flex items-baseline gap-2"
                  >
                    <XIcon size={13} className="self-center text-paper-faint" />
                    @lineage_0g ↗
                  </a>
                </li>
              </ul>
            </div>

            <div className="col-span-12 lg:col-span-2">
              <div className="label mb-3">Use</div>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="/mint" className="link-copper">
                    §01 Mint
                  </a>
                </li>
                <li>
                  <a href="/demo" className="link-copper">
                    §02 Demo
                  </a>
                </li>
                <li>
                  <a href="/earnings" className="link-copper">
                    §03 Earnings
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-rule py-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-faint">
              Set in Fraunces &amp; IBM Plex · Printed on 0G ·{" "}
              <span className="tabular">{today}</span>
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-paper-faint">
              Volume I · No. 1
            </p>
          </div>
        </PageWrap>
      </footer>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Live stat: pulls iNFT counts from /api/tokens for a given chain
// ─────────────────────────────────────────────────────────────────────────────

function LiveStat({ label, stats }: { label: string; stats: ChainStats }) {
  const v = stats.loading ? "—" : String(stats.total);
  const hint = stats.loading
    ? "scanning registry…"
    : `${stats.models} model · ${stats.skills} skill · ${stats.data} data`;
  return <Stat label={label} value={v} unit="iNFTs" hint={hint} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Chain panel (used in §05)
// ─────────────────────────────────────────────────────────────────────────────

interface ChainPanelProps {
  eyebrow: string;
  status: "live" | "down";
  stats: ChainStats;
  explorer: string;
  contracts: { name: string; address: string }[];
}

function ChainPanel({
  eyebrow,
  status,
  stats,
  explorer,
  contracts,
}: ChainPanelProps) {
  return (
    <article className="bg-ink p-6 lg:p-10">
      <div className="mb-6 flex items-center justify-between">
        <span className="label-copper label">{eyebrow}</span>
        <Badge tone={status === "live" ? "moss" : "rust"}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${status === "live" ? "bg-moss" : "bg-rust"}`}
            aria-hidden
          />
          {status}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-4 border-y border-rule py-6">
        <div>
          <div className="label mb-2">Models</div>
          <p className="display-upright tabular text-3xl text-paper">
            {stats.loading ? "—" : stats.models}
          </p>
        </div>
        <div>
          <div className="label mb-2">Skills</div>
          <p className="display-upright tabular text-3xl text-paper">
            {stats.loading ? "—" : stats.skills}
          </p>
        </div>
        <div>
          <div className="label mb-2">Data</div>
          <p className="display-upright tabular text-3xl text-paper">
            {stats.loading ? "—" : stats.data}
          </p>
        </div>
      </div>

      <ul className="mt-6 space-y-2 text-sm">
        {contracts.map((c) => (
          <li
            key={c.name}
            className="flex items-baseline justify-between gap-3"
          >
            <span className="label text-paper-dim">{c.name}</span>
            <a
              href={`${explorer}/address/${c.address}`}
              target="_blank"
              rel="noreferrer"
              className="link-copper truncate font-mono text-[11px] tabular"
            >
              {c.address.slice(0, 8)}…{c.address.slice(-6)}
            </a>
          </li>
        ))}
      </ul>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Receipt specimen (used in §02) — looks like a printed inference receipt
// ─────────────────────────────────────────────────────────────────────────────

function ReceiptSpecimen() {
  return (
    <div className="editorial-card relative overflow-hidden bg-ink-raised/40 p-6 lg:p-8">
      <div className="mb-4 flex items-baseline justify-between border-b border-rule pb-3">
        <span className="label label-copper">attribution receipt</span>
        <span className="font-mono text-[10px] tabular text-paper-faint">
          lineage/v1
        </span>
      </div>
      <dl className="space-y-3 font-mono text-[11px] tabular text-paper-dim">
        <SpecLine k="receiptId" v="0xa3f1…f2c1" />
        <SpecLine k="agentId" v="agent:0xb919…59ab" />
        <SpecLine k="timestamp" v="2026-05-15T18:42:07Z" />
        <SpecLine k="inputDigest" v="0x4a82…00d3" />
        <SpecLine k="outputDigest" v="0xc618…77ee" />
        <div className="border-t border-rule pt-3">
          <div className="label mb-2">lineage</div>
          <SpecLine k="model #36" v="weight 0.250" />
          <SpecLine k="skill #37" v="weight 0.250" />
          <SpecLine k="data  #33" v="weight 0.250" />
          <SpecLine k="data  #34" v="weight 0.250" />
        </div>
        <div className="border-t border-rule pt-3">
          <div className="label mb-2">signatures</div>
          <SpecLine k="tee" v="0x83df…08cf ✓" />
          <SpecLine k="host" v="0xbc74…a0c3 ✓" />
        </div>
      </dl>
      <div className="mt-5 flex items-baseline justify-between border-t border-rule pt-3">
        <span className="label">stamped to 0G storage</span>
        <span className="font-mono text-[10px] text-copper">
          rootHash 0x9f2c…
        </span>
      </div>
    </div>
  );
}

function SpecLine({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-paper-faint">{k}</span>
      <span className="truncate text-paper">{v}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow card (used in §06) — three-step CTA
// ─────────────────────────────────────────────────────────────────────────────

function FlowCard({
  chapter,
  href,
  title,
  body,
  cta,
}: {
  chapter: string;
  href: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <article className="group relative flex flex-col gap-5 bg-ink p-8 transition-colors hover:bg-ink-raised lg:p-10">
      <span className="chapter-mark">§{chapter}</span>
      <h3
        className="display text-3xl text-paper transition-colors group-hover:text-copper-bright lg:text-4xl"
        style={{ fontVariationSettings: '"opsz" 96' }}
      >
        {title}
      </h3>
      <p className="text-base leading-relaxed text-paper-dim">{body}</p>
      <a
        href={href}
        className="mt-auto inline-flex items-center gap-2 self-start font-mono text-[11px] uppercase tracking-[0.22em] text-copper transition-colors hover:text-copper-bright"
      >
        {cta} <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Static content
// ─────────────────────────────────────────────────────────────────────────────

const STACK_ENTRIES = [
  {
    layer: "0G Chain",
    title: "iNFTs, registry, splitter.",
    body: "ERC-7857 with a lineage layer on top. Sub-second finality. The graph of who-trained-on-what lives on-chain, immutable and append-only.",
  },
  {
    layer: "0G Storage",
    title: "Encrypted artifacts.",
    body: "Datasets, model weights, tool source, memory checkpoints. Content-addressed roots; the iNFT carries the storage root, not the bytes.",
  },
  {
    layer: "0G DA",
    title: "Attribution receipts.",
    body: "Per-inference receipts persisted to 0G DA. Cheap, infinitely scalable, verifiable. The settler reads from here to compute payouts.",
  },
  {
    layer: "0G Compute",
    title: "Verifiable TEE inference.",
    body: "The TEE is the trust root for 'this inference really used these iNFTs.' Every receipt is dual-signed: TEE + host operator.",
  },
  {
    layer: "ERC-7857",
    title: "The underlying NFT standard.",
    body: "Lineage adds the graph layer — what each iNFT was built from and how royalties cascade. The standard for agentic provenance.",
  },
  {
    layer: "RoyaltySplitter",
    title: "Pulls, not pushes.",
    body: "Merkle root posted on-chain. Contributors withdraw with a proof. Gas-efficient, audit-friendly, and recoverable across batches.",
  },
];

const MAINNET_CONTRACTS = [
  { name: "Registry", address: "0x7A6cce656a00aD3e763337d8F944F9DB350261C7" },
  { name: "RoyaltySplitter", address: "0x690835584988f2bF28a3e819965FD9dD18D9A8DB" },
  { name: "ModelINFT", address: "0xc7CfEEb82aAb351359B8AaD5c5522b346567Ee79" },
];

const TESTNET_CONTRACTS = [
  { name: "Registry", address: "0x5Ba9010bf4A6E13F098d1ce5DBAF52c22E21B3f5" },
  { name: "RoyaltySplitter", address: "0x4F27E90880E6b28525d7f7Eb8785273F11b0D0DE" },
  { name: "ModelINFT", address: "0xb54bcd09aAEfF92369D3f722dC8CBfdD6f861892" },
];
