import "../env";
import {
  createWalletClient,
  http,
  parseEther,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet } from "@repo/shared/chains";
import { AGENT_PERSONAS } from "@repo/shared/agents";
import { arcPublic } from "../tools/wallets";
import { env } from "../env";

// Default: 100 USDC per agent. Enough for a long demo without re-funding.
// Override with FUND_PER_AGENT_USDC=<n>.
const PER_AGENT_USDC = Number(process.env.FUND_PER_AGENT_USDC ?? "100");

async function main() {
  const pk = process.env.DEPLOYER_PRIVATE_KEY as Hex | undefined;
  if (!pk || pk.length !== 66) {
    console.error("DEPLOYER_PRIVATE_KEY not set in .env");
    process.exit(1);
  }
  const deployer = privateKeyToAccount(pk);
  const wallet = createWalletClient({
    account: deployer,
    chain: arcTestnet,
    transport: http(env.ARC_RPC_URL),
  });

  let deployerBal = await arcPublic.getBalance({ address: deployer.address });
  console.log(
    `\n👛 Deployer ${deployer.address}  balance ${(Number(deployerBal) / 1e18).toFixed(4)} USDC\n`,
  );

  // Native USDC on Arc is the gas token, 18 decimals — use parseEther.
  const target = parseEther(String(PER_AGENT_USDC));
  // Reserve a little for gas across N transfers.
  const GAS_RESERVE = parseEther("0.05");

  for (const persona of Object.values(AGENT_PERSONAS)) {
    const agentPk = process.env[persona.envKey] as Hex | undefined;
    if (!agentPk || agentPk.length !== 66) {
      console.log(`✗ ${persona.name}: no key`);
      continue;
    }
    const addr = privateKeyToAccount(agentPk).address;
    const before = await arcPublic.getBalance({ address: addr });
    if (before >= target) {
      console.log(
        `✓ ${persona.name.padEnd(8)} ${addr}  already at ${(Number(before) / 1e18).toFixed(3)} USDC (target ${PER_AGENT_USDC}), skipping`,
      );
      continue;
    }
    let needed = target - before;
    const available =
      deployerBal > GAS_RESERVE ? deployerBal - GAS_RESERVE : 0n;
    if (available === 0n) {
      console.log(
        `⛔ ${persona.name.padEnd(8)} ${addr}  deployer empty — top up at https://faucet.circle.com (Arc Testnet)`,
      );
      continue;
    }
    if (needed > available) {
      console.log(
        `⚠  ${persona.name.padEnd(8)} need ${(Number(needed) / 1e18).toFixed(3)} but deployer has ${(Number(available) / 1e18).toFixed(3)} — sending partial`,
      );
      needed = available;
    }
    const hash = await wallet.sendTransaction({ to: addr, value: needed });
    await arcPublic.waitForTransactionReceipt({ hash });
    deployerBal -= needed;
    const after = await arcPublic.getBalance({ address: addr });
    console.log(
      `→ ${persona.name.padEnd(8)} ${addr}  +${(Number(needed) / 1e18).toFixed(3)} USDC → now ${(Number(after) / 1e18).toFixed(3)}  tx ${hash.slice(0, 12)}…`,
    );
  }

  console.log(
    `\n✅ Done. Deployer balance: ${(Number(deployerBal) / 1e18).toFixed(4)} USDC.`,
  );
  console.log(`   Re-check with: pnpm balances\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
