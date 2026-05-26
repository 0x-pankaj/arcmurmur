import type { Address, Hash } from "viem";
import { ARC_ADDRS } from "@repo/shared/chains";
import { payAndUnlock } from "arc-kit/x402-client";
import { agentArcWallet, arcPublic } from "./wallets";
import type { AgentKey } from "@repo/shared/agents";

const INTEL_BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * x402 pay-to-unlock for agent intel, powered by the standalone `arc-kit`
 * primitive (`payAndUnlock`). The agent probes /api/intel/<slug>, pays the
 * requested USDC on Arc, and retries with the X-Payment header — every unlock
 * is a real Arc tx, visible on Arcscan. The kit flow is identical to the
 * browser's IntelUnlock; agents and humans pay through the same gate.
 */
export async function buyPaidIntel(args: {
  agent: AgentKey;
  slug: string;
}): Promise<{
  ok: boolean;
  txHash?: Hash;
  amountUsdc?: string;
  intel?: unknown;
  error?: string;
} | null> {
  const wallet = agentArcWallet(args.agent);
  if (!wallet) return null;

  const r = await payAndUnlock({
    wallet,
    publicClient: arcPublic,
    url: `${INTEL_BASE}/api/intel/${encodeURIComponent(args.slug)}`,
    usdc: ARC_ADDRS.usdc as Address,
  });

  return {
    ok: r.ok,
    txHash: r.txHash,
    amountUsdc: r.amountUsdc,
    intel: r.data,
    error: r.error,
  };
}
