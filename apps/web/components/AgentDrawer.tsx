"use client";
import { useEffect } from "react";
import type { AgentStatus, SignalEvent } from "@repo/shared/types";
import { fmtUsdc, fmtPct, shortAddr, timeAgo } from "@repo/shared/format";
import { X, ExternalLink } from "lucide-react";

export function AgentDrawer({
  agent,
  signals,
  explorer,
  onClose,
}: {
  agent: AgentStatus | null;
  signals: SignalEvent[];
  explorer: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!agent) return null;
  const mine = signals.filter((s) => s.agentName === agent.name);
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <aside className="relative h-full w-full sm:w-[460px] bg-[var(--color-panel)] border-l border-[var(--color-border)] overflow-y-auto scrollbar-thin fade-up">
        <header
          className="sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-4 flex items-start justify-between gap-3"
          style={{ boxShadow: `inset 0 -1px 0 ${agent.color}22` }}
        >
          <div className="flex items-center gap-3">
            <span
              className="grid size-10 place-items-center rounded-lg text-xl font-semibold"
              style={{
                background: `${agent.color}22`,
                color: agent.color,
                boxShadow: `inset 0 0 0 1px ${agent.color}44`,
              }}
            >
              {agent.emoji}
            </span>
            <div>
              <div className="font-semibold text-lg">{agent.name}</div>
              <div className="text-xs text-[var(--color-fg-soft)] capitalize">
                {agent.key} agent
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid size-8 place-items-center rounded-md hover:bg-white/5"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="p-5 space-y-5">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)] mb-1">
              wallet
            </div>
            <a
              href={`${explorer}/address/${agent.address}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm hover:text-white inline-flex items-center gap-1"
            >
              {shortAddr(agent.address)} <ExternalLink className="size-3" />
            </a>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Mini label="Signals" value={String(agent.signalsPosted)} />
            <Mini label="PnL" value={fmtUsdc(agent.pnlUsdc)} />
            <Mini
              label="Last edge"
              value={
                agent.lastDecision
                  ? `${agent.lastDecision.edge >= 0 ? "+" : ""}${fmtPct(agent.lastDecision.edge, 1)}`
                  : "—"
              }
            />
          </div>

          {agent.lastDecision && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)] mb-1">
                latest reasoning
              </div>
              <div className="text-sm font-semibold">
                {agent.lastDecision.question}
              </div>
              <p className="mt-2 text-sm text-[var(--color-fg-dim)] leading-snug">
                {agent.lastDecision.rationale}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-[var(--color-fg-soft)]">
                <div>
                  <div className="text-[10px] uppercase">my prob</div>
                  <div className="text-white font-mono">
                    {fmtPct(agent.lastDecision.myProb, 1)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase">market</div>
                  <div className="text-white font-mono">
                    {fmtPct(agent.lastDecision.marketProb, 1)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase">conviction</div>
                  <div className="text-white font-mono">
                    {fmtPct(agent.lastDecision.conviction, 0)}
                  </div>
                </div>
              </div>

              {agent.lastDecision.trace && (
                <div className="mt-4 border-t border-[var(--color-border)] pt-3 space-y-3">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
                    decision trace
                  </div>
                  {agent.lastDecision.trace.toolCalls?.length ? (
                    <div className="space-y-1">
                      {agent.lastDecision.trace.toolCalls.map((tc, i) => (
                        <div
                          key={i}
                          className="rounded-md bg-[var(--color-panel-2)] p-2 text-[11px]"
                        >
                          <div className="font-mono text-[var(--color-accent-2)]">
                            tool: {tc.tool}
                          </div>
                          <pre className="mt-1 whitespace-pre-wrap break-words text-[var(--color-fg-dim)] max-h-32 overflow-y-auto scrollbar-thin">
                            {summarize(tc.result)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {agent.lastDecision.trace.rawReasoning ? (
                    <details className="text-[11px]">
                      <summary className="cursor-pointer text-[var(--color-fg-dim)]">
                        chain-of-thought (raw)
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words text-[var(--color-fg-soft)] max-h-48 overflow-y-auto scrollbar-thin">
                        {agent.lastDecision.trace.rawReasoning}
                      </pre>
                    </details>
                  ) : null}
                </div>
              )}
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)] mb-2">
              on-chain history ({mine.length})
            </div>
            <ul className="space-y-2">
              {mine.length === 0 && (
                <li className="text-sm text-[var(--color-fg-soft)]">
                  No on-chain signals yet from {agent.name}.
                </li>
              )}
              {mine.slice(0, 30).map((s) => (
                <li
                  key={s.txHash}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono">
                      {["PASS", "BUY YES", "BUY NO", "CLOSE"][s.action] ?? "?"}
                    </span>
                    <span className="text-[var(--color-fg-soft)]">
                      {timeAgo(s.timestamp)}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-[var(--color-fg-dim)] line-clamp-2">
                    {s.rationale}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--color-fg-soft)] flex items-center justify-between">
                    <span className="truncate">{s.marketSlug}</span>
                    <a
                      href={`${explorer}/tx/${s.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      arcscan <ExternalLink className="size-3" />
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

function summarize(v: any): string {
  try {
    const s = typeof v === "string" ? v : JSON.stringify(v, null, 2);
    return s.length > 600 ? s.slice(0, 600) + "…" : s;
  } catch {
    return String(v);
  }
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
        {label}
      </div>
      <div className="mt-0.5 font-semibold tracking-tight text-sm">{value}</div>
    </div>
  );
}
