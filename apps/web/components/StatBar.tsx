"use client";
import { shortAddr } from "@repo/shared/format";

export function StatBar({
  totalSignals,
  marketsScanned,
  lastTickAt,
  contract,
  explorer,
  demoMode,
}: {
  totalSignals: number;
  marketsScanned: number;
  lastTickAt?: number;
  contract: string;
  explorer: string;
  demoMode: boolean;
}) {
  const stale = !lastTickAt || Date.now() - lastTickAt > 60_000;
  return (
    <div className="mx-auto max-w-7xl px-6 -mt-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/80 backdrop-blur p-4">
        <Stat label="On-chain signals" value={String(totalSignals)} hint="cumulative on Arc" />
        <Stat label="Markets scanned" value={String(marketsScanned)} hint="last tick" />
        <Stat
          label="Status"
          value={stale ? "Idle" : "Live"}
          hint={stale ? "click Run swarm tick" : "swarm reasoning"}
          dot={stale ? "amber" : "green"}
        />
        <Stat
          label="Mode"
          value={demoMode ? "Demo" : "Live"}
          hint={demoMode ? "simulated trades, real signals" : "real CCTP + Polymarket"}
          dot={demoMode ? "amber" : "green"}
        />
        <a
          href={contract ? `${explorer}/address/${contract}` : "#"}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 hover:border-[var(--color-accent)] transition"
        >
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">Stigmergy contract</div>
          <div className="mt-1 font-mono text-sm">
            {contract && !contract.startsWith("0x0000000000000000000000000000000000000000")
              ? shortAddr(contract)
              : "not deployed"}
          </div>
          <div className="text-[11px] text-[var(--color-fg-dim)] mt-0.5">Arc testnet · view on Arcscan</div>
        </a>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  dot,
}: {
  label: string;
  value: string;
  hint?: string;
  dot?: "green" | "amber" | "red";
}) {
  const dotColor =
    dot === "green" ? "bg-[var(--color-green)]" : dot === "amber" ? "bg-[var(--color-amber)]" : dot === "red" ? "bg-[var(--color-red)]" : "";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        {dot && <span className={`size-2 rounded-full live-dot ${dotColor}`} />}
        <span className="text-xl font-semibold tracking-tight">{value}</span>
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-[var(--color-fg-dim)]">{hint}</div>}
    </div>
  );
}
