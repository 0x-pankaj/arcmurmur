"use client";

/**
 * PowerUserStrip — the mentor's hint, made visible.
 *
 *   "React/Next + wagmi/viem frontends that wire x402 (client side) +
 *    session keys on top of the ArcOSS primitives."
 *
 * Two side-by-side cards: IntelUnlock (client-side x402) and SessionKeyPanel
 * (browser-held session key driving auto-cosigns). Both flows broadcast real
 * USDC transactions on Arc Testnet, with Arcscan deep links.
 */

import { IntelUnlock } from "./IntelUnlock";
import { SessionKeyPanel } from "./SessionKeyPanel";
import type { SignalEvent } from "@repo/shared/types";

export function PowerUserStrip({
  explorer,
  signals,
}: {
  explorer: string;
  signals: SignalEvent[];
}) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-6 space-y-3">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-sm uppercase tracking-wider text-[var(--color-fg-soft)]">
            ⚡ Power-user lane
          </h2>
          <p className="text-xs text-[var(--color-fg-soft)] mt-1 max-w-2xl">
            wagmi/viem + Arc Testnet. Two ArcOSS primitives, browser-driven:
            <span className="text-white font-mono"> x402</span> micropayments
            and <span className="text-white font-mono">session keys</span> —
            both produce live USDC txs on Arc.
          </p>
        </div>
        <a
          href="https://docs.arc.io/build#developer-tools"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-[var(--color-fg-soft)] hover:text-white font-mono"
        >
          docs.arc.io/build → session keys ↗
        </a>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <IntelUnlock explorer={explorer} />
        <SessionKeyPanel signals={signals} explorer={explorer} />
      </div>
    </section>
  );
}
