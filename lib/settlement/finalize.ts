import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayResult } from "@/lib/settlement/pay-members";

/**
 * Final status is EARNED from payout outcomes, never assumed:
 *  - any outcome unknown ('sending' in flight) -> stays 'running' — the next
 *    run (cron resume or manual) verifies receipts and finishes;
 *  - every payable member paid -> 'paid';
 *  - anything failed -> 'partial' (resumable, [RT-H1]).
 * The next cycle opens implicitly: cycleWindow derives from the latest
 * settlement cycle_end (= the force time when forced, [RT-H2]).
 */
export function computeFinalStatus(
  result: PayResult,
  payableCount: number,
): "paid" | "partial" | "running" {
  if (result.unknown > 0) return "running";
  if (result.paid + result.skippedAlreadyPaid >= payableCount) return "paid";
  return "partial";
}

export async function finalizeSettlement(
  db: SupabaseClient,
  settlementId: string,
  status: "paid" | "partial" | "running" | "no_activity" | "insufficient_funds",
): Promise<void> {
  const { error } = await db
    .from("settlements")
    .update({ status })
    .eq("id", settlementId);
  if (error) throw new Error(`finalize failed: ${error.message}`);
}
