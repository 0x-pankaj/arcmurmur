import {
  decodeEventLog,
  encodeFunctionData,
  keccak256,
  parseAbiItem,
  stringToBytes,
  type Address,
  type Hash,
} from "viem";
import { generateObject } from "ai";
import { z } from "zod";
import { PROPOSALS_ABI } from "@repo/shared/abi";
import { AGENT_PERSONAS, type AgentKey } from "@repo/shared/agents";
import type {
  AgentDecision,
  MarketProposalEvent,
  PolymarketMarket,
} from "@repo/shared/types";
import { env } from "../env";
import { agentArcWallet, arcPublic } from "./wallets";
import { model, llmAvailable } from "../llm";

const PROPOSED_EVENT = parseAbiItem(
  "event MarketProposed(bytes32 indexed proposalId, address indexed agent, string agentName, string question, string category, uint16 yesProbBps, uint16 convictionBps, string rationale, string evidenceURI, uint64 timestamp)",
);
const ENDORSED_EVENT = parseAbiItem(
  "event ProposalEndorsed(bytes32 indexed proposalId, address indexed agent, string agentName, uint16 convictionBps, string note, uint64 timestamp)",
);

const ProposalSchema = z.object({
  question: z
    .string()
    .min(10)
    .max(220)
    .describe("Yes/No prediction-market question, dated, neutrally worded."),
  category: z.string().max(40),
  yes_prob: z.number().min(0).max(1),
  conviction: z.number().min(0).max(1),
  rationale: z.string().max(200),
});

const PROPOSALS_ADDR = () =>
  (process.env.NEXT_PUBLIC_PROPOSALS_CONTRACT || "") as Address;

function configured() {
  const a = PROPOSALS_ADDR();
  return a && !a.startsWith("0x0000000000000000000000000000000000000000");
}

/**
 * Ask the LLM to derive ONE candidate market — typically a stricter or
 * adjacent variant of `baseMarket` — that the swarm believes is mispriced
 * or under-served. Returns null if the LLM declines or no key is present.
 */
export async function deriveProposal(
  agent: AgentKey,
  baseMarket: PolymarketMarket,
  decision: AgentDecision,
): Promise<z.infer<typeof ProposalSchema> | null> {
  if (!llmAvailable()) return null;
  const persona = AGENT_PERSONAS[agent];
  const sys = `${persona.systemPrompt}

You are now proposing a NEW prediction-market question for Polymarket that
does NOT currently exist there. The question should be:
  - in your domain of expertise (${persona.focus.join(", ")})
  - a clear binary YES/NO, with an unambiguous resolution date in the question
  - meaningfully DIFFERENT from the base market (a stricter threshold, a
    longer horizon, an adjacent topic, or a downstream consequence)
  - something *you* would trade on if it existed.

Return JSON: {question, category, yes_prob, conviction, rationale}.
If you can't think of a good +EV proposal, return conviction <= 0.2.`;
  const user = `Base market on Polymarket: "${baseMarket.question}"
Base market YES implied prob: ${(baseMarket.outcomePrices?.[0] ?? 0.5).toFixed(3)}
Your conviction on the base market: ${decision.conviction.toFixed(2)}
Your prob on the base market: ${decision.myProb.toFixed(3)}
Your rationale: ${decision.rationale}

Propose ONE adjacent market that would be valuable for the swarm to trade.`;
  try {
    const res = (await Promise.race([
      generateObject({
        model: model(),
        schema: ProposalSchema,
        temperature: 0.3,
        system: sys,
        prompt: user,
      }),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("llm-timeout")), 18_000),
      ),
    ])) as { object: z.infer<typeof ProposalSchema> };
    return res.object;
  } catch (err) {
    console.warn(
      `[proposals] LLM derive failed for ${persona.name}: ${(err as Error).message}`,
    );
    return null;
  }
}

export type ProposeResult = {
  ok: boolean;
  txHash?: Hash;
  proposalId?: `0x${string}`;
  error?: string;
};

/** Submit a new MarketProposed onchain (or `endorse` if it already exists). */
export async function submitProposal(
  agent: AgentKey,
  p: {
    question: string;
    category: string;
    yesProbBps: number;
    convictionBps: number;
    rationale: string;
    evidenceURI?: string;
  },
): Promise<ProposeResult> {
  if (!configured()) return { ok: false, error: "PROPOSALS contract not set" };
  const wallet = agentArcWallet(agent);
  if (!wallet) return { ok: false, error: `no wallet for agent ${agent}` };
  const persona = AGENT_PERSONAS[agent];

  const data = encodeFunctionData({
    abi: PROPOSALS_ABI,
    functionName: "propose",
    args: [
      p.question.slice(0, 240),
      p.category.slice(0, 40),
      p.yesProbBps,
      p.convictionBps,
      persona.name,
      p.rationale.slice(0, 200),
      p.evidenceURI ?? "",
    ],
  });

  try {
    const hash = await wallet.sendTransaction({
      to: PROPOSALS_ADDR(),
      data,
    });
    return { ok: true, txHash: hash };
  } catch (err) {
    const msg = (err as Error).message ?? "submit failed";
    // If revert reason includes "exists" -> endorse instead.
    if (/exists/i.test(msg)) {
      return endorseExisting(agent, p);
    }
    return { ok: false, error: msg };
  }
}

async function endorseExisting(
  agent: AgentKey,
  p: { question: string; convictionBps: number; rationale: string },
): Promise<ProposeResult> {
  const wallet = agentArcWallet(agent);
  if (!wallet) return { ok: false, error: `no wallet for agent ${agent}` };
  const persona = AGENT_PERSONAS[agent];
  // proposalId is keccak256(lowercase(question)) — the contract lowercases ASCII.
  const id = keccak256(stringToBytes(p.question.toLowerCase())) as `0x${string}`;

  const data = encodeFunctionData({
    abi: PROPOSALS_ABI,
    functionName: "endorse",
    args: [id, p.convictionBps, persona.name, p.rationale.slice(0, 140)],
  });
  try {
    const hash = await wallet.sendTransaction({
      to: PROPOSALS_ADDR(),
      data,
    });
    return { ok: true, txHash: hash, proposalId: id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Read all proposals + endorsements from the last `maxBlocks` blocks. */
export async function readRecentProposals(
  maxBlocks = 10_000,
): Promise<MarketProposalEvent[]> {
  if (!configured()) return [];
  try {
    const latest = await arcPublic.getBlockNumber();
    const fromBlock =
      latest > BigInt(maxBlocks) ? latest - BigInt(maxBlocks) : 0n;
    const [proposedLogs, endorsedLogs] = await Promise.all([
      arcPublic.getLogs({
        address: PROPOSALS_ADDR(),
        event: PROPOSED_EVENT,
        fromBlock,
        toBlock: latest,
      }),
      arcPublic.getLogs({
        address: PROPOSALS_ADDR(),
        event: ENDORSED_EVENT,
        fromBlock,
        toBlock: latest,
      }),
    ]);

    const byId = new Map<string, MarketProposalEvent>();
    for (const log of proposedLogs) {
      try {
        const dec = decodeEventLog({
          abi: PROPOSALS_ABI,
          data: log.data,
          topics: log.topics,
          eventName: "MarketProposed",
        });
        const a = dec.args as any;
        const pid = String(a.proposalId);
        byId.set(pid, {
          txHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber ?? 0n),
          timestamp: Number(a.timestamp ?? 0n) * 1000,
          proposalId: pid,
          agentAddress: String(a.agent),
          agentName: String(a.agentName),
          question: String(a.question),
          category: String(a.category),
          yesProbBps: Number(a.yesProbBps),
          convictionBps: Number(a.convictionBps),
          rationale: String(a.rationale),
          evidenceURI: String(a.evidenceURI),
          endorsements: [],
          convictionSumBps: Number(a.convictionBps),
        });
      } catch {}
    }
    for (const log of endorsedLogs) {
      try {
        const dec = decodeEventLog({
          abi: PROPOSALS_ABI,
          data: log.data,
          topics: log.topics,
          eventName: "ProposalEndorsed",
        });
        const a = dec.args as any;
        const pid = String(a.proposalId);
        const slot = byId.get(pid);
        if (!slot) continue;
        slot.endorsements.push({
          agentAddress: String(a.agent),
          agentName: String(a.agentName),
          convictionBps: Number(a.convictionBps),
          note: String(a.note),
          txHash: log.transactionHash!,
          timestamp: Number(a.timestamp ?? 0n) * 1000,
        });
        slot.convictionSumBps += Number(a.convictionBps);
      } catch {}
    }
    // newest first
    return [...byId.values()].sort((a, b) => b.timestamp - a.timestamp);
  } catch (err) {
    console.warn("[proposals] readRecentProposals failed:", err);
    return [];
  }
}

/** Mark the proposals env, for status reporting. */
export function proposalsContractAddress(): string | null {
  const a = PROPOSALS_ADDR();
  return a && !a.startsWith("0x0000000000000000000000000000000000000000")
    ? a
    : null;
}
