/**
 * CCTP v2 — burn USDC on Arc, mint native USDC on the destination chain.
 *
 * The Arc-side burn is ALWAYS a real on-chain tx (verifiable on Arcscan):
 *   1. approve USDC to the TokenMessengerV2
 *   2. depositForBurn(amount, destDomain, mintRecipient, USDC, …)
 *   3. poll Circle's attestation service for the signed message
 *   4. (on the destination chain) submit receiveMessage() to mint — left to you,
 *      since it needs a wallet funded on the destination chain.
 */
import {
  encodeAbiParameters,
  encodeFunctionData,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import {
  ARC_ADDRS,
  CCTP_DOMAINS,
  CCTP_ATTESTATION_HOST,
} from "./chain";
import { ERC20_ABI, CCTP_TOKEN_MESSENGER_ABI } from "./abi";

export type BurnResult = {
  ok: boolean;
  approveTxHash?: Hex;
  burnTxHash?: Hex;
  attestation?: string | null;
  error?: string;
};

/** bytes32-pad an address for CCTP's mintRecipient / destinationCaller fields. */
function padAddress(addr: Address): Hex {
  return encodeAbiParameters([{ type: "address" }], [addr]);
}

export async function depositForBurnFromArc(args: {
  wallet: WalletClient; // funded Arc wallet (agent EOA or session key)
  publicClient: PublicClient;
  amountUsdc: number;
  /** "polygon" | "amoy" — or any CCTP v2 domain number. */
  destination: keyof typeof CCTP_DOMAINS | number;
  /** Recipient on the destination chain (defaults to the sender). */
  recipient?: Address;
  /** maxFee fraction of amount (default 0.1%). */
  maxFeeBps?: number;
}): Promise<BurnResult> {
  const account = args.wallet.account;
  if (!account) return { ok: false, error: "wallet has no account" };

  const destDomain =
    typeof args.destination === "number"
      ? args.destination
      : CCTP_DOMAINS[args.destination];
  const recipient = args.recipient ?? account.address;
  const amountMicro = BigInt(Math.round(args.amountUsdc * 1_000_000));
  const maxFee = (amountMicro * BigInt(args.maxFeeBps ?? 10)) / 10_000n;

  try {
    // 1) approve
    const approveTxHash = await args.wallet.sendTransaction({
      account,
      chain: args.wallet.chain,
      to: ARC_ADDRS.usdc,
      data: encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [ARC_ADDRS.cctpTokenMessengerV2, amountMicro],
      }),
    });
    await args.publicClient.waitForTransactionReceipt({ hash: approveTxHash });

    // 2) depositForBurn
    const burnTxHash = await args.wallet.sendTransaction({
      account,
      chain: args.wallet.chain,
      to: ARC_ADDRS.cctpTokenMessengerV2,
      data: encodeFunctionData({
        abi: CCTP_TOKEN_MESSENGER_ABI,
        functionName: "depositForBurn",
        args: [
          amountMicro,
          destDomain,
          padAddress(recipient),
          ARC_ADDRS.usdc,
          padAddress("0x0000000000000000000000000000000000000000"), // any caller
          maxFee,
          1000, // minFinalityThreshold — fast finality
        ],
      }),
    });
    await args.publicClient.waitForTransactionReceipt({ hash: burnTxHash });

    // 3) poll attestation
    const attestation = await pollAttestation(burnTxHash);
    return { ok: true, approveTxHash, burnTxHash, attestation };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Poll Circle's iris attestation service for a burn tx's signed message. */
export async function pollAttestation(
  burnTxHash: string,
  { tries = 8, delayMs = 1500, sourceDomain = CCTP_DOMAINS.arc } = {},
): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(
        `${CCTP_ATTESTATION_HOST}/v2/messages/${sourceDomain}?transactionHash=${burnTxHash}`,
      );
      if (r.ok) {
        const json = (await r.json()) as { messages?: Array<{ attestation?: string }> };
        const att = json?.messages?.[0]?.attestation;
        if (att && att !== "PENDING") return att;
      }
    } catch {
      /* keep polling */
    }
    await new Promise((res) => setTimeout(res, delayMs));
  }
  return null;
}
