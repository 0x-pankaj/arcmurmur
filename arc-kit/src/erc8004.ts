/**
 * ERC-8004 — give an AI agent a portable, on-chain identity.
 *
 * Arc pre-deploys the ERC-8004 IdentityRegistry (and Reputation/Validation
 * registries). Registering an agent mints an identity NFT under its wallet;
 * metadata can be an inline `data:` URI so there's no IPFS dependency.
 */
import {
  encodeFunctionData,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { ERC8004 } from "./chain";
import { ERC8004_IDENTITY_ABI } from "./abi";

/** Register `wallet`'s address as an agent identity. Idempotent. */
export async function registerAgentIdentity(args: {
  wallet: WalletClient;
  publicClient: PublicClient;
  metadataURI: string;
}): Promise<{ txHash?: Hash; tokenId?: string; alreadyRegistered: boolean; error?: string }> {
  const account = args.wallet.account;
  if (!account) return { alreadyRegistered: false, error: "wallet has no account" };

  const existing = await lookupAgentId(args.publicClient, account.address);
  if (existing != null) return { tokenId: existing.toString(), alreadyRegistered: true };

  try {
    const txHash = await args.wallet.sendTransaction({
      account,
      chain: args.wallet.chain,
      to: ERC8004.IDENTITY_REGISTRY,
      data: encodeFunctionData({
        abi: ERC8004_IDENTITY_ABI,
        functionName: "register",
        args: [args.metadataURI],
      }),
    });
    const receipt = await args.publicClient.waitForTransactionReceipt({ hash: txHash });
    const id = await lookupAgentIdInBlock(args.publicClient, account.address, receipt.blockNumber);
    return { txHash, tokenId: id?.toString(), alreadyRegistered: false };
  } catch (err) {
    return { alreadyRegistered: false, error: (err as Error).message };
  }
}

/** Find an agent's tokenId by scanning Transfer(_, owner, _) events. */
export async function lookupAgentId(
  publicClient: PublicClient,
  owner: Address,
  spanBlocks = 50_000n,
): Promise<bigint | null> {
  const latest = await publicClient.getBlockNumber();
  const fromBlock = latest > spanBlocks ? latest - spanBlocks : 0n;
  return lookupAgentIdRange(publicClient, owner, fromBlock, latest);
}

async function lookupAgentIdInBlock(publicClient: PublicClient, owner: Address, block: bigint) {
  return lookupAgentIdRange(publicClient, owner, block, block);
}

async function lookupAgentIdRange(
  publicClient: PublicClient,
  owner: Address,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<bigint | null> {
  try {
    const logs = await publicClient.getLogs({
      address: ERC8004.IDENTITY_REGISTRY,
      event: ERC8004_IDENTITY_ABI[2], // Transfer
      args: { to: owner },
      fromBlock,
      toBlock,
    });
    const last = logs[logs.length - 1];
    return (last?.args.tokenId ?? null) as bigint | null;
  } catch {
    return null;
  }
}

/** Read an agent's metadata URI. */
export async function readAgentMetadataURI(
  publicClient: PublicClient,
  tokenId: bigint,
): Promise<string | null> {
  try {
    return (await publicClient.readContract({
      address: ERC8004.IDENTITY_REGISTRY,
      abi: ERC8004_IDENTITY_ABI,
      functionName: "tokenURI",
      args: [tokenId],
    })) as string;
  } catch {
    return null;
  }
}
