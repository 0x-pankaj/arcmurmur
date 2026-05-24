import type { SwarmTickResult, SignalEvent } from "@repo/shared/types";
import type { AgentKey } from "@repo/shared/agents";
import { readRecentSignals } from "../tools/stigmergy";
import { runSwarmGraph } from "./graph";
import { env } from "../env";

export type TickOptions = {
  maxMarkets?: number;
  agents?: AgentKey[];
  dryRun?: boolean;
};

/**
 * One full swarm tick — sense → reason → act → whisper, orchestrated by
 * LangGraph (see ./graph.ts). Wrapped here so existing API routes and the
 * CLI don't need to know about the graph internals.
 */
export async function swarmTick(opts: TickOptions = {}): Promise<SwarmTickResult> {
  return runSwarmGraph(opts);
}

export async function readSwarmSignals(): Promise<SignalEvent[]> {
  return readRecentSignals();
}

export { env as swarmEnv };
