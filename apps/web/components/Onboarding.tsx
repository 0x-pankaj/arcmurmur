"use client";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { X, Wallet, ExternalLink, Droplets, ArrowDownToLine, Sparkles } from "lucide-react";

const KEY = "arcmurmur:onboarding:dismissed";

export function Onboarding() {
  const { isConnected } = useAccount();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(KEY) === "1") return;
    setOpen(true);
  }, []);

  if (!open) return null;

  const close = () => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {}
    setOpen(false);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 mt-6">
      <div className="relative rounded-2xl border border-[var(--color-accent)]/40 bg-gradient-to-br from-[var(--color-accent)]/10 via-[var(--color-panel)] to-[var(--color-accent-2)]/10 p-5">
        <button
          onClick={close}
          className="absolute right-3 top-3 grid size-7 place-items-center rounded-md hover:bg-white/5"
          aria-label="dismiss"
        >
          <X className="size-4" />
        </button>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-[var(--color-accent)]">
          <Sparkles className="size-3" /> Welcome to ArcMurmur — 4 steps to join the swarm
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <Step
            n={1}
            icon={<Wallet className="size-4" />}
            title="Add Arc Testnet"
            body="MetaMask → Add network. Chain id 5042002 · RPC https://rpc.testnet.arc.network · symbol USDC."
            cta={{ label: "Network info", href: "https://docs.arc.io/integrate/connect-to-arc" }}
          />
          <Step
            n={2}
            icon={<Droplets className="size-4" />}
            title="Get testnet USDC"
            body="Open Circle faucet, select Arc Testnet, paste your address. USDC is the gas token on Arc."
            cta={{ label: "Circle faucet", href: "https://faucet.circle.com" }}
          />
          <Step
            n={3}
            icon={<ArrowDownToLine className="size-4" />}
            title="Connect & deposit"
            body={
              isConnected
                ? "Wallet connected ✓ — go to the Swarm Vault below and deposit any amount."
                : "Click Connect wallet (top-right), then deposit any USDC amount into the Swarm Vault."
            }
          />
          <Step
            n={4}
            icon={<Sparkles className="size-4" />}
            title="Watch the swarm act"
            body='Click "Run swarm tick" in the hero. Four AI agents reason live; every action lands on Arcscan.'
          />
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  body,
  cta,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-panel-2)]/60 p-3">
      <div className="flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-md bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs font-mono">
          {n}
        </span>
        <span className="text-[var(--color-accent-2)]">{icon}</span>
        <span className="font-semibold text-sm">{title}</span>
      </div>
      <p className="mt-2 text-xs text-[var(--color-fg-dim)] leading-snug">{body}</p>
      {cta && (
        <a
          href={cta.href}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-accent-2)] hover:underline"
        >
          {cta.label} <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
