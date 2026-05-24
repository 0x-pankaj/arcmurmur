"use client";
import type { AgentDecision, SignalEvent, SwarmTickResult } from "@repo/shared/types";
import { fmtUsdc, fmtPct, shortAddr, timeAgo } from "@repo/shared/format";
import { ExternalLink } from "lucide-react";

type Item =
  | { kind: "signal"; data: SignalEvent }
  | { kind: "decision"; data: AgentDecision }
  | { kind: "note"; data: { text: string; ts: number } };

export function SwarmFeed({
  signals,
  recentTicks,
  explorer,
}: {
  signals: SignalEvent[];
  recentTicks: SwarmTickResult[];
  explorer: string;
}) {
  const items: Item[] = [];
  for (const s of signals.slice(0, 30)) items.push({ kind: "signal", data: s });
  for (const t of recentTicks.slice(0, 4)) {
    for (const d of t.decisions) items.push({ kind: "decision", data: d });
    for (const n of t.notes) items.push({ kind: "note", data: { text: n, ts: t.ts } });
  }
  items.sort((a, b) => itemTs(b) - itemTs(a));

  return (
    <section
      id="feed"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]"
    >
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[var(--color-accent-2)] live-dot" />
          <h2 className="font-semibold">Swarm feed</h2>
        </div>
        <span className="text-xs text-[var(--color-fg-soft)] font-mono">
          {signals.length} on-chain · {recentTicks.reduce((s, t) => s + t.decisions.length, 0)} local
        </span>
      </header>
      <ul className="divide-y divide-[var(--color-border)] max-h-[640px] overflow-y-auto scrollbar-thin">
        {items.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-[var(--color-fg-soft)]">
            Swarm is quiet. Click <span className="text-white">Run swarm tick</span>.
          </li>
        )}
        {items.slice(0, 80).map((it, i) => (
          <FeedRow key={i} item={it} explorer={explorer} />
        ))}
      </ul>
    </section>
  );
}

function itemTs(i: Item): number {
  if (i.kind === "signal") return i.data.timestamp;
  if (i.kind === "decision") return i.data.ts;
  return i.data.ts;
}

function FeedRow({ item, explorer }: { item: Item; explorer: string }) {
  if (item.kind === "signal") {
    const s = item.data;
    const action = ["PASS", "BUY YES", "BUY NO", "CLOSE"][s.action] ?? "?";
    const tone =
      s.action === 1 ? "text-[var(--color-green)]" : s.action === 2 ? "text-[var(--color-red)]" : "text-[var(--color-fg-soft)]";
    return (
      <li className="fade-up px-4 py-3 hover:bg-white/[0.02]">
        <div className="flex items-start gap-3">
          <span className="mt-1 grid size-8 place-items-center rounded-md bg-[var(--color-panel-2)] text-xs font-mono">
            ⛓
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold">{s.agentName}</span>
              <span className={`font-mono ${tone}`}>{action}</span>
              <span className="text-[var(--color-fg-soft)]">
                prob {fmtPct(s.probBps / 10000, 0)} · conv {fmtPct(s.convictionBps / 10000, 0)} · {fmtUsdc(s.sizeUsdc / 1e6)}
              </span>
              <span className="ml-auto text-[var(--color-fg-soft)]">
                {timeAgo(s.timestamp)}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-fg-dim)]">
              {s.rationale || `Signal on ${s.marketSlug}`}
            </p>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-[var(--color-fg-soft)]">
              <span className="font-mono">{s.marketSlug}</span>
              <a
                href={`${explorer}/tx/${s.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-white"
              >
                arcscan {shortAddr(s.txHash)} <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        </div>
      </li>
    );
  }
  if (item.kind === "decision") {
    const d = item.data;
    const tone =
      d.action === "BUY_YES" ? "text-[var(--color-green)]" : d.action === "BUY_NO" ? "text-[var(--color-red)]" : "text-[var(--color-fg-soft)]";
    return (
      <li className="fade-up px-4 py-3 hover:bg-white/[0.02]">
        <div className="flex items-start gap-3">
          <span className="mt-1 grid size-8 place-items-center rounded-md bg-[var(--color-panel-2)] text-xs">
            🧠
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold capitalize">{d.agent}</span>
              <span className={`font-mono ${tone}`}>{d.action}</span>
              <span className="text-[var(--color-fg-soft)]">
                prob {fmtPct(d.myProb, 0)} vs mkt {fmtPct(d.marketProb, 0)} · edge {(d.edge >= 0 ? "+" : "") + fmtPct(d.edge, 1)}
              </span>
              <span className="ml-auto text-[var(--color-fg-soft)]">{timeAgo(d.ts)}</span>
            </div>
            <p className="mt-1 text-sm text-[var(--color-fg-dim)]">{d.rationale}</p>
            <div className="mt-1 text-[11px] text-[var(--color-fg-soft)] truncate">
              {d.question}
            </div>
          </div>
        </div>
      </li>
    );
  }
  return (
    <li className="px-4 py-2 text-[12px] text-[var(--color-fg-soft)] font-mono">
      · {item.data.text}
    </li>
  );
}
