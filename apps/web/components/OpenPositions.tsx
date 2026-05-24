"use client";
import { useMemo, useState } from "react";
import { AGENT_PERSONAS, AGENT_KEYS, type AgentKey } from "@repo/shared/agents";
import { fmtUsdc, timeAgo } from "@repo/shared/format";
import { ArrowUpRight, ArrowDownRight, ExternalLink, Activity } from "lucide-react";

export type Position = {
  id: string | number | bigint;
  txHash: string;
  agent: string;             // agent wallet address
  marketSlug: string;
  marketId?: string;
  action: number;            // 1 BUY_YES, 2 BUY_NO
  sizeUsdc: number;          // micro-USDC
  entryProbBps: number;
  rationale?: string;
  polygonTxHash?: string;
  timestamp: number;
  settled?: boolean;
  pnlMicroUsdc?: number;
  lastMarkBps?: number;
};

type Filter = "all" | "open" | "settled" | AgentKey;

function agentKeyFromAddress(addr: string): AgentKey | null {
  const lower = addr.toLowerCase();
  for (const k of AGENT_KEYS) {
    // AgentStatus[].address comes from packages/agents/wallets, deterministic.
    // We can't access env keys client-side; instead match by Personas if any
    // address-mapping comes through. Otherwise return null and render raw.
    const persona = AGENT_PERSONAS[k];
    if ((persona as any).address?.toLowerCase?.() === lower) return k;
  }
  return null;
}

export function OpenPositions({
  positions,
  explorer,
  agentAddresses,
}: {
  positions: Position[] | null;
  explorer: string;
  // Map from agent wallet address (lowercase) → agent key. Provided by page.tsx
  // from /api/swarm/status's `agents[].address`.
  agentAddresses?: Record<string, AgentKey>;
}) {
  const [filter, setFilter] = useState<Filter>("open");

  const items = useMemo(() => {
    const all = positions ?? [];
    return all
      .filter((p) => {
        if (filter === "all") return true;
        if (filter === "open") return !p.settled;
        if (filter === "settled") return !!p.settled;
        // agent-key filter
        const k =
          agentAddresses?.[p.agent.toLowerCase()] ?? agentKeyFromAddress(p.agent);
        return k === filter;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [positions, filter, agentAddresses]);

  const open = (positions ?? []).filter((p) => !p.settled).length;
  const settled = (positions ?? []).filter((p) => !!p.settled).length;
  const totalSize = (positions ?? []).reduce(
    (s, p) => s + Number(p.sizeUsdc) / 1e6,
    0,
  );
  const totalPnl = (positions ?? []).reduce((s, p) => {
    const mark = p.lastMarkBps != null ? p.lastMarkBps / 10_000 : null;
    const entry = p.entryProbBps / 10_000;
    const size = Number(p.sizeUsdc) / 1e6;
    if (p.settled && p.pnlMicroUsdc != null) {
      return s + Number(p.pnlMicroUsdc) / 1e6;
    }
    if (mark == null) return s;
    const delta = p.action === 1 ? mark - entry : entry - mark;
    return s + size * delta;
  }, 0);

  return (
    <section
      id="positions"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[var(--color-accent)]" />
          <h2 className="font-semibold">Swarm positions</h2>
          <span className="rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-[10px] font-mono px-2 py-0.5 text-[var(--color-fg-soft)]">
            {open} open · {settled} settled
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--color-fg-soft)]">
          <span>
            notional <span className="text-white">{fmtUsdc(totalSize, 2)}</span>
          </span>
          <span>·</span>
          <span>
            pnl{" "}
            <span
              className={
                totalPnl > 0 ? "text-emerald-400" : totalPnl < 0 ? "text-rose-400" : "text-white"
              }
            >
              {totalPnl >= 0 ? "+" : ""}
              {fmtUsdc(totalPnl, 3)}
            </span>
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--color-border)] px-3 py-2">
        {(["open", "settled", "all"] as Filter[]).map((f) => (
          <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f}
          </FilterChip>
        ))}
        <span className="mx-1 text-[var(--color-fg-soft)]">·</span>
        {AGENT_KEYS.map((k) => {
          const p = AGENT_PERSONAS[k];
          return (
            <FilterChip
              key={k}
              active={filter === k}
              onClick={() => setFilter(k)}
              accent={p.color}
            >
              {p.emoji} {p.name}
            </FilterChip>
          );
        })}
      </div>

      <ul className="divide-y divide-[var(--color-border)] max-h-[520px] overflow-y-auto scrollbar-thin">
        {items.length === 0 && (
          <li className="px-4 py-10 text-center text-sm text-[var(--color-fg-soft)]">
            {positions === null
              ? "Loading positions…"
              : "No positions match this filter."}
          </li>
        )}
        {items.slice(0, 40).map((p) => (
          <PositionRow
            key={String(p.id) + p.txHash}
            p={p}
            explorer={explorer}
            agentAddresses={agentAddresses}
          />
        ))}
      </ul>

      <footer className="border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-fg-soft)] font-mono flex justify-between">
        <span>read live from SwarmVault.PositionOpened / Marked / Settled</span>
        <span>showing {Math.min(items.length, 40)} of {items.length}</span>
      </footer>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={active && accent ? { borderColor: accent, color: accent } : undefined}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-mono uppercase tracking-wider transition ${
        active
          ? "bg-[var(--color-bg)] border-[var(--color-accent)] text-[var(--color-accent)]"
          : "border-[var(--color-border)] text-[var(--color-fg-soft)] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function PositionRow({
  p,
  explorer,
  agentAddresses,
}: {
  p: Position;
  explorer: string;
  agentAddresses?: Record<string, AgentKey>;
}) {
  const size = Number(p.sizeUsdc) / 1e6;
  const entry = p.entryProbBps / 10_000;
  const mark = p.lastMarkBps != null ? p.lastMarkBps / 10_000 : null;
  const isYes = p.action === 1;

  // Live mark-to-market PnL: open positions use the latest mark, settled use stored pnl.
  let pnl = 0;
  if (p.settled && p.pnlMicroUsdc != null) {
    pnl = Number(p.pnlMicroUsdc) / 1e6;
  } else if (mark != null) {
    pnl = (isYes ? mark - entry : entry - mark) * size;
  }

  const agentKey =
    agentAddresses?.[p.agent.toLowerCase()] ?? agentKeyFromAddress(p.agent);
  const persona = agentKey ? AGENT_PERSONAS[agentKey] : null;

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {persona ? (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-mono border"
                style={{ color: persona.color, borderColor: `${persona.color}66` }}
              >
                {persona.emoji} {persona.name}
              </span>
            ) : (
              <a
                href={`${explorer}/address/${p.agent}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-mono text-[var(--color-fg-soft)] hover:text-white"
              >
                {p.agent.slice(0, 6)}…{p.agent.slice(-4)}
              </a>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider ${
                isYes
                  ? "bg-emerald-500/12 text-emerald-300"
                  : "bg-rose-500/12 text-rose-300"
              }`}
            >
              {isYes ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {isYes ? "BUY YES" : "BUY NO"}
            </span>
            <span className="text-[11px] font-mono text-[var(--color-fg-soft)]">
              {timeAgo(p.timestamp)}
            </span>
            {p.settled && (
              <span className="rounded-md bg-zinc-500/15 text-zinc-300 text-[10px] font-mono px-1.5 py-0.5 uppercase tracking-wider">
                settled
              </span>
            )}
          </div>

          <p className="mt-1.5 text-sm text-white leading-snug line-clamp-2">
            {p.marketSlug}
          </p>
          {p.rationale && (
            <p className="mt-1 text-xs text-[var(--color-fg-dim)] leading-snug line-clamp-2">
              {p.rationale}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-[var(--color-fg-soft)]">
            <span>
              size <span className="text-white">{fmtUsdc(size, 2)}</span>
            </span>
            <span>·</span>
            <span>
              entry <span className="text-white">{(entry * 100).toFixed(0)}%</span>
            </span>
            {mark != null && (
              <>
                <span>·</span>
                <span>
                  mark <span className="text-white">{(mark * 100).toFixed(0)}%</span>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <div
            className={`text-base font-mono font-semibold ${
              pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-rose-400" : "text-white"
            }`}
          >
            {pnl >= 0 ? "+" : ""}
            {fmtUsdc(pnl, 3)}
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-[var(--color-fg-soft)]">
            <a
              href={`${explorer}/tx/${p.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 hover:text-white"
              title="open tx on Arcscan"
            >
              arcscan <ExternalLink size={9} />
            </a>
            {p.polygonTxHash &&
              p.polygonTxHash !== "0x" + "0".repeat(64) && (
                <>
                  <span>·</span>
                  <a
                    href={`https://polygonscan.com/tx/${p.polygonTxHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 hover:text-white"
                    title="polygon tx (or stub in DEMO_MODE)"
                  >
                    polygon <ExternalLink size={9} />
                  </a>
                </>
              )}
          </div>
        </div>
      </div>
    </li>
  );
}
