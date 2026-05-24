import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const explorer = process.env.ARC_EXPLORER_URL || "https://testnet.arcscan.app";
  const usdc = process.env.NEXT_PUBLIC_ARC_USDC || "0x3600000000000000000000000000000000000000";

  console.log(`\n🌐 Network: ${network.name} (chainId ${network.config.chainId})`);
  console.log(`👛 Deployer: ${deployer.address}`);
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} native\n`);

  if (balance === 0n) {
    console.log("⛔  Deployer has 0 USDC on Arc — can't pay gas.\n");
    console.log(`👉 Fund this address from the Circle faucet:\n`);
    console.log(`   https://faucet.circle.com   (network: Arc Testnet)`);
    console.log(`   Address: ${deployer.address}\n`);
    console.log(`Then re-run: pnpm contracts:deploy\n`);
    process.exit(2);
  }

  console.log("🚀 1/2  Deploying StigmergySignal…");
  const stig = await (await ethers.getContractFactory("StigmergySignal")).deploy();
  await stig.waitForDeployment();
  const stigAddr = await stig.getAddress();
  console.log(`   ✅ ${stigAddr}`);
  console.log(`   🔗 ${explorer}/address/${stigAddr}\n`);

  console.log("🚀 2/2  Deploying SwarmVault…");
  const vault = await (await ethers.getContractFactory("SwarmVault")).deploy(usdc, stigAddr);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log(`   ✅ ${vaultAddr}`);
  console.log(`   🔗 ${explorer}/address/${vaultAddr}\n`);

  // Persist deployment info
  const outDir = path.resolve(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, `${network.name}.json`),
    JSON.stringify(
      {
        network: network.name,
        chainId: network.config.chainId,
        stigmergy: stigAddr,
        vault: vaultAddr,
        usdc,
        deployer: deployer.address,
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  // Auto-update root .env
  const envPath = path.resolve(__dirname, "../../../.env");
  if (fs.existsSync(envPath)) {
    let env = fs.readFileSync(envPath, "utf-8");
    const setVar = (k: string, v: string) => {
      const re = new RegExp(`^${k}=.*$`, "m");
      const line = `${k}=${v}`;
      env = re.test(env) ? env.replace(re, line) : env + `\n${line}\n`;
    };
    setVar("NEXT_PUBLIC_STIGMERGY_CONTRACT", stigAddr);
    setVar("NEXT_PUBLIC_VAULT_CONTRACT", vaultAddr);
    fs.writeFileSync(envPath, env);
    console.log(`✏️  Updated NEXT_PUBLIC_STIGMERGY_CONTRACT + NEXT_PUBLIC_VAULT_CONTRACT in .env\n`);
  }

  console.log("🐝 Next: pnpm dev   (open http://localhost:3000 and click 'Run swarm tick')\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
