"use client";
import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { ERC20_ABI } from "@repo/shared/abi";
import { SWARM_VAULT_ABI } from "@repo/shared/vaultAbi";
import { fmtUsdc, fmtPct } from "@repo/shared/format";
import { ARC_USDC, VAULT_ADDRESS } from "@/lib/wagmi";
import { ConnectButton } from "./ConnectButton";
import { Wallet, ArrowDownToLine, ArrowUpFromLine, Copy } from "lucide-react";

export function VaultPanel({ explorer }: { explorer: string }) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");

  const vaultConfigured =
    VAULT_ADDRESS && VAULT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const balance = useReadContract({
    abi: ERC20_ABI,
    address: ARC_USDC,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 8000 },
  });

  const allowance = useReadContract({
    abi: [
      {
        type: "function",
        name: "allowance",
        stateMutability: "view",
        inputs: [
          { name: "owner", type: "address" },
          { name: "spender", type: "address" },
        ],
        outputs: [{ type: "uint256" }],
      },
    ] as const,
    address: ARC_USDC,
    functionName: "allowance",
    args: address ? [address, VAULT_ADDRESS] : undefined,
    query: { enabled: !!address && vaultConfigured, refetchInterval: 8000 },
  });

  const userInfo = useReadContract({
    abi: SWARM_VAULT_ABI,
    address: VAULT_ADDRESS,
    functionName: "userInfo",
    args: address ? [address] : undefined,
    query: { enabled: !!address && vaultConfigured, refetchInterval: 8000 },
  });

  const stats = useReadContract({
    abi: SWARM_VAULT_ABI,
    address: VAULT_ADDRESS,
    functionName: "stats",
    query: { enabled: vaultConfigured, refetchInterval: 8000 },
  });

  const { writeContract, data: txHash, isPending, reset } = useWriteContract();
  const { isLoading: confirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const usdcBalanceMicro = (balance.data as bigint | undefined) ?? 0n;
  const allowanceMicro = (allowance.data as bigint | undefined) ?? 0n;
  const amtMicro = (() => {
    if (!amount) return 0n;
    const f = Number(amount);
    if (!Number.isFinite(f) || f <= 0) return 0n;
    return BigInt(Math.floor(f * 1_000_000));
  })();

  const needsApprove = amtMicro > 0n && allowanceMicro < amtMicro;

  const onApprove = () => {
    if (!vaultConfigured) return;
    writeContract({
      abi: ERC20_ABI,
      address: ARC_USDC,
      functionName: "approve",
      args: [VAULT_ADDRESS, 2n ** 96n - 1n], // ~max approve
    });
  };
  const onDeposit = () => {
    if (!vaultConfigured || amtMicro === 0n) return;
    writeContract({
      abi: SWARM_VAULT_ABI,
      address: VAULT_ADDRESS,
      functionName: "deposit",
      args: [amtMicro],
    });
  };
  const onWithdraw = () => {
    if (!vaultConfigured || amtMicro === 0n) return;
    writeContract({
      abi: SWARM_VAULT_ABI,
      address: VAULT_ADDRESS,
      functionName: "withdraw",
      args: [amtMicro],
    });
  };
  const onToggleCopy = (enabled: boolean) => {
    if (!vaultConfigured) return;
    writeContract({
      abi: SWARM_VAULT_ABI,
      address: VAULT_ADDRESS,
      functionName: "setCopyEnabled",
      args: [enabled],
    });
  };

  if (isSuccess && txHash) {
    // refresh + reset for next action
    setTimeout(() => {
      reset();
      balance.refetch();
      allowance.refetch();
      userInfo.refetch();
      stats.refetch();
    }, 200);
  }

  const user = userInfo.data as
    | readonly [bigint, bigint, bigint, boolean, bigint]
    | undefined;
  const totalDeposits = (stats.data as any)?.[0] as bigint | undefined;
  const userCount = (stats.data as any)?.[2] as bigint | undefined;
  const positionCount = (stats.data as any)?.[4] as bigint | undefined;

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] overflow-hidden">
      <header className="border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-[var(--color-accent)]" />
          <h2 className="font-semibold">Swarm vault · Arc Testnet</h2>
        </div>
        <ConnectButton />
      </header>

      {!vaultConfigured ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--color-fg-soft)] space-y-2">
          <div className="text-base text-white">Vault not loaded</div>
          <div className="max-w-md mx-auto leading-snug">
            The site can't see <span className="font-mono text-white">NEXT_PUBLIC_VAULT_CONTRACT</span>.
            If the contracts were just deployed, restart the dev server so Next.js picks up the new <span className="font-mono text-white">.env</span> values.
          </div>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Vault stats column */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
              vault stats
            </div>
            <Stat label="TVL" value={fmtUsdc(Number((totalDeposits ?? 0n)) / 1e6, 2)} />
            <Stat label="Users" value={String(Number(userCount ?? 0n))} />
            <Stat label="Positions opened" value={String(Number(positionCount ?? 0n))} />
            <a
              href={`${explorer}/address/${VAULT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-[var(--color-fg-dim)] hover:text-white"
            >
              vault on arcscan →
            </a>
          </div>

          {/* User position column */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
              your position
            </div>
            {!isConnected ? (
              <div className="text-sm text-[var(--color-fg-soft)]">
                Connect wallet to see your position.
              </div>
            ) : (
              <>
                <Stat
                  label="USDC balance"
                  value={fmtUsdc(Number(usdcBalanceMicro) / 1e6, 2)}
                />
                <Stat
                  label="Shares"
                  value={fmtUsdc(Number(user?.[2] ?? 0n) / 1e6, 2)}
                />
                <Stat
                  label="Est. PnL"
                  value={fmtUsdc(Number(user?.[4] ?? 0n) / 1e6, 2)}
                  tone={
                    Number(user?.[4] ?? 0n) > 0
                      ? "green"
                      : Number(user?.[4] ?? 0n) < 0
                        ? "red"
                        : undefined
                  }
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--color-fg-soft)]">copy swarm</span>
                  <button
                    onClick={() => onToggleCopy(!(user?.[3] ?? false))}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
                      user?.[3]
                        ? "bg-[var(--color-green)]/10 border-[var(--color-green)]/40 text-[var(--color-green)]"
                        : "border-[var(--color-border)] text-[var(--color-fg-dim)]"
                    }`}
                  >
                    <Copy className="size-3" /> {user?.[3] ? "ON" : "OFF"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Action column */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)]">
              deposit / withdraw USDC
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                placeholder="0.00"
                step="0.01"
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-[var(--color-accent)]"
                disabled={!isConnected}
              />
              <button
                onClick={() => setAmount((Number(usdcBalanceMicro) / 1e6).toFixed(2))}
                disabled={!isConnected || usdcBalanceMicro === 0n}
                className="text-[10px] text-[var(--color-fg-soft)] hover:text-white"
              >
                MAX
              </button>
            </div>

            {needsApprove ? (
              <button
                onClick={onApprove}
                disabled={!isConnected || isPending || confirming}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-br from-[var(--color-accent-2)] to-[#0ea5e9] px-3 py-2 text-sm font-medium disabled:opacity-60"
              >
                {isPending || confirming ? "Approving…" : "Approve USDC"}
              </button>
            ) : (
              <button
                onClick={onDeposit}
                disabled={!isConnected || amtMicro === 0n || isPending || confirming}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-gradient-to-br from-[var(--color-accent)] to-[#5b3fe0] px-3 py-2 text-sm font-medium disabled:opacity-60"
              >
                <ArrowDownToLine className="size-4" />
                {isPending || confirming ? "Depositing…" : "Deposit"}
              </button>
            )}

            <button
              onClick={onWithdraw}
              disabled={!isConnected || amtMicro === 0n || isPending || confirming}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:border-white/20 disabled:opacity-60"
            >
              <ArrowUpFromLine className="size-4" />
              Withdraw
            </button>

            {txHash && (
              <a
                href={`${explorer}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="block text-[11px] font-mono text-[var(--color-fg-soft)] hover:text-white truncate"
              >
                tx {txHash.slice(0, 10)}…{txHash.slice(-6)} {confirming ? "(pending)" : isSuccess ? "✓" : ""}
              </a>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red";
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-[var(--color-fg-soft)]">{label}</span>
      <span
        className={`font-mono font-semibold ${
          tone === "green"
            ? "text-[var(--color-green)]"
            : tone === "red"
              ? "text-[var(--color-red)]"
              : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
