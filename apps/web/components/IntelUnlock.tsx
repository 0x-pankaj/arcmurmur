"use client";

/**
 * IntelUnlock — browser-driven x402 micropayment on Arc.
 *
 * Maps to the Agora mentor hint: "React/Next + wagmi/viem frontends that wire
 * x402 (client side)". The matching server endpoint is /api/intel/[slug],
 * which returns HTTP 402 + payment requirements, then unlocks intel once an
 * Arc USDC tx hash arrives in the X-Payment header.
 *
 * Flow:
 *   1. probe   → GET /api/intel/<slug>          → 402 { accepts: [...] }
 *   2. pay     → user's wallet signs USDC.transfer(payTo, amount) on Arc
 *   3. confirm → wait for receipt
 *   4. retry   → GET /api/intel/<slug> with X-Payment header (carries txHash)
 *   5. render  → intel payload + Arcscan link for the payment tx
 *
 * Every unlock is a real Arc tx — that's the point. The button itself is the
 * fastest readable proof that this app moves USDC on Arc from the browser.
 */

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { ERC20_ABI } from "@repo/shared/abi";
import { ARC_USDC } from "@/lib/wagmi";
import { arcTestnet } from "@repo/shared/chains";
import { Lock, Unlock, Loader2, ExternalLink, Zap } from "lucide-react";

type Accept = {
  scheme: string;
  network: string;
  chainId: number;
  payTo: `0x${string}`;
  asset: `0x${string}`;
  amount: string;
  description: string;
  tokenSymbol: string;
  decimals: number;
};

type Phase =
  | "idle"
  | "probing"
  | "ready" // 402 received, awaiting user click to pay
  | "paying" // tx submitted, waiting for receipt
  | "verifying" // receipt in, retrying with X-Payment header
  | "unlocked"
  | "error";

export function IntelUnlock({ explorer }: { explorer: string }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const [slug, setSlug] = useState<string | null>(null);
  const [question, setQuestion] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [accept, setAccept] = useState<Accept | null>(null);
  const [intel, setIntel] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync, data: txHash, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess: confirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Pick a slug from the most-active Polymarket market.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/markets")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const m = d.markets?.[0];
        if (m?.slug) {
          setSlug(m.slug);
          setQuestion(m.question ?? m.slug);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const probe = useCallback(async () => {
    if (!slug) return;
    setPhase("probing");
    setError(null);
    try {
      const r = await fetch(`/api/intel/${encodeURIComponent(slug)}`);
      if (r.status === 402) {
        const body = await r.json();
        const a = body?.accepts?.[0] as Accept | undefined;
        if (!a) throw new Error("server returned 402 with no requirements");
        setAccept(a);
        setPhase("ready");
      } else if (r.ok) {
        const j = await r.json();
        setIntel(j);
        setPhase("unlocked");
      } else {
        throw new Error(`probe failed: HTTP ${r.status}`);
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  }, [slug]);

  // Auto-probe once we have a slug + connection.
  useEffect(() => {
    if (slug && isConnected && phase === "idle") probe();
  }, [slug, isConnected, phase, probe]);

  const pay = useCallback(async () => {
    if (!accept || !slug) return;
    setError(null);
    setPhase("paying");
    try {
      if (chainId !== arcTestnet.id) {
        await switchChainAsync({ chainId: arcTestnet.id });
      }
      const microAmount = BigInt(
        Math.round(Number(accept.amount) * 10 ** accept.decimals),
      );
      await writeContractAsync({
        abi: ERC20_ABI,
        address: ARC_USDC,
        functionName: "transfer",
        args: [accept.payTo, microAmount],
      });
      // Receipt is awaited by the wagmi hook → effect below kicks in.
    } catch (e) {
      setError((e as Error).message ?? "user rejected transfer");
      setPhase("ready");
    }
  }, [accept, slug, chainId, switchChainAsync, writeContractAsync]);

  // After confirmation, retry the gated endpoint with X-Payment.
  useEffect(() => {
    if (!confirmed || !txHash || !accept || !slug) return;
    if (phase !== "paying") return;
    (async () => {
      setPhase("verifying");
      try {
        const xPayment = JSON.stringify({
          scheme: accept.scheme,
          network: accept.network,
          payTo: accept.payTo,
          amount: accept.amount,
          asset: accept.asset,
          txHash,
        });
        const r = await fetch(`/api/intel/${encodeURIComponent(slug)}`, {
          headers: { "x-payment": xPayment },
        });
        if (!r.ok) throw new Error(`gate retry failed: HTTP ${r.status}`);
        const j = await r.json();
        setIntel(j);
        setPhase("unlocked");
      } catch (e) {
        setError((e as Error).message);
        setPhase("error");
      }
    })();
  }, [confirmed, txHash, accept, slug, phase]);

  const resetAll = () => {
    setIntel(null);
    setError(null);
    setPhase("idle");
    reset();
    probe();
  };

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden h-full flex flex-col">
      <header className="border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-[var(--color-accent)]" />
          <h2 className="font-semibold">x402 alpha · browser pays Arc</h2>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)] font-mono">
          HTTP 402 · 0.01 USDC
        </span>
      </header>

      <div className="p-4 space-y-3 flex-1">
        <p className="text-xs text-[var(--color-fg-soft)] leading-relaxed">
          One click pays the server <span className="text-white">0.01 USDC</span>{" "}
          on Arc and unlocks a real-time market intel snapshot. The browser
          drives the full x402 handshake — probe → 402 → wagmi-signed
          USDC.transfer → retry with <span className="font-mono">X-Payment</span>.
        </p>

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-soft)] px-3 py-2 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
            target market
          </div>
          <div className="font-mono text-white truncate">
            {question || "loading top Polymarket market…"}
          </div>
        </div>

        <PhaseLine phase={phase} txHash={txHash} explorer={explorer} />

        {phase !== "unlocked" && (
          <button
            onClick={() => {
              if (phase === "ready") pay();
              else if (phase === "error" || phase === "idle") resetAll();
            }}
            disabled={
              !isConnected ||
              !slug ||
              phase === "probing" ||
              phase === "paying" ||
              phase === "verifying" ||
              confirming
            }
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-br from-[var(--color-accent)] to-[#5b3fe0] px-3 py-2 text-sm font-medium disabled:opacity-60"
          >
            {phase === "probing" && (
              <>
                <Loader2 className="size-4 animate-spin" /> probing endpoint…
              </>
            )}
            {phase === "ready" && (
              <>
                <Lock className="size-4" /> Pay 0.01 USDC & unlock
              </>
            )}
            {phase === "paying" && (
              <>
                <Loader2 className="size-4 animate-spin" /> waiting for Arc
                receipt…
              </>
            )}
            {phase === "verifying" && (
              <>
                <Loader2 className="size-4 animate-spin" /> server verifying tx…
              </>
            )}
            {(phase === "idle" || phase === "error") && (
              <>
                <Lock className="size-4" /> Probe gated endpoint
              </>
            )}
          </button>
        )}

        {phase === "unlocked" && intel && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-[var(--color-green)]">
              <Unlock className="size-4" /> unlocked
            </div>
            <div className="rounded-md border border-[var(--color-green)]/40 bg-[var(--color-green)]/5 px-3 py-2 text-xs leading-relaxed space-y-1">
              <div className="font-mono text-white">{intel?.intel?.summary}</div>
              {intel?.related?.length ? (
                <div className="text-[var(--color-fg-soft)]">
                  related: {intel.related.length} markets in same category
                </div>
              ) : null}
              {intel?.payment?.txHash && (
                <a
                  href={`${explorer}/tx/${intel.payment.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--color-fg-soft)] hover:text-white"
                >
                  payment {intel.payment.txHash.slice(0, 10)}… on Arcscan
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <button
              onClick={resetAll}
              className="text-[11px] text-[var(--color-fg-soft)] hover:text-white"
            >
              ↻ unlock another
            </button>
          </div>
        )}

        {error && (
          <div className="text-[11px] text-[var(--color-red)] font-mono">
            {error}
          </div>
        )}

        {!isConnected && (
          <div className="text-[11px] text-[var(--color-fg-soft)]">
            connect a wallet on Arc Testnet to drive the x402 flow.
          </div>
        )}
      </div>
    </section>
  );
}

function PhaseLine({
  phase,
  txHash,
  explorer,
}: {
  phase: Phase;
  txHash?: `0x${string}`;
  explorer: string;
}) {
  const steps: { id: Phase | "init"; label: string }[] = [
    { id: "probing", label: "probe" },
    { id: "ready", label: "402" },
    { id: "paying", label: "pay" },
    { id: "verifying", label: "verify" },
    { id: "unlocked", label: "200" },
  ];
  const order: Phase[] = [
    "idle",
    "probing",
    "ready",
    "paying",
    "verifying",
    "unlocked",
  ];
  const idx = order.indexOf(phase);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] font-mono">
        {steps.map((s, i) => {
          const reached = order.indexOf(s.id as Phase) <= idx;
          return (
            <span
              key={s.label}
              className={`px-1.5 py-0.5 rounded ${
                reached
                  ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)]"
                  : "text-[var(--color-fg-soft)]/60"
              }`}
            >
              {s.label}
              {i < steps.length - 1 && "→"}
            </span>
          );
        })}
      </div>
      {txHash && (
        <a
          href={`${explorer}/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-[10px] font-mono text-[var(--color-fg-soft)] hover:text-white truncate"
        >
          payment tx {txHash.slice(0, 10)}…{txHash.slice(-6)}
        </a>
      )}
    </div>
  );
}
