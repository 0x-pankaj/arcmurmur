import { NextResponse } from "next/server";
import {
  createWalletClient,
  http,
  parseEther,
  isAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "@repo/shared/chains";
import { arcPublic } from "@repo/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENABLED = (process.env.WELCOME_DROP_ENABLED ?? "true").toLowerCase() !== "false";
const DROP_USDC = Number(process.env.WELCOME_DROP_USDC ?? "10");
const MAX_PER_DAY = Number(process.env.WELCOME_DROP_MAX_PER_DAY ?? "20");

// Per-wallet cooldown: 24h. Per-IP cooldown: 1h. Daily-claim cap.
// In-memory, resets on server restart — fine for a hackathon demo.
const COOLDOWN_WALLET_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_IP_MS = 60 * 60 * 1000;
const g = globalThis as unknown as {
  __arcmurmur_drop_state?: {
    byWallet: Map<string, number>;
    byIp: Map<string, number>;
    dailyCount: number;
    dailyResetAt: number;
  };
};
g.__arcmurmur_drop_state ??= {
  byWallet: new Map(),
  byIp: new Map(),
  dailyCount: 0,
  dailyResetAt: Date.now() + 24 * 60 * 60 * 1000,
};
const state = g.__arcmurmur_drop_state!;

export async function POST(req: Request) {
  if (!ENABLED) {
    return NextResponse.json({ ok: false, error: "drop disabled" }, { status: 403 });
  }

  let wallet = "";
  try {
    const body = await req.json();
    wallet = String(body?.wallet ?? "").toLowerCase();
  } catch {
    return NextResponse.json({ ok: false, error: "bad request body" }, { status: 400 });
  }
  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ ok: false, error: "valid wallet required" }, { status: 400 });
  }

  // Daily cap (refresh window).
  if (Date.now() > state.dailyResetAt) {
    state.dailyCount = 0;
    state.dailyResetAt = Date.now() + 24 * 60 * 60 * 1000;
  }
  if (state.dailyCount >= MAX_PER_DAY) {
    return NextResponse.json(
      { ok: false, error: "daily faucet cap reached — try again tomorrow" },
      { status: 429 },
    );
  }

  const lastWallet = state.byWallet.get(wallet) ?? 0;
  if (Date.now() - lastWallet < COOLDOWN_WALLET_MS) {
    return NextResponse.json(
      { ok: false, error: "this wallet already claimed in the last 24h" },
      { status: 429 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const lastIp = state.byIp.get(ip) ?? 0;
  if (ip !== "unknown" && Date.now() - lastIp < COOLDOWN_IP_MS) {
    return NextResponse.json(
      { ok: false, error: "this IP claimed within the last hour" },
      { status: 429 },
    );
  }

  const pk = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
  if (!pk || pk.length !== 66) {
    return NextResponse.json(
      { ok: false, error: "deployer key not configured on server" },
      { status: 500 },
    );
  }
  const deployer = privateKeyToAccount(pk);
  const deployerBal = await arcPublic.getBalance({ address: deployer.address });
  const value = parseEther(String(DROP_USDC));
  const reserve = parseEther("0.05");
  if (deployerBal < value + reserve) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "deployer treasury is low — please ask the team to top up via https://faucet.circle.com",
      },
      { status: 503 },
    );
  }

  const walletClient = createWalletClient({
    account: deployer,
    chain: arcTestnet,
    transport: http(process.env.ARC_RPC_URL),
  });

  try {
    const hash = await walletClient.sendTransaction({
      to: wallet as `0x${string}`,
      value,
    });
    state.byWallet.set(wallet, Date.now());
    if (ip !== "unknown") state.byIp.set(ip, Date.now());
    state.dailyCount++;
    return NextResponse.json({
      ok: true,
      txHash: hash,
      amount: DROP_USDC,
      deployer: deployer.address,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}

export async function GET() {
  // Status check — used by the banner to know whether to show the button.
  return NextResponse.json({
    enabled: ENABLED,
    amountUsdc: DROP_USDC,
    dailyRemaining: Math.max(0, MAX_PER_DAY - state.dailyCount),
  });
}
