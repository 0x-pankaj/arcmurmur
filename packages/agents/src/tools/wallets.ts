import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arcTestnet, polygonMainnet } from "@repo/shared/chains";
import { AGENT_PERSONAS, type AgentKey } from "@repo/shared/agents";
import { env } from "../env";

export const arcPublic = createPublicClient({
  chain: arcTestnet,
  transport: http(env.ARC_RPC_URL),
});

export const polygonPublic = createPublicClient({
  chain: polygonMainnet,
  transport: http(env.POLYGON_RPC_URL),
});

function pkFor(agent: AgentKey): `0x${string}` | null {
  const key = AGENT_PERSONAS[agent].envKey;
  const v = process.env[key];
  if (!v || v.startsWith("0x0000000000000000000000000000000000000000")) return null;
  return v as `0x${string}`;
}

export function agentAccount(agent: AgentKey) {
  const pk = pkFor(agent);
  if (!pk) return null;
  return privateKeyToAccount(pk);
}

export function agentArcWallet(agent: AgentKey) {
  const acct = agentAccount(agent);
  if (!acct) return null;
  return createWalletClient({
    account: acct,
    chain: arcTestnet,
    transport: http(env.ARC_RPC_URL),
  });
}

export function agentPolygonWallet(agent: AgentKey) {
  const acct = agentAccount(agent);
  if (!acct) return null;
  return createWalletClient({
    account: acct,
    chain: polygonMainnet,
    transport: http(env.POLYGON_RPC_URL),
  });
}

export function agentAddress(agent: AgentKey): Address {
  const acct = agentAccount(agent);
  if (acct) return acct.address;
  // Deterministic placeholder so the UI always has an address to render.
  const stub = "0x" + Buffer.from(agent.padEnd(20, "0")).toString("hex").slice(0, 40);
  return stub as Address;
}
