import { loadSignals, type SignalsDto } from "@/lib/teams/load-signals";

/**
 * The frozen, immutable audit record of one settlement. Written ONCE at
 * freeze time [RT-C4]; resume loads it, never recomputes.
 */
export interface SettlementSnapshot {
  window: { start: string; end: string };
  weights: { commit: number; pr: number };
  poolBalance: string;
  /** [RT-C1] balance - gas buffer: the basis every amount was computed on. */
  distributable: string;
  dustBaseUnits: string;
  noActivity: boolean;
  members: {
    memberId: string;
    username: string;
    /** Wallet at freeze time — display only; payment uses the CURRENT wallet
     *  and records the actual destination on the payout row [RT-H4]. */
    wallet: string;
    commits: number;
    prs: number;
    commitItems: { sha: string; html_url: string }[];
    prItems: { number: number; html_url: string }[];
    points: number;
    pct: number;
    amountBaseUnits: string;
  }[];
}

/**
 * [RT-C5] STRICT freeze: any member's GitHub fetch failure THROWS here and
 * the settlement aborts un-frozen (retryable). A tolerant snapshot would
 * silently zero a member and misdirect their money — never acceptable.
 * `cycleEndOverride` [RT-H2]: forced settles freeze the truncated window
 * [start, now] — loadSignals computes the open window; amounts are computed
 * on signals inside it, so the override only stamps the recorded end.
 */
export async function freezeSnapshot(
  teamId: string,
  cycleEndOverride?: string,
): Promise<SettlementSnapshot | null> {
  const dto: SignalsDto | null = await loadSignals(teamId, { strict: true });
  if (!dto) return null;
  return {
    window: {
      start: dto.window.start,
      end: cycleEndOverride ?? dto.window.end,
    },
    weights: { commit: dto.commitWeight, pr: dto.prWeight },
    poolBalance: dto.poolBalance,
    distributable: dto.distributable,
    dustBaseUnits: dto.dustBaseUnits,
    noActivity: dto.noActivity,
    members: dto.members.map((m) => ({
      memberId: m.memberId,
      username: m.username,
      wallet: m.wallet,
      commits: m.commits,
      prs: m.prs,
      commitItems: m.commitItems.map((c) => ({ sha: c.sha, html_url: c.html_url })),
      prItems: m.prItems.map((p) => ({ number: p.number, html_url: p.html_url })),
      points: m.points,
      pct: m.pct,
      amountBaseUnits: m.amountBaseUnits,
    })),
  };
}
