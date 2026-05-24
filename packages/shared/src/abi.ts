export const STIGMERGY_ABI = [
  {
    type: "event",
    name: "Signal",
    inputs: [
      { indexed: true, name: "agent", type: "address" },
      { indexed: true, name: "marketId", type: "bytes32" },
      { indexed: false, name: "agentName", type: "string" },
      { indexed: false, name: "probBps", type: "uint16" },
      { indexed: false, name: "convictionBps", type: "uint16" },
      { indexed: false, name: "action", type: "uint8" },
      { indexed: false, name: "sizeUsdc", type: "uint64" },
      { indexed: false, name: "polymarketSlug", type: "string" },
      { indexed: false, name: "rationale", type: "string" },
      { indexed: false, name: "polygonTxHash", type: "bytes32" },
      { indexed: false, name: "timestamp", type: "uint64" },
    ],
  },
  {
    type: "event",
    name: "Settlement",
    inputs: [
      { indexed: true, name: "agent", type: "address" },
      { indexed: true, name: "marketId", type: "bytes32" },
      { indexed: false, name: "pnlMicroUsdc", type: "int64" },
      { indexed: false, name: "polygonTxHash", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "post",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "agentName", type: "string" },
      { name: "probBps", type: "uint16" },
      { name: "convictionBps", type: "uint16" },
      { name: "action", type: "uint8" },
      { name: "sizeUsdc", type: "uint64" },
      { name: "polymarketSlug", type: "string" },
      { name: "rationale", type: "string" },
      { name: "polygonTxHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "marketId", type: "bytes32" },
      { name: "pnlMicroUsdc", type: "int64" },
      { name: "polygonTxHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "totalSignals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

export enum ActionCode {
  PASS = 0,
  BUY_YES = 1,
  BUY_NO = 2,
  CLOSE = 3,
}

/**
 * MarketProposals (RFB-03). Agents emit `propose` when swarm consensus on a
 * topic has no matching Polymarket market; peers can `endorse` once each.
 */
export const PROPOSALS_ABI = [
  {
    type: "event",
    name: "MarketProposed",
    inputs: [
      { indexed: true, name: "proposalId", type: "bytes32" },
      { indexed: true, name: "agent", type: "address" },
      { indexed: false, name: "agentName", type: "string" },
      { indexed: false, name: "question", type: "string" },
      { indexed: false, name: "category", type: "string" },
      { indexed: false, name: "yesProbBps", type: "uint16" },
      { indexed: false, name: "convictionBps", type: "uint16" },
      { indexed: false, name: "rationale", type: "string" },
      { indexed: false, name: "evidenceURI", type: "string" },
      { indexed: false, name: "timestamp", type: "uint64" },
    ],
  },
  {
    type: "event",
    name: "ProposalEndorsed",
    inputs: [
      { indexed: true, name: "proposalId", type: "bytes32" },
      { indexed: true, name: "agent", type: "address" },
      { indexed: false, name: "agentName", type: "string" },
      { indexed: false, name: "convictionBps", type: "uint16" },
      { indexed: false, name: "note", type: "string" },
      { indexed: false, name: "timestamp", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "propose",
    stateMutability: "nonpayable",
    inputs: [
      { name: "question", type: "string" },
      { name: "category", type: "string" },
      { name: "yesProbBps", type: "uint16" },
      { name: "convictionBps", type: "uint16" },
      { name: "agentName", type: "string" },
      { name: "rationale", type: "string" },
      { name: "evidenceURI", type: "string" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "endorse",
    stateMutability: "nonpayable",
    inputs: [
      { name: "id", type: "bytes32" },
      { name: "convictionBps", type: "uint16" },
      { name: "agentName", type: "string" },
      { name: "note", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "totalProposals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "totalEndorsements",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

/** Arc Testnet ERC-8004 registry addresses (deployed by Arc). */
export const ERC8004 = {
  IDENTITY_REGISTRY: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  REPUTATION_REGISTRY: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  VALIDATION_REGISTRY: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
} as const;

export const ERC8004_IDENTITY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "metadataURI", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "string" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: true, name: "tokenId", type: "uint256" },
    ],
  },
] as const;

export const ERC8004_REPUTATION_ABI = [
  {
    type: "function",
    name: "giveFeedback",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "score", type: "int128" },
      { name: "feedbackType", type: "uint8" },
      { name: "tag", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "evidenceURI", type: "string" },
      { name: "comment", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
  },
] as const;
