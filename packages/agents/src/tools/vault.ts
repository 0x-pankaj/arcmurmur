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
import { SWARM_VAULT_ABI } from "@repo/shared/vaultAbi";
import { env } from "../env";
import { agentArcWallet, arcPublic } from "./wallets";
import type { AgentKey } from "@repo/shared/agents";

const VAULT = (process.env.NEXT_PUBLIC_VAULT_CONTRACT ||
  "") as `0x${string}`;

const POSITION_OPENED = parseAbiItem(
  "event PositionOpened(uint256 indexed id, address indexed agent, bytes32 indexed marketId, string marketSlug, uint8 action, uint64 sizeUsdc, uint64 entryProbBps, string rationale, bytes32 polygonTxHash, uint64 timestamp)",
);
const POSITION_SETTLED = parseAbiItem(
  "event PositionSettled(uint256 indexed id, int64 pnlMicroUsdc, bytes32 polygonTxHash)",
);
const POSITION_MARKED = parseAbiItem(
  "event PositionMarked(uint256 indexed id, int64 unrealizedDeltaMicroUsdc, uint64 markProbBps)",
);
const USER_SIGNAL = parseAbiItem(
  "event UserSignal(address indexed user, bytes32 indexed marketId, string marketSlug, int8 lean, string note, uint64 timestamp)",
);
const DEPOSIT = parseAbiItem(
  "event Deposit(address indexed user, uint256 amount, uint128 newShares, uint64 totalUsers)",
);

export function vaultConfigured() {
  return (
    !!VAULT &&
    VAULT.toLowerCase() !== "0x0000000000000000000000000000000000000000"
  );
}

function marketIdHash(slug: string): Hex {
  return keccak256(stringToBytes(slug));
}

export async function openVaultPosition(args: {
  agent: AgentKey;
  marketSlug: string;
  action: 1 | 2;
  sizeUsdc: number; // micro-USDC
  entryProbBps: number;
  rationale: string;
  polygonTxHash?: `0x${string}`;
}): Promise<Hash | null> {
  if (!vaultConfigured()) return null;
  const wallet = agentArcWallet(args.agent);
  if (!wallet) return null;
  const data = encodeFunctionData({
    abi: SWARM_VAULT_ABI,
    functionName: "openPosition",
    args: [
      marketIdHash(args.marketSlug),
      args.marketSlug,
      args.action,
      BigInt(args.sizeUsdc),
      BigInt(args.entryProbBps),
      args.rationale.slice(0, 280),
      (args.polygonTxHash ?? ("0x" + "0".repeat(64))) as `0x${string}`,
    ],
  });
  try {
    return await wallet.sendTransaction({ to: VAULT, data });
  } catch (e) {
    console.warn("[vault] openPosition failed:", (e as Error).message);
    return null;
  }
}

export async function markVaultPosition(
  agent: AgentKey,
  id: bigint,
  markProbBps: number,
): Promise<Hash | null> {
  if (!vaultConfigured()) return null;
  const wallet = agentArcWallet(agent);
  if (!wallet) return null;
  const data = encodeFunctionData({
    abi: SWARM_VAULT_ABI,
    functionName: "markPosition",
    args: [id, BigInt(markProbBps)],
  });
  try {
    return await wallet.sendTransaction({ to: VAULT, data });
  } catch (e) {
    console.warn("[vault] markPosition failed:", (e as Error).message);
    return null;
  }
}

export async function settleVaultPosition(
  agent: AgentKey,
  id: bigint,
  pnlMicroUsdc: bigint,
  polygonTxHash?: `0x${string}`,
): Promise<Hash | null> {
  if (!vaultConfigured()) return null;
  const wallet = agentArcWallet(agent);
  if (!wallet) return null;
  const data = encodeFunctionData({
    abi: SWARM_VAULT_ABI,
    functionName: "settlePosition",
    args: [
      id,
      pnlMicroUsdc,
      (polygonTxHash ?? ("0x" + "0".repeat(64))) as `0x${string}`,
    ],
  });
  try {
    return await wallet.sendTransaction({ to: VAULT, data });
  } catch (e) {
    console.warn("[vault] settlePosition failed:", (e as Error).message);
    return null;
  }
}

export type VaultStats = {
  totalDeposits: bigint;
  totalShares: bigint;
  userCount: number;
  signalCount: number;
  positionCount: number;
  realizedMicroUsdc: bigint;
  unrealizedMicroUsdc: bigint;
};

export async function readVaultStats(): Promise<VaultStats | null> {
  if (!vaultConfigured()) return null;
  try {
    const r = (await arcPublic.readContract({
      address: VAULT,
      abi: SWARM_VAULT_ABI,
      functionName: "stats",
    })) as unknown as readonly [
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ];
    return {
      totalDeposits: r[0],
      totalShares: r[1],
      userCount: Number(r[2]),
      signalCount: Number(r[3]),
      positionCount: Number(r[4]),
      realizedMicroUsdc: r[5],
      unrealizedMicroUsdc: r[6],
    };
  } catch (e) {
    console.warn("[vault] readVaultStats failed:", (e as Error).message);
    return null;
  }
}

export type VaultPosition = {
  id: bigint;
  txHash: string;
  agent: string;
  marketId: string;
  marketSlug: string;
  action: number;
  sizeUsdc: number; // micro-USDC
  entryProbBps: number;
  rationale: string;
  polygonTxHash: string;
  timestamp: number; // ms
  settled?: boolean;
  pnlMicroUsdc?: number;
  lastMarkBps?: number;
};

export async function readRecentVaultEvents(maxBlocks = 8000) {
  if (!vaultConfigured()) {
    return {
      positions: [] as VaultPosition[],
      userSignals: [] as Array<{
        user: string;
        marketSlug: string;
        marketId: string;
        lean: number;
        note: string;
        timestamp: number;
        txHash: string;
      }>,
      depositors: new Set<string>(),
    };
  }
  try {
    const latest = await arcPublic.getBlockNumber();
    const fromBlock = latest > BigInt(maxBlocks) ? latest - BigInt(maxBlocks) : 0n;
    const [openedLogs, settledLogs, markedLogs, signalLogs, depositLogs] =
      await Promise.all([
        arcPublic.getLogs({ address: VAULT, event: POSITION_OPENED, fromBlock, toBlock: latest }),
        arcPublic.getLogs({ address: VAULT, event: POSITION_SETTLED, fromBlock, toBlock: latest }),
        arcPublic.getLogs({ address: VAULT, event: POSITION_MARKED, fromBlock, toBlock: latest }),
        arcPublic.getLogs({ address: VAULT, event: USER_SIGNAL, fromBlock, toBlock: latest }),
        arcPublic.getLogs({ address: VAULT, event: DEPOSIT, fromBlock, toBlock: latest }),
      ]);
    const positions = new Map<string, VaultPosition>();
    for (const log of openedLogs) {
      try {
        const a = (
          decodeEventLog({
            abi: SWARM_VAULT_ABI,
            data: log.data,
            topics: log.topics,
            eventName: "PositionOpened",
          }).args as any
        );
        const id = a.id as bigint;
        positions.set(id.toString(), {
          id,
          txHash: log.transactionHash!,
          agent: String(a.agent),
          marketId: String(a.marketId),
          marketSlug: String(a.marketSlug),
          action: Number(a.action),
          sizeUsdc: Number(a.sizeUsdc),
          entryProbBps: Number(a.entryProbBps),
          rationale: String(a.rationale),
          polygonTxHash: String(a.polygonTxHash),
          timestamp: Number(a.timestamp) * 1000,
        });
      } catch {}
    }
    for (const log of markedLogs) {
      try {
        const a = (
          decodeEventLog({
            abi: SWARM_VAULT_ABI,
            data: log.data,
            topics: log.topics,
            eventName: "PositionMarked",
          }).args as any
        );
        const pos = positions.get((a.id as bigint).toString());
        if (pos) pos.lastMarkBps = Number(a.markProbBps);
      } catch {}
    }
    for (const log of settledLogs) {
      try {
        const a = (
          decodeEventLog({
            abi: SWARM_VAULT_ABI,
            data: log.data,
            topics: log.topics,
            eventName: "PositionSettled",
          }).args as any
        );
        const pos = positions.get((a.id as bigint).toString());
        if (pos) {
          pos.settled = true;
          pos.pnlMicroUsdc = Number(a.pnlMicroUsdc);
        }
      } catch {}
    }
    const userSignals = signalLogs
      .map((log) => {
        try {
          const a = (
            decodeEventLog({
              abi: SWARM_VAULT_ABI,
              data: log.data,
              topics: log.topics,
              eventName: "UserSignal",
            }).args as any
          );
          return {
            user: String(a.user),
            marketSlug: String(a.marketSlug),
            marketId: String(a.marketId),
            lean: Number(a.lean),
            note: String(a.note),
            timestamp: Number(a.timestamp) * 1000,
            txHash: log.transactionHash!,
          };
        } catch {
          return null;
        }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .reverse();

    const depositors = new Set<string>();
    for (const log of depositLogs) {
      try {
        const a = (
          decodeEventLog({
            abi: SWARM_VAULT_ABI,
            data: log.data,
            topics: log.topics,
            eventName: "Deposit",
          }).args as any
        );
        depositors.add(String(a.user).toLowerCase());
      } catch {}
    }

    return {
      positions: [...positions.values()].reverse(),
      userSignals,
      depositors,
    };
  } catch (e) {
    console.warn("[vault] readRecentVaultEvents failed:", (e as Error).message);
    return {
      positions: [] as VaultPosition[],
      userSignals: [] as any[],
      depositors: new Set<string>(),
    };
  }
}

/** Fetch current price for a slug from Polymarket Gamma (used for marking). */
export async function fetchYesPrice(slug: string): Promise<number | null> {
  try {
    const r = await fetch(
      `${env.POLYMARKET_GAMMA_HOST}/markets?slug=${encodeURIComponent(slug)}&limit=1`,
    );
    if (!r.ok) return null;
    const json = (await r.json()) as any[];
    const m = json?.[0];
    if (!m) return null;
    const prices = JSON.parse(m.outcomePrices ?? "[\"0.5\",\"0.5\"]");
    return Number(prices?.[0] ?? 0.5);
  } catch {
    return null;
  }
}

export const vaultAddress = () => VAULT;
