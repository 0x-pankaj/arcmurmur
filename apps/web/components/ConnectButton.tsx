"use client";
import { useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { shortAddr } from "@repo/shared/format";
import {
  Wallet,
  LogOut,
  AlertTriangle,
  Copy,
  Check,
  Droplets,
} from "lucide-react";
import { arcTestnet } from "@repo/shared/chains";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();
  const wrongChain = isConnected && chainId !== arcTestnet.id;
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  };

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <button
        onClick={() => connector && connect({ connector })}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-[#5b3fe0] px-3 py-2 text-sm font-medium shadow-lg shadow-purple-900/30 hover:translate-y-[-1px] transition disabled:opacity-60"
      >
        <Wallet className="size-4" />
        {isPending ? "Opening MetaMask…" : "Connect wallet"}
      </button>
    );
  }
  if (wrongChain) {
    return (
      <button
        onClick={() => switchChain({ chainId: arcTestnet.id })}
        disabled={switching}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 px-3 py-2 text-sm text-[var(--color-amber)]"
      >
        <AlertTriangle className="size-4" />
        Switch to Arc Testnet
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] pl-3 pr-1 py-1 text-sm">
      <span className="size-2 rounded-full bg-[var(--color-green)] live-dot" />
      <button
        onClick={onCopy}
        className="font-mono text-xs hover:text-white"
        title="copy address"
      >
        {shortAddr(address)}
      </button>
      <button
        onClick={onCopy}
        className="grid size-6 place-items-center rounded-md text-[var(--color-fg-soft)] hover:text-white"
        title="copy address"
      >
        {copied ? <Check className="size-3 text-[var(--color-green)]" /> : <Copy className="size-3" />}
      </button>
      <a
        href="https://faucet.circle.com"
        target="_blank"
        rel="noreferrer"
        className="grid size-6 place-items-center rounded-md text-[var(--color-accent-2)] hover:bg-white/5"
        title="open Circle faucet"
      >
        <Droplets className="size-3.5" />
      </a>
      <button
        onClick={() => disconnect()}
        className="grid size-6 place-items-center rounded-md text-[var(--color-fg-soft)] hover:text-[var(--color-red)]"
        title="disconnect"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}
