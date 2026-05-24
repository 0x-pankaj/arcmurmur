"use client";
import { fmtUsdc } from "@repo/shared/format";
import { ExternalLink } from "lucide-react";

export type TractionData = {
  totalDeposits: number;
  userCount: number;
  signalCount: number;
  positionCount: number;
  realizedPnl: number;
  unrealizedPnl: number;
  topDepositors: Array<{
    address: string;
    deposited: number;
    net?: number;
    depositCount?: number;
    lastDepositTx?: string;
  }>;
  recentSignals: Array<{
    user: string;
    marketSlug: string;
    lean: number;
    note: string;
    timestamp: number;
    txHash: string;
  }>;
  agentSignalCount?: number;
  nanopayCount?: number;
  nanopayTotalUsdc?: number;
  intelPaymentCount?: number;
  intelPaymentTotalUsdc?: number;
  boostCount?: number;
  boostTotalUsdc?: number;
  // Aggregate live USDC across the 4 agent wallets. "Operating capital",
  // separate from vault TVL.
  swarmCapital?: number;
  // Per-agent live balances for the breakdown popup.
  agentBalances?: Array<{ name: string; address: string; balance: number }>;
  // Unique addresses that have done ANY on-chain action
  // (deposit ∪ boost-sender ∪ user-signal).
  participantCount?: number;
};

export function TractionPanel({
  data,
  explorer,
  vaultAddress,
  stigmergyAddress,
}: {
  data: TractionData | null;
  explorer: string;
  vaultAddress?: string;
  stigmergyAddress?: string;
}) {
  const total = data?.totalDeposits ?? 0;
  const pnl = (data?.realizedPnl ?? 0) + (data?.unrealizedPnl ?? 0);

  // Build event-filtered Arcscan URLs — each tile points at the contract page
  // on Arcscan; judges click and see the matching events.
  const vaultUrl = vaultAddress
    ? `${explorer}/address/${vaultAddress}#events`
    : explorer;
  const stigUrl = stigmergyAddress
    ? `${explorer}/address/${stigmergyAddress}#events`
    : explorer;

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden">
      <header className="border-b border-[var(--color-border)] px-4 py-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Traction · live on Arc</h2>
          <p className="text-xs text-[var(--color-fg-soft)]">
            Every number is read live from on-chain events. Click any tile → Arcscan.
          </p>
        </div>
        {vaultAddress && (
          <a
            href={vaultUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--color-fg-dim)] hover:text-white"
          >
            verify on arcscan <ExternalLink className="size-3" />
          </a>
        )}
      </header>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        <TileLink href={vaultUrl} label="TVL" value={fmtUsdc(total, 2)} sub="Deposit events · Arcscan" />
        <TileLink
          href={vaultUrl}
          label="Participants"
          value={String(data?.participantCount ?? data?.userCount ?? 0)}
          sub={
            data?.userCount != null
              ? `${data.userCount} depositors · all activity counted`
              : "deposits + boosts + signals"
          }
        />
        <TileLink
          href={vaultUrl}
          label="Swarm capital"
          value={fmtUsdc(data?.swarmCapital ?? 0, 2)}
          sub="agent treasury (operating)"
        />
        <TileLink
          href={vaultUrl}
          label="Swarm PnL"
          value={fmtUsdc(pnl, 2)}
          sub={`realized ${fmtUsdc(data?.realizedPnl ?? 0, 2)} · mtm ${fmtUsdc(data?.unrealizedPnl ?? 0, 2)}`}
          tone={pnl >= 0 ? "green" : "red"}
        />
      </div>

      <div className="px-4 pb-2 grid grid-cols-2 md:grid-cols-4 gap-3">
        <TileLink
          href={vaultUrl}
          label="Vault positions"
          value={String(data?.positionCount ?? 0)}
          sub="PositionOpened events"
        />
        <TileLink
          href={stigUrl}
          label="Agent signals"
          value={String(data?.agentSignalCount ?? 0)}
          sub="StigmergySignal.Signal"
        />
        <TileLink
          href={vaultUrl}
          label="Nanopayments"
          value={String(data?.nanopayCount ?? 0)}
          sub={
            data?.nanopayTotalUsdc
              ? `${fmtUsdc(data.nanopayTotalUsdc, 4)} agent↔agent`
              : "agent → agent USDC"
          }
        />
        <TileLink
          href={vaultUrl}
          label="Intel payments"
          value={String(data?.intelPaymentCount ?? 0)}
          sub={
            data?.intelPaymentTotalUsdc
              ? `${fmtUsdc(data.intelPaymentTotalUsdc, 3)} via x402`
              : "x402 USDC on Arc"
          }
        />
      </div>

      {/* Boost call-out — separate row so it pops */}
      {(data?.boostCount ?? 0) > 0 && (
        <div className="px-4 pb-2">
          <TileLink
            href={vaultUrl}
            label="Boosts received"
            value={String(data?.boostCount ?? 0)}
            sub={`${fmtUsdc(data?.boostTotalUsdc ?? 0, 2)} sent by users to agents`}
            tone="green"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-4">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)]">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)] border-b border-[var(--color-border)] flex items-center justify-between">
            <span>top depositors</span>
            {vaultAddress && (
              <a
                href={vaultUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[var(--color-fg-dim)] hover:text-white"
              >
                view all <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <ul className="divide-y divide-[var(--color-border)] max-h-[220px] overflow-y-auto scrollbar-thin">
            {(data?.topDepositors ?? []).slice(0, 8).map((d, i) => (
              <li key={d.address} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="flex items-center gap-2">
                  <span className="text-[var(--color-fg-soft)] w-4 text-right">{i + 1}.</span>
                  <a
                    href={`${explorer}/address/${d.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono hover:text-white"
                  >
                    {d.address.slice(0, 6)}…{d.address.slice(-4)}
                  </a>
                </span>
                <span className="font-mono font-semibold">{fmtUsdc(d.deposited, 2)}</span>
              </li>
            ))}
            {(!data || data.topDepositors.length === 0) && (
              <li className="px-3 py-6 text-center text-xs text-[var(--color-fg-soft)]">
                No deposits yet — be the first.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)]">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)] border-b border-[var(--color-border)] flex items-center justify-between">
            <span>recent user signals</span>
            {vaultAddress && (
              <a
                href={vaultUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[var(--color-fg-dim)] hover:text-white"
              >
                view all <ExternalLink className="size-3" />
              </a>
            )}
          </div>
          <ul className="divide-y divide-[var(--color-border)] max-h-[220px] overflow-y-auto scrollbar-thin">
            {(data?.recentSignals ?? []).slice(0, 10).map((s) => (
              <li key={s.txHash} className="px-3 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <a
                    href={`${explorer}/address/${s.user}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono hover:text-white"
                  >
                    {s.user.slice(0, 6)}…{s.user.slice(-4)}
                  </a>
                  <span className="flex items-center gap-2">
                    <span
                      className={`font-mono ${s.lean > 0 ? "text-[var(--color-green)]" : s.lean < 0 ? "text-[var(--color-red)]" : ""}`}
                    >
                      {s.lean > 0 ? "+" : ""}{s.lean}
                    </span>
                    <a
                      href={`${explorer}/tx/${s.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--color-fg-soft)] hover:text-white"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  </span>
                </div>
                <div className="text-[var(--color-fg-dim)] mt-0.5 truncate">{s.note || s.marketSlug}</div>
              </li>
            ))}
            {(!data || data.recentSignals.length === 0) && (
              <li className="px-3 py-6 text-center text-xs text-[var(--color-fg-soft)]">
                No user signals yet.
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  );
}

function TileLink({
  href,
  label,
  value,
  sub,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  tone?: "green" | "red";
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 hover:border-[var(--color-accent)] transition cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">{label}</div>
        <ExternalLink className="size-3 text-[var(--color-fg-soft)] opacity-0 group-hover:opacity-100 transition" />
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tracking-tight font-mono ${
          tone === "green"
            ? "text-[var(--color-green)]"
            : tone === "red"
              ? "text-[var(--color-red)]"
              : ""
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-[var(--color-fg-soft)] truncate">{sub}</div>
      )}
    </a>
  );
}
