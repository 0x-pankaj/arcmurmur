/**
 * x402 SERVER — gate any Next.js route behind a USDC payment on Arc.
 *
 * Returns a Next.js App-Router GET handler:
 *   - No `X-Payment` header  → HTTP 402 with payment requirements.
 *   - Valid `X-Payment`      → verifies the Arc tx on-chain, then `unlock()`.
 *
 * Usage (app/api/intel/[slug]/route.ts):
 *
 *   import { createX402Handler } from "arc-kit/x402-server";
 *   export const GET = createX402Handler({
 *     priceUsdc: "0.01",
 *     payTo: process.env.INTEL_RECEIVER as `0x${string}`,
 *     unlock: async (req) => ({ secret: "the gated payload" }),
 *   });
 *
 * The verification here is intentionally minimal (tx exists + succeeded). For
 * production also assert: tx `to` == USDC, decoded `transfer(payTo, >=amount)`,
 * recent block, and a nonce/replay guard so one payment unlocks once.
 */
import { createPublicClient, http, type Address } from "viem";
import { arcTestnet, ARC_ADDRS, ARC_RPC_URL } from "./chain";

export type X402Config = {
  /** Price in whole USDC, e.g. "0.01". */
  priceUsdc: string;
  /** Address that receives the payment. */
  payTo: Address;
  /** USDC token address (defaults to Arc native USDC). */
  usdc?: Address;
  /** Arc RPC url (defaults to env / public). */
  rpcUrl?: string;
  /** Called after payment verifies — return the JSON payload to unlock. */
  unlock: (req: Request) => Promise<unknown> | unknown;
};

export function createX402Handler(cfg: X402Config) {
  const usdc = cfg.usdc ?? ARC_ADDRS.usdc;
  const arc = createPublicClient({
    chain: arcTestnet,
    transport: http(cfg.rpcUrl ?? ARC_RPC_URL),
  });

  return async function GET(req: Request): Promise<Response> {
    const xPayment = req.headers.get("x-payment");

    if (!xPayment) {
      return Response.json(
        {
          error: "Payment required",
          accepts: [
            {
              scheme: "exact",
              network: "arc-testnet",
              chainId: arcTestnet.id,
              payTo: cfg.payTo,
              asset: usdc,
              amount: cfg.priceUsdc,
              tokenSymbol: "USDC",
              decimals: 6,
            },
          ],
        },
        { status: 402, headers: { "x-payment-required": "true" } },
      );
    }

    let parsed: { txHash?: string };
    try {
      parsed = JSON.parse(xPayment);
    } catch {
      return Response.json({ error: "bad x-payment header" }, { status: 400 });
    }

    const txHash = parsed.txHash as `0x${string}` | undefined;
    if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      return Response.json({ error: "missing or malformed txHash" }, { status: 400 });
    }
    try {
      const receipt = await arc.getTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        return Response.json({ error: "tx not successful" }, { status: 402 });
      }
    } catch {
      return Response.json({ error: "tx not found yet" }, { status: 402 });
    }

    const payload = await cfg.unlock(req);
    return Response.json({ paid: true, payment: { txHash, amount: cfg.priceUsdc }, ...(payload as object) });
  };
}
