import { NextResponse } from "next/server";
import { fetchActiveMarkets } from "@repo/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const markets = await fetchActiveMarkets(24);
    return NextResponse.json({ markets });
  } catch (err) {
    return NextResponse.json(
      { markets: [], error: (err as Error).message },
      { status: 200 },
    );
  }
}
