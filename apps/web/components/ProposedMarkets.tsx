"use client";
import { useEffect, useState } from "react";
import type { MarketProposalEvent } from "@repo/shared/types";
import { shortAddr, timeAgo } from "@repo/shared/format";
import { ExternalLink, Sparkles, ThumbsUp } from "lucide-react";

type Resp = { proposals: MarketProposalEvent[]; contract: string | null };

export function ProposedMarkets({ explorer }: { explorer: string }) {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    let alive = true;
    const fetcher = async () => {
      try {
        const r = await fetch("/api/proposals").then((r) => r.json());
        if (alive) setData(r);
      } catch {}
    };
    fetcher();
    const i = setInterval(fetcher, 12_000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, []);

  const proposals = data?.proposals ?? [];

  return (
    <section
      id="proposals"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]"
    >
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--color-accent)]" />
          <h2 className="font-semibold">Markets the swarm wishes existed</h2>
          <span className="ml-1 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider">
            RFB-03
          </span>
        </div>
        <div className="text-xs text-[var(--color-fg-soft)] font-mono flex items-center gap-2">
          <span>{proposals.length} live</span>
          {data?.contract && (
            <a
              href={`${explorer}/address/${data.contract}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-white"
              title="MarketProposals contract on Arcscan"
            >
              contract <ExternalLink size={11} />
            </a>
          )}
        </div>
      </header>

      <ul className="divide-y divide-[var(--color-border)] max-h-[440px] overflow-y-auto scrollbar-thin">
        {proposals.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-[var(--color-fg-soft)]">
            No proposals yet. Run a swarm tick — when an agent has high
            conviction about something Polymarket doesn&apos;t cover, they
            emit a <code className="text-white">MarketProposed</code> event.
          </li>
        )}
        {proposals.slice(0, 12).map((p) => (
          <ProposalRow key={p.proposalId} p={p} explorer={explorer} />
        ))}
      </ul>
      <footer className="border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-fg-soft)] flex justify-between font-mono">
        <span>
          ranking · convictionΣ + 2000bps per endorser
        </span>
        <span>read from on-chain events on Arc</span>
      </footer>
    </section>
  );
}

function ProposalRow({
  p,
  explorer,
}: {
  p: MarketProposalEvent;
  explorer: string;
}) {
  const yes = (p.yesProbBps / 100).toFixed(0);
  const conviction = (p.convictionBps / 100).toFixed(0);
  const score = (p.convictionSumBps / 100).toFixed(0);
  const ago = timeAgo(p.timestamp);
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug text-white">
            {p.question}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-mono text-[var(--color-fg-soft)]">
            <span className="rounded bg-[var(--color-bg)] border border-[var(--color-border)] px-1.5 py-0.5 text-white">
              {p.agentName}
            </span>
            <span>·</span>
            <span>{p.category || "general"}</span>
            <span>·</span>
            <span className="text-[var(--color-accent)]">YES {yes}%</span>
            <span>·</span>
            <span>conv {conviction}%</span>
            <span>·</span>
            <span>{ago}</span>
          </div>
          {p.rationale && (
            <p className="mt-1.5 text-xs text-[var(--color-fg-dim)] leading-relaxed line-clamp-2">
              {p.rationale}
            </p>
          )}
          {p.endorsements.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {p.endorsements.slice(0, 6).map((e, i) => (
                <a
                  key={i}
                  href={`${explorer}/tx/${e.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-0.5 text-[10px] font-mono text-[var(--color-fg-dim)] hover:text-white"
                  title={`${e.agentName} endorsed (${(e.convictionBps / 100).toFixed(0)}%)`}
                >
                  <ThumbsUp size={9} /> {e.agentName}
                </a>
              ))}
              {p.endorsements.length > 6 && (
                <span className="text-[10px] text-[var(--color-fg-soft)] font-mono">
                  +{p.endorsements.length - 6}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 text-[11px] font-mono">
          <div className="rounded-md bg-[var(--color-accent)]/12 text-[var(--color-accent)] px-2 py-0.5">
            score {score}
          </div>
          <a
            href={`${explorer}/tx/${p.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-fg-soft)] hover:text-white"
          >
            {shortAddr(p.txHash)} <ExternalLink size={10} />
          </a>
        </div>
      </div>
    </li>
  );
}
