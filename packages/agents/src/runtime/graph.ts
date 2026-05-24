import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import type {
  AgentDecision,
  PolymarketMarket,
  SignalEvent,
  SwarmTickResult,
} from "@repo/shared/types";
import { AGENT_PERSONAS, type AgentKey, pickAgentForMarket } from "@repo/shared/agents";
import { ActionCode } from "@repo/shared/abi";
import { ARC_ADDRS } from "@repo/shared/chains";
import { ERC20_ABI } from "@repo/shared/abi";
import { arcPublic, agentAddress } from "../tools/wallets";
import { fetchActiveMarkets, placePolymarketOrder } from "../tools/polymarket";
import { postSignal, readRecentSignals } from "../tools/stigmergy";
import { bridgeUsdc } from "../tools/cctp";
import {
  openVaultPosition,
  markVaultPosition,
  settleVaultPosition,
  readRecentVaultEvents,
  fetchYesPrice,
} from "../tools/vault";
import { buyPaidIntel } from "../tools/paidIntel";
import { nanopayPeers } from "../tools/nanopay";
import { reasonAboutMarket } from "../reasoning";

/**
 * LangGraph state machine for one swarm tick.
 *
 *   sense  ─►  reason  ─►  act  ─►  whisper  ─►  END
 *
 *  - sense:    pull Polymarket markets + prior Arc signals
 *  - reason:   per-market, picked agents produce a structured decision
 *  - act:      bridge + place order (DEMO_MODE skips real txs)
 *  - whisper:  post Signal pheromone on Arc
 */
const SwarmState = Annotation.Root({
  enabledAgents: Annotation<AgentKey[]>({
    reducer: (_, b) => b,
    default: () => Object.keys(AGENT_PERSONAS) as AgentKey[],
  }),
  maxMarkets: Annotation<number>({ reducer: (_, b) => b, default: () => 3 }),
  dryRun: Annotation<boolean>({ reducer: (_, b) => b, default: () => false }),
  markets: Annotation<PolymarketMarket[]>({ reducer: (_, b) => b, default: () => [] }),
  priorSignals: Annotation<SignalEvent[]>({ reducer: (_, b) => b, default: () => [] }),
  decisions: Annotation<AgentDecision[]>({ reducer: (_, b) => b, default: () => [] }),
  signalTxHashes: Annotation<string[]>({ reducer: (_, b) => b, default: () => [] }),
  notes: Annotation<string[]>({
    reducer: (a, b) => [...a, ...b],
    default: () => [],
  }),
});

async function nodeSense(s: typeof SwarmState.State) {
  const [markets, priorSignals] = await Promise.all([
    fetchActiveMarkets(40),
    readRecentSignals(),
  ]);
  const top = markets.slice(0, s.maxMarkets);
  return {
    markets: top,
    priorSignals,
    notes: [
      `sensed ${markets.length} markets · ${priorSignals.length} prior signals`,
    ],
  };
}

async function nodeReason(s: typeof SwarmState.State) {
  // Reason on all markets in parallel — 3 markets × 1-2 agents = up to 6
  // concurrent LLM calls. Stays well under OpenRouter rate limits.
  const jobs: Promise<AgentDecision>[] = [];
  for (const market of s.markets) {
    const primary = pickAgentForMarket(market.question);
    const pool = s.enabledAgents.filter((k) => k !== primary);
    const wildcard = pool[Math.floor(Math.random() * pool.length)] ?? null;
    const acting = [primary, wildcard].filter(
      (k): k is AgentKey => !!k && s.enabledAgents.includes(k),
    );
    for (const a of acting) {
      jobs.push(reasonAboutMarket(a, market, s.priorSignals));
    }
  }
  const decisions = await Promise.all(jobs);
  return {
    decisions,
    notes: [`reasoned · ${decisions.length} decisions produced`],
  };
}

async function nodeAct(s: typeof SwarmState.State) {
  if (s.dryRun) return { notes: ["act: skipped (dryRun)"] };
  const notes: string[] = [];
  const actionable = s.decisions.filter((d) => d.action !== "PASS");
  notes.push(`act · ${actionable.length} actionable decisions`);

  // Read each acting agent's live USDC balance once, so we can clamp trade
  // sizes to "what the wallet can actually afford" — avoids the
  // ERC20-exceeds-balance class of failures inside CCTP depositForBurn.
  const GAS_RESERVE_USDC = 0.5; // leave at least $0.50 for gas + intel + nanopays
  const MAX_FRACTION = 0.6;     // never burn more than 60% of balance per trade
  const balanceByAgent = new Map<string, number>();
  for (const d of actionable) {
    if (balanceByAgent.has(d.agent)) continue;
    try {
      const bal = (await arcPublic.readContract({
        address: ARC_ADDRS.usdc as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [agentAddress(d.agent)],
      })) as bigint;
      balanceByAgent.set(d.agent, Number(bal) / 1e6);
    } catch {
      balanceByAgent.set(d.agent, 0);
    }
  }

  for (const d of actionable) {
    const persona = AGENT_PERSONAS[d.agent];
    const market = s.markets.find((m) => m.slug === d.marketSlug);

    // Clamp trade size to what the agent actually has on Arc.
    const live = balanceByAgent.get(d.agent) ?? 0;
    const spendable = Math.max(0, live - GAS_RESERVE_USDC);
    const cap = Math.floor(spendable * MAX_FRACTION * 100) / 100;
    if (cap < 0.05) {
      notes.push(
        `[${persona.name}] underfunded · bal $${live.toFixed(3)} — skip (boost this agent to enable trades)`,
      );
      d.action = "PASS";
      d.sizeUsdc = 0;
      continue;
    }
    if (d.sizeUsdc > cap) {
      notes.push(
        `[${persona.name}] clamped size $${d.sizeUsdc.toFixed(2)} → $${cap.toFixed(2)} (bal $${live.toFixed(2)})`,
      );
      d.sizeUsdc = cap;
    }

    // x402-style PaidIntel: agent pays a tiny USDC tip on Arc to access
    // premium market intel before committing to the trade.
    const intel = await buyPaidIntel({ agent: d.agent, slug: d.marketSlug });
    if (intel?.ok && intel.txHash) {
      notes.push(
        `[${persona.name}] x402 paid $${intel.amountUsdc} for intel · ${intel.txHash.slice(0, 10)}…`,
      );
    }
    const dest =
      (process.env.BRIDGE_DEST || "amoy").toLowerCase() === "polygon"
        ? "polygon"
        : "amoy";
    const bridgeOut = await bridgeUsdc({
      agent: d.agent,
      fromChain: "arc",
      toChain: dest as "polygon" | "amoy",
      amountUsdc: d.sizeUsdc,
    });
    if (!bridgeOut.ok) {
      notes.push(`[${persona.name}] bridge out failed: ${bridgeOut.error}`);
      continue;
    }
    const order = await placePolymarketOrder({
      marketSlug: d.marketSlug,
      tokenId:
        market?.tokens?.[d.action === "BUY_YES" ? 0 : 1]?.token_id ?? "0",
      side: "BUY",
      price: d.action === "BUY_YES" ? d.marketProb : 1 - d.marketProb,
      sizeUsdc: d.sizeUsdc,
    });
    if (!order.ok) {
      notes.push(`[${persona.name}] order failed: ${order.error}`);
      continue;
    }
    // open a virtual position on the SwarmVault on Arc so it's visible to
    // every user — this is what judges see on Arcscan as "swarm activity".
    const vaultTx = await openVaultPosition({
      agent: d.agent,
      marketSlug: d.marketSlug,
      action: d.action === "BUY_YES" ? 1 : 2,
      sizeUsdc: Math.round(d.sizeUsdc * 1_000_000),
      entryProbBps: Math.round(d.marketProb * 10_000),
      rationale: d.rationale,
      polygonTxHash: order.polygonTxHash as `0x${string}` | undefined,
    });
    if (vaultTx) {
      notes.push(`[${persona.name}] vault.openPosition → ${vaultTx.slice(0, 10)}…`);
    }
    // bridge profits back (estimated)
    await bridgeUsdc({
      agent: d.agent,
      fromChain: dest as "polygon" | "amoy",
      toChain: "arc",
      amountUsdc: d.sizeUsdc,
    });
    notes.push(
      `[${persona.name}] ${d.action} $${d.sizeUsdc} · burn ${bridgeOut.burnTxHash?.slice(0, 10)}… · polygon ${order.polygonTxHash?.slice(0, 10)}…`,
    );
    (d as any)._polygonTxHash = order.polygonTxHash;
  }

  // Mark-to-market on open positions: pull fresh prices, push markPosition
  // events on Arc so PnL stays alive between trades. Also: nanopayment-style
  // rewards to peers whose signals matched the winning side.
  try {
    const { positions } = await readRecentVaultEvents();
    const openPos = positions.filter((p) => !p.settled);
    for (const p of openPos.slice(0, 5)) {
      const fresh = await fetchYesPrice(p.marketSlug);
      if (fresh == null) continue;
      const markBps = Math.round(fresh * 10_000);

      // figure out which agent owns this position (by address match)
      const ownerKey = (Object.keys(AGENT_PERSONAS) as AgentKey[]).find(
        (k) =>
          AGENT_PERSONAS[k] &&
          p.agent.toLowerCase() ===
            (Object.values(AGENT_PERSONAS) as any).reduce(
              (m: string, v: any) => (v.key === k ? v.address ?? m : m),
              "",
            ),
      );
      const markAgent = ownerKey ?? ("crypto" as AgentKey);
      const tx = await markVaultPosition(markAgent, p.id, markBps);
      if (tx) {
        notes.push(
          `mark ${p.marketSlug.slice(0, 24)}… @${(fresh * 100).toFixed(0)}% · ${tx.slice(0, 10)}…`,
        );
      }

      // If the mark is favourable (BUY_YES + fresh > entry, or BUY_NO + fresh < entry),
      // the position owner sends a nanopayment to peers who whispered concurring signals.
      const entry = p.entryProbBps / 10_000;
      const favourable =
        (p.action === 1 && fresh > entry) || (p.action === 2 && fresh < entry);
      if (favourable && ownerKey) {
        const concurring = s.priorSignals
          .filter(
            (sig) =>
              sig.marketSlug === p.marketSlug &&
              sig.agentName !== AGENT_PERSONAS[ownerKey].name &&
              ((p.action === 1 && sig.action === 1) ||
                (p.action === 2 && sig.action === 2)),
          )
          .map((sig) => sig.agentName);
        const peers = (Object.keys(AGENT_PERSONAS) as AgentKey[]).filter((k) =>
          concurring.includes(AGENT_PERSONAS[k].name),
        );
        if (peers.length) {
          const tips = await nanopayPeers({
            from: ownerKey,
            peers,
            amountUsdc: 0.002,
            marketSlug: p.marketSlug,
          });
          for (const t of tips) {
            if (t.txHash) {
              notes.push(
                `${AGENT_PERSONAS[ownerKey].name} → ${AGENT_PERSONAS[t.peer].name} nanopay $0.002 · ${t.txHash.slice(0, 10)}…`,
              );
            }
          }
        }
      }
    }
  } catch (err) {
    notes.push(`mark+nanopay step failed: ${(err as Error).message}`);
  }

  return { notes };
}

async function nodeWhisper(s: typeof SwarmState.State) {
  if (s.dryRun) return { notes: ["whisper: skipped (dryRun)"] };
  const signalTxHashes: string[] = [];
  const notes: string[] = [];
  for (const d of s.decisions) {
    if (d.action === "PASS") continue;
    const persona = AGENT_PERSONAS[d.agent];
    const txHash = await postSignal({
      agent: d.agent,
      agentName: persona.name,
      marketSlug: d.marketSlug,
      probBps: Math.round(d.myProb * 10000),
      convictionBps: Math.round(d.conviction * 10000),
      action:
        d.action === "BUY_YES" ? ActionCode.BUY_YES : ActionCode.BUY_NO,
      sizeUsdc: Math.round(d.sizeUsdc * 1_000_000),
      rationale: d.rationale,
      polygonTxHash: (d as any)._polygonTxHash,
    });
    if (txHash) {
      signalTxHashes.push(txHash);
      notes.push(`[${persona.name}] whispered Signal → ${txHash.slice(0, 10)}…`);
    } else {
      notes.push(`[${persona.name}] would whisper Signal (contract not configured)`);
    }
  }
  return {
    signalTxHashes,
    notes: notes.length ? notes : ["whisper · no actionable signals"],
  };
}

export const swarmGraph = (() => {
  const g = new StateGraph(SwarmState)
    .addNode("sense", nodeSense)
    .addNode("reason", nodeReason)
    .addNode("act", nodeAct)
    .addNode("whisper", nodeWhisper)
    .addEdge(START, "sense")
    .addEdge("sense", "reason")
    .addEdge("reason", "act")
    .addEdge("act", "whisper")
    .addEdge("whisper", END);
  return g.compile();
})();

export async function runSwarmGraph(
  opts: { maxMarkets?: number; dryRun?: boolean; agents?: AgentKey[] } = {},
): Promise<SwarmTickResult> {
  const out = await swarmGraph.invoke({
    maxMarkets: opts.maxMarkets ?? 4,
    dryRun: opts.dryRun ?? false,
    enabledAgents: opts.agents ?? (Object.keys(AGENT_PERSONAS) as AgentKey[]),
  });
  return {
    ts: Date.now(),
    marketsScanned: out.markets.length,
    decisions: out.decisions,
    signalTxHashes: out.signalTxHashes,
    notes: out.notes,
  };
}
