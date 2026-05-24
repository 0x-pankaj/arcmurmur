import { AGENT_KEYS, AGENT_PERSONAS, type AgentKey } from "@repo/shared/agents";
import {
  agentMetadataJson,
  registerAgentIdentity,
} from "../tools/identity";
import { agentAddress } from "../tools/wallets";
import { env } from "../env";

/**
 * Register each ArcMurmur agent against Arc's ERC-8004 IdentityRegistry.
 *
 * We do NOT pin metadata to IPFS during the hackathon — we use a
 * data: URI containing the JSON inline. This keeps the demo
 * self-contained (no IPFS infra) while still being a valid `tokenURI`
 * that block explorers and indexers can resolve.
 */
function inlineMetadataURI(agent: AgentKey): string {
  const meta = agentMetadataJson(agent);
  const json = JSON.stringify(meta);
  return `data:application/json;base64,${Buffer.from(json).toString("base64")}`;
}

async function main() {
  const onlyArg = process.argv[2];
  const targets = onlyArg
    ? (AGENT_KEYS.filter((k) => k === onlyArg) as AgentKey[])
    : AGENT_KEYS;
  if (!targets.length) {
    console.error(`Unknown agent "${onlyArg}". Valid: ${AGENT_KEYS.join(", ")}`);
    process.exit(2);
  }

  console.log(`\n🪪 Registering ${targets.length} agent(s) against ERC-8004 on Arc…\n`);
  console.log(`   IdentityRegistry: 0x8004A818BFB912233c491871b3d84c89A494BD9e`);
  console.log(`   RPC:              ${env.ARC_RPC_URL}\n`);

  for (const k of targets) {
    const persona = AGENT_PERSONAS[k];
    const addr = agentAddress(k);
    process.stdout.write(`  ${persona.emoji} ${persona.name.padEnd(8)} ${addr}  …  `);
    const res = await registerAgentIdentity(k, inlineMetadataURI(k));
    if (res.alreadyRegistered && res.tokenId) {
      console.log(`✓ already registered · tokenId=${res.tokenId}`);
    } else if (res.txHash && res.tokenId) {
      console.log(`✅ minted #${res.tokenId} · ${res.txHash.slice(0, 12)}…`);
    } else if (res.txHash) {
      console.log(`✅ registered (tokenId pending) · ${res.txHash.slice(0, 12)}…`);
    } else {
      console.log(`❌ ${res.error ?? "unknown failure"}`);
    }
  }
  console.log(`\n🐝 Done. Explorer: https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89A494BD9e\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
