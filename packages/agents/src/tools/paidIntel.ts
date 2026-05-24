import {
  encodeFunctionData,
  type Address,
  type Hash,
} from "viem";
import { ARC_ADDRS } from "@repo/shared/chains";
import { ERC20_ABI } from "@repo/shared/abi";
import { env } from "../env";
import { agentArcWallet, arcPublic } from "./wallets";
import type { AgentKey } from "@repo/shared/agents";

const RECEIVER =
  (process.env.INTEL_RECEIVER ||
    process.env.POLYMARKET_BUILDER_ADDRESS ||
    "0xeac008fe82e9b548f5f17512fc20bcc058d1d275") as Address;

const INTEL_BASE =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * x402-style flow: probe /api/intel/<slug>, get 402, pay the requested USDC
 * to the receiver on Arc, retry with the X-Payment header (carrying our tx
 * hash). On success the server returns the intel and the payment is forever
 * visible on Arcscan as agentic-commerce activity.
 *
 * Returns null if the agent has no wallet or the network call fails.
 */
export async function buyPaidIntel(args: {
  agent: AgentKey;
  slug: string;
}): Promise<{
  ok: boolean;
  txHash?: Hash;
  amountUsdc?: string;
  intel?: any;
  error?: string;
} | null> {
  const wallet = agentArcWallet(args.agent);
  if (!wallet) return null;
  const url = `${INTEL_BASE}/api/intel/${encodeURIComponent(args.slug)}`;

  // 1) probe
  const probe = await fetch(url).catch(() => null);
  if (!probe) return null;
  if (probe.status !== 402) {
    // already free — just return
    try {
      const json = await probe.json();
      return { ok: true, intel: json };
    } catch {
      return { ok: false, error: `unexpected ${probe.status}` };
    }
  }
  const requirements = (await probe.json().catch(() => null)) as any;
  const accept = requirements?.accepts?.[0];
  if (!accept) return { ok: false, error: "no x402 requirements" };

  const amount = String(accept.amount ?? "0.01");
  const microAmount = BigInt(Math.round(Number(amount) * 1_000_000));
  const payTo = accept.payTo as Address;

  // 2) pay on Arc — USDC ERC-20 transfer to the receiver.
  let txHash: Hash;
  try {
    const data = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [payTo, microAmount],
    });
    txHash = await wallet.sendTransaction({
      to: ARC_ADDRS.usdc as Address,
      data,
    });
    await arcPublic.waitForTransactionReceipt({ hash: txHash });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // 3) retry with X-Payment header
  const xPayment = JSON.stringify({
    scheme: accept.scheme,
    network: accept.network,
    payTo,
    amount,
    asset: accept.asset,
    txHash,
  });
  const r = await fetch(url, {
    headers: { "x-payment": xPayment },
  }).catch(() => null);
  if (!r || !r.ok) {
    return { ok: false, txHash, error: `retry failed ${r?.status}` };
  }
  const intel = await r.json().catch(() => null);
  return { ok: true, txHash, amountUsdc: amount, intel };
}
