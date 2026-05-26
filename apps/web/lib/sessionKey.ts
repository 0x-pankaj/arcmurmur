"use client";

/**
 * Session-key infrastructure for ArcMurmur power users.
 *
 * The crypto + on-chain mechanics (key generation, signing txs from the
 * session key with no MetaMask prompt, sweeping USDC back on revoke) come
 * straight from the standalone **`arc-kit`** primitive — this file only adds
 * ArcMurmur-specific glue: the storage namespace and the StigmergySignal
 * co-sign. Same kit, dogfooded by the live app.
 *
 * What a "session key" means here:
 *   - The browser generates a fresh secp256k1 EOA.
 *   - The user funds it with a small USDC budget via ONE MetaMask transfer.
 *   - Until the budget runs out or the expiry passes, the page posts
 *     StigmergySignal co-signs from that key without prompting MetaMask.
 *   - Revoke = sweep remaining USDC back to the user wallet.
 */

import { encodeFunctionData, type Address, type Hex } from "viem";
import {
  generateSessionKey,
  isSessionLive,
  remainingBudgetMicro,
  sessionSend,
  sessionSweepUSDC,
  type SessionRecord,
} from "arc-kit/session-keys";
import { STIGMERGY_ABI } from "@repo/shared/abi";
import { STIGMERGY_ADDRESS } from "@/lib/wagmi";

// Re-export the kit primitives the UI consumes, so component imports are
// unchanged (`@/lib/sessionKey` stays the single import surface).
export {
  generateSessionKey,
  isSessionLive,
  remainingBudgetMicro,
  sessionSweepUSDC,
  type SessionRecord,
};

// --- ArcMurmur-specific storage (own namespace, preserves existing sessions) ---

const KEY_PREFIX = "arcmurmur::session::";
const storageKey = (owner: Address) => KEY_PREFIX + owner.toLowerCase();

export function loadSession(owner?: Address | null): SessionRecord | null {
  if (!owner || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(owner));
    return raw ? (JSON.parse(raw) as SessionRecord) : null;
  } catch {
    return null;
  }
}

export function saveSession(rec: SessionRecord) {
  if (typeof window !== "undefined")
    window.localStorage.setItem(storageKey(rec.owner), JSON.stringify(rec));
}

export function clearSession(owner: Address) {
  if (typeof window !== "undefined") window.localStorage.removeItem(storageKey(owner));
}

// --- ArcMurmur-specific action: post a StigmergySignal from the session key ---

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
  const data = encodeFunctionData({
    abi: STIGMERGY_ABI,
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
  });
  // The kit drives the session wallet (no MetaMask prompt).
  return sessionSend(rec, STIGMERGY_ADDRESS as Address, data);
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
