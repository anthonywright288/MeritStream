import { createPublicClient, defineChain, http } from "viem";

const ARC_RPC_URL =
  process.env.NEXT_PUBLIC_ARC_RPC_URL ?? "https://rpc.testnet.arc.network";

// Verified 2026-07-24: eth_chainId returned 0x4cef52 = 5042002.
// nativeCurrency.decimals=18 is ASSUMED (affects viem display only, never our
// money math — that runs on ERC-20 base units). The verify script measures the
// real gas cost via ERC-20 balance delta, which is decimals-independent.
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC_URL] } },
  testnet: true,
});

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});
