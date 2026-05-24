"use client";
import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet } from "@repo/shared/chains";

const arcRpc =
  process.env.NEXT_PUBLIC_ARC_RPC_URL ||
  "https://rpc.testnet.arc.network";

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  // Pin the connector to MetaMask specifically so multi-extension users
  // (Phantom + MetaMask + Backpack) don't get a silent reconnect to the wrong
  // wallet. `shimDisconnect: false` means a Disconnect click is final until
  // the user explicitly reconnects.
  connectors: [
    injected({
      shimDisconnect: false,
      target: () => ({
        id: "metaMask",
        name: "MetaMask",
        provider:
          typeof window !== "undefined"
            ? (window as any).ethereum?.providers?.find((p: any) => p?.isMetaMask) ??
              (window as any).ethereum
            : undefined,
      }),
    }),
  ],
  transports: {
    [arcTestnet.id]: http(arcRpc),
  },
  ssr: true,
});

export const ARC_USDC =
  (process.env.NEXT_PUBLIC_ARC_USDC ||
    "0x3600000000000000000000000000000000000000") as `0x${string}`;
export const VAULT_ADDRESS =
  (process.env.NEXT_PUBLIC_VAULT_CONTRACT ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const STIGMERGY_ADDRESS =
  (process.env.NEXT_PUBLIC_STIGMERGY_CONTRACT ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`;
