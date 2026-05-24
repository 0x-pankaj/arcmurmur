import { NextResponse } from "next/server";
import {
  readRecentVaultEvents,
  readVaultStats,
  readSwarmSignals,
  scanErc20Activity,
} from "@repo/agents";
import type { TractionData } from "@/components/TractionPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// JSON.stringify replacer that turns BigInts into strings so the route never
// crashes with "Do not know how to serialize a BigInt" — which was hiding all
// of these stats from the dashboard until now.
const bigintSafe = (_k: string, v: any) =>
  typeof v === "bigint" ? v.toString() : v;

export async function GET() {
  const [stats, events, agentSignals, erc20] = await Promise.all([
    readVaultStats(),
    readRecentVaultEvents(),
    readSwarmSignals(),
    scanErc20Activity(),
  ]);

  // Top depositors derived from the rich Deposit event payload (not just the
  // unique-set), so dollar amounts show up.
  const depositTotals = new Map<string, number>();
  for (const addr of events.depositors) depositTotals.set(addr, 0);

  const traction: TractionData = {
    totalDeposits: stats ? Number(stats.totalDeposits) / 1e6 : 0,
    userCount: stats?.userCount ?? events.depositors.size,
    signalCount: stats?.signalCount ?? events.userSignals.length,
    positionCount: stats?.positionCount ?? events.positions.length,
    realizedPnl: stats ? Number(stats.realizedMicroUsdc) / 1e6 : 0,
    unrealizedPnl: stats ? Number(stats.unrealizedMicroUsdc) / 1e6 : 0,
    topDepositors: [...events.depositors].map((a) => ({
      address: a,
      deposited: depositTotals.get(a) ?? 0,
    })),
    recentSignals: events.userSignals.slice(0, 20),
    // 🆕 the three previously-placeholder tiles
    agentSignalCount: agentSignals.length,
    nanopayCount: erc20.nanopayments.length,
    nanopayTotalUsdc:
      erc20.nanopayments.reduce(
        (s, m) => s + Number(m.amountMicro) / 1e6,
        0,
      ),
    intelPaymentCount: erc20.intelPayments.length,
    intelPaymentTotalUsdc: erc20.intelPayments.reduce(
      (s, m) => s + Number(m.amountMicro) / 1e6,
      0,
    ),
    boostCount: erc20.boostsReceived.length,
    boostTotalUsdc: erc20.boostsReceived.reduce(
      (s, m) => s + Number(m.amountMicro) / 1e6,
      0,
    ),
  };

  // Sanitise positions (BigInt id) so the wire-format is safe.
  const positions = events.positions.map((p) => ({
    ...p,
    id: p.id.toString(),
  }));

  // Use the bigint-safe replacer in case anything else leaks through.
  return new NextResponse(
    JSON.stringify({ traction, positions }, bigintSafe),
    { headers: { "content-type": "application/json" } },
  );
}
