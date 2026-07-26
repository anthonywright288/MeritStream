import type { Address } from "viem";
import { fetchCommits, type CommitItem } from "@/lib/github/fetch-commits";
import { fetchMergedPrs, type MergedPrItem } from "@/lib/github/fetch-merged-prs";
import { computeShares } from "@/lib/points/compute-shares";
import { cycleWindow, daysUntil, memberSince } from "@/lib/cycle/window";
import { distributableFrom } from "@/lib/settlement/constants";
import { readUsdcBalance } from "@/lib/wallet/usdc";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface MemberSignalsDto {
  memberId: string;
  username: string;
  wallet: string;
  memberSince: string;
  commits: number;
  prs: number;
  commitItems: CommitItem[];
  prItems: MergedPrItem[];
  points: number;
  pct: number;
  amountBaseUnits: string;
  /** Tolerant mode only: GitHub fetch failed, counts forced to 0. */
  error: boolean;
}

export interface SignalsDto {
  teamId: string;
  teamName: string;
  repo: string;
  cycle: string;
  commitWeight: number;
  prWeight: number;
  window: { start: string; end: string };
  daysUntilSettlement: number;
  poolAddress: string;
  poolBalance: string;
  distributable: string;
  dustBaseUnits: string;
  noActivity: boolean;
  members: MemberSignalsDto[];
}

/**
 * [RT-C5] strict=false (dashboard): a member's GitHub failure marks
 * error:true + counts 0 — partial render, never a blank page.
 * strict=true (settlement freeze ONLY, Phase 3): ANY member failure throws —
 * a silently-zeroed member in a frozen snapshot would misdirect real money.
 */
export async function loadSignals(
  teamId: string,
  { strict }: { strict: boolean },
): Promise<SignalsDto | null> {
  const db = supabaseAdmin();
  // A DB/connection error must NOT masquerade as "team not found" (404):
  // throw so callers surface 502 and the real cause is visible.
  const { data: team, error: teamError } = await db
    .from("teams")
    .select("id, name, repo, commit_weight, pr_weight, cycle, pool_address, created_at")
    .eq("id", teamId)
    .maybeSingle();
  if (teamError) throw new Error(`db teams query failed: ${teamError.message}`);
  if (!team) return null;

  const { data: members, error: membersError } = await db
    .from("members")
    .select("id, github_username, wallet_address, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: true });
  if (membersError) throw new Error(`db members query failed: ${membersError.message}`);
  if (!members?.length) return null;

  const window = cycleWindow(team.created_at, team.cycle, null);
  const untilISO = window.end.toISOString();

  const fetched = await Promise.all(
    members.map(async (m) => {
      // [RT-H3] mid-cycle join: fetch from max(joined, window start) for BOTH
      const sinceISO = memberSince(m.created_at, window.start).toISOString();
      try {
        const [commits, prs] = await Promise.all([
          fetchCommits(team.repo, m.github_username, sinceISO, untilISO),
          fetchMergedPrs(team.repo, m.github_username, sinceISO, untilISO),
        ]);
        return { member: m, sinceISO, commits, prs, error: false };
      } catch (error) {
        if (strict) throw error; // settlement freeze must abort, never zero
        return {
          member: m,
          sinceISO,
          commits: { count: 0, items: [] as CommitItem[] },
          prs: { count: 0, items: [] as MergedPrItem[] },
          error: true,
        };
      }
    }),
  );

  const poolBalance = await readUsdcBalance(team.pool_address as Address);
  // [RT-C1] identical basis as settlement: shares over balance - gas buffer
  const distributable = distributableFrom(poolBalance);

  const shares = computeShares(
    fetched.map((f) => ({
      id: f.member.id,
      commits: f.commits.count,
      prs: f.prs.count,
    })),
    Number(team.commit_weight),
    Number(team.pr_weight),
    distributable,
  );

  return {
    teamId: team.id,
    teamName: team.name,
    repo: team.repo,
    cycle: team.cycle,
    commitWeight: Number(team.commit_weight),
    prWeight: Number(team.pr_weight),
    window: { start: window.start.toISOString(), end: untilISO },
    daysUntilSettlement: daysUntil(window.end),
    poolAddress: team.pool_address,
    poolBalance: poolBalance.toString(),
    distributable: distributable.toString(),
    dustBaseUnits: shares.dustBaseUnits.toString(),
    noActivity: shares.noActivity,
    members: fetched.map((f, i) => ({
      memberId: f.member.id,
      username: f.member.github_username,
      wallet: f.member.wallet_address,
      memberSince: f.sinceISO,
      commits: f.commits.count,
      prs: f.prs.count,
      commitItems: f.commits.items,
      prItems: f.prs.items,
      points: shares.members[i].points,
      pct: shares.members[i].pct,
      amountBaseUnits: shares.members[i].amountBaseUnits.toString(),
      error: f.error,
    })),
  };
}
