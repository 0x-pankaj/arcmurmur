import { NextResponse } from "next/server";
import { readRecentProposals, proposalsContractAddress } from "@repo/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let proposals: Awaited<ReturnType<typeof readRecentProposals>> = [];
  try {
    proposals = await readRecentProposals();
  } catch (err) {
    console.warn("[api/proposals] read failed:", (err as Error).message);
  }
  // Rank: convictionSum + 1 point per endorser, newest as tiebreak.
  const ranked = [...proposals].sort((a, b) => {
    const sa = a.convictionSumBps + a.endorsements.length * 2000;
    const sb = b.convictionSumBps + b.endorsements.length * 2000;
    return sb - sa || b.timestamp - a.timestamp;
  });
  return NextResponse.json({
    proposals: ranked,
    contract: proposalsContractAddress(),
  });
}
