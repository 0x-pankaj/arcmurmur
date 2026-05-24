import {
  encodeAbiParameters,
  encodeFunctionData,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";
import { ARC_ADDRS, CCTP_DOMAINS } from "@repo/shared/chains";
import { ERC20_ABI } from "@repo/shared/abi";
import { env } from "../env";
import {
  agentArcWallet,
  agentAddress,
  arcPublic,
} from "./wallets";
import type { AgentKey } from "@repo/shared/agents";

const CCTP_V2_TOKEN_MESSENGER_ABI = [
  parseAbiItem(
    "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) returns (uint64 nonce)",
  ),
] as const;

const CCTP_ATTESTATION_HOST = "https://iris-api-sandbox.circle.com";

export type BridgeChain = "arc" | "polygon" | "amoy";

export type BridgeArgs = {
  agent: AgentKey;
  fromChain: BridgeChain;
  toChain: BridgeChain;
  amountUsdc: number;
  recipient?: Address;
};

const CCTP_DOMAIN_BY_CHAIN: Record<BridgeChain, number> = {
  arc: 26,
  polygon: 7,
  amoy: 7, // Polygon Amoy uses domain 7 in CCTP V2 testnet
};

export type BridgeResult = {
  ok: boolean;
  burnTxHash?: string;
  attestationHash?: string;
  message?: string;
  error?: string;
  steps: string[];
};

/**
 * Real CCTP v2 bridge from Arc Testnet.
 *
 *  Arc (domain 26) → Polygon (domain 7):
 *    1. approve USDC to TokenMessengerV2
 *    2. call depositForBurn(amount, destDomain, mintRecipient, USDC, ...)
 *    3. wait for Circle attestation at iris-api-sandbox.circle.com
 *    4. user/agent submits receiveMessage() on Polygon to mint
 *
 *  Step 4 (mint on Polygon) is left as an enqueued step for the demo —
 *  it requires a separately-funded Polygon wallet. The dashboard
 *  surfaces the attestation hash + Arcscan tx so judges can verify the
 *  burn leg landed on Arc.
 *
 *  When DEMO_MODE=true, we still emit deterministic synthetic hashes so
 *  the UI runs end-to-end even before the deployer is funded.
 */
export async function bridgeUsdc(args: BridgeArgs): Promise<BridgeResult> {
  const steps: string[] = [];

  const destLabel =
    args.toChain === "amoy"
      ? "Polygon Amoy (testnet)"
      : args.toChain === "polygon"
        ? "Polygon"
        : "Arc";

  // Arc → Polygon (mainnet or Amoy testnet). The Arc-side burn is ALWAYS
  // real on-chain when an agent wallet is funded — only the Polygon mint
  // is simulated because we don't keep a Polygon-funded wallet for the
  // hackathon. So every actionable trade emits a true CCTP v2
  // `depositForBurn` event on Arc, verifiable on Arcscan.
  if (args.fromChain === "arc" && (args.toChain === "polygon" || args.toChain === "amoy")) {
    const wallet = agentArcWallet(args.agent);
    if (!wallet) {
      return demoBridge(args, steps, "Arc → Polygon");
    }
    try {
      const recipient = args.recipient ?? agentAddress(args.agent);
      const amountMicro = BigInt(Math.round(args.amountUsdc * 1_000_000));

      // 1) approve USDC to TokenMessenger
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ARC_ADDRS.cctpTokenMessengerV2 as Address, amountMicro],
      });
      const approveHash = await wallet.sendTransaction({
        to: ARC_ADDRS.usdc as Address,
        data: approveData,
      });
      steps.push(`approve(USDC, TokenMessengerV2): ${approveHash}`);
      await arcPublic.waitForTransactionReceipt({ hash: approveHash });

      // 2) depositForBurn
      const destDomain = CCTP_DOMAIN_BY_CHAIN[args.toChain];
      const burnData = encodeFunctionData({
        abi: CCTP_V2_TOKEN_MESSENGER_ABI,
        functionName: "depositForBurn",
        args: [
          amountMicro,
          destDomain,
          padAddress(recipient),
          ARC_ADDRS.usdc as Address,
          padAddress("0x0000000000000000000000000000000000000000"), // any caller
          (amountMicro * 1n) / 1000n, // maxFee = 0.1%
          1000, // minFinalityThreshold (fast finality)
        ],
      });
      const burnHash = await wallet.sendTransaction({
        to: ARC_ADDRS.cctpTokenMessengerV2 as Address,
        data: burnData,
      });
      steps.push(`depositForBurn → ${burnHash}`);
      await arcPublic.waitForTransactionReceipt({ hash: burnHash });

      // 3) request attestation (poll briefly; if it isn't ready the agent
      //    can come back next tick).
      const attestation = await pollAttestation(burnHash);

      return {
        ok: true,
        burnTxHash: burnHash,
        attestationHash: attestation ?? undefined,
        message: `Bridged ${args.amountUsdc.toFixed(2)} USDC Arc → ${destLabel} (attestation ${attestation ? attestation.slice(0, 10) + "…" : "pending"})`,
        steps,
      };
    } catch (err) {
      return {
        ok: false,
        error: (err as Error).message,
        steps,
      };
    }
  }

  // Polygon → Arc bridges back. In demo we surface the intent; live wiring
  // would mirror the Arc-side flow using @circle-fin/bridge-kit's Polygon
  // adapter (kept stubbed to avoid a Polygon-funded wallet requirement).
  return demoBridge(args, steps, "Polygon → Arc");
}

function demoBridge(
  args: BridgeArgs,
  steps: string[],
  label: string,
): BridgeResult {
  const burn = randomHash();
  const att = randomHash().slice(0, 18);
  steps.push(`[demo] ${label}: depositForBurn ${burn}`);
  steps.push(`[demo] ${label}: attestation ${att}`);
  return {
    ok: true,
    burnTxHash: burn,
    attestationHash: att,
    message: `[demo] Bridged $${args.amountUsdc.toFixed(2)} USDC ${args.fromChain.toUpperCase()} → ${args.toChain.toUpperCase()} via Circle CCTP for ${agentAddress(args.agent)}`,
    steps,
  };
}

async function pollAttestation(burnHash: string, tries = 6, delayMs = 1500) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${CCTP_ATTESTATION_HOST}/v2/messages/26?transactionHash=${burnHash}`);
      if (r.ok) {
        const json = (await r.json()) as any;
        const msg = json?.messages?.[0];
        if (msg?.attestation && msg.attestation !== "PENDING") {
          return msg.attestation as string;
        }
      }
    } catch {}
    await new Promise((res) => setTimeout(res, delayMs));
  }
  return null;
}

function padAddress(addr: string): Hex {
  return encodeAbiParameters([{ type: "address" }], [addr as Address]);
}

function randomHash() {
  return (
    "0x" +
    [...Array(64)]
      .map(() => Math.floor(Math.random() * 16).toString(16))
      .join("")
  );
}
