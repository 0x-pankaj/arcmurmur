import type { AgentKey } from "./agents";

export type PolymarketMarket = {
  id: string;
  slug: string;
  question: string;
  description?: string;
  category?: string;
  endDate?: string;
  outcomes: string[];
  outcomePrices: number[];
  volume24h?: number;
  liquidity?: number;
  conditionId?: string;
  tokens?: Array<{ token_id: string; outcome: string; price: number }>;
};

export type AgentDecision = {
  agent: AgentKey;
  agentAddress: string;
  marketId: string;
  marketSlug: string;
  question: string;
  myProb: number;
  marketProb: number;
  edge: number;
  conviction: number;
  action: "BUY_YES" | "BUY_NO" | "PASS";
  sizeUsdc: number;
  rationale: string;
  ts: number;
  trace?: {
    thoughts: string[];
    toolCalls: Array<{ tool: string; args: any; result: any }>;
    rawReasoning?: string;
    finalRationale: string;
  };
};

export type SignalEvent = {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  agentAddress: string;
  agentName: string;
  marketId: string;
  marketSlug: string;
  probBps: number;
  convictionBps: number;
  action: number;
  sizeUsdc: number;
  rationale: string;
  polygonTxHash: string;
};

export type AgentStatus = {
  key: AgentKey;
  name: string;
  emoji: string;
  color: string;
  address: string;
  arcBalanceUsdc: number;
  polygonBalanceUsdc: number;
  signalsPosted: number;
  pnlUsdc: number;
  lastThought?: string;
  lastDecision?: AgentDecision;
};

export type SwarmTickResult = {
  ts: number;
  marketsScanned: number;
  decisions: AgentDecision[];
  signalTxHashes: string[];
  notes: string[];
};
