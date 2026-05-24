"use client";
import { useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { keccak256, stringToBytes } from "viem";
import { SWARM_VAULT_ABI } from "@repo/shared/vaultAbi";
import { VAULT_ADDRESS } from "@/lib/wagmi";
import { Send } from "lucide-react";

const SUGGESTED = [
  "will-bitcoin-hit-150k-by-2026",
  "fed-cuts-rates-june-2026",
  "us-2028-democratic-nominee",
  "mumbai-indians-ipl-2026-champion",
];

export function SignalForm({ explorer }: { explorer: string }) {
  const { isConnected } = useAccount();
  const [slug, setSlug] = useState("");
  const [lean, setLean] = useState(0);
  const [note, setNote] = useState("");
  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const vaultConfigured =
    VAULT_ADDRESS && VAULT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const submit = () => {
    if (!vaultConfigured || !slug.trim()) return;
    writeContract({
      abi: SWARM_VAULT_ABI,
      address: VAULT_ADDRESS,
      functionName: "sendSignal",
      args: [keccak256(stringToBytes(slug.trim())), slug.trim(), lean, note.slice(0, 240)],
    });
  };

  if (isSuccess && txHash) {
    setTimeout(() => {
      reset();
      setNote("");
    }, 1500);
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden">
      <header className="border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Send className="size-4 text-[var(--color-accent-2)]" />
          <h2 className="font-semibold">Drop a pheromone</h2>
        </div>
        <p className="text-xs text-[var(--color-fg-soft)] mt-1">
          Your sentiment becomes an on-chain stigmergy signal that the agents read next tick.
        </p>
      </header>
      <div className="p-4 space-y-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
            market slug (from polymarket.com/event/&lt;slug&gt;)
          </label>
          <input
            list="slug-suggestions"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="will-bitcoin-hit-150k-by-2026"
            className="mt-1 w-full rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-2 text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
          />
          <datalist id="slug-suggestions">
            {SUGGESTED.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
            <span>lean</span>
            <span
              className={`font-mono ${
                lean > 0
                  ? "text-[var(--color-green)]"
                  : lean < 0
                    ? "text-[var(--color-red)]"
                    : ""
              }`}
            >
              {lean > 0 ? `+${lean}` : lean} ({lean > 0 ? "YES" : lean < 0 ? "NO" : "neutral"})
            </span>
          </div>
          <input
            type="range"
            min={-100}
            max={100}
            value={lean}
            onChange={(e) => setLean(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--color-accent)]"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
            short rationale
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={240}
            placeholder="why? (saved on Arc forever)"
            className="mt-1 w-full rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        <button
          onClick={submit}
          disabled={!isConnected || !slug.trim() || isPending || confirming}
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-br from-[var(--color-accent-2)] to-[#0ea5e9] px-3 py-2 text-sm font-medium disabled:opacity-60"
        >
          {!isConnected
            ? "Connect wallet to send"
            : isPending || confirming
              ? "Submitting…"
              : "Send signal"}
        </button>

        {txHash && (
          <a
            href={`${explorer}/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="block text-[11px] font-mono text-[var(--color-fg-soft)] hover:text-white truncate"
          >
            tx {txHash.slice(0, 10)}…{txHash.slice(-6)} {confirming ? "(pending)" : isSuccess ? "✓ recorded on Arc" : ""}
          </a>
        )}
      </div>
    </section>
  );
}
