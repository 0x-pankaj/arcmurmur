import { NextResponse } from "next/server";
import {
  readRecentVaultEvents,
  readVaultStats,
  readSwarmSignals,
  scanErc20Activity,
  readDepositorLeaderboard,
  arcPublic,
  agentAddress,
} from "@repo/agents";
import { AGENT_KEYS, AGENT_PERSONAS } from "@repo/shared/agents";
import { ARC_ADDRS } from "@repo/shared/chains";
import { ERC20_ABI } from "@repo/shared/abi";
import type { TractionData } from "@/components/TractionPanel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// JSON.stringify replacer that turns BigInts into strings so the route never
// crashes with "Do not know how to serialize a BigInt" — which was hiding all
// of these stats from the dashboard until now.
const bigintSafe = (_k: string, v: any) =>
  typeof v === "bigint" ? v.toString() : v;

export async function GET() {
  const [stats, events, agentSignals, erc20, leaderboard, agentBalances] =
    await Promise.all([
      readVaultStats(),
      readRecentVaultEvents(),
      readSwarmSignals(),
      scanErc20Activity(),
      readDepositorLeaderboard(),
      // Per-agent live USDC balances → "Swarm capital".
      Promise.all(
        AGENT_KEYS.map(async (k) => {
          try {
            const bal = (await arcPublic.readContract({
              address: ARC_ADDRS.usdc as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [agentAddress(k)],
            })) as bigint;
            return {
              name: AGENT_PERSONAS[k].name,
              address: agentAddress(k),
              balance: Number(bal) / 1e6,
            };
          } catch {
            return {
              name: AGENT_PERSONAS[k].name,
              address: agentAddress(k),
              balance: 0,
            };
          }
        }),
      ),
    ]);

  // "Participants" = anyone who has interacted at all (deposit / boost / signal).
  const participants = new Set<string>();
  for (const d of events.depositors) participants.add(d.toLowerCase());
  for (const b of erc20.boostsReceived)
    participants.add((b.from ?? "").toLowerCase());
  for (const s of events.userSignals) participants.add(s.user.toLowerCase());
  participants.delete(""); // guard
  const swarmCapital = agentBalances.reduce((s, a) => s + a.balance, 0);

  const traction: TractionData = {
    totalDeposits: stats ? Number(stats.totalDeposits) / 1e6 : 0,
    userCount: stats?.userCount ?? events.depositors.size,
    signalCount: stats?.signalCount ?? events.userSignals.length,
    positionCount: stats?.positionCount ?? events.positions.length,
    realizedPnl: stats ? Number(stats.realizedMicroUsdc) / 1e6 : 0,
    unrealizedPnl: stats ? Number(stats.unrealizedMicroUsdc) / 1e6 : 0,
    topDepositors: leaderboard.slice(0, 10).map((d) => ({
      address: d.address,
      deposited: d.totalDepositedUsdc,
      net: d.netUsdc,
      depositCount: d.depositCount,
      lastDepositTx: d.lastDepositTx,
    })),
    recentSignals: events.userSignals.slice(0, 20),
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
    swarmCapital,
    agentBalances,
    participantCount: participants.size,
  };

  // Sanitise positions (BigInt id) so the wire-format is safe.
  const positions = events.positions.map((p) => ({
    ...p,
    id: p.id.toString(),
  }));

  return new NextResponse(
    JSON.stringify({ traction, positions, leaderboard }, bigintSafe),
    { headers: { "content-type": "application/json" } },
  );
}
