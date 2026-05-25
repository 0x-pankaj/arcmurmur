/**
 * Arc Testnet chain config + well-known addresses.
 *
 * Arc is Circle's stablecoin-native L1 — gas is paid in USDC. This file is the
 * one place every other primitive in the kit imports its chain + addresses
 * from, so you only configure Arc once.
 *
 * Docs: https://docs.arc.io/arc/references/contract-addresses
 */
import { defineChain, type PublicClient, type WalletClient } from "viem";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";

export const ARC_RPC_URL =
  process.env.ARC_RPC_URL ||
  process.env.NEXT_PUBLIC_ARC_RPC_URL ||
  "https://rpc.testnet.arc.network";

export const ARC_CHAIN_ID = Number(process.env.ARC_CHAIN_ID ?? 5042002);

export const ARC_EXPLORER =
  process.env.ARC_EXPLORER_URL ||
  process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ||
  "https://testnet.arcscan.app";

export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  // Native currency on Arc is USDC (18-decimal native form).
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [ARC_RPC_URL] },
    public: { http: [ARC_RPC_URL] },
  },
  blockExplorers: { default: { name: "Arcscan", url: ARC_EXPLORER } },
  testnet: true,
});

/** Well-known Arc Testnet contract addresses. */
export const ARC_ADDRS = {
  /** Native USDC, ERC-20 interface (6 decimals). */
  usdc: (process.env.NEXT_PUBLIC_ARC_USDC ||
    "0x3600000000000000000000000000000000000000") as `0x${string}`,
  /** Circle CCTP v2 — Arc is domain 26. */
  cctpTokenMessengerV2: (process.env.ARC_CCTP_TOKEN_MESSENGER ||
    "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA") as `0x${string}`,
  cctpMessageTransmitterV2: (process.env.ARC_CCTP_MESSAGE_TRANSMITTER ||
    "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275") as `0x${string}`,
  cctpTokenMinterV2: (process.env.ARC_CCTP_TOKEN_MINTER ||
    "0xb43db544E2c27092c107639Ad201b3dEfAbcF192") as `0x${string}`,
} as const;

/** ERC-8004 registries are PRE-DEPLOYED by Arc — no action needed to use them. */
export const ERC8004 = {
  IDENTITY_REGISTRY: "0x8004A818BFB912233c491871b3d84c89A494BD9e" as `0x${string}`,
  REPUTATION_REGISTRY: "0x8004B663056A597Dffe9eCcC1965A193B7388713" as `0x${string}`,
  VALIDATION_REGISTRY: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272" as `0x${string}`,
} as const;

/** CCTP v2 domain ids. */
export const CCTP_DOMAINS = {
  arc: Number(process.env.ARC_CCTP_DOMAIN ?? 26),
  polygon: Number(process.env.POLYGON_CCTP_DOMAIN ?? 7),
  amoy: 7, // Polygon Amoy testnet shares domain 7 in CCTP v2
} as const;

/** Circle's attestation (iris) API — sandbox endpoint for testnets. */
export const CCTP_ATTESTATION_HOST = "https://iris-api-sandbox.circle.com";

// ---- client factories ------------------------------------------------------

/** Read-only client for the Arc testnet. */
export function arcPublicClient(rpcUrl = ARC_RPC_URL): PublicClient {
  return createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });
}

/** Wallet client driven by a raw private key (server / agent / session key). */
export function arcWalletClient(privateKey: Hex, rpcUrl = ARC_RPC_URL): WalletClient {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: arcTestnet,
    transport: http(rpcUrl),
  });
}

// ---- explorer helpers -------------------------------------------------------

export const arcscanTx = (hash: string) => `${ARC_EXPLORER}/tx/${hash}`;
export const arcscanAddress = (addr: string) => `${ARC_EXPLORER}/address/${addr}`;
