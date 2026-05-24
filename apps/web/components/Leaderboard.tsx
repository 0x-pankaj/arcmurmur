"use client";
import type { TractionData } from "@/components/TractionPanel";
import { fmtUsdc, shortAddr } from "@repo/shared/format";
import { ExternalLink, Trophy } from "lucide-react";

export function Leaderboard({
  topDepositors,
  explorer,
  myAddress,
}: {
  topDepositors: TractionData["topDepositors"];
  explorer: string;
  myAddress?: string;
}) {
  const me = myAddress?.toLowerCase();
  const ranked = topDepositors ?? [];
  const myRank = me ? ranked.findIndex((d) => d.address.toLowerCase() === me) : -1;

  return (
    <section
      id="leaderboard"
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]"
    >
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-yellow-400" />
          <h2 className="font-semibold">Depositor leaderboard</h2>
        </div>
        <div className="text-[11px] font-mono text-[var(--color-fg-soft)]">
          {ranked.length} on-chain · read from Deposit events
        </div>
      </header>

      {myRank >= 0 && ranked[myRank] && (
        <div className="border-b border-[var(--color-accent)]/30 bg-[var(--color-accent)]/8 px-4 py-2 text-xs font-mono">
          <span className="text-[var(--color-fg-soft)]">your rank</span>{" "}
          <span className="text-white">#{myRank + 1}</span>{" "}
          <span className="text-[var(--color-fg-soft)]">·</span>{" "}
          <span className="text-[var(--color-accent)]">
            {fmtUsdc(ranked[myRank]!.deposited)} deposited
          </span>
        </div>
      )}

      <ol className="divide-y divide-[var(--color-border)]">
        {ranked.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-[var(--color-fg-soft)]">
            Be the first depositor. Connect a wallet, click the vault, deposit
            $1 — your address shows here forever.
          </li>
        )}
        {ranked.slice(0, 8).map((d, i) => {
          const isMe = me && d.address.toLowerCase() === me;
          return (
            <li
              key={d.address}
              className={`flex items-center justify-between px-4 py-2.5 ${isMe ? "bg-[var(--color-accent)]/5" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`grid size-6 place-items-center rounded-full font-mono text-[11px] ${
                    i === 0
                      ? "bg-yellow-400/20 text-yellow-300"
                      : i === 1
                        ? "bg-zinc-400/20 text-zinc-200"
                        : i === 2
                          ? "bg-amber-700/20 text-amber-400"
                          : "bg-[var(--color-bg)] text-[var(--color-fg-soft)]"
                  }`}
                >
                  {i + 1}
                </span>
                <a
                  href={`${explorer}/address/${d.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-sm font-mono hover:text-white truncate"
                >
                  {shortAddr(d.address)}
                  <ExternalLink size={10} className="opacity-60" />
                </a>
                {isMe && (
                  <span className="rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-[10px] font-mono px-1.5 py-0.5">
                    you
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm font-mono">
                <span className="text-white">{fmtUsdc(d.deposited)}</span>
                {d.depositCount != null && d.depositCount > 1 && (
                  <span className="text-[10px] text-[var(--color-fg-soft)]">
                    ×{d.depositCount}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <footer className="border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-fg-soft)] font-mono flex justify-between">
        <span>top 8 of {ranked.length}</span>
        <span>rank = net USDC deposited (deposit − withdraw)</span>
      </footer>
    </section>
  );
}
