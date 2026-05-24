import { generateObject } from "ai";
import { z } from "zod";
import type {
  PolymarketMarket,
  AgentDecision,
  SignalEvent,
} from "@repo/shared/types";
import { AGENT_PERSONAS, type AgentKey } from "@repo/shared/agents";
import { model, llmAvailable } from "./llm";
import { env } from "./env";
import { agentAddress } from "./tools/wallets";

const MIN_EDGE = 0.04;
const MAX_SIZE_USDC = 25;

const DecisionSchema = z.object({
  my_prob: z.number().min(0).max(1),
  conviction: z.number().min(0).max(1),
  rationale: z.string().max(240),
});

/**
 * In-memory LLM result cache. Keyed by (agentKey, marketSlug). A hit is
 * returned when the cached entry is younger than LLM_CACHE_TTL_MS AND the
 * Polymarket YES price has moved less than LLM_CACHE_PRICE_DELTA — meaning
 * the market hasn't changed materially since we reasoned.
 *
 * Lives on globalThis so it survives Next.js hot-reloads in dev.
 */
type CacheEntry = {
  ts: number;
  yesPrice: number;
  result: z.infer<typeof DecisionSchema> & { trace: ReasoningTrace };
};
const g = globalThis as unknown as { __arcmurmur_llm_cache?: Map<string, CacheEntry> };
g.__arcmurmur_llm_cache ??= new Map();
const llmCache = g.__arcmurmur_llm_cache!;

let cacheHitCount = 0;
let cacheMissCount = 0;
export function llmCacheStats() {
  return { hits: cacheHitCount, misses: cacheMissCount, size: llmCache.size };
}

export type ReasoningTrace = {
  thoughts: string[];      // step-by-step reasoning lines
  toolCalls: Array<{ tool: string; args: any; result: any }>;
  rawReasoning?: string;   // OpenRouter `reasoning` field (if present)
  finalRationale: string;
};

/**
 * Multi-step, tool-augmented reasoning.
 *
 * The agent:
 *   1) Inspects the market + peer Arc signals + user pheromones.
 *   2) Optionally calls `fetch_news` (Polymarket markets, vault state).
 *   3) Optionally calls `peer_signals` for cross-agent context.
 *   4) Produces a structured {my_prob, conviction, rationale}.
 *
 * For thinking-capable models (DeepSeek V4 Pro, Kimi K2 thinking) we also
 * capture the reasoning trace so the dashboard can render it in the
 * decision drawer.
 */
export async function reasonAboutMarket(
  agent: AgentKey,
  market: PolymarketMarket,
  swarmSignals: SignalEvent[],
  opts: {
    userSignals?: Array<{ lean: number; note: string; user: string }>;
  } = {},
): Promise<AgentDecision & { trace?: ReasoningTrace }> {
  const persona = AGENT_PERSONAS[agent];
  const yesPrice = market.outcomePrices?.[0] ?? 0.5;

  let myProb = heuristicProb(agent, market, swarmSignals);
  let rationale = `heuristic baseline · ${persona.focus[0]}`;
  let convOverride: number | null = null;
  let trace: ReasoningTrace | undefined;

  // Budget guards — skip the LLM call entirely when the agent is clearly
  // out of its domain (heuristic prior is fine), or when we have a fresh
  // cached decision for the same agent/market and the price hasn't moved.
  const inDomain = persona.focus.some((f) =>
    market.question.toLowerCase().includes(f),
  );
  const cacheKey = `${agent}:${market.slug}`;
  const cached = llmCache.get(cacheKey);
  const priceMoved =
    cached && Math.abs(cached.yesPrice - yesPrice) > env.LLM_CACHE_PRICE_DELTA;
  const cacheFresh =
    cached && Date.now() - cached.ts < env.LLM_CACHE_TTL_MS && !priceMoved;

  if (cacheFresh && cached) {
    cacheHitCount++;
    myProb = clamp01(cached.result.my_prob);
    rationale = cached.result.rationale.slice(0, 220);
    convOverride = clamp01(cached.result.conviction);
    trace = cached.result.trace;
  } else if (
    llmAvailable() &&
    (inDomain || !env.LLM_SKIP_OUT_OF_DOMAIN)
  ) {
    cacheMissCount++;
    try {
      const result = await runAgentLoop(agent, market, swarmSignals, opts.userSignals ?? []);
      if (result) {
        myProb = clamp01(result.my_prob);
        rationale = result.rationale.slice(0, 220);
        convOverride = clamp01(result.conviction);
        trace = result.trace;
        llmCache.set(cacheKey, {
          ts: Date.now(),
          yesPrice,
          result,
        });
      }
    } catch (err) {
      console.warn(
        `[reasoning] LLM fallback for ${persona.name}:`,
        (err as Error).message,
      );
    }
  }
  // else: out-of-domain + skip flag on → keep heuristic baseline, no LLM call

  const edge = myProb - yesPrice;
  const conv = convOverride ?? Math.min(1, Math.abs(edge) * 5);
  const decision = buildDecision(agent, market, myProb, yesPrice, conv, rationale);
  return { ...decision, trace };
}

async function runAgentLoop(
  agent: AgentKey,
  market: PolymarketMarket,
  swarmSignals: SignalEvent[],
  userSignals: Array<{ lean: number; note: string; user: string }>,
): Promise<
  | (z.infer<typeof DecisionSchema> & { trace: ReasoningTrace })
  | null
> {
  const persona = AGENT_PERSONAS[agent];
  const yesPrice = market.outcomePrices?.[0] ?? 0.5;
  const thoughts: string[] = [];
  const toolCalls: ReasoningTrace["toolCalls"] = [];

  // Pre-compute context the agent always wants — avoids LLM tool round-trips.
  const peers = swarmSignals
    .filter(
      (s) => s.marketSlug === market.slug && s.agentName !== persona.name,
    )
    .slice(0, 6)
    .map((s) => ({
      agent: s.agentName,
      prob: s.probBps / 10000,
      conviction: s.convictionBps / 10000,
      action: ["PASS", "BUY_YES", "BUY_NO", "CLOSE"][s.action] ?? "?",
      rationale: s.rationale,
    }));
  const userSentiment = userSignals.length
    ? {
        count: userSignals.length,
        avgLean:
          userSignals.reduce((s, x) => s + x.lean, 0) / userSignals.length,
        recent: userSignals.slice(0, 4),
      }
    : null;

  if (peers.length) {
    toolCalls.push({ tool: "peer_signals", args: {}, result: peers });
  }
  if (userSentiment) {
    toolCalls.push({ tool: "user_sentiment", args: {}, result: userSentiment });
  }
  toolCalls.push({
    tool: "market_context",
    args: {},
    result: {
      question: market.question,
      category: market.category,
      yesPrice,
      volume24h: market.volume24h,
      liquidity: market.liquidity,
      endDate: market.endDate,
    },
  });

  const sys = `${persona.systemPrompt}

The user message already includes peer agent signals, user pheromones, and
market context. Reason briefly, then return JSON: {"my_prob","conviction","rationale"}.`;

  const userPrompt = `Market: "${market.question}"
Category: ${market.category ?? "?"}
Market YES implied prob: ${yesPrice.toFixed(3)}
Liquidity: $${(market.liquidity ?? 0).toLocaleString()}
24h volume: $${(market.volume24h ?? 0).toLocaleString()}
End date: ${market.endDate ?? "?"}

Peer agent signals: ${JSON.stringify(peers)}
User sentiment: ${userSentiment ? JSON.stringify(userSentiment) : "(none)"}

Return JSON: {"my_prob":0..1, "conviction":0..1, "rationale":"<=30 words"}.
Be quantitative. If out of your domain, conviction <= 0.2.`;

  let rawReasoning: string | undefined;
  let object: z.infer<typeof DecisionSchema>;

  const reasoningOpts = env.OPENROUTER_REASONING
    ? ({ providerOptions: { openrouter: { reasoning: { enabled: true, exclude: false } } } } as any)
    : {};

  try {
    const res = (await Promise.race([
      generateObject({
        model: model(),
        schema: DecisionSchema,
        temperature: 0.2,
        system: sys,
        prompt: userPrompt,
        ...reasoningOpts,
      }),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("llm-timeout")), 22_000),
      ),
    ])) as { object: z.infer<typeof DecisionSchema>; providerMetadata?: any; experimental_providerMetadata?: any };
    object = res.object;
    rawReasoning =
      res?.providerMetadata?.openrouter?.reasoning ??
      res?.experimental_providerMetadata?.openrouter?.reasoning ??
      undefined;
    if (rawReasoning) thoughts.push(rawReasoning);
  } catch (err) {
    return null;
  }

  return {
    ...object,
    trace: {
      thoughts,
      toolCalls,
      rawReasoning,
      finalRationale: object.rationale,
    },
  };
}

function buildDecision(
  agent: AgentKey,
  market: PolymarketMarket,
  myProb: number,
  marketProb: number,
  conviction: number,
  rationale: string,
): AgentDecision {
  const edge = myProb - marketProb;
  let action: AgentDecision["action"] = "PASS";
  let size = 0;
  if (Math.abs(edge) >= MIN_EDGE && conviction >= 0.25) {
    action = edge > 0 ? "BUY_YES" : "BUY_NO";
    size =
      Math.round(
        MAX_SIZE_USDC * conviction * Math.min(1, Math.abs(edge) * 4) * 100,
      ) / 100;
  }
  return {
    agent,
    agentAddress: agentAddress(agent),
    marketId: market.id,
    marketSlug: market.slug,
    question: market.question,
    myProb,
    marketProb,
    edge,
    conviction,
    action,
    sizeUsdc: size,
    rationale,
    ts: Date.now(),
  };
}

function heuristicProb(
  agent: AgentKey,
  market: PolymarketMarket,
  swarm: SignalEvent[],
): number {
  const persona = AGENT_PERSONAS[agent];
  const q = market.question.toLowerCase();
  const inDomain = persona.focus.some((f) => q.includes(f));
  const market_p = market.outcomePrices?.[0] ?? 0.5;
  const peers = swarm.filter(
    (s) => s.marketSlug === market.slug && s.agentName !== persona.name,
  );
  const avgPeer = peers.length
    ? peers.reduce((s, p) => s + p.probBps / 10000, 0) / peers.length
    : null;
  if (!inDomain) {
    return clamp01(0.7 * market_p + 0.3 * (avgPeer ?? market_p));
  }
  const jitter = (Math.random() - 0.5) * 0.18;
  const prior = clamp01(market_p + jitter * (persona.key === "sports" ? 1.4 : 1));
  return avgPeer === null ? prior : clamp01(0.7 * prior + 0.3 * avgPeer);
}

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}
