/**
 * x402 CLIENT — pay-to-unlock a gated HTTP endpoint, on Arc.
 *
 *   probe  →  402  →  pay (USDC.transfer on Arc)  →  retry w/ X-Payment  →  200
 *
 * The same flow works for an autonomous agent (pass a private-key wallet) and
 * for a browser power-user (pass a wagmi/viem WalletClient backed by MetaMask).
 * Either way, the unlock is a real USDC transfer on Arc, verifiable on Arcscan.
 *
 * x402 header schema follows Coinbase's HTTP 402 draft:
 *   X-Payment: { scheme, network, payTo, amount, asset, txHash }
 */
import {
  encodeFunctionData,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { ARC_ADDRS } from "./chain";
import { ERC20_ABI } from "./abi";

export type PayAndUnlockResult = {
  ok: boolean;
  txHash?: Hash;
  amountUsdc?: string;
  data?: unknown;
  error?: string;
};

export async function payAndUnlock(args: {
  /** Wallet that pays (agent EOA, session key, or MetaMask via wagmi). */
  wallet: WalletClient;
  /** Read client to await the payment receipt. */
  publicClient: PublicClient;
  /** Full URL of the gated endpoint. */
  url: string;
  /** USDC token address (defaults to Arc native USDC). */
  usdc?: Address;
}): Promise<PayAndUnlockResult> {
  const account = args.wallet.account;
  if (!account) return { ok: false, error: "wallet has no account" };
  const usdc = args.usdc ?? ARC_ADDRS.usdc;

  // 1) probe — expect HTTP 402 with payment requirements
  const probe = await fetch(args.url).catch(() => null);
  if (!probe) return { ok: false, error: "probe failed" };
  if (probe.status !== 402) {
    const data = await probe.json().catch(() => null);
    return { ok: probe.ok, data, error: probe.ok ? undefined : `unexpected ${probe.status}` };
  }
  const requirements = (await probe.json().catch(() => null)) as
    | { accepts?: Array<Record<string, unknown>> }
    | null;
  const accept = requirements?.accepts?.[0];
  if (!accept) return { ok: false, error: "no x402 requirements in 402 body" };

  const amount = String(accept.amount ?? "0.01");
  const microAmount = BigInt(Math.round(Number(amount) * 1_000_000));
  const payTo = accept.payTo as Address;

  // 2) pay — USDC ERC-20 transfer to the receiver on Arc
  let txHash: Hash;
  try {
    txHash = await args.wallet.sendTransaction({
      account,
      chain: args.wallet.chain,
      to: usdc,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [payTo, microAmount],
      }),
    });
    await args.publicClient.waitForTransactionReceipt({ hash: txHash });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  // 3) retry with the X-Payment header carrying our tx hash
  const xPayment = JSON.stringify({
    scheme: accept.scheme,
    network: accept.network,
    payTo,
    amount,
    asset: accept.asset,
    txHash,
  });
  const res = await fetch(args.url, { headers: { "x-payment": xPayment } }).catch(() => null);
  if (!res || !res.ok) return { ok: false, txHash, error: `retry failed ${res?.status}` };

  const data = await res.json().catch(() => null);
  return { ok: true, txHash, amountUsdc: amount, data };
}
