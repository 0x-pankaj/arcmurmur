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

const PER_AGENT_USDC = Number(process.env.FUND_PER_AGENT_USDC ?? "2"); // 2 USDC default

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

  const balance = await arcPublic.getBalance({ address: deployer.address });
  console.log(
    `\n👛 Deployer ${deployer.address}  balance ${(Number(balance) / 1e18).toFixed(4)} USDC\n`,
  );

  // Native USDC on Arc is the gas token, 18 decimals — use parseEther.
  const perAgent = parseEther(String(PER_AGENT_USDC));

  for (const persona of Object.values(AGENT_PERSONAS)) {
    const agentPk = process.env[persona.envKey] as Hex | undefined;
    if (!agentPk || agentPk.length !== 66) {
      console.log(`✗ ${persona.name}: no key`);
      continue;
    }
    const target = privateKeyToAccount(agentPk).address;
    const before = await arcPublic.getBalance({ address: target });
    if (before >= perAgent) {
      console.log(
        `✓ ${persona.name.padEnd(8)} ${target}  already has ${(Number(before) / 1e18).toFixed(3)} USDC, skipping`,
      );
      continue;
    }
    const hash = await wallet.sendTransaction({
      to: target,
      value: perAgent,
    });
    console.log(
      `→ ${persona.name.padEnd(8)} ${target}  tx ${hash}`,
    );
    await arcPublic.waitForTransactionReceipt({ hash });
  }

  console.log(`\n✅ Done. Re-check with: pnpm balances\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
