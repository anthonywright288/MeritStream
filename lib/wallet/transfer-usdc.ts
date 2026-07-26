import { createWalletClient, http, type Address } from "viem";
import type { HDAccount } from "viem/accounts";
import { arcTestnet, publicClient } from "@/lib/arc/chain";
import { withRetry } from "@/lib/wallet/rpc-retry";
import { USDC_ADDRESS, usdcAbi } from "@/lib/wallet/usdc";

/**
 * [RT-C2] Transfer is split into three distinct steps so a retry can never
 * re-broadcast money:
 *  - broadcastUsdcTransfer: called EXACTLY ONCE per payout, NO retry — an
 *    RPC timeout after mempool acceptance would otherwise double-send.
 *  - awaitUsdcReceipt: receipt polling, safe to retry (read-only).
 *  - getUsdcReceipt: read-only check for resume ('sending' rows with a hash).
 * This module does NO DB writes — pay-members persists state transitions
 * around these calls (sending BEFORE broadcast, hash right after, paid after
 * the receipt confirms).
 */
export async function broadcastUsdcTransfer(
  account: HDAccount,
  to: Address,
  amountBaseUnits: bigint,
): Promise<`0x${string}`> {
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });
  // single send — intentionally NOT wrapped in withRetry
  return walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "transfer",
    args: [to, amountBaseUnits],
  });
}

/** Await receipt with retry; throws if the tx reverted. */
export async function awaitUsdcReceipt(txHash: `0x${string}`) {
  const receipt = await withRetry(
    () => publicClient.waitForTransactionReceipt({ hash: txHash }),
    { retries: 8, baseDelayMs: 1000 },
  );
  if (receipt.status !== "success") {
    throw new Error(`transfer reverted: ${txHash}`);
  }
  return receipt;
}

/**
 * Resume check for a 'sending' payout: null = not found/not mined yet
 * (leave it alone, never blind re-send), receipt = decide paid/failed.
 */
export async function getUsdcReceipt(txHash: `0x${string}`) {
  try {
    return await withRetry(
      () => publicClient.getTransactionReceipt({ hash: txHash }),
      { retries: 3, baseDelayMs: 500 },
    );
  } catch {
    return null;
  }
}
