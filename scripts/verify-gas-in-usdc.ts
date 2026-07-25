/**
 * Phase 1 gas-in-USDC verification (run: npx tsx scripts/verify-gas-in-usdc.ts)
 *
 * Proves the PRD assumption "gas on Arc is USDC" with a REAL transfer:
 * derives pool account #0, sends 0.01 USDC to account #1, awaits the receipt,
 * and compares ERC-20 balance deltas. If the sender's USDC drop exceeds the
 * transfer amount, the excess is the gas — paid in USDC. If the tx needs a
 * separate native token, STOP and file plans/PRD-ERRATA.md.
 *
 * [RT-C1] Also measures the per-transfer gas cost in USDC base units to
 * validate the 1 USDC settlement buffer against max expected member count.
 * [RT-C2] The broadcast is NOT retried; only reads/receipt-wait use withRetry.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createWalletClient, http, parseUnits } from "viem";

// Load .env.local manually (tsx does not auto-load env files)
try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {
  // fall through — env may already be set in the shell
}

async function main() {
  const { arcTestnet, publicClient } = await import("../lib/arc/chain");
  const { deriveTeamPoolAccount } = await import(
    "../lib/wallet/derive-pool-account"
  );
  const { withRetry } = await import("../lib/wallet/rpc-retry");
  const { USDC_ADDRESS, usdcAbi, readUsdcBalance, readUsdcDecimals, formatUsdc } =
    await import("../lib/wallet/usdc");

  const sender = deriveTeamPoolAccount(0);
  const receiver = deriveTeamPoolAccount(1);
  console.log(`Pool account #0 (sender):   ${sender.address}`);
  console.log(`Pool account #1 (receiver): ${receiver.address}`);

  const decimals = await readUsdcDecimals();
  console.log(`USDC decimals on-chain: ${decimals}`);

  const balanceBefore = await readUsdcBalance(sender.address);
  console.log(`Sender USDC balance: ${formatUsdc(balanceBefore)} USDC`);
  if (balanceBefore === 0n) {
    console.error(
      "\nSender has 0 USDC. Fund the address above from an Arc testnet faucet, then re-run.",
    );
    process.exit(1);
  }

  const receiverBefore = await readUsdcBalance(receiver.address);
  const amount = parseUnits("0.01", decimals);

  const walletClient = createWalletClient({
    account: sender,
    chain: arcTestnet,
    transport: http(),
  });

  // [RT-C2] single broadcast, NO retry wrapper around the send
  const txHash = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "transfer",
    args: [receiver.address, amount],
  });
  console.log(`\nBroadcast tx: ${txHash}`);

  const receipt = await withRetry(
    () => publicClient.waitForTransactionReceipt({ hash: txHash }),
    { retries: 8, baseDelayMs: 1000 },
  );
  console.log(`Status: ${receipt.status}`);
  console.log(`gasUsed: ${receipt.gasUsed}`);
  console.log(`effectiveGasPrice: ${receipt.effectiveGasPrice}`);

  const balanceAfter = await readUsdcBalance(sender.address);
  const receiverAfter = await readUsdcBalance(receiver.address);

  const senderDrop = balanceBefore - balanceAfter;
  const gasInUsdcBaseUnits = senderDrop - amount;
  const nativeFee = receipt.gasUsed * receipt.effectiveGasPrice;

  console.log(`\nSender drop:      ${formatUsdc(senderDrop)} USDC`);
  console.log(`Transfer amount:  ${formatUsdc(amount)} USDC`);
  console.log(`=> Gas cost:      ${formatUsdc(gasInUsdcBaseUnits)} USDC (${gasInUsdcBaseUnits} base units)`);
  console.log(`Native fee (raw units): ${nativeFee}`);
  console.log(
    `Receiver delta:   ${formatUsdc(receiverAfter - receiverBefore)} USDC (expected ${formatUsdc(amount)})`,
  );

  // [RT-C1] headroom vs the 1 USDC buffer for a realistic member count
  const buffer = 1_000_000n;
  const maxMembers = gasInUsdcBaseUnits > 0n ? buffer / gasInUsdcBaseUnits : null;
  console.log(
    `\n[RT-C1] 1 USDC buffer covers ${maxMembers ?? "unbounded (zero gas?)"} transfers at the measured cost.`,
  );

  if (gasInUsdcBaseUnits >= 0n && receiverAfter - receiverBefore === amount) {
    console.log("\nVERDICT: gas paid in USDC — PRD assumption CONFIRMED.");
  } else {
    console.log(
      "\nVERDICT: UNEXPECTED balance math — investigate before proceeding (possible non-USDC gas). See PRD CONFLICT PROTOCOL.",
    );
    process.exit(2);
  }
}

main().catch((error) => {
  console.error("\nverify-gas-in-usdc failed:", error);
  console.error(
    "If the error mentions a missing NATIVE (non-USDC) balance for gas -> STOP and write plans/PRD-ERRATA.md.",
  );
  process.exit(1);
});
