import { NextResponse } from "next/server";
import { dueTeams } from "@/lib/settlement/due-teams";
import { runSettlement } from "@/lib/settlement/run-settlement";
import { supabaseAdmin } from "@/lib/supabase/admin";

// [RT-H1] Explicit ceiling — sequential transfers + retries are slow.
export const maxDuration = 60;

/**
 * POST /api/agent/run — Vercel Cron entrypoint (daily; Hobby max 1/day —
 * verified fact; demo timing uses the manual Settle-now instead).
 * [RT-H1] Handles BOTH newly-due teams and resumable non-terminal
 * settlements (stale running / partial / insufficient_funds).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const due = await dueTeams(supabaseAdmin());
  const settled: unknown[] = [];
  const resumed: unknown[] = [];
  const skipped: unknown[] = [];
  for (const t of due) {
    // sequential on purpose: Arc RPC rate limits + one signer nonce stream
    const outcome = await runSettlement(t.teamId);
    const entry = { teamId: t.teamId, ...outcome };
    if (outcome.code === 200) (t.reason === "resume" ? resumed : settled).push(entry);
    else skipped.push(entry);
  }
  return NextResponse.json({ settled, resumed, skipped });
}

/** Vercel cron uses GET — same guard, same behavior. */
export async function GET(request: Request) {
  return POST(request);
}
