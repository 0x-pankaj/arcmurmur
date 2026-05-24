"use client";
import { useReadContract } from "wagmi";
import type { AgentStatus } from "@repo/shared/types";
import { fmtUsdc, shortAddr } from "@repo/shared/format";
import { ERC20_ABI } from "@repo/shared/abi";
import { ARC_USDC } from "@/lib/wagmi";
import { Zap } from "lucide-react";

export function AgentCards({
  agents,
  explorer,
  onSelect,
  onBoost,
}: {
  agents: AgentStatus[];
  explorer: string;
  onSelect?: (a: AgentStatus) => void;
  onBoost?: (a: AgentStatus) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {agents.map((a) => (
        <AgentCard key={a.key} a={a} explorer={explorer} onSelect={onSelect} onBoost={onBoost} />
      ))}
    </div>
  );
}

function AgentCard({
  a,
  explorer,
  onSelect,
  onBoost,
}: {
  a: AgentStatus;
  explorer: string;
  onSelect?: (a: AgentStatus) => void;
  onBoost?: (a: AgentStatus) => void;
}) {
  const liveBalance = useReadContract({
    abi: ERC20_ABI,
    address: ARC_USDC,
    functionName: "balanceOf",
    args: [a.address as `0x${string}`],
    query: { refetchInterval: 10_000 },
  });
  const liveUsdc = liveBalance.data
    ? Number(liveBalance.data as bigint) / 1e6
    : a.arcBalanceUsdc;
  const d = a.lastDecision;
  const action = d?.action ?? "PASS";
  const tone =
    action === "BUY_YES"
      ? "text-[var(--color-green)]"
      : action === "BUY_NO"
        ? "text-[var(--color-red)]"
        : "text-[var(--color-fg-soft)]";
  return (
    <button
      type="button"
      onClick={() => onSelect?.(a)}
      className="relative text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 overflow-hidden hover:border-white/20 hover:translate-y-[-1px] transition cursor-pointer"
      style={{ boxShadow: `inset 0 0 0 1px ${a.color}10` }}
    >
      <div
        className="absolute -top-12 -right-12 size-32 rounded-full opacity-30 blur-3xl"
        style={{ background: a.color }}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="grid place-items-center size-8 rounded-lg text-base font-semibold"
            style={{
              background: `${a.color}22`,
              color: a.color,
              boxShadow: `inset 0 0 0 1px ${a.color}44`,
            }}
          >
            {a.emoji}
          </span>
          <div>
            <div className="font-semibold">{a.name}</div>
            <div className="text-[11px] text-[var(--color-fg-soft)] capitalize">{a.key}</div>
          </div>
        </div>
        <a
          href={`${explorer}/address/${a.address}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[11px] text-[var(--color-fg-dim)] hover:text-white"
        >
          {shortAddr(a.address)}
        </a>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Mini label="On-chain bal" value={fmtUsdc(liveUsdc, 2)} tone={liveUsdc > 0 ? "green" : undefined} />
        <Mini label="Signals" value={String(a.signalsPosted)} />
        <Mini
          label="Last edge"
          value={d ? `${(d.edge >= 0 ? "+" : "") + (d.edge * 100).toFixed(1)}%` : "—"}
          tone={d ? (d.edge > 0 ? "green" : d.edge < 0 ? "red" : undefined) : undefined}
        />
      </div>

      <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-soft)]/60 p-3 min-h-[88px]">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
          <span>last reasoning</span>
          <span className={tone}>{action}</span>
        </div>
        <p className="mt-1 text-[13px] leading-snug text-[var(--color-fg-dim)] line-clamp-3">
          {d?.rationale ?? "Idle. Awaiting next tick."}
        </p>
        {d && (
          <div className="mt-2 text-[11px] text-[var(--color-fg-soft)] truncate">
            {d.question}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
          click to inspect
        </span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            onBoost?.(a);
          }}
          role="button"
          tabIndex={0}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/40 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent)] hover:bg-[var(--color-accent)]/25 transition cursor-pointer"
        >
          <Zap className="size-3" /> boost
        </span>
      </div>
    </button>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-soft)]/60 p-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
        {label}
      </div>
      <div
        className={`mt-0.5 font-semibold tracking-tight ${tone === "green" ? "text-[var(--color-green)]" : tone === "red" ? "text-[var(--color-red)]" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
