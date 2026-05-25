"use client";

/**
 * SESSION KEYS — in-browser, no account-abstraction infra.
 *
 * The cleanest credible session-key UX on Arc:
 *   1. The browser generates a fresh secp256k1 EOA.
 *   2. The user funds it with a small USDC budget via ONE MetaMask transfer.
 *   3. Until the budget runs out or the expiry passes, the page sends txs from
 *      the session key WITHOUT prompting MetaMask (e.g. auto-cosign a signal).
 *   4. Revoke = sweep remaining USDC back to the user (signed by the session
 *      key, which the browser still holds).
 *
 * Not ERC-4337. No paymaster, no bundler. The session key is bounded two ways:
 * it can only spend what was funded, and it stops at the wall-clock expiry.
 * The private key never leaves the browser (localStorage, scoped to owner).
 */
import {
  createWalletClient,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_ADDRS, ARC_RPC_URL, arcPublicClient } from "./chain";
import { ERC20_ABI } from "./abi";

export type SessionRecord = {
  owner: Address; // user's MetaMask address — scopes the storage slot
  privateKey: Hex; // session key — lives only in this browser
  address: Address; // session-key address, visible on-chain as msg.sender
  expiresAt: number; // wall-clock ms
  budgetMicro: string; // USDC budget (6 decimals)
  spentMicro: string; // best-effort client-tracked spend
  fundingTxHash?: Hex;
  autoActions: number;
};

const KEY_PREFIX = "arckit::session::";
const storageKey = (owner: Address) => KEY_PREFIX + owner.toLowerCase();
const arcPublic = arcPublicClient();

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

/** Fresh session key — keep until the owner funds and saves it. */
export function generateSessionKey(): { privateKey: Hex; address: Address } {
  const pk = generatePrivateKey();
  return { privateKey: pk, address: privateKeyToAccount(pk).address };
}

export function isSessionLive(rec: SessionRecord | null): boolean {
  if (!rec || Date.now() > rec.expiresAt) return false;
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
 * Build the calldata for the ONE funding transfer the USER signs in MetaMask.
 * Send this via your wagmi `useWriteContract` / `useSendTransaction`, then
 * persist the returned tx hash into the SessionRecord.
 */
export function fundingCall(sessionAddress: Address, budgetMicro: bigint) {
  return {
    to: ARC_ADDRS.usdc,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [sessionAddress, budgetMicro],
    }),
  };
}

/** Send an arbitrary tx FROM the session key — no MetaMask prompt. */
export async function sessionSend(
  rec: SessionRecord,
  to: Address,
  data: Hex,
): Promise<Hex> {
  const account = privateKeyToAccount(rec.privateKey);
  const wallet = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });
  return wallet.sendTransaction({ account, chain: arcTestnet, to, data });
}

/** Sweep remaining USDC from the session key back to the owner — on Revoke. */
export async function sessionSweepUSDC(rec: SessionRecord): Promise<Hex | null> {
  const account = privateKeyToAccount(rec.privateKey);
  const balance = (await arcPublic.readContract({
    abi: ERC20_ABI,
    address: ARC_ADDRS.usdc,
    functionName: "balanceOf",
    args: [account.address],
  })) as bigint;
  if (balance === 0n) return null;
  return sessionSend(
    rec,
    ARC_ADDRS.usdc,
    encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [rec.owner, balance] }),
  );
}
