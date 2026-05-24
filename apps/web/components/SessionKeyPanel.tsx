"use client";

/**
 * SessionKeyPanel — one-tap auto-copy mode on Arc.
 *
 * Maps to the Agora mentor hint asking for "session keys" on top of ArcOSS
 * primitives. Concretely:
 *
 *   ┌─ user signs ONE MetaMask tx ─┐         ┌─ session key (browser-held) ─┐
 *   │   USDC.transfer(sk, budget)   │  →   →  │  posts StigmergySignal.post(…) │
 *   └───────────────────────────────┘         │  on Arc per high-conviction    │
 *                                             │  swarm tick — no prompt.       │
 *                                             └────────────────────────────────┘
 *
 *   Revoke = session key sweeps remaining USDC back to the user wallet.
 *
 * The session key never leaves this browser. Budget + expiry are enforced
 * client-side AND on-chain implicitly: the session can only spend what the
 * user funded it with.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { ERC20_ABI } from "@repo/shared/abi";
import { ARC_USDC, STIGMERGY_ADDRESS } from "@/lib/wagmi";
import { arcTestnet } from "@repo/shared/chains";
import {
  clearSession,
  formatTimeRemaining,
  generateSessionKey,
  isSessionLive,
  loadSession,
  remainingBudgetMicro,
  saveSession,
  sessionPostSignal,
  sessionSweepUSDC,
  type SessionRecord,
} from "@/lib/sessionKey";
import type { SignalEvent } from "@repo/shared/types";
import { keccak256, stringToBytes, type Hex } from "viem";
import {
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  PowerOff,
  ExternalLink,
} from "lucide-react";

const DEFAULT_BUDGET_USDC = 0.5;
const DEFAULT_TTL_MIN = 60;
const COSIGN_CONVICTION_THRESHOLD = 6500; // 65% conviction triggers auto-cosign

type AutoEntry = {
  ts: number;
  txHash: Hex;
  slug: string;
  conviction: number;
  agent: string;
};

export function SessionKeyPanel({
  signals,
  explorer,
}: {
  signals: SignalEvent[];
  explorer: string;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const lcAddress = address?.toLowerCase() as `0x${string}` | undefined;

  const [session, setSession] = useState<SessionRecord | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [auto, setAuto] = useState<AutoEntry[]>([]);
  const [autoBusy, setAutoBusy] = useState(false);
  const [lastSeenSignalTs, setLastSeenSignalTs] = useState<number>(Date.now());
  const [armOpen, setArmOpen] = useState(false);
  const [budget, setBudget] = useState(DEFAULT_BUDGET_USDC.toString());
  const [ttlMin, setTtlMin] = useState(DEFAULT_TTL_MIN);
  const [armingError, setArmingError] = useState<string | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeTxHash, setRevokeTxHash] = useState<Hex | null>(null);

  // Load session on owner change.
  useEffect(() => {
    if (!lcAddress) {
      setSession(null);
      return;
    }
    setSession(loadSession(lcAddress as `0x${string}`));
    setAuto([]);
  }, [lcAddress]);

  // Tick clock for live "expires in" display.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const live = isSessionLive(session);
  const remaining = session ? remainingBudgetMicro(session) : 0n;
  const msRemaining = session ? Math.max(0, session.expiresAt - now) : 0;

  // Auto-cosign new high-conviction signals while the session is live.
  useEffect(() => {
    if (!session || !live || autoBusy) return;
    if (!STIGMERGY_ADDRESS) return;
    const candidate = signals
      .filter((s) => s.timestamp > lastSeenSignalTs)
      .filter((s) => (s.convictionBps ?? 0) >= COSIGN_CONVICTION_THRESHOLD)
      .filter((s) => s.action === 1 || s.action === 2) // YES/NO only
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    if (!candidate) return;
    // Make sure we don't exceed remaining budget — cosign costs USDC gas only;
    // we burn a small notional via the size field for visibility (no transfer).
    if (remaining < 50_000n) return; // <0.05 USDC left → stop auto-acting.
    setAutoBusy(true);
    (async () => {
      try {
        const marketId = keccak256(
          stringToBytes(candidate.marketSlug || candidate.marketId),
        ) as Hex;
        const hash = await sessionPostSignal(session, {
          marketId,
          agentName: "session-cosign",
          probBps: candidate.probBps ?? 5000,
          convictionBps: candidate.convictionBps ?? 0,
          action: candidate.action,
          sizeUsdc: 0n,
          polymarketSlug: candidate.marketSlug || "",
          rationale: `auto-cosign of ${candidate.agentName} via session key`,
        });
        const entry: AutoEntry = {
          ts: Date.now(),
          txHash: hash,
          slug: candidate.marketSlug || candidate.marketId,
          conviction: candidate.convictionBps ?? 0,
          agent: candidate.agentName,
        };
        setAuto((prev) => [entry, ...prev].slice(0, 5));
        // Estimate ~0.005 USDC gas spend per tx for the budget bar.
        const spent = BigInt(session.spentMicro) + 5_000n;
        const next = {
          ...session,
          spentMicro: spent.toString(),
          autoActions: session.autoActions + 1,
        };
        saveSession(next);
        setSession(next);
        setLastSeenSignalTs(candidate.timestamp);
      } catch {
        // swallow — failed cosign shouldn't crash the page; user can revoke.
      } finally {
        setAutoBusy(false);
      }
    })();
  }, [signals, session, live, autoBusy, lastSeenSignalTs, remaining]);

  // Sync lastSeenSignalTs whenever the session is freshly armed/cleared.
  // On a fresh arm we backdate by 5s so a signal that arrived during the
  // funding confirm can still trigger; on no-session we just freeze at now
  // so the next batch of signals will be considered.
  useEffect(() => {
    setLastSeenSignalTs(Date.now() - (session?.fundingTxHash ? 5000 : 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.address]);

  // ARM: generate session key + user MetaMask tx funding it.
  const { writeContractAsync, data: fundTxHash, reset } = useWriteContract();
  const { isLoading: fundingConfirming, isSuccess: fundingConfirmed } =
    useWaitForTransactionReceipt({ hash: fundTxHash });
  const [pendingSession, setPendingSession] = useState<{
    address: `0x${string}`;
    privateKey: Hex;
    budgetMicro: string;
    expiresAt: number;
  } | null>(null);

  const startArming = useCallback(async () => {
    if (!lcAddress || !isConnected) return;
    setArmingError(null);
    const usdc = Number(budget);
    if (!Number.isFinite(usdc) || usdc <= 0) {
      setArmingError("budget must be > 0 USDC");
      return;
    }
    const microBudget = BigInt(Math.floor(usdc * 1_000_000));
    const sk = generateSessionKey();
    const expiresAt = Date.now() + ttlMin * 60_000;
    try {
      if (chainId !== arcTestnet.id) {
        await switchChainAsync({ chainId: arcTestnet.id });
      }
      setPendingSession({
        address: sk.address,
        privateKey: sk.privateKey,
        budgetMicro: microBudget.toString(),
        expiresAt,
      });
      await writeContractAsync({
        abi: ERC20_ABI,
        address: ARC_USDC,
        functionName: "transfer",
        args: [sk.address, microBudget],
      });
    } catch (e) {
      setArmingError((e as Error).message ?? "failed to arm session");
      setPendingSession(null);
    }
  }, [
    lcAddress,
    isConnected,
    budget,
    ttlMin,
    chainId,
    switchChainAsync,
    writeContractAsync,
  ]);

  // After funding confirms, persist the session.
  useEffect(() => {
    if (!fundingConfirmed || !fundTxHash || !pendingSession || !lcAddress) return;
    const rec: SessionRecord = {
      owner: lcAddress as `0x${string}`,
      privateKey: pendingSession.privateKey,
      address: pendingSession.address,
      expiresAt: pendingSession.expiresAt,
      budgetMicro: pendingSession.budgetMicro,
      spentMicro: "0",
      fundingTxHash: fundTxHash,
      autoActions: 0,
    };
    saveSession(rec);
    setSession(rec);
    setPendingSession(null);
    setArmOpen(false);
    setLastSeenSignalTs(Date.now());
    reset();
  }, [fundingConfirmed, fundTxHash, pendingSession, lcAddress, reset]);

  const revoke = useCallback(async () => {
    if (!session || !lcAddress) return;
    setRevokeBusy(true);
    setRevokeTxHash(null);
    try {
      const hash = await sessionSweepUSDC(session);
      if (hash) setRevokeTxHash(hash);
    } catch {
      // ignore — even if sweep fails, we still clear the local key for safety.
    } finally {
      clearSession(lcAddress as `0x${string}`);
      setSession(null);
      setRevokeBusy(false);
    }
  }, [session, lcAddress]);

  const stigmergyConfigured = useMemo(
    () =>
      !!STIGMERGY_ADDRESS &&
      STIGMERGY_ADDRESS !== "0x0000000000000000000000000000000000000000",
    [],
  );

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden h-full flex flex-col">
      <header className="border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-[var(--color-accent)]" />
          <h2 className="font-semibold">session keys · auto-copy</h2>
        </div>
        {live ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-green)]/15 text-[var(--color-green)] text-[10px] font-mono px-2 py-0.5">
            <span className="size-1.5 rounded-full bg-[var(--color-green)] animate-pulse" />
            ACTIVE
          </span>
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)] font-mono">
            wagmi · viem
          </span>
        )}
      </header>

      <div className="p-4 space-y-3 flex-1">
        {!stigmergyConfigured && (
          <div className="text-[11px] text-[var(--color-red)] font-mono">
            STIGMERGY contract not configured — set NEXT_PUBLIC_STIGMERGY_CONTRACT.
          </div>
        )}

        {!live && !armOpen && (
          <>
            <p className="text-xs text-[var(--color-fg-soft)] leading-relaxed">
              Fund an ephemeral browser key with a USDC budget. While active, it
              auto-broadcasts <span className="font-mono">StigmergySignal.post</span>{" "}
              cosigns whenever the swarm reaches{" "}
              <span className="text-white">≥{COSIGN_CONVICTION_THRESHOLD / 100}% conviction</span>
              {" "}— no MetaMask prompt per tick.
            </p>
            <button
              onClick={() => setArmOpen(true)}
              disabled={!isConnected}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-br from-[var(--color-accent-2)] to-[#0ea5e9] px-3 py-2 text-sm font-medium disabled:opacity-60"
            >
              <Sparkles className="size-4" /> Arm session key
            </button>
            {!isConnected && (
              <div className="text-[11px] text-[var(--color-fg-soft)]">
                connect a wallet to arm a session.
              </div>
            )}
          </>
        )}

        {!live && armOpen && (
          <div className="space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
              new session
            </div>
            <label className="block text-xs text-[var(--color-fg-soft)]">
              budget (USDC)
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0.05"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="mt-1 w-full rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
              />
            </label>
            <label className="block text-xs text-[var(--color-fg-soft)]">
              duration
              <div className="mt-1 grid grid-cols-3 gap-2">
                {[15, 60, 240].map((m) => (
                  <button
                    key={m}
                    onClick={() => setTtlMin(m)}
                    className={`rounded-md border px-2 py-1.5 text-xs font-mono ${
                      ttlMin === m
                        ? "bg-[var(--color-accent)]/15 border-[var(--color-accent)] text-white"
                        : "border-[var(--color-border)] text-[var(--color-fg-dim)]"
                    }`}
                  >
                    {m < 60 ? `${m}m` : `${m / 60}h`}
                  </button>
                ))}
              </div>
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={startArming}
                disabled={fundingConfirming || !isConnected}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-br from-[var(--color-accent)] to-[#5b3fe0] px-3 py-2 text-sm font-medium disabled:opacity-60"
              >
                {fundingConfirming || pendingSession ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> funding key…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" /> sign 1 tx · fund
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setArmOpen(false);
                  setArmingError(null);
                  setPendingSession(null);
                }}
                className="rounded-md border border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-fg-dim)] hover:text-white"
              >
                cancel
              </button>
            </div>
            {armingError && (
              <div className="text-[11px] text-[var(--color-red)] font-mono">
                {armingError}
              </div>
            )}
            {fundTxHash && (
              <a
                href={`${explorer}/tx/${fundTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="block text-[11px] font-mono text-[var(--color-fg-soft)] hover:text-white truncate"
              >
                funding tx {fundTxHash.slice(0, 10)}…
                {fundTxHash.slice(-6)}
              </a>
            )}
          </div>
        )}

        {session && live && (
          <div className="space-y-3">
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 space-y-2">
              <Row label="session key">
                <a
                  href={`${explorer}/address/${session.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-white hover:underline"
                >
                  {session.address.slice(0, 8)}…{session.address.slice(-6)}
                  <ExternalLink className="inline ml-1 size-3" />
                </a>
              </Row>
              <Row label="expires in">
                <span className="font-mono text-xs text-white">
                  {formatTimeRemaining(msRemaining)}
                </span>
              </Row>
              <Row label="budget">
                <span className="font-mono text-xs text-white">
                  {(Number(remaining) / 1e6).toFixed(3)} /{" "}
                  {(Number(BigInt(session.budgetMicro)) / 1e6).toFixed(3)} USDC
                </span>
              </Row>
              <BudgetBar
                spent={Number(session.spentMicro)}
                total={Number(BigInt(session.budgetMicro))}
              />
              <Row label="auto-cosigns">
                <span className="font-mono text-xs text-white">
                  {session.autoActions}
                </span>
              </Row>
            </div>

            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 space-y-2 max-h-48 overflow-auto">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
                auto activity {autoBusy && <span className="ml-1">…</span>}
              </div>
              {auto.length === 0 ? (
                <div className="text-[11px] text-[var(--color-fg-soft)]">
                  waiting for the next ≥
                  {COSIGN_CONVICTION_THRESHOLD / 100}% conviction signal…
                </div>
              ) : (
                <ul className="space-y-1">
                  {auto.map((a) => (
                    <li
                      key={a.txHash}
                      className="text-[11px] font-mono flex items-center justify-between gap-2"
                    >
                      <span className="text-white truncate">
                        {(a.conviction / 100).toFixed(0)}% · {a.agent} →{" "}
                        {a.slug.slice(0, 22)}…
                      </span>
                      <a
                        href={`${explorer}/tx/${a.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--color-fg-soft)] hover:text-white"
                      >
                        ↗
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={revoke}
              disabled={revokeBusy}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-red)]/40 text-[var(--color-red)] hover:bg-[var(--color-red)]/10 px-3 py-2 text-sm disabled:opacity-60"
            >
              {revokeBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> sweeping…
                </>
              ) : (
                <>
                  <PowerOff className="size-4" /> Revoke + sweep
                </>
              )}
            </button>
            {revokeTxHash && (
              <a
                href={`${explorer}/tx/${revokeTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="block text-[11px] font-mono text-[var(--color-fg-soft)] hover:text-white truncate"
              >
                sweep {revokeTxHash.slice(0, 10)}… on Arcscan
              </a>
            )}
          </div>
        )}

        {session && !live && (
          <div className="space-y-2">
            <div className="text-xs text-[var(--color-fg-soft)]">
              Session expired or budget exhausted.
            </div>
            <button
              onClick={revoke}
              className="w-full rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:border-white/20"
            >
              clear + sweep dust
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--color-fg-soft)]">{label}</span>
      {children}
    </div>
  );
}

function BudgetBar({ spent, total }: { spent: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (spent / total) * 100) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-[var(--color-border)] overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-2)]"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
