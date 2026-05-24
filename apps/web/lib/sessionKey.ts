"use client";

/**
 * Session-key infrastructure for ArcMurmur power users.
 *
 * Why this exists — mentor hint (Agora hackathon):
 *   "would love to see more frontend repos — React/Next + wagmi/viem that wire
 *    x402 (client side) + session keys on top of the ArcOSS primitives"
 *
 * What a "session key" means here:
 *   - The browser generates a fresh secp256k1 EOA on demand.
 *   - The user funds the session key with a small USDC budget via ONE MetaMask
 *     transfer (e.g. 0.5 USDC).
 *   - Until the budget runs out or the expiry passes, the page can send
 *     transactions on Arc from that session key without prompting MetaMask.
 *   - Concrete demo use: auto-broadcast `StigmergySignal.post(...)` co-signs
 *     when the swarm reaches high conviction, so the user "rides the swarm"
 *     without signing every tick.
 *   - Revoke = sweep remaining USDC back to the user wallet (signed by the
 *     session key, which the browser holds).
 *
 * This is not ERC-4337. It's the simplest credible session-key UX that still
 * produces real on-chain txs on Arc Testnet, which is what judges can verify.
 * It also avoids adding a paymaster/bundler dependency for the hackathon.
 */

import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_ADDRS } from "@repo/shared/chains";
import { ERC20_ABI, STIGMERGY_ABI } from "@repo/shared/abi";
import { STIGMERGY_ADDRESS } from "@/lib/wagmi";

export type SessionRecord = {
  /** Owner wallet (the user's MetaMask address) — scopes the storage slot. */
  owner: Address;
  /** Session key private key (lives only in this browser, in localStorage). */
  privateKey: Hex;
  /** Derived session-key address — visible on-chain as msg.sender. */
  address: Address;
  /** Wall-clock ms when the session expires. */
  expiresAt: number;
  /** USDC budget (6 decimals, micro) authorized for this session. */
  budgetMicro: string;
  /** USDC spent so far (best-effort, client-tracked). */
  spentMicro: string;
  /** Tx hash of the funding transfer that armed the session. */
  fundingTxHash?: Hex;
  /** Count of auto-broadcast actions this session has performed. */
  autoActions: number;
};

const KEY_PREFIX = "arcmurmur::session::";
function storageKey(owner: Address) {
  return KEY_PREFIX + owner.toLowerCase();
}

export function loadSession(owner?: Address | null): SessionRecord | null {
  if (!owner || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(owner));
    if (!raw) return null;
    return JSON.parse(raw) as SessionRecord;
  } catch {
    return null;
  }
}

export function saveSession(rec: SessionRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(rec.owner), JSON.stringify(rec));
}

export function clearSession(owner: Address) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(owner));
}

/** Fresh session key — keep until the owner funds and saves it. */
export function generateSessionKey(): { privateKey: Hex; address: Address } {
  const pk = generatePrivateKey();
  const acc = privateKeyToAccount(pk);
  return { privateKey: pk, address: acc.address };
}

/** Read-only client for confirmations + balance reads. */
const arcRpc =
  (typeof process !== "undefined" &&
    (process.env.NEXT_PUBLIC_ARC_RPC_URL as string | undefined)) ||
  "https://rpc.testnet.arc.network";

export const arcPublic = createPublicClient({
  chain: arcTestnet,
  transport: http(arcRpc),
});

/** Wallet client driven by the session privkey (no MetaMask prompt). */
export function sessionWalletClient(privateKey: Hex): WalletClient {
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(arcRpc),
  });
}

export function isSessionLive(rec: SessionRecord | null): boolean {
  if (!rec) return false;
  if (Date.now() > rec.expiresAt) return false;
  try {
    return BigInt(rec.spentMicro) < BigInt(rec.budgetMicro);
  } catch {
    return false;
  }
}

export function remainingBudgetMicro(rec: SessionRecord): bigint {
  try {
    const b = BigInt(rec.budgetMicro);
    const s = BigInt(rec.spentMicro);
    return b > s ? b - s : 0n;
  } catch {
    return 0n;
  }
}

/**
 * Post a StigmergySignal from the session key. The session key acts as a new
 * "agent" address on-chain. The Stigmergy contract treats every msg.sender as
 * its own agent identity, so user co-signs show up naturally in the feed.
 *
 * Returns a tx hash on success.
 */
export async function sessionPostSignal(
  rec: SessionRecord,
  args: {
    marketId: Hex;
    agentName: string;
    probBps: number;
    convictionBps: number;
    action: number;
    sizeUsdc: bigint;
    polymarketSlug: string;
    rationale: string;
  },
): Promise<Hex> {
  if (
    !STIGMERGY_ADDRESS ||
    STIGMERGY_ADDRESS === "0x0000000000000000000000000000000000000000"
  ) {
    throw new Error("STIGMERGY contract not configured");
  }
  const account = privateKeyToAccount(rec.privateKey);
  const wallet = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(arcRpc),
  });
  const hash = await wallet.writeContract({
    abi: STIGMERGY_ABI,
    address: STIGMERGY_ADDRESS,
    functionName: "post",
    args: [
      args.marketId,
      args.agentName,
      args.probBps,
      args.convictionBps,
      args.action,
      args.sizeUsdc,
      args.polymarketSlug,
      args.rationale,
      `0x${"0".repeat(64)}` as Hex,
    ],
    account,
    chain: arcTestnet,
  });
  return hash;
}

/** Sweep remaining USDC from session key back to owner — used on Revoke. */
export async function sessionSweepUSDC(rec: SessionRecord): Promise<Hex | null> {
  const account = privateKeyToAccount(rec.privateKey);
  const balance = (await arcPublic.readContract({
    abi: ERC20_ABI,
    address: ARC_ADDRS.usdc as Address,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  if (balance === 0n) return null;
  const wallet = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(arcRpc),
  });
  const hash = await wallet.sendTransaction({
    to: ARC_ADDRS.usdc as Address,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [rec.owner, balance],
    }),
    chain: arcTestnet,
    account,
  });
  return hash;
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
