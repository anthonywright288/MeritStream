import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/admin-token";
import { runSettlement } from "@/lib/settlement/run-settlement";
import { supabaseAdmin } from "@/lib/supabase/admin";

// [RT-H1] settle can run long (sequential transfers + receipts)
export const maxDuration = 60;

/**
 * POST /api/teams/[id]/settle — manual "Settle now" (admin token).
 * `{force:true}` settles before cycle end; [RT-H2] the engine records
 * cycle_end = now. Idempotency lives in the engine's claim [RT-C3]: an
 * already-settled cycle returns 409 here, never a second payout.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: team } = await db
    .from("teams")
    .select("id, admin_token_hash")
    .eq("id", id)
    .maybeSingle();
  if (!team) {
    return NextResponse.json({ error: "team not found" }, { status: 404 });
  }
  const token = request.headers.get("x-admin-token") ?? "";
  if (!verifyToken(token, team.admin_token_hash)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let force = false;
  try {
    const body = await request.json();
    force = body?.force === true;
  } catch {
    // empty body = not forced
  }

  const outcome = await runSettlement(id, { force });
  return NextResponse.json(outcome, { status: outcome.code });
}
