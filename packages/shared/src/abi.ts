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
