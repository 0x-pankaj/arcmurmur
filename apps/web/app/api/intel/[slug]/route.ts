import { createX402Handler } from "arc-kit/x402-server";
import { fetchActiveMarkets } from "@repo/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ArcMurmur PaidIntel — an x402-style monetized endpoint, built on the
 * standalone `arc-kit` primitive (`createX402Handler`).
 *
 *   GET /api/intel/<slug>
 *     - no X-Payment header → HTTP 402 with payment requirements
 *     - valid X-Payment (USDC tx on Arc → receiver) → verified, intel unlocked
 *
 * The same kit handler powers any gated route; here `unlock()` returns the
 * market snapshot + related markets. Agents (packages/agents/paidIntel) and
 * the browser (components/IntelUnlock) both pay through this one gate.
 */
const RECEIVER = (process.env.INTEL_RECEIVER ||
  process.env.POLYMARKET_BUILDER_ADDRESS ||
  "0xeac008fe82e9b548f5f17512fc20bcc058d1d275") as `0x${string}`;

export const GET = createX402Handler({
  priceUsdc: "0.01",
  payTo: RECEIVER,
  unlock: async (req) => {
    const slug = decodeURIComponent(new URL(req.url).pathname.split("/").pop() ?? "");
    const markets = await fetchActiveMarkets(60).catch(() => []);
    const market = markets.find((m) => m.slug === slug);
    const related = markets
      .filter((m) => m.slug !== slug && m.category === market?.category)
      .slice(0, 5)
      .map((m) => ({ slug: m.slug, q: m.question, yes: m.outcomePrices?.[0] }));
    return {
      slug,
      market: market ?? null,
      related,
      intel: {
        summary: market
          ? `YES @ ${(market.outcomePrices?.[0] ?? 0).toFixed(3)} · liq $${(market.liquidity ?? 0).toLocaleString()} · vol24h $${(market.volume24h ?? 0).toLocaleString()}`
          : "no market data",
        generatedAt: new Date().toISOString(),
      },
    };
  },
});
