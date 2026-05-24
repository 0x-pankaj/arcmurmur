import {
  encodeFunctionData,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { AGENT_PERSONAS, type AgentKey } from "@repo/shared/agents";
import { ARC_ADDRS } from "@repo/shared/chains";
import { ERC20_ABI } from "@repo/shared/abi";
import { agentArcWallet, agentAddress, arcPublic } from "./wallets";

/**
 * Nanopayment-style on-chain rewards between swarm agents.
 *
 * When an agent's marked-to-market position turns favourable, it sends a
 * sub-cent USDC tip to peer agents who posted concurring signals — a
 * micro-incentive loop that puts every "agreement" on Arc forever.
 *
 * For the hackathon we use ERC-20 transfer of native USDC on Arc; in
 * production this would route through Circle's batched nanopayments to
 * minimize gas. The semantic is identical: tiny, frequent, agent-to-agent.
 */
export async function nanopayPeers(args: {
  from: AgentKey;
  peers: AgentKey[];
  amountUsdc?: number; // default 0.001 USDC
  marketSlug: string;
}): Promise<{ peer: AgentKey; txHash?: Hash; address: string }[]> {
  const wallet = agentArcWallet(args.from);
  if (!wallet || args.peers.length === 0) return [];
  const microAmount = parseUnits(
    String(args.amountUsdc ?? 0.001),
    6,
  );
  const out: { peer: AgentKey; txHash?: Hash; address: string }[] = [];

  for (const peer of args.peers) {
    if (peer === args.from) continue;
    const addr = agentAddress(peer);
    try {
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [addr as Address, microAmount],
      });
      const hash = await wallet.sendTransaction({
        to: ARC_ADDRS.usdc as Address,
        data,
      });
      await arcPublic.waitForTransactionReceipt({ hash });
      out.push({ peer, txHash: hash, address: addr });
    } catch (err) {
      console.warn(
        `[nanopay] ${AGENT_PERSONAS[args.from].name} → ${AGENT_PERSONAS[peer].name} failed:`,
        (err as Error).message,
      );
      out.push({ peer, address: addr });
    }
  }
  return out;
}
