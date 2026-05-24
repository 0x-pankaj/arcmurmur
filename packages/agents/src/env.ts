import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const env = {
  ARC_RPC_URL:
    process.env.ARC_RPC_URL || "https://rpc.testnet.arc-node.thecanteenapp.com",
  ARC_CHAIN_ID: Number(process.env.ARC_CHAIN_ID ?? 421614),
  ARC_EXPLORER: process.env.ARC_EXPLORER_URL || "https://testnet.arcscan.io",
  POLYGON_RPC_URL: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
  POLYGON_AMOY_RPC_URL:
    process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology",
  POLYGON_AMOY_USDC:
    process.env.POLYGON_AMOY_USDC ||
    "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  BRIDGE_DEST: (process.env.BRIDGE_DEST || "amoy").toLowerCase() as
    | "amoy"
    | "polygon",
  STIGMERGY: process.env.NEXT_PUBLIC_STIGMERGY_CONTRACT || "",
  ARC_USDC: process.env.NEXT_PUBLIC_ARC_USDC || "",
  POLYGON_USDC:
    process.env.NEXT_PUBLIC_POLYGON_USDC ||
    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  POLYMARKET_BUILDER_CODE: process.env.POLYMARKET_BUILDER_CODE || "",
  POLYMARKET_BUILDER_ADDRESS: process.env.POLYMARKET_BUILDER_ADDRESS || "",
  POLYMARKET_GAMMA_HOST:
    process.env.POLYMARKET_GAMMA_HOST || "https://gamma-api.polymarket.com",
  POLYMARKET_CLOB_HOST:
    process.env.POLYMARKET_CLOB_HOST || "https://clob.polymarket.com",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  OPENROUTER_MODEL:
    process.env.OPENROUTER_MODEL || "deepseek/deepseek-v4-pro",
  OPENROUTER_BASE_URL:
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  OPENROUTER_REASONING:
    (process.env.OPENROUTER_REASONING ?? "true").toLowerCase() !== "false",
  DEMO_MODE: (process.env.DEMO_MODE ?? "true").toLowerCase() !== "false",
  SWARM_TICK_INTERVAL_MS: Number(process.env.SWARM_TICK_INTERVAL_MS ?? 60000),

  // ---- LLM budget controls (kill OpenRouter cost) ----
  // Total LLM calls per tick = markets × (1 + wildcard?) + propose?
  // Defaults below give ~3 LLM calls per tick (was ~10).
  LLM_MAX_MARKETS_PER_TICK: Number(process.env.LLM_MAX_MARKETS_PER_TICK ?? 3),
  LLM_INCLUDE_WILDCARD:
    (process.env.LLM_INCLUDE_WILDCARD ?? "false").toLowerCase() === "true",
  LLM_SKIP_OUT_OF_DOMAIN:
    (process.env.LLM_SKIP_OUT_OF_DOMAIN ?? "true").toLowerCase() === "true",
  LLM_CACHE_TTL_MS: Number(process.env.LLM_CACHE_TTL_MS ?? 5 * 60 * 1000),
  LLM_CACHE_PRICE_DELTA: Number(process.env.LLM_CACHE_PRICE_DELTA ?? 0.02),
  LLM_MIN_CONVICTION_PROPOSAL: Number(
    process.env.LLM_MIN_CONVICTION_PROPOSAL ?? 0.7,
  ),
  LLM_MAX_PROPOSALS_PER_TICK: Number(
    process.env.LLM_MAX_PROPOSALS_PER_TICK ?? 1,
  ),
};

export function isLive() {
  return !env.DEMO_MODE;
}
