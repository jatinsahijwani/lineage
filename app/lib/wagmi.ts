import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

const RPC_URL =
  process.env.NEXT_PUBLIC_ZERO_G_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const EXPLORER_URL = "https://chainscan-galileo.0g.ai";

export const zeroGTestnet = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: {
    name: "0G",
    symbol: "OG",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [RPC_URL] },
    public: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: "0G Chainscan Galileo", url: EXPLORER_URL },
  },
  testnet: true,
});

// `??` only catches null/undefined — an empty string from `.env` would slip
// through and crash WalletConnect v2's strict "no empty projectId" check.
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || "lineage-dev";

export const wagmiConfig = getDefaultConfig({
  appName: "Lineage",
  projectId: walletConnectProjectId,
  chains: [zeroGTestnet],
  ssr: true,
});
