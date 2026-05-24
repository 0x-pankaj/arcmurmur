import { defineChain } from "viem";

const arcRpc =
  process.env.ARC_RPC_URL ||
  process.env.NEXT_PUBLIC_ARC_RPC_URL ||
  "https://rpc.testnet.arc.network";

export const ARC_CHAIN_ID = Number(process.env.ARC_CHAIN_ID ?? 5042002);
export const ARC_EXPLORER =
  process.env.ARC_EXPLORER_URL ||
  process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ||
  "https://testnet.arcscan.app";

/**
 * Arc Testnet — Circle's stablecoin-native L1.
 * - chainId: 5042002
 * - native currency: USDC (gas paid in USDC, 18-decimal native)
 * - ERC-20 USDC interface (6 decimals): 0x3600000000000000000000000000000000000000
 * Source: https://docs.arc.io/arc/references/contract-addresses
 */
export const arcTestnet = defineChain({
  id: ARC_CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [arcRpc] },
    public: { http: [arcRpc] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: ARC_EXPLORER },
  },
  testnet: true,
});

export const polygonMainnet = defineChain({
  id: Number(process.env.POLYGON_CHAIN_ID ?? 137),
  name: "Polygon",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: {
    default: {
      http: [process.env.POLYGON_RPC_URL || "https://polygon-rpc.com"],
    },
    public: {
      http: [process.env.POLYGON_RPC_URL || "https://polygon-rpc.com"],
    },
  },
  blockExplorers: {
    default: { name: "Polygonscan", url: "https://polygonscan.com" },
  },
});

// Well-known Arc Testnet contracts (from Arc docs).
export const ARC_ADDRS = {
  usdc: "0x3600000000000000000000000000000000000000",
  cctpTokenMessengerV2:
    process.env.ARC_CCTP_TOKEN_MESSENGER ||
    "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  cctpMessageTransmitterV2:
    process.env.ARC_CCTP_MESSAGE_TRANSMITTER ||
    "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
  cctpTokenMinterV2:
    process.env.ARC_CCTP_TOKEN_MINTER ||
    "0xb43db544E2c27092c107639Ad201b3dEfAbcF192",
  multicall3: "0xcA11bde05977b3631167028862bE2a173976CA11",
  permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
} as const;

export const CCTP_DOMAINS = {
  arc: Number(process.env.ARC_CCTP_DOMAIN ?? 26),
  polygon: Number(process.env.POLYGON_CCTP_DOMAIN ?? 7),
} as const;

export function arcscanTx(hash: string) {
  return `${ARC_EXPLORER}/tx/${hash}`;
}
export function arcscanAddress(addr: string) {
  return `${ARC_EXPLORER}/address/${addr}`;
}
export function polygonscanTx(hash: string) {
  return `https://polygonscan.com/tx/${hash}`;
}
