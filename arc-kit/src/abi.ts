/** Minimal ABIs used across the kit. Import only what you need. */
import { parseAbiItem } from "viem";

/** Standard ERC-20 surface (USDC on Arc speaks this). */
export const ERC20_ABI = [
  parseAbiItem("function transfer(address to, uint256 amount) returns (bool)"),
  parseAbiItem("function approve(address spender, uint256 amount) returns (bool)"),
  parseAbiItem("function balanceOf(address owner) view returns (uint256)"),
  parseAbiItem("function allowance(address owner, address spender) view returns (uint256)"),
  parseAbiItem("function decimals() view returns (uint8)"),
] as const;

/** StigmergySignal.sol — the on-chain coordination contract (see ../contracts). */
export const STIGMERGY_ABI = [
  parseAbiItem(
    "event Signal(address indexed agent, bytes32 indexed marketId, string agentName, uint16 probBps, uint16 convictionBps, uint8 action, uint64 sizeUsdc, string polymarketSlug, string rationale, bytes32 polygonTxHash, uint64 timestamp)",
  ),
  parseAbiItem(
    "function post(bytes32 marketId, string agentName, uint16 probBps, uint16 convictionBps, uint8 action, uint64 sizeUsdc, string polymarketSlug, string rationale, bytes32 polygonTxHash)",
  ),
  parseAbiItem("function settle(bytes32 marketId, int64 pnlDelta, bytes32 polygonTxHash)"),
  parseAbiItem("function totalSignals() view returns (uint256)"),
  parseAbiItem("function signalCount(address) view returns (uint256)"),
] as const;

/** Circle CCTP v2 TokenMessenger — the burn side of a cross-chain transfer. */
export const CCTP_TOKEN_MESSENGER_ABI = [
  parseAbiItem(
    "function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller, uint256 maxFee, uint32 minFinalityThreshold) returns (uint64 nonce)",
  ),
] as const;

/** ERC-8004 IdentityRegistry — register an agent as an on-chain identity NFT. */
export const ERC8004_IDENTITY_ABI = [
  parseAbiItem("function register(string metadataURI) returns (uint256)"),
  parseAbiItem("function tokenURI(uint256 tokenId) view returns (string)"),
  parseAbiItem(
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  ),
] as const;
