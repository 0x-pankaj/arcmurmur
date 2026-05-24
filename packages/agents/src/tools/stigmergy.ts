import {
  decodeEventLog,
  encodeFunctionData,
  keccak256,
  parseAbiItem,
  stringToBytes,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { STIGMERGY_ABI } from "@repo/shared/abi";
import type { SignalEvent } from "@repo/shared/types";
import { env } from "../env";
import {
  agentArcWallet,
  agentAddress,
  arcPublic,
} from "./wallets";
import type { AgentKey } from "@repo/shared/agents";

const SIGNAL_EVENT = parseAbiItem(
  "event Signal(address indexed agent, bytes32 indexed marketId, string agentName, uint16 probBps, uint16 convictionBps, uint8 action, uint64 sizeUsdc, string polymarketSlug, string rationale, bytes32 polygonTxHash, uint64 timestamp)",
);

export function marketIdHash(slug: string): Hex {
  return keccak256(stringToBytes(slug));
}

export type PostSignalArgs = {
  agent: AgentKey;
  agentName: string;
  marketSlug: string;
  probBps: number;
  convictionBps: number;
  action: number;
  sizeUsdc: number; // micro-USDC
  rationale: string;
  polygonTxHash?: `0x${string}`;
};

/** Post a signal on the Arc-deployed StigmergySignal contract. */
export async function postSignal(args: PostSignalArgs): Promise<Hash | null> {
  if (!env.STIGMERGY || env.STIGMERGY.startsWith("0x0000000000000000000000000000000000000000")) {
    console.warn("[stigmergy] STIGMERGY contract address not configured");
    return null;
  }
  const wallet = agentArcWallet(args.agent);
  if (!wallet) {
    console.warn(`[stigmergy] no wallet for agent ${args.agent}`);
    return null;
  }
  const data = encodeFunctionData({
    abi: STIGMERGY_ABI,
    functionName: "post",
    args: [
      marketIdHash(args.marketSlug),
      args.agentName,
      args.probBps,
      args.convictionBps,
      args.action,
      BigInt(args.sizeUsdc),
      args.marketSlug,
      args.rationale.slice(0, 280),
      (args.polygonTxHash ?? "0x" + "0".repeat(64)) as `0x${string}`,
    ],
  });
  try {
    const hash = await wallet.sendTransaction({
      to: env.STIGMERGY as Address,
      data,
    });
    return hash;
  } catch (err) {
    console.error("[stigmergy] postSignal failed:", err);
    return null;
  }
}

export async function readRecentSignals(maxBlocks = 5000): Promise<SignalEvent[]> {
  if (!env.STIGMERGY || env.STIGMERGY.startsWith("0x0000000000000000000000000000000000000000")) {
    return [];
  }
  try {
    const latest = await arcPublic.getBlockNumber();
    const fromBlock = latest > BigInt(maxBlocks) ? latest - BigInt(maxBlocks) : 0n;
    const logs = await arcPublic.getLogs({
      address: env.STIGMERGY as Address,
      event: SIGNAL_EVENT,
      fromBlock,
      toBlock: latest,
    });
    const events: SignalEvent[] = [];
    for (const log of logs) {
      try {
        const dec = decodeEventLog({
          abi: STIGMERGY_ABI,
          data: log.data,
          topics: log.topics,
          eventName: "Signal",
        });
        const a = dec.args as any;
        events.push({
          txHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber ?? 0n),
          timestamp: Number(a.timestamp ?? 0n) * 1000,
          agentAddress: String(a.agent),
          agentName: String(a.agentName),
          marketId: String(a.marketId),
          marketSlug: String(a.polymarketSlug),
          probBps: Number(a.probBps),
          convictionBps: Number(a.convictionBps),
          action: Number(a.action),
          sizeUsdc: Number(a.sizeUsdc),
          rationale: String(a.rationale),
          polygonTxHash: String(a.polygonTxHash),
        });
      } catch {}
    }
    return events.reverse();
  } catch (err) {
    console.warn("[stigmergy] readRecentSignals failed:", err);
    return [];
  }
}

export function agentAddrFor(agent: AgentKey) {
  return agentAddress(agent);
}
