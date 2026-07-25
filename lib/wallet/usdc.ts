import type { Address } from "viem";
import { publicClient } from "@/lib/arc/chain";
import { withRetry } from "@/lib/wallet/rpc-retry";

// Verified on-chain 2026-07-24: bytecode present, decimals()=6, symbol()="USDC"
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ??
  "0x3600000000000000000000000000000000000000") as Address;

export const USDC_DECIMALS = 6;

/** 1 USDC in base units. */
export const ONE_USDC = 1_000_000n;

export const usdcAbi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
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

/** USDC balance in base units (6 decimals), read through retry/backoff. */
export function readUsdcBalance(address: Address): Promise<bigint> {
  return withRetry(() =>
    publicClient.readContract({
      address: USDC_ADDRESS,
      abi: usdcAbi,
      functionName: "balanceOf",
      args: [address],
    }),
  );
}

/** On-chain decimals — used by the verify script to re-confirm the constant. */
export function readUsdcDecimals(): Promise<number> {
  return withRetry(() =>
    publicClient.readContract({
      address: USDC_ADDRESS,
      abi: usdcAbi,
      functionName: "decimals",
    }),
  );
}

/** Format base units as a human string, e.g. 1234567n -> "1.234567". */
export function formatUsdc(baseUnits: bigint): string {
  const negative = baseUnits < 0n;
  const abs = negative ? -baseUnits : baseUnits;
  const whole = abs / ONE_USDC;
  const frac = (abs % ONE_USDC).toString().padStart(6, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}
