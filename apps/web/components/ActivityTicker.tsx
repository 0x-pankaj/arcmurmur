"use client";
import { useEffect, useState } from "react";
import { useBlockNumber, useChainId } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";

type TickerItem = {
  kind: "signal" | "deposit" | "position" | "intel" | "nanopay" | "tick";
  text: string;
  ts: number;
};

export function ActivityTicker({
  signals,
  positions,
  recentNotes,
}: {
  signals: Array<{ agentName: string; rationale: string; timestamp: number; action: number }>;
  positions: Array<{ agent: string; marketSlug: string; sizeUsdc: number; timestamp: number }>;
  recentNotes: Array<{ text: string; ts: number }>;
}) {
  const items: TickerItem[] = [];
  for (const s of signals.slice(0, 12)) {
    items.push({
      kind: "signal",
      text: `⛓ ${s.agentName} whispered: ${s.rationale.slice(0, 70)}`,
      ts: s.timestamp,
    });
  }
  for (const p of positions.slice(0, 8)) {
    items.push({
      kind: "position",
      text: `📍 vault position opened on ${p.marketSlug.slice(0, 40)} · $${(p.sizeUsdc / 1e6).toFixed(2)}`,
      ts: p.timestamp,
    });
  }
  for (const n of recentNotes.slice(0, 16)) {
    if (/intel|nanopay|burn|bridg|whisper|deposit|mark/i.test(n.text)) {
      const kind: TickerItem["kind"] =
        /intel/i.test(n.text) ? "intel" :
        /nanopay/i.test(n.text) ? "nanopay" :
        /deposit/i.test(n.text) ? "deposit" :
        /whisper|signal/i.test(n.text) ? "signal" :
        "tick";
      items.push({ kind, text: `· ${n.text}`, ts: n.ts });
    }
  }
  items.sort((a, b) => b.ts - a.ts);
  const top = items.slice(0, 18);
  // duplicate the array so the CSS marquee can loop seamlessly
  const rail = top.length ? [...top, ...top] : [];

  return (
    <div className="mt-6 mx-auto max-w-7xl px-6">
      <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)]/70 backdrop-blur">
        <div className="absolute left-0 top-0 h-full w-32 z-10 pointer-events-none bg-gradient-to-r from-[var(--color-bg)] to-transparent" />
        <div className="absolute right-0 top-0 h-full w-32 z-10 pointer-events-none bg-gradient-to-l from-[var(--color-bg)] to-transparent" />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 inline-flex items-center gap-1 rounded-full bg-[var(--color-panel)] px-2 py-1 text-[10px] uppercase tracking-wider text-[var(--color-accent)] border border-[var(--color-accent)]/30">
          <Activity className="size-3" /> live · arc
        </div>
        <div className="flex gap-8 py-2.5 pl-28 pr-6 whitespace-nowrap" style={{ animation: "marquee 80s linear infinite" }}>
          {rail.length === 0 ? (
            <span className="text-xs text-[var(--color-fg-soft)]">awaiting on-chain activity… click "Run swarm tick"</span>
          ) : (
            rail.map((it, i) => (
              <span key={i} className="text-xs text-[var(--color-fg-dim)]">
                <span
                  className={
                    it.kind === "signal" ? "text-[var(--color-accent)]" :
                    it.kind === "position" ? "text-[var(--color-green)]" :
                    it.kind === "intel" ? "text-[var(--color-accent-2)]" :
                    it.kind === "nanopay" ? "text-[var(--color-amber)]" :
                    it.kind === "deposit" ? "text-[var(--color-green)]" :
                    ""
                  }
                >
                  {it.text}
                </span>
              </span>
            ))
          )}
        </div>
      </div>
      <BlockBadge />
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

function BlockBadge() {
  const { data: bn } = useBlockNumber({ watch: true, query: { refetchInterval: 3000 } });
  const chainId = useChainId();
  if (!bn) return null;
  return (
    <div className="mt-2 flex justify-end">
      <span className="text-[10px] font-mono text-[var(--color-fg-soft)]">
        arc · chain {chainId} · block {bn.toString()}
      </span>
    </div>
  );
}
