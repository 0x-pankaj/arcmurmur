import "../env";
import { formatUnits } from "viem";
import { arcPublic } from "../tools/wallets";
import { ARC_ADDRS } from "@repo/shared/chains";
import { privateKeyToAccount } from "viem/accounts";

const NAMES: Record<string, string> = {
  DEPLOYER_PRIVATE_KEY: "Deployer",
  AGENT_CRYPTO_PRIVATE_KEY: "Vega (crypto)",
  AGENT_POLITICS_PRIVATE_KEY: "Solon (politics)",
  AGENT_MACRO_PRIVATE_KEY: "Atlas (macro)",
  AGENT_SPORTS_PRIVATE_KEY: "Yuki (sports)",
};

async function main() {
  console.log("\n📊 Arc Testnet balances\n");
  console.log("name".padEnd(20), "address".padEnd(44), "native".padStart(12), "erc20 USDC".padStart(14));
  console.log("-".repeat(94));
  let anyFunded = false;
  for (const [envKey, label] of Object.entries(NAMES)) {
    const pk = process.env[envKey];
    if (!pk || !pk.startsWith("0x") || pk.length !== 66) {
      console.log(label.padEnd(20), "(no key set)");
      continue;
    }
    const addr = privateKeyToAccount(pk as `0x${string}`).address;
    const native = await arcPublic.getBalance({ address: addr });
    const erc20 = (await arcPublic.readContract({
      address: ARC_ADDRS.usdc as `0x${string}`,
      abi: [
        {
          type: "function",
          name: "balanceOf",
          stateMutability: "view",
          inputs: [{ name: "_", type: "address" }],
          outputs: [{ type: "uint256" }],
        },
      ],
      functionName: "balanceOf",
      args: [addr],
    })) as bigint;
    const nativeStr = (Number(native) / 1e18).toFixed(4);
    const erc20Str = formatUnits(erc20, 6);
    if (native > 0n) anyFunded = true;
    console.log(label.padEnd(20), addr.padEnd(44), nativeStr.padStart(12), erc20Str.padStart(14));
  }
  console.log();
  if (!anyFunded) {
    console.log("⛔ No wallets are funded yet.\n");
    console.log("👉 Visit https://faucet.circle.com  (network: Arc Testnet)");
    console.log("   Paste the Deployer address above and request testnet USDC.");
    console.log("   Once it has any balance, run: pnpm contracts:deploy\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
