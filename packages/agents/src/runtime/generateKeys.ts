import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { AGENT_PERSONAS } from "@repo/shared/agents";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../../../../.env");
const examplePath = path.resolve(__dirname, "../../../../.env.example");

function loadEnv(): string {
  if (fs.existsSync(envPath)) return fs.readFileSync(envPath, "utf-8");
  if (fs.existsSync(examplePath)) return fs.readFileSync(examplePath, "utf-8");
  return "";
}

function setEnvVar(content: string, key: string, value: string): string {
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  if (re.test(content)) return content.replace(re, line);
  return content.replace(/\s*$/, `\n${line}\n`);
}

function isPlaceholder(v: string | undefined): boolean {
  if (!v) return true;
  if (!v.startsWith("0x")) return true;
  if (v.length !== 66) return true;
  // Treat the dummy 0x000...0N keys as placeholders.
  return /^0x0+[0-9]?$/.test(v);
}

console.log("\n🔑 Generating ArcMurmur agent keys (writing to .env)…\n");

let env = loadEnv();
const generated: { label: string; envKey: string; pk: string; addr: string }[] = [];

const FORCE = process.argv.includes("--force");

for (const persona of Object.values(AGENT_PERSONAS)) {
  const current = process.env[persona.envKey];
  if (!FORCE && !isPlaceholder(current)) {
    console.log(`✓ ${persona.name} already configured (${persona.envKey})`);
    continue;
  }
  const pk = generatePrivateKey();
  const addr = privateKeyToAccount(pk).address;
  env = setEnvVar(env, persona.envKey, pk);
  generated.push({ label: persona.name, envKey: persona.envKey, pk, addr });
}

if (FORCE || isPlaceholder(process.env.DEPLOYER_PRIVATE_KEY)) {
  const pk = generatePrivateKey();
  const addr = privateKeyToAccount(pk).address;
  env = setEnvVar(env, "DEPLOYER_PRIVATE_KEY", pk);
  generated.push({ label: "Deployer", envKey: "DEPLOYER_PRIVATE_KEY", pk, addr });
} else {
  console.log(`✓ Deployer already configured`);
}

fs.writeFileSync(envPath, env);

console.log("\n✅ .env updated. Generated:\n");
for (const g of generated) {
  console.log(`  ${g.label.padEnd(10)} → ${g.addr}    (${g.envKey})`);
}

if (generated.length === 0) {
  console.log("  (nothing to do — all keys already set; pass --force to regenerate)\n");
} else {
  console.log("\n👉 Fund the addresses above with testnet USDC:");
  console.log("   https://faucet.circle.com  (select 'Arc Testnet')\n");
}
