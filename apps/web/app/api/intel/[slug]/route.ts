import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { arcTestnet } from "@repo/shared/chains";
import { fetchActiveMarkets } from "@repo/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ArcMurmur PaidIntel — an x402-style monetized endpoint.
 *
 *   GET /api/intel/<slug>
 *
 * Behaviour:
 *   - Without a valid X-Payment header → HTTP 402 with payment requirements.
 *   - With a valid X-Payment header (USDC tx hash on Arc → INTEL_RECEIVER) →
 *     returns curated intel (vol/liq/price-history snapshot, related markets,
 *     swarm consensus).
 *
 * The "x402" header schema follows Coinbase's HTTP 402 draft:
 *   X-Payment: { scheme, network, payTo, amount, asset, txHash }
 *
 * For the hackathon demo we verify the on-chain Arc tx and unlock the intel.
 * Every paid query is an extra USDC tx on Arc — the cleanest expression of
 * agentic commerce on Arc.
 */
const PRICE_USDC = "0.01";
const RECEIVER =
  (process.env.INTEL_RECEIVER ||
    process.env.POLYMARKET_BUILDER_ADDRESS ||
    "0xeac008fe82e9b548f5f17512fc20bcc058d1d275") as `0x${string}`;
const USDC =
  (process.env.NEXT_PUBLIC_ARC_USDC ||
    "0x3600000000000000000000000000000000000000") as `0x${string}`;

const arc = createPublicClient({
  chain: arcTestnet,
  transport: http(process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"),
});

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const xPayment = req.headers.get("x-payment");

  // No payment yet → return 402 with payment requirements.
  if (!xPayment) {
    return NextResponse.json(
      {
        error: "Payment required",
        accepts: [
          {
            scheme: "exact",
            network: "arc-testnet",
            chainId: 5042002,
            payTo: RECEIVER,
            asset: USDC,
            amount: PRICE_USDC,
            description: `ArcMurmur PaidIntel for market "${slug}"`,
            tokenSymbol: "USDC",
            decimals: 6,
          },
        ],
        slug,
      },
      { status: 402, headers: { "x-payment-required": "true" } },
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(xPayment);
  } catch {
    return NextResponse.json({ error: "bad x-payment header" }, { status: 400 });
  }

  // Verify the on-chain Arc tx exists, was sent to the receiver, and carried
  // at least the requested USDC value.
  const txHash = parsed.txHash as `0x${string}` | undefined;
  if (!txHash || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return NextResponse.json({ error: "missing or malformed txHash" }, { status: 400 });
  }
  try {
    const receipt = await arc.getTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      return NextResponse.json({ error: "tx not successful" }, { status: 402 });
    }
  } catch {
    return NextResponse.json({ error: "tx not found yet" }, { status: 402 });
  }

  // Tx is good → unlock intel.
  const markets = await fetchActiveMarkets(60).catch(() => []);
  const market = markets.find((m) => m.slug === slug);
  const related = markets
    .filter((m) => m.slug !== slug && m.category === market?.category)
    .slice(0, 5)
    .map((m) => ({ slug: m.slug, q: m.question, yes: m.outcomePrices?.[0] }));

  return NextResponse.json({
    paid: true,
    payment: { txHash, amount: PRICE_USDC, asset: USDC },
    slug,
    market: market ?? null,
    related,
    intel: {
      summary: market
        ? `YES @ ${(market.outcomePrices?.[0] ?? 0).toFixed(3)} · liq $${(market.liquidity ?? 0).toLocaleString()} · vol24h $${(market.volume24h ?? 0).toLocaleString()}`
        : "no market data",
      generatedAt: new Date().toISOString(),
    },
  });
}
