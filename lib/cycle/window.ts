/** Cycle window math — all UTC ISO strings in, Date out. */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export interface CycleWindow {
  start: Date;
  end: Date;
}

/**
 * Current open window: starts at the team's creation (or, from Phase 3 on,
 * at the last settlement's cycle_end — pass it as `lastSettlementEnd`), runs
 * one cycle length. Force-settle (Phase 3, [RT-H2]) truncates via its own
 * cycle_end = now; this function only derives the OPEN window.
 */
export function cycleWindow(
  teamCreatedAt: string,
  cycle: string,
  lastSettlementEnd: string | null,
  now: Date = new Date(),
): CycleWindow {
  const length = cycle === "weekly" ? WEEK_MS : MONTH_MS;
  let start = new Date(lastSettlementEnd ?? teamCreatedAt);
  // Roll forward past fully-elapsed unsettled windows so the "open" window
  // always contains `now` (cron may lag; dashboard must show the live one).
  while (start.getTime() + length <= now.getTime()) {
    start = new Date(start.getTime() + length);
  }
  return { start, end: new Date(start.getTime() + length) };
}

/**
 * [RT-H3] Mid-cycle join: a member accrues from the moment they were added,
 * never retroactively. Effective fetch-start = max(joined, window start).
 */
export function memberSince(memberCreatedAt: string, windowStart: Date): Date {
  const joined = new Date(memberCreatedAt);
  return joined > windowStart ? joined : windowStart;
}

export function daysUntil(end: Date, now: Date = new Date()): number {
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}
