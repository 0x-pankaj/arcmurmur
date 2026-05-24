import { NextResponse } from "next/server";
import { swarmTick } from "@repo/agents/tick";
import { readSwarmSignals } from "@repo/agents";
import { pushTick, setSignals } from "@/lib/swarmCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    dryRun?: boolean;
    maxMarkets?: number;
  };
  const result = await swarmTick({
    dryRun: body.dryRun,
    maxMarkets: body.maxMarkets ?? 6,
  });
  pushTick(result);
  try {
    const fresh = await readSwarmSignals();
    setSignals(fresh);
  } catch {}
  return NextResponse.json(result);
}

export async function GET() {
  return POST(new Request("http://x", { method: "POST", body: "{}" }));
}
