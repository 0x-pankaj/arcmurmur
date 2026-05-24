import {
  parseAbiItem,
  type Address,
  type Hash,
} from "viem";
import { ARC_ADDRS } from "@repo/shared/chains";
import { AGENT_PERSONAS, type AgentKey } from "@repo/shared/agents";
import { arcPublic, agentAddress } from "./wallets";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)",
);

export type Erc20Move = {
  txHash: Hash;
  blockNumber: number;
  from: Address;
  to: Address;
  amountMicro: bigint;
};

const INTEL_RECEIVER =
  (process.env.INTEL_RECEIVER ||
    process.env.POLYMARKET_BUILDER_ADDRESS ||
    "0xeac008fe82e9b548f5f17512fc20bcc058d1d275").toLowerCase() as Address;

// Arc RPC caps eth_getLogs at 10k block range AND 20k results per call.
// We solve both by:
//  (a) topic-filtering on from/to (only OUR addresses, not the whole USDC firehose)
//  (b) walking the window in 9_500-block chunks
const ARC_RANGE_CAP = 9_500;
const DEFAULT_MAX_BLOCKS = 250_000;

/**
 * Scan USDC ERC-20 Transfer events on Arc Testnet and classify them into:
 *   - intelPayments    : agent → INTEL_RECEIVER  (x402 fee)
 *   - nanopayments     : agent → another agent   (peer reward)
 *   - boostsReceived   : non-agent → agent       (user boost)
 *
 * Each result carries its txHash so the dashboard can deep-link to Arcscan.
 */
export async function scanErc20Activity(
  maxBlocks = DEFAULT_MAX_BLOCKS,
): Promise<{
  intelPayments: Erc20Move[];
  nanopayments: Erc20Move[];
  boostsReceived: Erc20Move[];
}> {
  const intelPayments: Erc20Move[] = [];
  const nanopayments: Erc20Move[] = [];
  const boostsReceived: Erc20Move[] = [];

  const agentAddrs = (Object.keys(AGENT_PERSONAS) as AgentKey[]).map((k) =>
    agentAddress(k),
  );
  const agentSet = new Set(agentAddrs.map((a) => a.toLowerCase()));

  let latest: bigint;
  try {
    latest = await arcPublic.getBlockNumber();
  } catch (err) {
    console.warn("[erc20Tracker] getBlockNumber failed:", (err as Error).message);
    return { intelPayments, nanopayments, boostsReceived };
  }
  const earliest =
    latest > BigInt(maxBlocks) ? latest - BigInt(maxBlocks) : 0n;

  const seen = new Set<string>(); // dedup across the two-direction queries

  // Walk the window in chunks, doing TWO queries per chunk:
  //  - "from in agents"  → catches intel + outbound nanopays
  //  - "to in agents OR INTEL_RECEIVER" → catches inbound nanopays + user boosts
  for (
    let cursor = latest;
    cursor > earliest;
    cursor -= BigInt(ARC_RANGE_CAP + 1)
  ) {
    const toBlock = cursor;
    const fromBlock =
      cursor > BigInt(ARC_RANGE_CAP)
        ? cursor - BigInt(ARC_RANGE_CAP)
        : 0n;
    if (fromBlock < earliest) {
      // truncate
    }
    try {
      const [outbound, inbound] = await Promise.all([
        arcPublic.getLogs({
          address: ARC_ADDRS.usdc as Address,
          event: TRANSFER_EVENT,
          args: { from: agentAddrs as readonly Address[] },
          fromBlock: fromBlock > earliest ? fromBlock : earliest,
          toBlock,
        }),
        arcPublic.getLogs({
          address: ARC_ADDRS.usdc as Address,
          event: TRANSFER_EVENT,
          args: { to: [...agentAddrs, INTEL_RECEIVER] as readonly Address[] },
          fromBlock: fromBlock > earliest ? fromBlock : earliest,
          toBlock,
        }),
      ]);

      for (const log of [...outbound, ...inbound]) {
        const id = `${log.transactionHash}:${log.logIndex ?? 0}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const from = ((log.args?.from as string) || "").toLowerCase();
        const to = ((log.args?.to as string) || "").toLowerCase();
        const value = (log.args?.value as bigint) ?? 0n;
        const move: Erc20Move = {
          txHash: log.transactionHash!,
          blockNumber: Number(log.blockNumber ?? 0n),
          from: from as Address,
          to: to as Address,
          amountMicro: value,
        };
        const fromIsAgent = agentSet.has(from);
        const toIsAgent = agentSet.has(to);
        if (fromIsAgent && to === INTEL_RECEIVER) {
          intelPayments.push(move);
        } else if (fromIsAgent && toIsAgent && from !== to) {
          nanopayments.push(move);
        } else if (toIsAgent && !fromIsAgent) {
          boostsReceived.push(move);
        }
      }
    } catch (err) {
      // Out of range / rate limit → bail this chunk, keep what we have.
      console.warn(
        `[erc20Tracker] chunk ${fromBlock}-${toBlock} failed:`,
        (err as Error).message,
      );
      continue;
    }
  }

  return { intelPayments, nanopayments, boostsReceived };
}
