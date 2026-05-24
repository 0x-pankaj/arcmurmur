import "@nomicfoundation/hardhat-toolbox";
import * as path from "path";
import * as dotenv from "dotenv";

// Load root .env (monorepo-level config)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const ARC_RPC_URL =
  process.env.ARC_RPC_URL ||
  "https://rpc.testnet.arc-node.thecanteenapp.com";
const ARC_CHAIN_ID = Number(process.env.ARC_CHAIN_ID ?? 421614);
const DEPLOYER_PK =
  process.env.DEPLOYER_PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

export default {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    arc: {
      url: ARC_RPC_URL,
      chainId: ARC_CHAIN_ID,
      accounts: [DEPLOYER_PK],
    },
    hardhat: {},
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
    cache: "./cache",
  },
};
