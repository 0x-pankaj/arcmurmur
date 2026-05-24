// Load the monorepo-root .env before Next.js inlines NEXT_PUBLIC_* values
// into the client bundle. Without this, `pnpm contracts:deploy` writes new
// addresses into the root .env but Next.js (which only loads apps/web/.env)
// never sees them — causing hydration mismatches between SSR (which inherits
// the shell env) and the client bundle.
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/ui", "@repo/shared", "@repo/agents"],
  experimental: {},
  typescript: { ignoreBuildErrors: false },
  // Pin the env vars Next.js inlines so it doesn't matter whether the dev
  // server inherited them from the shell or read them from .env.
  env: {
    NEXT_PUBLIC_ARC_EXPLORER_URL: process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "",
    NEXT_PUBLIC_ARC_USDC: process.env.NEXT_PUBLIC_ARC_USDC || "",
    NEXT_PUBLIC_ARC_RPC_URL: process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network",
    NEXT_PUBLIC_STIGMERGY_CONTRACT: process.env.NEXT_PUBLIC_STIGMERGY_CONTRACT || "",
    NEXT_PUBLIC_VAULT_CONTRACT: process.env.NEXT_PUBLIC_VAULT_CONTRACT || "",
    NEXT_PUBLIC_PROPOSALS_CONTRACT: process.env.NEXT_PUBLIC_PROPOSALS_CONTRACT || "",
    NEXT_PUBLIC_POLYGON_USDC: process.env.NEXT_PUBLIC_POLYGON_USDC || "",
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    NEXT_PUBLIC_SWARM_TICK_INTERVAL_MS: process.env.SWARM_TICK_INTERVAL_MS || "60000",
  },
};

export default nextConfig;
