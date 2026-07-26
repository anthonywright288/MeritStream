import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { SettlementRow, type SettlementView } from "@/components/history/settlement-row";

export const metadata = { title: "Settlement history — MeritStream" };
export const dynamic = "force-dynamic";

/** The audit-trail page: every past cycle, its frozen snapshot, its txs. */
export default async function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: team } = await db
    .from("teams")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!team) {
    return <main className="p-10">Team not found.</main>;
  }

  const { data: settlements } = await db
    .from("settlements")
    .select("id, cycle_start, cycle_end, pool_amount, status, snapshot")
    .eq("team_id", id)
    .order("cycle_end", { ascending: false });

  const ids = (settlements ?? []).map((s) => s.id);
  const { data: payouts } = ids.length
    ? await db
        .from("payouts")
        .select("settlement_id, member_id, status, tx_hash, dest_address")
        .in("settlement_id", ids)
    : { data: [] };

  const views: SettlementView[] = (settlements ?? []).map((s) => ({
    id: s.id,
    cycleStart: s.cycle_start,
    cycleEnd: s.cycle_end,
    poolAmount: String(s.pool_amount),
    status: s.status,
    snapshot: s.snapshot,
    payouts: (payouts ?? [])
      .filter((p) => p.settlement_id === s.id)
      .map((p) => ({
        memberId: p.member_id,
        status: p.status,
        txHash: p.tx_hash,
        destAddress: p.dest_address,
      })),
  }));

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-4 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{team.name} — settlement history</h1>
        <Link href={`/team/${id}`} className="text-sm text-blue-500 hover:underline">
          ← dashboard
        </Link>
      </div>
      {views.length === 0 && (
        <p className="text-muted-foreground">No settlements yet. The audit trail starts after the first cycle settles.</p>
      )}
      {views.map((s) => (
        <SettlementRow key={s.id} settlement={s} />
      ))}
    </main>
  );
}
