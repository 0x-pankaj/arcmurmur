import type { PolymarketMarket } from "@repo/shared/types";
import { env } from "../env";

/**
 * Fetch active markets from Polymarket Gamma (public, no auth).
 * Returns top markets ranked by 24h volume.
 */
export async function fetchActiveMarkets(limit = 30): Promise<PolymarketMarket[]> {
  const url = `${env.POLYMARKET_GAMMA_HOST}/markets?active=true&closed=false&limit=${limit}&order=volume24hr&ascending=false`;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`gamma ${res.status}`);
    const json = (await res.json()) as any[];
    return json.map(parseMarket).filter((m): m is PolymarketMarket => !!m);
  } catch (err) {
    console.warn("[polymarket] gamma fetch failed, using fallback fixtures:", err);
    return FALLBACK_MARKETS;
  }
}

function parseMarket(raw: any): PolymarketMarket | null {
  try {
    const outcomes: string[] = JSON.parse(raw.outcomes ?? "[\"Yes\",\"No\"]");
    const outcomePricesRaw: string[] = JSON.parse(raw.outcomePrices ?? "[\"0.5\",\"0.5\"]");
    const outcomePrices = outcomePricesRaw.map((x) => Number(x));
    const tokensRaw = raw.clobTokenIds ? JSON.parse(raw.clobTokenIds) : [];
    const tokens = Array.isArray(tokensRaw)
      ? tokensRaw.map((tid: string, i: number) => ({
          token_id: tid,
          outcome: outcomes[i] ?? `Out${i}`,
          price: outcomePrices[i] ?? 0,
        }))
      : [];
    return {
      id: String(raw.id ?? raw.conditionId ?? raw.slug),
      slug: raw.slug,
      question: raw.question,
      description: raw.description,
      category: raw.category,
      endDate: raw.endDate,
      outcomes,
      outcomePrices,
      volume24h: Number(raw.volume24hr ?? raw.volume ?? 0),
      liquidity: Number(raw.liquidity ?? 0),
      conditionId: raw.conditionId,
      tokens,
    };
  } catch {
    return null;
  }
}

/** Static demo markets so the UI works without network. */
const FALLBACK_MARKETS: PolymarketMarket[] = [
  {
    id: "demo-btc-150k",
    slug: "will-bitcoin-hit-150k-by-2026",
    question: "Will Bitcoin reach $150,000 by end of 2026?",
    category: "Crypto",
    outcomes: ["Yes", "No"],
    outcomePrices: [0.38, 0.62],
    volume24h: 1_240_000,
    liquidity: 480_000,
    conditionId: "0xdemobtc",
    tokens: [
      { token_id: "demo-btc-yes", outcome: "Yes", price: 0.38 },
      { token_id: "demo-btc-no", outcome: "No", price: 0.62 },
    ],
  },
  {
    id: "demo-fed-cut",
    slug: "fed-cuts-rates-june-2026",
    question: "Will the Fed cut rates at the June 2026 FOMC meeting?",
    category: "Macro",
    outcomes: ["Yes", "No"],
    outcomePrices: [0.71, 0.29],
    volume24h: 880_000,
    liquidity: 320_000,
    conditionId: "0xdemofed",
    tokens: [
      { token_id: "demo-fed-yes", outcome: "Yes", price: 0.71 },
      { token_id: "demo-fed-no", outcome: "No", price: 0.29 },
    ],
  },
  {
    id: "demo-ipl-mi",
    slug: "mumbai-indians-ipl-2026-champion",
    question: "Will Mumbai Indians win IPL 2026?",
    category: "Sports",
    outcomes: ["Yes", "No"],
    outcomePrices: [0.18, 0.82],
    volume24h: 240_000,
    liquidity: 90_000,
    conditionId: "0xdemoipl",
    tokens: [
      { token_id: "demo-ipl-yes", outcome: "Yes", price: 0.18 },
      { token_id: "demo-ipl-no", outcome: "No", price: 0.82 },
    ],
  },
  {
    id: "demo-eth-etf",
    slug: "spot-eth-staking-etf-approval-2026",
    question: "Will the SEC approve a spot ETH staking ETF in 2026?",
    category: "Crypto",
    outcomes: ["Yes", "No"],
    outcomePrices: [0.55, 0.45],
    volume24h: 610_000,
    liquidity: 210_000,
    conditionId: "0xdemoeth",
    tokens: [
      { token_id: "demo-eth-yes", outcome: "Yes", price: 0.55 },
      { token_id: "demo-eth-no", outcome: "No", price: 0.45 },
    ],
  },
  {
    id: "demo-us-election",
    slug: "us-2028-democratic-nominee",
    question: "Will the 2028 Democratic nominee be under 60 years old?",
    category: "Politics",
    outcomes: ["Yes", "No"],
    outcomePrices: [0.42, 0.58],
    volume24h: 950_000,
    liquidity: 410_000,
    conditionId: "0xdemoelec",
    tokens: [
      { token_id: "demo-elec-yes", outcome: "Yes", price: 0.42 },
      { token_id: "demo-elec-no", outcome: "No", price: 0.58 },
    ],
  },
];

export type TradeIntent = {
  marketSlug: string;
  tokenId: string;
  side: "BUY" | "SELL";
  price: number; // 0..1
  sizeUsdc: number; // dollars
};

/**
 * Place an order via the Polymarket CLOB v2 endpoint. In DEMO_MODE we don't
 * actually submit — we return a synthetic txHash so the swarm UI still works.
 * Real signing requires the @polymarket/clob-client-v2 EIP-712 flow with the
 * Polygon agent wallet; we stub the network call here but include the builder
 * code so when keys are wired, fees route to our address.
 */
export async function placePolymarketOrder(
  intent: TradeIntent,
): Promise<{ ok: boolean; orderId?: string; polygonTxHash?: string; error?: string }> {
  if (env.DEMO_MODE) {
    const fake = "0x" +
      [...Array(64)]
        .map(() => Math.floor(Math.random() * 16).toString(16))
        .join("");
    return { ok: true, orderId: `demo-${Date.now()}`, polygonTxHash: fake };
  }
  // Live path stub — real CLOB v2 integration would happen here.
  return {
    ok: false,
    error:
      "Live Polymarket trading requires the @polymarket/clob-client-v2 EIP-712 signer wired to a Polygon-funded agent wallet. Run in DEMO_MODE=true for the hackathon, or wire your keys.",
  };
}
