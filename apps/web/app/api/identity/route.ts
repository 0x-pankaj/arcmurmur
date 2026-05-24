import { NextResponse } from "next/server";
import { getAllAgentIdentities } from "@repo/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let identities: Awaited<ReturnType<typeof getAllAgentIdentities>> = [];
  try {
    identities = await getAllAgentIdentities();
  } catch (err) {
    console.warn("[api/identity] read failed:", (err as Error).message);
  }
  return NextResponse.json({
    identities,
    registry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
    standard: "ERC-8004",
  });
}
