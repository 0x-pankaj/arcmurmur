"use client";
import { useEffect, useState } from "react";
import type { PolymarketMarket } from "@repo/shared/types";
import { fmtPct, fmtUsdc } from "@repo/shared/format";
import { ExternalLink } from "lucide-react";

export function MarketsTable() {
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/markets")
        .then((r) => r.json())
        .then((j) => {
          if (!cancelled) {
            setMarkets(j.markets ?? []);
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
    load();
    const i = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
  }, []);
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div>
          <h2 className="font-semibold">Polymarket — top markets</h2>
          <p className="text-xs text-[var(--color-fg-soft)]">
            Live from <span className="font-mono">gamma-api.polymarket.com</span>, ranked by 24h volume.
          </p>
        </div>
        <span className="text-xs text-[var(--color-fg-soft)] font-mono">
          {loading ? "…" : `${markets.length} markets`}
        </span>
      </header>
      <div className="max-h-[420px] overflow-y-auto scrollbar-thin divide-y divide-[var(--color-border)]">
        {loading && (
          <div className="px-4 py-6 space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 rounded-md shimmer" />
            ))}
          </div>
        )}
        {!loading && markets.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-[var(--color-fg-soft)]">
            No markets returned. (Gamma may be rate-limited; will retry.)
          </div>
        )}
        {markets.map((m) => {
          const yes = m.outcomePrices?.[0] ?? 0.5;
          return (
            <div key={m.id} className="px-4 py-3 hover:bg-white/[0.02]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium line-clamp-2">{m.question}</div>
                  <div className="mt-1 text-[11px] text-[var(--color-fg-soft)] flex items-center gap-3">
                    {m.category && (
                      <span className="px-1.5 py-0.5 rounded bg-[var(--color-panel-2)] font-mono">
                        {m.category}
                      </span>
                    )}
                    <span>vol {fmtUsdc(m.volume24h ?? 0, 0)}</span>
                    <span>liq {fmtUsdc(m.liquidity ?? 0, 0)}</span>
                    <a
                      href={`https://polymarket.com/event/${m.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-white"
                    >
                      polymarket <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <div className="text-xs text-[var(--color-fg-soft)]">YES</div>
                  <div
                    className="font-mono text-base font-semibold"
                    style={{
                      color:
                        yes > 0.55
                          ? "var(--color-green)"
                          : yes < 0.45
                            ? "var(--color-red)"
                            : "var(--color-fg)",
                    }}
                  >
                    {fmtPct(yes, 0)}
                  </div>
                </div>
              </div>
              <ProbabilityBar yes={yes} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProbabilityBar({ yes }: { yes: number }) {
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-[var(--color-bg-soft)] overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--color-green)] to-emerald-400"
        style={{ width: `${Math.round(yes * 100)}%` }}
      />
    </div>
  );
}
