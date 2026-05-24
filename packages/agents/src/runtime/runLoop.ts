import "../env";
import { swarmTick } from "./tick";
import { env } from "../env";

async function loop() {
  console.log(`\n🐝 ArcMurmur loop @ ${env.SWARM_TICK_INTERVAL_MS / 1000}s intervals\n`);
  let i = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    i++;
    const t0 = Date.now();
    try {
      const r = await swarmTick();
      console.log(
        `[#${i}] +${Date.now() - t0}ms decisions=${r.decisions.length} signals=${r.signalTxHashes.length}`,
      );
    } catch (e) {
      console.error(`[#${i}] failed:`, (e as Error).message);
    }
    await new Promise((res) => setTimeout(res, env.SWARM_TICK_INTERVAL_MS));
  }
}

loop();
