"use client";
import { useEffect, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { Gift, ExternalLink, Loader2, Check, X } from "lucide-react";

type DropStatus = { enabled: boolean; amountUsdc: number; dailyRemaining: number };

export function WelcomeBanner({ explorer }: { explorer: string }) {
  const { address, isConnected } = useAccount();
  const { data: bal } = useBalance({ address });
  const [status, setStatus] = useState<DropStatus | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<
    | { ok: true; txHash: string; amount: number }
    | { ok: false; error: string }
    | null
  >(null);
  const [dismissed, setDismissed] = useState(false);

  // Fetch status only once on mount.
  useEffect(() => {
    fetch("/api/welcome-drop")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  // Hide once they've already received the funds (balance > drop amount).
  const native = bal ? Number(bal.value) / 1e18 : 0;
  if (!status?.enabled) return null;
  if (dismissed) return null;
  if (!isConnected) {
    return (
      <div className="mx-auto max-w-7xl px-6 mt-3">
        <div className="rounded-xl border border-dashed border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5 px-4 py-2.5 flex items-center gap-3 text-sm">
          <Gift size={14} className="text-[var(--color-accent)]" />
          <span className="flex-1 text-[var(--color-fg-dim)]">
            New here? Connect a wallet and claim{" "}
            <span className="text-white font-mono">
              {status.amountUsdc} test USDC
            </span>{" "}
            free — enough to deposit, boost an agent, and try everything.
          </span>
          <button
            onClick={() => setDismissed(true)}
            className="text-[var(--color-fg-soft)] hover:text-white"
            aria-label="dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }
  // already funded — don't nag
  if (native >= 1 && !result) return null;
  if (result?.ok) {
    return (
      <div className="mx-auto max-w-7xl px-6 mt-3">
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/8 px-4 py-2.5 flex items-center gap-3 text-sm">
          <Check size={14} className="text-emerald-400" />
          <span className="flex-1 text-emerald-200">
            Sent {result.amount} USDC to your wallet. You can deposit, boost, or
            send a signal now.
          </span>
          <a
            href={`${explorer}/tx/${result.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 px-2 py-1 text-[11px] font-mono text-emerald-200 hover:text-white"
          >
            tx <ExternalLink size={10} />
          </a>
          <button
            onClick={() => {
              setResult(null);
              setDismissed(true);
            }}
            className="text-[var(--color-fg-soft)] hover:text-white"
            aria-label="dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  const onClaim = async () => {
    if (!address || claiming) return;
    setClaiming(true);
    setResult(null);
    try {
      const r = await fetch("/api/welcome-drop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet: address }),
      });
      const json = await r.json();
      if (r.ok && json?.ok) {
        setResult({ ok: true, txHash: json.txHash, amount: json.amount });
      } else {
        setResult({
          ok: false,
          error: json?.error ?? `request failed (${r.status})`,
        });
      }
    } catch (err) {
      setResult({ ok: false, error: (err as Error).message });
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 mt-3">
      <div className="rounded-xl border border-[var(--color-accent)]/40 bg-gradient-to-r from-[var(--color-accent)]/8 to-fuchsia-500/5 px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm">
        <Gift size={14} className="text-[var(--color-accent)]" />
        <span className="flex-1 text-[var(--color-fg-dim)]">
          Welcome — claim{" "}
          <span className="text-white font-mono">
            {status.amountUsdc} test USDC
          </span>{" "}
          on Arc to start trading the swarm. No faucet hunt required.
        </span>
        <button
          disabled={claiming}
          onClick={onClaim}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-60"
        >
          {claiming ? (
            <>
              <Loader2 size={12} className="animate-spin" /> claiming…
            </>
          ) : (
            <>
              <Gift size={12} /> claim {status.amountUsdc} USDC
            </>
          )}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-[var(--color-fg-soft)] hover:text-white"
          aria-label="dismiss"
        >
          <X size={14} />
        </button>
        {result && !result.ok && (
          <div className="basis-full text-[11px] font-mono text-rose-300 mt-1">
            {result.error}
          </div>
        )}
      </div>
    </div>
  );
}
