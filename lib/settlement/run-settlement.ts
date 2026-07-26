import { isAddress, type Address } from "viem";
import { cycleWindow } from "@/lib/cycle/window";
import { deriveTeamPoolAccount } from "@/lib/wallet/derive-pool-account";
import { readUsdcBalance } from "@/lib/wallet/usdc";
import {
  awaitUsdcReceipt,
  broadcastUsdcTransfer,
  getUsdcReceipt,
} from "@/lib/wallet/transfer-usdc";
import { GAS_BUFFER_BASE_UNITS } from "@/lib/settlement/constants";
import { freezeSnapshot, type SettlementSnapshot } from "@/lib/settlement/freeze-snapshot";
import { payMembers } from "@/lib/settlement/pay-members";
import { supabasePayoutStore } from "@/lib/settlement/payout-store";
import { computeFinalStatus, finalizeSettlement } from "@/lib/settlement/finalize";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface SettleOutcome {
  code: number; // HTTP-ish: 200 ok, 409 refused, 502 aborted, 500 config error
  status: string;
  settlementId?: string;
  detail?: string;
  shortfallBaseUnits?: string;
  result?: { paid: number; failed: number; unknown: number; skippedAlreadyPaid: number };
}

/**
 * The ONE settlement engine — called by cron and by Settle-now.
 * Order: claim [RT-C3] -> snapshot load-or-strict-freeze [RT-C4][RT-C5] ->
 * mnemonic assert [RT-H5] -> funds gate on remaining unpaid [RT-C1] ->
 * sequential resume-safe pay loop [RT-C2][RT-H4] -> earned status.
 */
export async function runSettlement(
  teamId: string,
  { force = false }: { force?: boolean } = {},
): Promise<SettleOutcome> {
  const db = supabaseAdmin();
  const now = new Date();

  const { data: team } = await db
    .from("teams")
    .select("id, cycle, created_at, wallet_index, pool_address")
    .eq("id", teamId)
    .maybeSingle();
  if (!team) return { code: 404, status: "error", detail: "team not found" };

  const { data: last } = await db
    .from("settlements")
    .select("cycle_end")
    .eq("team_id", teamId)
    .in("status", ["paid", "no_activity"])
    .order("cycle_end", { ascending: false })
    .limit(1);
  const window = cycleWindow(team.created_at, team.cycle, last?.[0]?.cycle_end ?? null, now);

  if (!force && window.end.getTime() > now.getTime()) {
    return { code: 409, status: "not_due", detail: "cycle still open; use force to settle early" };
  }
  // Idempotency for rapid re-force (user constraint #3): a force right after
  // a completed settle would open a near-empty [lastEnd, now] window and mint
  // a junk settlement row. Refuse until the new window has meaningful age.
  const MIN_FORCE_WINDOW_MS = 60_000;
  if (force && now.getTime() - window.start.getTime() < MIN_FORCE_WINDOW_MS) {
    return {
      code: 409,
      status: "already_settled",
      detail: "cycle was just settled — nothing new to settle yet",
    };
  }
  // [RT-H2] forced settle truncates: recorded cycle_end = now
  const cycleEnd = force && window.end.getTime() > now.getTime() ? now : window.end;

  // [RT-C3] atomic claim — exactly one concurrent invocation proceeds
  const { data: claims, error: claimError } = await db.rpc("claim_settlement", {
    p_team_id: teamId,
    p_cycle_start: window.start.toISOString(),
    p_cycle_end: cycleEnd.toISOString(),
  });
  if (claimError || !claims?.length) {
    return { code: 500, status: "error", detail: `claim failed: ${claimError?.message}` };
  }
  const claim = claims[0] as { settlement_id: string; prior_status: string | null; claimed: boolean };
  if (!claim.claimed) {
    const why = claim.prior_status === "running" ? "settlement already running" : "cycle already settled";
    return { code: 409, status: claim.prior_status ?? "refused", settlementId: claim.settlement_id, detail: why };
  }
  const settlementId = claim.settlement_id;

  // [RT-C4] load stored snapshot; freeze STRICT only on first claim
  const { data: row } = await db
    .from("settlements")
    .select("snapshot")
    .eq("id", settlementId)
    .maybeSingle();
  let snapshot = row?.snapshot as SettlementSnapshot | null;
  if (!snapshot) {
    try {
      snapshot = await freezeSnapshot(teamId, cycleEnd.toISOString());
    } catch (error) {
      // [RT-C5] strict freeze aborted (GitHub error): delete the un-frozen row
      // so the cycle stays retryable; nothing was paid, nothing is lost.
      await db.from("settlements").delete().eq("id", settlementId).is("snapshot", null);
      return {
        code: 502,
        status: "freeze_aborted",
        detail: `signals unavailable, settlement aborted (no partial split): ${error instanceof Error ? error.message : error}`,
      };
    }
    if (!snapshot) return { code: 404, status: "error", detail: "team vanished during freeze" };
    const { error: snapError } = await db
      .from("settlements")
      .update({ snapshot, pool_amount: snapshot.poolBalance })
      .eq("id", settlementId)
      .is("snapshot", null); // write-once [RT-C4]
    if (snapError) return { code: 500, status: "error", detail: snapError.message };
  }

  if (snapshot.noActivity) {
    await finalizeSettlement(db, settlementId, "no_activity");
    return { code: 200, status: "no_activity", settlementId, detail: "no points this cycle; pool rolls over" };
  }

  // [RT-H5] the runtime mnemonic must derive the wallet this team funded
  const account = deriveTeamPoolAccount(team.wallet_index);
  if (account.address.toLowerCase() !== team.pool_address.toLowerCase()) {
    return {
      code: 500,
      status: "mnemonic_mismatch",
      settlementId,
      detail: `derived ${account.address} != stored pool ${team.pool_address}; refusing to sign`,
    };
  }
  if (!isAddress(team.pool_address)) {
    return { code: 500, status: "error", settlementId, detail: "invalid pool address" };
  }

  // [RT-C1][RT-C4] gate on what is still OWED, against a fresh balance read
  const store = supabasePayoutStore(db, settlementId, teamId);
  const existing = await store.load();
  const remainingTotal = snapshot.members.reduce((sum, m) => {
    const paid = existing.get(m.memberId)?.status === "paid";
    return paid ? sum : sum + BigInt(m.amountBaseUnits);
  }, 0n);
  const balance = await readUsdcBalance(team.pool_address as Address);
  if (balance - GAS_BUFFER_BASE_UNITS < remainingTotal) {
    const shortfall = remainingTotal - (balance - GAS_BUFFER_BASE_UNITS);
    await finalizeSettlement(db, settlementId, "insufficient_funds");
    return {
      code: 409,
      status: "insufficient_funds",
      settlementId,
      shortfallBaseUnits: shortfall.toString(),
      detail: `pool short by ${shortfall} base units (incl. 1 USDC gas buffer); nothing paid`,
    };
  }

  const result = await payMembers(snapshot, account, store, {
    broadcast: broadcastUsdcTransfer,
    awaitReceipt: awaitUsdcReceipt,
    getReceipt: getUsdcReceipt,
  });

  const payableCount = snapshot.members.filter((m) => BigInt(m.amountBaseUnits) > 0n).length;
  const status = computeFinalStatus(result, payableCount);
  await finalizeSettlement(db, settlementId, status);
  return { code: 200, status, settlementId, result };
}
