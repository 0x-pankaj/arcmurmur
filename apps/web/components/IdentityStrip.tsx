"use client";
import { useEffect, useState } from "react";
import type { AgentIdentity } from "@repo/shared/types";
import { AGENT_PERSONAS } from "@repo/shared/agents";
import { shortAddr } from "@repo/shared/format";
import { BadgeCheck, ExternalLink } from "lucide-react";

type Resp = {
  identities: AgentIdentity[];
  registry: string;
  standard: string;
};

export function IdentityStrip({ explorer }: { explorer: string }) {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    let alive = true;
    const fetcher = async () => {
      try {
        const r = await fetch("/api/identity").then((r) => r.json());
        if (alive) setData(r);
      } catch {}
    };
    fetcher();
    const i = setInterval(fetcher, 30_000);
    return () => {
      alive = false;
      clearInterval(i);
    };
  }, []);

  const identities = data?.identities ?? [];
  const registered = identities.filter((i) => i.agentId != null);

  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BadgeCheck size={14} className="text-[var(--color-accent-2)]" />
          <h3 className="text-sm font-semibold">Onchain agent identity</h3>
          <span className="rounded-full bg-[var(--color-accent-2)]/15 text-[var(--color-accent-2)] text-[10px] font-mono px-2 py-0.5 uppercase tracking-wider">
            ERC-8004
          </span>
        </div>
        <div className="text-[11px] font-mono text-[var(--color-fg-soft)]">
          {registered.length}/{identities.length || 4} registered
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {identities.map((i) => {
          const p = AGENT_PERSONAS[i.agentKey];
          const isReg = i.agentId != null;
          return (
            <div
              key={i.agentKey}
              className={`rounded-lg border px-2.5 py-2 text-[11px] font-mono ${isReg ? "border-[var(--color-accent-2)]/40 bg-[var(--color-accent-2)]/5" : "border-[var(--color-border)] bg-[var(--color-bg)]"}`}
              title={isReg ? `tokenId ${i.agentId} · click to view on Arcscan` : "Not registered — run pnpm register:agents"}
            >
              <div className="flex items-center justify-between">
                <span style={{ color: p.color }}>{p.emoji}</span>
                <span className="text-white">{p.name}</span>
              </div>
              <div className="mt-1 text-[var(--color-fg-soft)]">
                {isReg ? `#${i.agentId}` : "—"}
              </div>
              <a
                href={`${explorer}/address/${i.agentAddress}`}
                target="_blank"
                rel="noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-[var(--color-fg-soft)] hover:text-white"
              >
                {shortAddr(i.agentAddress)} <ExternalLink size={9} />
              </a>
            </div>
          );
        })}
      </div>

      <footer className="mt-3 flex items-center justify-between text-[11px] text-[var(--color-fg-soft)]">
        <a
          href={`${explorer}/address/${data?.registry ?? "0x8004A818BFB912233c491871b3d84c89A494BD9e"}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 hover:text-white"
        >
          IdentityRegistry on Arcscan <ExternalLink size={10} />
        </a>
        <span className="font-mono">
          {registered.length === 0
            ? "run: pnpm register:agents"
            : "tokenURI = data:json (inline persona)"}
        </span>
      </footer>
    </section>
  );
}
