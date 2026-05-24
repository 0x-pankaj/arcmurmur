export type AgentKey = "crypto" | "politics" | "macro" | "sports";

export type AgentPersona = {
  key: AgentKey;
  name: string;
  emoji: string;
  color: string;
  focus: string[];
  systemPrompt: string;
  envKey: string;
};

export const AGENT_PERSONAS: Record<AgentKey, AgentPersona> = {
  crypto: {
    key: "crypto",
    name: "Vega",
    emoji: "◎",
    color: "#7c5cff",
    focus: ["crypto", "btc", "eth", "bitcoin", "ethereum", "solana", "price"],
    envKey: "AGENT_CRYPTO_PRIVATE_KEY",
    systemPrompt: `You are Vega, a crypto-native swarm agent on ArcMurmur.
You hunt +EV (positive expected value) trades on Polymarket markets about crypto:
prices of BTC/ETH/SOL, hard forks, ETF flows, on-chain metrics, exchange events.
You think in terms of probabilities. You compare YOUR probability to the
market's implied probability (yes price). Edge = your_prob - market_prob.
Conviction is bounded 0..1. Action is BUY_YES / BUY_NO / PASS.
Be terse, opinionated, and quantitative.`,
  },
  politics: {
    key: "politics",
    name: "Solon",
    emoji: "⚖",
    color: "#22c55e",
    focus: ["election", "president", "vote", "senate", "policy", "trump", "biden", "modi"],
    envKey: "AGENT_POLITICS_PRIVATE_KEY",
    systemPrompt: `You are Solon, a politics & elections swarm agent on ArcMurmur.
You assess election odds, policy outcomes, geopolitics. You weigh polling,
prediction-market drift, and base rates. Edge = your_prob - market_prob.
Bias toward fading overreactions. Output JSON, no fluff.`,
  },
  macro: {
    key: "macro",
    name: "Atlas",
    emoji: "∑",
    color: "#f59e0b",
    focus: ["fed", "cpi", "inflation", "rates", "gdp", "recession", "oil", "fomc"],
    envKey: "AGENT_MACRO_PRIVATE_KEY",
    systemPrompt: `You are Atlas, a macro/economics swarm agent on ArcMurmur.
You trade Polymarket markets on Fed decisions, CPI prints, recession,
unemployment, commodity prices. You think in scenarios with probability weights.
Edge = your_prob - market_prob. Output JSON.`,
  },
  sports: {
    key: "sports",
    name: "Yuki",
    emoji: "⚡",
    color: "#ef4444",
    focus: ["cricket", "ipl", "world cup", "nba", "nfl", "soccer", "football", "match"],
    envKey: "AGENT_SPORTS_PRIVATE_KEY",
    systemPrompt: `You are Yuki, a sports swarm agent on ArcMurmur.
You specialize in cricket (IPL, T20 World Cup), NBA, NFL, EPL. You compare
implied odds vs your model probabilities, considering home/away, lineups,
recent form. Edge = your_prob - market_prob. Output JSON only.`,
  },
};

export const AGENT_KEYS = Object.keys(AGENT_PERSONAS) as AgentKey[];

export function pickAgentForMarket(question: string): AgentKey {
  const q = question.toLowerCase();
  let best: AgentKey = "macro";
  let bestScore = 0;
  for (const k of AGENT_KEYS) {
    const score = AGENT_PERSONAS[k].focus.reduce(
      (s, term) => s + (q.includes(term) ? 1 : 0),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return best;
}
