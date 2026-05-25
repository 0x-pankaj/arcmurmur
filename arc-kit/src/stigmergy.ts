/**
 * STIGMERGY — multi-agent coordination with zero orchestrator.
 *
 * Agents never message each other directly. Each agent `post()`s a signal to
 * the StigmergySignal contract on Arc; peers `readRecentSignals()` next tick
 * and adjust their beliefs. The chain IS the message bus — fully verifiable,
 * no Redis, no queue. (Contract source: ../contracts/StigmergySignal.sol)
 */
import {
  decodeEventLog,
  encodeFunctionData,
  keccak256,
  stringToBytes,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { STIGMERGY_ABI } from "./abi";

export const ZERO_BYTES32 = ("0x" + "0".repeat(64)) as Hex;

/** Stable market id from a slug. */
export const marketIdHash = (slug: string): Hex => keccak256(stringToBytes(slug));

export type PostSignalArgs = {
  agentName: string;
  marketSlug: string;
  probBps: number; // 0..10000
  convictionBps: number; // 0..10000
  action: number; // 0 PASS, 1 BUY_YES, 2 BUY_NO, 3 CLOSE
  sizeUsdc: number; // micro-USDC
  rationale: string;
  polygonTxHash?: Hex;
};

/** Drop a pheromone: post a signal from `wallet` to the Stigmergy contract. */
export async function postSignal(
  wallet: WalletClient,
  contract: Address,
  args: PostSignalArgs,
): Promise<Hash> {
  const account = wallet.account;
  if (!account) throw new Error("wallet has no account");
  return wallet.sendTransaction({
    account,
    chain: wallet.chain,
    to: contract,
    data: encodeFunctionData({
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
        args.polygonTxHash ?? ZERO_BYTES32,
      ],
    }),
  });
}

export type SignalEvent = {
  txHash: string;
  blockNumber: number;
  timestamp: number;
  agentAddress: string;
  agentName: string;
  marketSlug: string;
  probBps: number;
  convictionBps: number;
  action: number;
  sizeUsdc: number;
  rationale: string;
};

/** Read recent signals (the whole swarm's shared memory). */
export async function readRecentSignals(
  publicClient: PublicClient,
  contract: Address,
  maxBlocks = 5000,
): Promise<SignalEvent[]> {
  const latest = await publicClient.getBlockNumber();
  const fromBlock = latest > BigInt(maxBlocks) ? latest - BigInt(maxBlocks) : 0n;
  const logs = await publicClient.getLogs({
    address: contract,
    event: STIGMERGY_ABI[0], // Signal event
    fromBlock,
    toBlock: latest,
  });
  const out: SignalEvent[] = [];
  for (const log of logs) {
    try {
      const dec = decodeEventLog({
        abi: STIGMERGY_ABI,
        data: log.data,
        topics: log.topics,
        eventName: "Signal",
      });
      const a = dec.args as Record<string, unknown>;
      out.push({
        txHash: log.transactionHash!,
        blockNumber: Number(log.blockNumber ?? 0n),
        timestamp: Number(a.timestamp ?? 0n) * 1000,
        agentAddress: String(a.agent),
        agentName: String(a.agentName),
        marketSlug: String(a.polymarketSlug),
        probBps: Number(a.probBps),
        convictionBps: Number(a.convictionBps),
        action: Number(a.action),
        sizeUsdc: Number(a.sizeUsdc),
        rationale: String(a.rationale),
      });
    } catch {
      /* skip undecodable */
    }
  }
  return out.reverse();
}
