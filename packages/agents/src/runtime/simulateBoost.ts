/**
 * Simulates the BoostAgentModal flow end-to-end on Arc.
 * Same calldata MetaMask would sign on a real boost click.
 */
import "../env";
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, ARC_ADDRS } from "@repo/shared/chains";
import { ERC20_ABI } from "@repo/shared/abi";
import { AGENT_PERSONAS } from "@repo/shared/agents";
import { env } from "../env";

const TARGET_AGENT = (process.argv[2] || "crypto") as "crypto" | "politics" | "macro" | "sports";
const AMOUNT_USDC = Number(process.argv[3] || "0.5");

async function main() {
  // "User" wallet — for the simulation we use the deployer (has 11 USDC).
  // In the real boost flow, this is whichever wallet the visitor connected.
  const userPk = process.env.DEPLOYER_PRIVATE_KEY as Hex;
  const user = privateKeyToAccount(userPk);
  const target = privateKeyToAccount(
    process.env[AGENT_PERSONAS[TARGET_AGENT].envKey] as Hex,
  );

  const pub = createPublicClient({
    chain: arcTestnet,
    transport: http(env.ARC_RPC_URL),
  });
  const wallet = createWalletClient({
    account: user,
    chain: arcTestnet,
    transport: http(env.ARC_RPC_URL),
  });

  const amount = BigInt(Math.round(AMOUNT_USDC * 1_000_000));

  console.log(`\n⚡ Simulating Boost flow`);
  console.log(`   "user"  : ${user.address}`);
  console.log(`   agent   : ${AGENT_PERSONAS[TARGET_AGENT].name} (${target.address})`);
  console.log(`   amount  : ${AMOUNT_USDC} USDC`);

  const before = (await pub.readContract({
    address: ARC_ADDRS.usdc as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [target.address],
  })) as bigint;

  // Exact same calldata MetaMask receives from useWriteContract({ functionName: "transfer", args: [agent, amount] })
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "transfer",
    args: [target.address as Address, amount],
  });

  console.log(`\n📨 Signing & sending USDC.transfer(${target.address}, ${amount})…`);
  const hash = await wallet.sendTransaction({
    to: ARC_ADDRS.usdc as Address,
    data,
  });
  console.log(`   tx: ${hash}`);
  console.log(`   ${env.ARC_EXPLORER}/tx/${hash}`);

  console.log(`\n⏳ Waiting for receipt…`);
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  console.log(`   status: ${rcpt.status} · block ${rcpt.blockNumber} · gas ${rcpt.gasUsed}`);

  const after = (await pub.readContract({
    address: ARC_ADDRS.usdc as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [target.address],
  })) as bigint;

  console.log(`\n📊 ${AGENT_PERSONAS[TARGET_AGENT].name} balance`);
  console.log(`   before: ${Number(before) / 1e6} USDC`);
  console.log(`   after : ${Number(after) / 1e6} USDC`);
  console.log(`   delta : +${Number(after - before) / 1e6} USDC\n`);
  if (after - before === amount) {
    console.log(`✅ Boost simulation success — same path the BoostAgentModal triggers in production.\n`);
  } else {
    console.log(`⚠️  Delta mismatch — expected +${AMOUNT_USDC}, got +${Number(after - before) / 1e6}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
