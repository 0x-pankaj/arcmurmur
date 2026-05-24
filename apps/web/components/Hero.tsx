"use client";
import { Sparkles, Zap, ArrowRight, Repeat } from "lucide-react";

export function Hero({
  onTrigger,
  ticking,
  autoTick,
  onToggleAuto,
}: {
  onTrigger: () => void;
  ticking: boolean;
  autoTick?: boolean;
  onToggleAuto?: () => void;
}) {
  return (
    <section className="relative overflow-hidden border-b border-[var(--color-border)]">
      <div className="mx-auto max-w-7xl px-6 pt-14 pb-12 md:pt-20 md:pb-16">
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-fg-dim)]">
          <span className="rounded-full bg-[var(--color-panel)] border border-[var(--color-border)] px-2 py-1">
            Arc · L1 testnet
          </span>
          <span className="rounded-full bg-[var(--color-panel)] border border-[var(--color-border)] px-2 py-1">
            Circle CCTP · Native USDC
          </span>
          <span className="rounded-full bg-[var(--color-panel)] border border-[var(--color-border)] px-2 py-1">
            Polymarket v2
          </span>
        </div>

        <h1 className="mt-6 text-5xl md:text-7xl font-semibold tracking-tight leading-[1.02]">
          A swarm that{" "}
          <span className="bg-gradient-to-r from-[var(--color-accent)] via-fuchsia-400 to-[var(--color-accent-2)] bg-clip-text text-transparent">
            whispers on-chain
          </span>
          <br />
          and trades in the real world.
        </h1>

        <p className="mt-5 max-w-2xl text-[var(--color-fg-dim)] text-lg leading-relaxed">
          ArcMurmur is a stigmergic colony of AI agents. They reason on
          Polymarket markets, drop pheromone signals on Arc testnet, bridge
          USDC via Circle CCTP, and execute trades on Polygon — fully autonomous,
          fully observable.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            onClick={onTrigger}
            disabled={ticking}
            className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-[#5b3fe0] px-5 py-3 text-sm font-medium shadow-lg shadow-purple-900/30 ring-1 ring-white/10 transition hover:translate-y-[-1px] hover:shadow-xl disabled:opacity-60 disabled:translate-y-0"
          >
            <Sparkles className="size-4" />
            {ticking ? "Swarm reasoning…" : "Run swarm tick"}
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </button>

          <button
            onClick={onToggleAuto}
            className={`inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm transition ${
              autoTick
                ? "border-[var(--color-green)]/50 bg-[var(--color-green)]/10 text-[var(--color-green)]"
                : "border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-fg-dim)] hover:text-white"
            }`}
          >
            <Repeat className={`size-4 ${autoTick ? "animate-spin" : ""}`} style={autoTick ? { animationDuration: "3s" } : undefined} />
            {autoTick ? "Auto-tick ON · 30s" : "Enable auto-tick"}
          </button>
          <a
            href="#feed"
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-5 py-3 text-sm text-[var(--color-fg-dim)] transition hover:text-white"
          >
            <Zap className="size-4" />
            Live feed
          </a>
        </div>
      </div>
    </section>
  );
}
