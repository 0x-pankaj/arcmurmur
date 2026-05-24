import type { SwarmTickResult, AgentStatus, SignalEvent } from "@repo/shared/types";
import { AGENT_KEYS, AGENT_PERSONAS } from "@repo/shared/agents";
import { agentAddress } from "@repo/agents";

type State = {
  lastTick?: SwarmTickResult;
  lastTickAt?: number;
  signals: SignalEvent[];
  recentTicks: SwarmTickResult[];
};

// Module-singleton in-memory cache. Survives across API requests within one
// Node process — perfect for the hackathon dashboard.
const g = globalThis as unknown as { __arcmurmur_state?: State };
g.__arcmurmur_state ??= { signals: [], recentTicks: [] };
const state = g.__arcmurmur_state!;

export function getState() {
  return state;
}

export function pushTick(t: SwarmTickResult) {
  state.lastTick = t;
  state.lastTickAt = Date.now();
  state.recentTicks.unshift(t);
  if (state.recentTicks.length > 30) state.recentTicks.pop();
}

export function setSignals(signals: SignalEvent[]) {
  state.signals = signals;
}

export function computeAgentStatus(): AgentStatus[] {
  const last = state.lastTick;
  return AGENT_KEYS.map((k) => {
    const p = AGENT_PERSONAS[k];
    const decs = last?.decisions.filter((d) => d.agent === k) ?? [];
    const latest = decs[0];
    const signalsPosted = state.signals.filter(
      (s) => s.agentName === p.name,
    ).length;
    const pnl =
      state.signals
        .filter((s) => s.agentName === p.name)
        .reduce((acc) => acc, 0) + decs.length * 0.0; // placeholder, no settle yet
    return {
      key: k,
      name: p.name,
      emoji: p.emoji,
      color: p.color,
      address: agentAddress(k),
      arcBalanceUsdc: 0,
      polygonBalanceUsdc: 0,
      signalsPosted,
      pnlUsdc: pnl,
      lastThought: latest?.rationale,
      lastDecision: latest,
    };
  });
}
