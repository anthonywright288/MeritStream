import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayoutRow, PayoutStore } from "@/lib/settlement/pay-members";

/**
 * Supabase adapter for the payout loop. All writes go through the
 * UNIQUE(settlement_id, member_id) upsert [RT-C3] so concurrent runs cannot
 * mint duplicate payout rows.
 */
export function supabasePayoutStore(
  db: SupabaseClient,
  settlementId: string,
  teamId: string,
): PayoutStore {
  return {
    async load() {
      const { data } = await db
        .from("payouts")
        .select("member_id, status, tx_hash, dest_address, amount")
        .eq("settlement_id", settlementId);
      const map = new Map<string, PayoutRow>();
      for (const r of data ?? []) {
        map.set(r.member_id, {
          memberId: r.member_id,
          status: r.status,
          txHash: r.tx_hash,
          destAddress: r.dest_address,
          amountBaseUnits: String(r.amount),
        });
      }
      return map;
    },
    async upsert(row: PayoutRow) {
      const { error } = await db.from("payouts").upsert(
        {
          settlement_id: settlementId,
          member_id: row.memberId,
          status: row.status,
          tx_hash: row.txHash,
          dest_address: row.destAddress,
          amount: row.amountBaseUnits,
        },
        { onConflict: "settlement_id,member_id" },
      );
      if (error) throw new Error(`payout upsert failed: ${error.message}`);
    },
    async currentWallet(memberId: string) {
      const { data } = await db
        .from("members")
        .select("wallet_address")
        .eq("id", memberId)
        .eq("team_id", teamId)
        .maybeSingle();
      return data?.wallet_address ?? null;
    },
  };
}
