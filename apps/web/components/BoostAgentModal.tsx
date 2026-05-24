"use client";
import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import type { AgentStatus } from "@repo/shared/types";
import { ERC20_ABI } from "@repo/shared/abi";
import { fmtUsdc } from "@repo/shared/format";
import { ARC_USDC } from "@/lib/wagmi";
import { Sparkles, X, Zap, Copy, Check, Info } from "lucide-react";

const PRESETS = [0.1, 1, 5];

export function BoostAgentModal({
  agent,
  explorer,
  onClose,
}: {
  agent: AgentStatus | null;
  explorer: string;
  onClose: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("1");
  const [copied, setCopied] = useState(false);
  const usdcBalance = useReadContract({
    abi: ERC20_ABI,
    address: ARC_USDC,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });
  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  if (!agent) return null;

  const amtMicro = (() => {
    const f = Number(amount);
    if (!Number.isFinite(f) || f <= 0) return 0n;
    return BigInt(Math.round(f * 1_000_000));
  })();
  const balanceMicro = (usdcBalance.data as bigint | undefined) ?? 0n;
  const canSend = isConnected && amtMicro > 0n && balanceMicro >= amtMicro;

  const onBoost = () => {
    if (!canSend) return;
    writeContract({
      abi: ERC20_ABI,
      address: ARC_USDC,
      functionName: "transfer",
      args: [agent.address as `0x${string}`, amtMicro],
    });
  };

  const onCopyAgent = () => {
    navigator.clipboard.writeText(agent.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  if (isSuccess && txHash) {
    setTimeout(() => {
      reset();
      usdcBalance.refetch();
    }, 600);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-5 fade-up">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 grid size-7 place-items-center rounded-md hover:bg-white/5"
        >
          <X className="size-4" />
        </button>

        <div
          className="flex items-center gap-3 pb-3 border-b border-[var(--color-border)]"
          style={{ boxShadow: `inset 0 -1px 0 ${agent.color}22` }}
        >
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
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
              Boost agent
            </div>
            <div className="font-semibold">{agent.name}</div>
            <button
              onClick={onCopyAgent}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-fg-soft)] hover:text-white"
            >
              {agent.address}
              {copied ? <Check className="size-3 text-[var(--color-green)]" /> : <Copy className="size-3" />}
            </button>
          </div>
        </div>

        <p className="mt-3 text-sm text-[var(--color-fg-dim)] leading-snug">
          Send USDC directly to <span className="text-white">{agent.name}</span>'s
          wallet on Arc. The agent uses boosts to pay gas, buy x402 intel, and
          tip peer agents who agree. Every boost is one Arc tx — verifiable on
          Arcscan instantly.
        </p>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
            <span>amount (USDC)</span>
            <span>
              your balance: {fmtUsdc(Number(balanceMicro) / 1e6, 2)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-2 text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
            />
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(String(p))}
                className="rounded-md border border-[var(--color-border)] px-2 py-1 text-xs hover:border-white/30"
              >
                ${p}
              </button>
            ))}
          </div>
        </div>

        {/* What MetaMask will show — pre-sign clarity */}
        <div className="mt-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 text-[11px] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[var(--color-fg-soft)] uppercase tracking-wider text-[10px]">
            <Info className="size-3" /> MetaMask will show
          </div>
          <Row label="Contract" value={`${ARC_USDC.slice(0, 6)}…${ARC_USDC.slice(-4)}`} note="(the USDC contract on Arc — that's normal)" />
          <Row label="Function" value="transfer" />
          <Row
            label="To (recipient)"
            value={`${agent.address.slice(0, 6)}…${agent.address.slice(-4)}`}
            note={`= ${agent.name}'s wallet`}
            highlight
          />
          <Row label="Amount" value={`${amount || "0"} USDC`} />
          <Row label="Network" value="Arc Testnet · 5042002" />
        </div>

        <button
          onClick={onBoost}
          disabled={!canSend || isPending || confirming}
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-br from-[var(--color-accent)] to-[#5b3fe0] px-3 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          <Zap className="size-4" />
          {!isConnected
            ? "Connect wallet"
            : !canSend
              ? "Insufficient USDC"
              : isPending || confirming
                ? "Boosting…"
                : `Boost ${agent.name}`}
        </button>

        {txHash && (
          <a
            href={`${explorer}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block text-[11px] font-mono text-[var(--color-fg-soft)] hover:text-white truncate"
          >
            tx {txHash.slice(0, 10)}…{txHash.slice(-6)}{" "}
            {confirming ? "(pending)" : isSuccess ? "✓ boosted!" : ""}
          </a>
        )}

        {isSuccess && (
          <div className="mt-3 rounded-md border border-[var(--color-green)]/30 bg-[var(--color-green)]/10 p-2 text-xs text-[var(--color-green)] flex items-center gap-2">
            <Sparkles className="size-3.5" />
            Boost landed on Arc. {agent.name} now has more fuel for the next tick.
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  note,
  highlight,
}: {
  label: string;
  value: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 font-mono">
      <span className="text-[var(--color-fg-soft)] w-24 shrink-0">{label}</span>
      <span className={highlight ? "text-[var(--color-green)]" : "text-white"}>
        {value}
      </span>
      {note && <span className="text-[var(--color-fg-soft)] truncate">{note}</span>}
    </div>
  );
}
