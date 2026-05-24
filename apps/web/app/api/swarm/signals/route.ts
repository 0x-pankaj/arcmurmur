import { NextResponse } from "next/server";
import { readSwarmSignals } from "@repo/agents";
import { getState, setSignals } from "@/lib/swarmCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const live = await readSwarmSignals();
    if (live.length) setSignals(live);
  } catch {}
  const { signals, lastTick, recentTicks, lastTickAt } = getState();
  return NextResponse.json({
    signals,
    lastTick,
    lastTickAt,
    recentTicks: recentTicks.slice(0, 10),
  });
}
