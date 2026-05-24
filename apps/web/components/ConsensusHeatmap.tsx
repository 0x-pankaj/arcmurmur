"use client";
import type { AgentDecision, SwarmTickResult } from "@repo/shared/types";
import { fmtPct } from "@repo/shared/format";
import { AGENT_KEYS, AGENT_PERSONAS } from "@repo/shared/agents";

/**
 * Per-market consensus heatmap: rows = markets, columns = agents. Cell color
 * encodes the agent's probability for that market vs market price (edge).
 */
export function ConsensusHeatmap({ ticks }: { ticks: SwarmTickResult[] }) {
  // Collapse the last few ticks into latest decision per (market, agent).
  const latest = new Map<string, Map<string, AgentDecision>>();
  for (const t of ticks) {
    for (const d of t.decisions) {
      if (!latest.has(d.marketSlug)) latest.set(d.marketSlug, new Map());
      const prev = latest.get(d.marketSlug)!.get(d.agent);
      if (!prev || prev.ts < d.ts) latest.get(d.marketSlug)!.set(d.agent, d);
    }
  }
  const markets = [...latest.entries()].slice(0, 10);

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      <header className="border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="font-semibold">Swarm consensus heatmap</h2>
        <p className="text-xs text-[var(--color-fg-soft)]">
          Each cell is an agent's probability for that market. Green = bullish vs market price, red = bearish.
        </p>
      </header>

      <div className="p-4 overflow-x-auto scrollbar-thin">
        {markets.length === 0 ? (
          <div className="text-center text-sm text-[var(--color-fg-soft)] py-12">
            Run a swarm tick to populate the heatmap.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--color-fg-soft)]">
                <th className="pb-2 font-medium">Market</th>
                <th className="pb-2 font-medium">Market</th>
                {AGENT_KEYS.map((k) => (
                  <th key={k} className="pb-2 font-medium">
                    <span style={{ color: AGENT_PERSONAS[k].color }}>
                      {AGENT_PERSONAS[k].emoji} {AGENT_PERSONAS[k].name}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {markets.map(([slug, byAgent]) => {
                const sample = [...byAgent.values()][0];
                return (
                  <tr key={slug} className="border-t border-[var(--color-border)]">
                    <td className="py-2 pr-4 max-w-[260px] truncate text-[var(--color-fg-dim)]">
                      {sample?.question ?? slug}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-[var(--color-fg-soft)]">
                      {sample ? fmtPct(sample.marketProb, 0) : "—"}
                    </td>
                    {AGENT_KEYS.map((k) => {
                      const d = byAgent.get(k);
                      const edge = d?.edge ?? 0;
                      const bg = cellColor(edge, d?.conviction ?? 0);
                      return (
                        <td key={k} className="py-1 pr-2">
                          <div
                            className="rounded-md px-2 py-1.5 text-xs font-mono text-center"
                            style={{ background: bg }}
                            title={
                              d
                                ? `${d.action} prob=${fmtPct(d.myProb, 0)} edge=${(edge >= 0 ? "+" : "") + fmtPct(edge, 1)} conv=${fmtPct(d.conviction, 0)}`
                                : "no decision"
                            }
                          >
                            {d ? fmtPct(d.myProb, 0) : "·"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function cellColor(edge: number, conv: number): string {
  if (!edge && !conv) return "rgba(255,255,255,0.04)";
  const intensity = Math.min(1, Math.abs(edge) * 6) * Math.max(0.25, conv);
  if (edge >= 0) {
    return `rgba(34, 197, 94, ${0.1 + intensity * 0.55})`;
  }
  return `rgba(239, 68, 68, ${0.1 + intensity * 0.55})`;
}
