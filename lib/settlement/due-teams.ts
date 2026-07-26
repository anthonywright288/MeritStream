import type { SupabaseClient } from "@supabase/supabase-js";
import { cycleWindow } from "@/lib/cycle/window";

/**
 * [RT-H1] Cron work list = newly-due teams AND resumable non-terminal
 * settlements. Without the second set, a crashed run, an underfunded pool,
 * or a partial payout would be a permanent dead-end.
 */
export interface DueTeam {
  teamId: string;
  reason: "due" | "resume";
}

const STALE_RUNNING_MS = 10 * 60 * 1000; // a 'running' older than this is a crash

export async function dueTeams(
  db: SupabaseClient,
  now: Date = new Date(),
): Promise<DueTeam[]> {
  const { data: teams } = await db
    .from("teams")
    .select("id, cycle, created_at");
  if (!teams?.length) return [];

  const out: DueTeam[] = [];
  for (const team of teams) {
    // resumable first: running(stale) | partial | insufficient_funds
    const { data: nonTerminal } = await db
      .from("settlements")
      .select("id, status, created_at")
      .eq("team_id", team.id)
      .in("status", ["running", "partial", "insufficient_funds"])
      .order("created_at", { ascending: false })
      .limit(1);
    const open = nonTerminal?.[0];
    if (open) {
      const stale =
        open.status !== "running" ||
        now.getTime() - Date.parse(open.created_at) > STALE_RUNNING_MS;
      if (stale) out.push({ teamId: team.id, reason: "resume" });
      continue; // an open settlement blocks starting the next window
    }

    // newly due: open window fully elapsed and not covered by any settlement
    const { data: last } = await db
      .from("settlements")
      .select("cycle_end")
      .eq("team_id", team.id)
      .order("cycle_end", { ascending: false })
      .limit(1);
    const window = cycleWindow(
      team.created_at,
      team.cycle,
      last?.[0]?.cycle_end ?? null,
      now,
    );
    // [RT-H2] coverage by range: the derived open window starts at the last
    // settlement end (incl. forced ends), so due = its end has passed.
    if (window.end.getTime() <= now.getTime()) {
      out.push({ teamId: team.id, reason: "due" });
    }
  }
  return out;
}
