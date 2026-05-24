"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Hero } from "@/components/Hero";
import { StatBar } from "@/components/StatBar";
import { AgentCards } from "@/components/AgentCards";
import { AgentDrawer } from "@/components/AgentDrawer";
import { BoostAgentModal } from "@/components/BoostAgentModal";
import { SwarmFeed } from "@/components/SwarmFeed";
import { ConsensusHeatmap } from "@/components/ConsensusHeatmap";
import { HowItWorks } from "@/components/HowItWorks";
import { MarketsTable } from "@/components/MarketsTable";
import { VaultPanel } from "@/components/VaultPanel";
import { SignalForm } from "@/components/SignalForm";
import { TractionPanel, type TractionData } from "@/components/TractionPanel";
import { ConnectButton } from "@/components/ConnectButton";
import { Footer } from "@/components/Footer";
import { ActivityTicker } from "@/components/ActivityTicker";
import { Onboarding } from "@/components/Onboarding";
import { ShareCTA } from "@/components/ShareCTA";
import type {
  AgentStatus,
  SignalEvent,
  SwarmTickResult,
} from "@repo/shared/types";

type Status = {
  agents: AgentStatus[];
  lastTick?: SwarmTickResult;
  lastTickAt?: number;
  stigmergyContract: string;
  arcExplorer: string;
  demoMode: boolean;
};
type SignalsResp = {
  signals: SignalEvent[];
  lastTick?: SwarmTickResult;
  lastTickAt?: number;
  recentTicks: SwarmTickResult[];
};
type VaultResp = {
  traction: TractionData;
  positions: Array<{
    id: string;
    txHash: string;
    agent: string;
    marketSlug: string;
    sizeUsdc: number;
    timestamp: number;
  }>;
};

export default function Page() {
  const [status, setStatus] = useState<Status | null>(null);
  const [signalsResp, setSignalsResp] = useState<SignalsResp | null>(null);
  const [vault, setVault] = useState<VaultResp | null>(null);
  const [ticking, setTicking] = useState(false);
  const [autoTick, setAutoTick] = useState(false);
  const [activeAgentKey, setActiveAgentKey] = useState<string | null>(null);
  const [boostAgentKey, setBoostAgentKey] = useState<string | null>(null);
  const autoRef = useRef<NodeJS.Timeout | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, sg, v] = await Promise.all([
        fetch("/api/swarm/status").then((r) => r.json()),
        fetch("/api/swarm/signals").then((r) => r.json()),
        fetch("/api/vault").then((r) => r.json()).catch(() => null),
      ]);
      setStatus(s);
      setSignalsResp(sg);
      if (v) setVault(v);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 8000);
    return () => clearInterval(i);
  }, [refresh]);

  const runTick = useCallback(async () => {
    if (ticking) return;
    setTicking(true);
    try {
      await fetch("/api/swarm/tick", { method: "POST", body: "{}" });
      await refresh();
    } finally {
      setTicking(false);
    }
  }, [refresh, ticking]);

  useEffect(() => {
    if (autoTick) {
      runTick();
      autoRef.current = setInterval(() => {
        runTick();
      }, 30_000);
      return () => {
        if (autoRef.current) clearInterval(autoRef.current);
        autoRef.current = null;
      };
    }
  }, [autoTick, runTick]);

  const agents = status?.agents ?? [];
  const explorer = status?.arcExplorer ?? "https://testnet.arcscan.app";
  const totalSignals = signalsResp?.signals.length ?? 0;
  const marketsScanned = status?.lastTick?.marketsScanned ?? 0;
  const activeAgent = useMemo(
    () => agents.find((a) => a.key === activeAgentKey) ?? null,
    [agents, activeAgentKey],
  );
  const boostAgent = useMemo(
    () => agents.find((a) => a.key === boostAgentKey) ?? null,
    [agents, boostAgentKey],
  );

  return (
    <main>
      <Header />
      <Onboarding />
      <Hero
        onTrigger={runTick}
        ticking={ticking}
        autoTick={autoTick}
        onToggleAuto={() => setAutoTick((x) => !x)}
      />

      <ActivityTicker
        signals={signalsResp?.signals ?? []}
        positions={(vault?.positions ?? []) as any}
        recentNotes={(signalsResp?.recentTicks ?? []).flatMap((t) =>
          (t.notes ?? []).map((n: string) => ({ text: n, ts: t.ts })),
        )}
      />

      <StatBar
        totalSignals={totalSignals}
        marketsScanned={marketsScanned}
        lastTickAt={status?.lastTickAt}
        contract={status?.stigmergyContract ?? ""}
        explorer={explorer}
        demoMode={status?.demoMode ?? true}
      />

      <section className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <VaultPanel explorer={explorer} />
        </div>
        <div className="lg:col-span-2">
          <SignalForm explorer={explorer} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10">
        <TractionPanel
          data={vault?.traction ?? null}
          explorer={explorer}
          vaultAddress={
            (process.env.NEXT_PUBLIC_VAULT_CONTRACT as string | undefined) ||
            undefined
          }
          stigmergyAddress={status?.stigmergyContract}
        />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm uppercase tracking-wider text-[var(--color-fg-soft)]">
            The colony
          </h2>
          <span className="text-xs text-[var(--color-fg-soft)]">
            click an agent to inspect · or hit <span className="text-[var(--color-accent)]">boost</span> to tip them on-chain
          </span>
        </div>
        <AgentCards
          agents={agents}
          explorer={explorer}
          onSelect={(a) => setActiveAgentKey(a.key)}
          onBoost={(a) => setBoostAgentKey(a.key)}
        />
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-10 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <SwarmFeed
            signals={signalsResp?.signals ?? []}
            recentTicks={signalsResp?.recentTicks ?? []}
            explorer={explorer}
          />
          <MarketsTable />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <ConsensusHeatmap ticks={signalsResp?.recentTicks ?? []} />
          <HowItWorks />
        </div>
      </section>

      <Footer />

      <AgentDrawer
        agent={activeAgent}
        signals={signalsResp?.signals ?? []}
        explorer={explorer}
        onClose={() => setActiveAgentKey(null)}
      />
      <BoostAgentModal
        agent={boostAgent}
        explorer={explorer}
        onClose={() => setBoostAgentKey(null)}
      />
    </main>
  );
}

function Header() {
  return (
    <header className="mx-auto max-w-7xl px-6 pt-6 flex items-center justify-between">
      <a href="/" className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-md bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-mono text-sm">
          ✶
        </span>
        <span className="font-semibold tracking-tight">ArcMurmur</span>
        <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)] font-mono">
          v0.4 · agora
        </span>
      </a>
      <div className="flex items-center gap-3">
        <nav className="hidden md:flex items-center gap-5 text-sm text-[var(--color-fg-dim)]">
          <a href="#feed" className="hover:text-white">Feed</a>
          <a
            href="https://agora.thecanteenapp.com/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            Agora
          </a>
          <a
            href="https://docs.arc.io"
            target="_blank"
            rel="noreferrer"
            className="hover:text-white"
          >
            Arc docs
          </a>
        </nav>
        <ShareCTA />
        <ConnectButton />
      </div>
    </header>
  );
}
