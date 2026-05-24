import {
  decodeEventLog,
  encodeFunctionData,
  parseAbiItem,
  type Address,
  type Hash,
} from "viem";
import {
  ERC8004,
  ERC8004_IDENTITY_ABI,
  ERC8004_REPUTATION_ABI,
} from "@repo/shared/abi";
import { AGENT_KEYS, AGENT_PERSONAS, type AgentKey } from "@repo/shared/agents";
import type { AgentIdentity } from "@repo/shared/types";
import {
  agentArcWallet,
  agentAddress,
  arcPublic,
} from "./wallets";

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
);

/**
 * Register an agent against the Arc-deployed ERC-8004 IdentityRegistry.
 * Mints an identity NFT under the agent's own wallet. Idempotent: if the
 * agent already owns an identity, this is a no-op.
 */
export async function registerAgentIdentity(
  agent: AgentKey,
  metadataURI: string,
): Promise<{ txHash?: Hash; tokenId?: string; alreadyRegistered: boolean; error?: string }> {
  const wallet = agentArcWallet(agent);
  if (!wallet) return { alreadyRegistered: false, error: `no wallet for ${agent}` };
  const addr = agentAddress(agent);

  const existing = await lookupAgentId(addr);
  if (existing) {
    return { tokenId: existing.toString(), alreadyRegistered: true };
  }

  const data = encodeFunctionData({
    abi: ERC8004_IDENTITY_ABI,
    functionName: "register",
    args: [metadataURI],
  });
  try {
    const hash = await wallet.sendTransaction({
      to: ERC8004.IDENTITY_REGISTRY as Address,
      data,
    });
    // Wait so we can look up the freshly-minted tokenId.
    const receipt = await arcPublic.waitForTransactionReceipt({ hash });
    const id = await lookupAgentIdSinceBlock(addr, receipt.blockNumber);
    return {
      txHash: hash,
      tokenId: id?.toString(),
      alreadyRegistered: false,
    };
  } catch (err) {
    return { alreadyRegistered: false, error: (err as Error).message };
  }
}

/** Find an agent's ERC-8004 tokenId by scanning Transfer-to-owner events. */
export async function lookupAgentId(owner: Address): Promise<bigint | null> {
  try {
    const latest = await arcPublic.getBlockNumber();
    const span = 50_000n;
    const fromBlock = latest > span ? latest - span : 0n;
    const logs = await arcPublic.getLogs({
      address: ERC8004.IDENTITY_REGISTRY as Address,
      event: TRANSFER_EVENT,
      args: { to: owner },
      fromBlock,
      toBlock: latest,
    });
    const last = logs[logs.length - 1];
    if (!last) return null;
    return (last.args.tokenId ?? null) as bigint | null;
  } catch {
    return null;
  }
}

async function lookupAgentIdSinceBlock(
  owner: Address,
  fromBlock: bigint,
): Promise<bigint | null> {
  try {
    const logs = await arcPublic.getLogs({
      address: ERC8004.IDENTITY_REGISTRY as Address,
      event: TRANSFER_EVENT,
      args: { to: owner },
      fromBlock,
      toBlock: fromBlock,
    });
    const last = logs[logs.length - 1];
    if (!last) return null;
    return (last.args.tokenId ?? null) as bigint | null;
  } catch {
    return null;
  }
}

/** Read tokenURI for an already-registered agent. */
export async function readAgentMetadataURI(
  tokenId: bigint,
): Promise<string | null> {
  try {
    const uri = (await arcPublic.readContract({
      address: ERC8004.IDENTITY_REGISTRY as Address,
      abi: ERC8004_IDENTITY_ABI,
      functionName: "tokenURI",
      args: [tokenId],
    })) as string;
    return uri || null;
  } catch {
    return null;
  }
}

export async function getAllAgentIdentities(): Promise<AgentIdentity[]> {
  const out: AgentIdentity[] = [];
  for (const k of AGENT_KEYS) {
    const addr = agentAddress(k);
    const id = await lookupAgentId(addr);
    const tokenURI = id != null ? await readAgentMetadataURI(id) : null;
    out.push({
      agentKey: k,
      agentAddress: addr,
      agentId: id != null ? id.toString() : null,
      tokenURI,
      registeredAt: null,
      registrationTx: null,
      reputationCount: 0,
    });
  }
  return out;
}

/**
 * Record reputation feedback for an agent (per ERC-8004, the validator
 * wallet must be DIFFERENT from the agent owner). For ArcMurmur we let
 * peer agents leave feedback for each other after a profitable settlement.
 */
export async function recordPeerFeedback(opts: {
  fromAgent: AgentKey;
  forAgentId: bigint;
  score: number; // 0..100
  tag: string;
}): Promise<{ txHash?: Hash; error?: string }> {
  const wallet = agentArcWallet(opts.fromAgent);
  if (!wallet) return { error: `no wallet for ${opts.fromAgent}` };
  const { keccak256, stringToBytes } = await import("viem");
  const feedbackHash = keccak256(stringToBytes(opts.tag));
  const data = encodeFunctionData({
    abi: ERC8004_REPUTATION_ABI,
    functionName: "giveFeedback",
    args: [
      opts.forAgentId,
      BigInt(opts.score),
      0,
      opts.tag.slice(0, 32),
      "",
      "",
      "",
      feedbackHash,
    ],
  });
  try {
    const hash = await wallet.sendTransaction({
      to: ERC8004.REPUTATION_REGISTRY as Address,
      data,
    });
    return { txHash: hash };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/** Build a minimal ERC-8004 metadata JSON for an agent persona. */
export function agentMetadataJson(agent: AgentKey) {
  const p = AGENT_PERSONAS[agent];
  return {
    name: `${p.name} · ArcMurmur swarm`,
    description: `Autonomous stigmergic agent on Arc. Domain: ${p.focus.join(", ")}. Trades Polymarket via CCTP, coordinates with peer agents via on-chain Signal pheromones.`,
    agent_type: "trading",
    image: "",
    capabilities: [
      "polymarket_signal_posting",
      "cctp_v2_burn_and_mint",
      "x402_intel_payments",
      "peer_nanopayments",
      ...p.focus.map((f) => `domain:${f}`),
    ],
    version: "0.4.0",
    homepage: "https://arcmurmur.app",
  };
}

// Silence ts unused: re-export for the import side-effect convenience.
export const ERC8004_ADDRESSES = ERC8004;
