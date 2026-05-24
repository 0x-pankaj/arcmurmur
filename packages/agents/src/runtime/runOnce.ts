import "../env";
import { swarmTick } from "./tick";

async function main() {
  console.log("\n🐝 ArcMurmur swarm tick starting…\n");
  const r = await swarmTick();
  console.log(`\n📡 marketsScanned=${r.marketsScanned} decisions=${r.decisions.length} signals=${r.signalTxHashes.length}`);
  for (const n of r.notes) console.log("  •", n);
  console.log("\n🧠 decisions:");
  for (const d of r.decisions) {
    console.log(
      `  ${d.agent.padEnd(8)} prob=${d.myProb.toFixed(2)} mkt=${d.marketProb.toFixed(2)} edge=${(d.edge >= 0 ? "+" : "") + d.edge.toFixed(2)} ${d.action} $${d.sizeUsdc} — ${d.question.slice(0, 70)}`,
    );
  }
  console.log("\n✅ tick complete\n");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
