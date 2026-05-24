import { NextResponse } from "next/server";
import { computeAgentStatus, getState } from "@/lib/swarmCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const agents = computeAgentStatus();
  const { lastTick, lastTickAt } = getState();
  return NextResponse.json({
    agents,
    lastTick,
    lastTickAt,
    stigmergyContract: process.env.NEXT_PUBLIC_STIGMERGY_CONTRACT ?? "",
    arcExplorer: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? process.env.ARC_EXPLORER_URL ?? "https://testnet.arcscan.io",
    demoMode: (process.env.DEMO_MODE ?? "true").toLowerCase() !== "false",
  });
}
