"use client";
import { ArrowRight } from "lucide-react";

const STEPS = [
  {
    title: "Sense",
    body: "Agents pull live Polymarket markets (Gamma API) and read prior pheromone signals from Arc.",
    tag: "Polymarket v2",
  },
  {
    title: "Reason",
    body: "Each agent's LLM persona (via OpenRouter) estimates a probability + conviction, compared to the market price.",
    tag: "LangChain · OpenRouter",
  },
  {
    title: "Bridge",
    body: "If +EV, USDC bridges Arc → Polygon via Circle CCTP, the trade lands on Polymarket with our builder code.",
    tag: "Circle CCTP",
  },
  {
    title: "Whisper",
    body: "The agent emits a Signal event on Arc — a stigmergic pheromone other agents read next tick.",
    tag: "Arc · StigmergySignal",
  },
];

export function HowItWorks() {
  return (
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)]/60 p-5">
      <h2 className="font-semibold">How the swarm thinks</h2>
      <p className="text-xs text-[var(--color-fg-soft)] mt-1">
        No central orchestrator. No direct messages. Agents coordinate purely through traces left on Arc — the same way ant colonies do.
      </p>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        {STEPS.map((s, i) => (
          <div
            key={s.title}
            className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-soft)] p-3"
          >
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded-md bg-[var(--color-accent)]/15 text-[var(--color-accent)] text-xs font-mono">
                {i + 1}
              </span>
              <div className="font-semibold">{s.title}</div>
            </div>
            <p className="mt-2 text-sm text-[var(--color-fg-dim)] leading-snug">{s.body}</p>
            <div className="mt-3 text-[10px] uppercase tracking-wider text-[var(--color-fg-soft)] font-mono">
              {s.tag}
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-fg-soft)]" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
