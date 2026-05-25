import "../env";
import { formatUnits, parseAbiItem, type AbiEvent, type Address } from "viem";
import { arcPublic } from "../tools/wallets";
import { SWARM_VAULT_ABI } from "@repo/shared/vaultAbi";

// Arc public RPC caps eth_getLogs at 10,000 blocks per request. We chunk
// backwards from head, stopping early once we either hit the user's
// configured FROM_BLOCK or accumulate enough events.
const LOG_CHUNK = 9_900n;

async function getLogsChunked<E extends AbiEvent>(args: {
  address: Address;
  event: E;
  fromBlock: bigint;
  toBlock: bigint;
}) {
  type Out = Awaited<
    ReturnType<typeof arcPublic.getLogs<E, undefined, undefined, bigint, bigint>>
  >;
  const out: Out = [] as unknown as Out;
  let to = args.toBlock;
  while (to >= args.fromBlock) {
    const from =
      to - LOG_CHUNK + 1n > args.fromBlock ? to - LOG_CHUNK + 1n : args.fromBlock;
    const logs = await arcPublic.getLogs({
      address: args.address,
      event: args.event,
      fromBlock: from,
      toBlock: to,
    });
    (out as unknown as unknown[]).push(...(logs as unknown[]));
    if (from === args.fromBlock) break;
    to = from - 1n;
  }
  return out;
}

/**
 * traction.ts — pulls live numbers from the SwarmVault for posting to Agora
 * via `arc-canteen update-traction`.
 *
 * Outputs:
 *   • aggregate stats (TVL, userCount, signalCount, positionCount, PnL)
 *   • top-N depositor leaderboard (computed from on-chain Deposit events)
 *   • a copy-pastable "for the canteen wizard" block
 *
 * Env:
 *   NEXT_PUBLIC_VAULT_CONTRACT (required)
 *   TRACTION_FROM_BLOCK        (optional — defaults to 0; set if RPC complains)
 *   TRACTION_TOP_N             (optional — default 5)
 */

const VAULT = (
  process.env.NEXT_PUBLIC_VAULT_CONTRACT || ""
).toLowerCase() as Address;

const FROM_BLOCK = (() => {
  const raw = process.env.TRACTION_FROM_BLOCK;
  if (!raw) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
})();

const TOP_N = Math.max(1, Number(process.env.TRACTION_TOP_N || 5));

const DEPOSIT_EVENT = parseAbiItem(
  "event Deposit(address indexed user, uint256 amount, uint128 newShares, uint64 totalUsers)",
);
const WITHDRAW_EVENT = parseAbiItem(
  "event Withdraw(address indexed user, uint256 amount, uint128 sharesBurned)",
);

function fmt(n: bigint, d = 6, places = 2) {
  return Number(formatUnits(n, d)).toLocaleString(undefined, {
    maximumFractionDigits: places,
  });
}

function shortAddr(a: string) {
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

async function main() {
  if (!VAULT || VAULT === "0x0000000000000000000000000000000000000000") {
    console.error("❌ NEXT_PUBLIC_VAULT_CONTRACT not set in .env");
    process.exit(1);
  }

  console.log(`\n📊 SwarmVault traction · ${VAULT}\n`);

  // 1) Aggregate view-fn snapshot.
  const stats = (await arcPublic.readContract({
    abi: SWARM_VAULT_ABI,
    address: VAULT,
    functionName: "stats",
  })) as readonly [
    bigint, // totalDeposits (micro USDC)
    bigint, // totalShares
    bigint, // userCount
    bigint, // signalCount
    bigint, // positionCount
    bigint, // realized (micro USDC, signed)
    bigint, // unrealized (micro USDC, signed)
  ];
  const [
    totalDeposits,
    totalShares,
    userCount,
    signalCount,
    positionCount,
    realized,
    unrealized,
  ] = stats;

  console.log("  TVL (gross deposits)  ", fmt(totalDeposits), "USDC");
  console.log("  unique depositors     ", userCount.toString());
  console.log("  user sentiment signals", signalCount.toString());
  console.log("  positions opened      ", positionCount.toString());
  console.log(
    "  realized PnL          ",
    `${realized < 0n ? "-" : ""}${fmt(realized < 0n ? -realized : realized)} USDC`,
  );
  console.log(
    "  unrealized PnL        ",
    `${unrealized < 0n ? "-" : ""}${fmt(unrealized < 0n ? -unrealized : unrealized)} USDC`,
  );

  // Short-circuit: if the view function says 0 depositors, no point
  // scanning logs.
  if (userCount === 0n) {
    console.log(
      "\n  (no deposits on this vault yet — skipping log scan)\n",
    );
    console.log(
      "──────────────────────────────────────────────────────────────",
    );
    const explorer =
      process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://testnet.arcscan.app";
    console.log(
      "📋 paste-ready summary for `arc-canteen update-traction`:\n",
    );
    console.log(
      `SwarmVault on Arc Testnet (${VAULT.slice(0, 10)}…) update:`,
    );
    console.log(`• Platform live; ${positionCount.toString()} agent positions opened`);
    console.log(`• ${signalCount.toString()} user sentiment signals`);
    console.log(`• Awaiting first human depositors — recruiting in flight`);
    console.log(`• Live: ${explorer}/address/${VAULT}#events`);
    console.log(
      "──────────────────────────────────────────────────────────────\n",
    );
    return;
  }

  // 2) Replay Deposit + Withdraw events to build per-address NET position.
  const head = await arcPublic.getBlockNumber();
  console.log(`\n  scanning blocks ${FROM_BLOCK} → ${head} (chunks of ${LOG_CHUNK})…`);

  const [deposits, withdraws] = await Promise.all([
    getLogsChunked({
      address: VAULT,
      event: DEPOSIT_EVENT,
      fromBlock: FROM_BLOCK,
      toBlock: head,
    }),
    getLogsChunked({
      address: VAULT,
      event: WITHDRAW_EVENT,
      fromBlock: FROM_BLOCK,
      toBlock: head,
    }),
  ]);

  type DecodedArgs = { user?: string; amount?: bigint };
  const net = new Map<string, bigint>();
  for (const log of deposits) {
    const a = (log as unknown as { args: DecodedArgs }).args;
    if (!a?.user) continue;
    const u = a.user.toLowerCase();
    net.set(u, (net.get(u) ?? 0n) + (a.amount ?? 0n));
  }
  for (const log of withdraws) {
    const a = (log as unknown as { args: DecodedArgs }).args;
    if (!a?.user) continue;
    const u = a.user.toLowerCase();
    net.set(u, (net.get(u) ?? 0n) - (a.amount ?? 0n));
  }

  const ranked = [...net.entries()]
    .filter(([, v]) => v > 0n)
    .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
    .slice(0, TOP_N);

  console.log(
    `\n  📈 top ${ranked.length} depositors (net = deposited − withdrawn):\n`,
  );
  if (ranked.length === 0) {
    console.log("     (no depositors yet)");
  } else {
    ranked.forEach(([addr, amt], i) => {
      console.log(
        `   ${(i + 1).toString().padStart(2)}.  ${shortAddr(addr)}   ${fmt(amt).padStart(10)} USDC`,
      );
    });
  }

  console.log(
    `\n  totals from events:  ${deposits.length} Deposit · ${withdraws.length} Withdraw\n`,
  );

  // 3) Copy-pastable summary block for the canteen wizard.
  const explorer =
    process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://testnet.arcscan.app";
  console.log("──────────────────────────────────────────────────────────────");
  console.log("📋 paste-ready summary for `arc-canteen update-traction`:\n");
  console.log(`SwarmVault on Arc Testnet (${VAULT.slice(0, 10)}…) update:`);
  console.log(
    `• ${userCount.toString()} unique depositors · ${fmt(totalDeposits)} USDC TVL`,
  );
  console.log(
    `• ${signalCount.toString()} user sentiment signals · ${positionCount.toString()} swarm positions opened`,
  );
  const top = ranked[0];
  if (top) {
    console.log(
      `• Top depositor: ${shortAddr(top[0])} with ${fmt(top[1])} USDC`,
    );
  }
  console.log(`• Verify live: ${explorer}/address/${VAULT}#events`);
  console.log("──────────────────────────────────────────────────────────────\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
