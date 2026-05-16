import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { ZG_TESTNET, ZG_MAINNET } from "@lineage/shared";

const TESTNET_RPC =
  process.env.NEXT_PUBLIC_ZERO_G_TESTNET_RPC_URL ??
  process.env.NEXT_PUBLIC_ZERO_G_RPC_URL ??
  ZG_TESTNET.rpcUrl;

const MAINNET_RPC =
  process.env.NEXT_PUBLIC_ZERO_G_MAINNET_RPC_URL ?? ZG_MAINNET.rpcUrl;

export const zeroGTestnet = defineChain({
  id: ZG_TESTNET.chainId,
  name: ZG_TESTNET.name,
  nativeCurrency: { name: "0G", symbol: ZG_TESTNET.symbol, decimals: 18 },
  rpcUrls: {
    default: { http: [TESTNET_RPC] },
    public: { http: [TESTNET_RPC] },
  },
  blockExplorers: {
    default: { name: "0G Chainscan Galileo", url: ZG_TESTNET.blockExplorer },
  },
  testnet: true,
});

export const zeroGMainnet = defineChain({
  id: ZG_MAINNET.chainId,
  name: ZG_MAINNET.name,
  nativeCurrency: { name: "0G", symbol: ZG_MAINNET.symbol, decimals: 18 },
  rpcUrls: {
    default: { http: [MAINNET_RPC] },
    public: { http: [MAINNET_RPC] },
  },
  blockExplorers: {
    default: { name: "0G Chainscan", url: ZG_MAINNET.blockExplorer },
  },
  testnet: false,
});

// `??` only catches null/undefined — an empty string from `.env` would slip
// through and crash WalletConnect v2's strict "no empty projectId" check.
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_ID || "lineage-dev";

export const wagmiConfig = getDefaultConfig({
  appName: "Lineage",
  projectId: walletConnectProjectId,
  // Mainnet first so RainbowKit lists it on top; testnet remains available
  // via the chain modal for the existing demo flow.
  chains: [zeroGMainnet, zeroGTestnet],
  ssr: true,
});
