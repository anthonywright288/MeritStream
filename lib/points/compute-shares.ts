/**
 * Pure share computation — the money heart of MeritStream. No I/O, no LLM,
 * bigint end-to-end. Same inputs, same split, every time.
 *
 * [RT-C1] `poolBaseUnits` is the DISTRIBUTABLE amount: callers must pass
 * `max(0n, balance - GAS_BUFFER_BASE_UNITS)`, never the raw pool balance,
 * so dashboard projection and settlement agree and the settlement balance
 * gate cannot double-count the buffer.
 */
export interface MemberSignals {
  id: string;
  commits: number;
  prs: number;
}

export interface MemberShare {
  id: string;
  points: number;
  /** Display-only percentage (float). Money math never uses it. */
  pct: number;
  amountBaseUnits: bigint;
}

export interface SharesResult {
  members: MemberShare[];
  dustBaseUnits: bigint;
  noActivity: boolean;
}

/**
 * [RT-M1] Weights must be non-negative integers. Fractional weights would
 * poison the bigint math (BigInt * float throws); negatives would produce
 * negative shares. Server-side API validation is the first line; this guard
 * ensures bad values can never silently corrupt a settlement.
 */
export function assertValidWeights(commitWeight: number, prWeight: number) {
  for (const [name, w] of [
    ["commitWeight", commitWeight],
    ["prWeight", prWeight],
  ] as const) {
    if (!Number.isInteger(w) || w < 0) {
      throw new Error(`${name} must be a non-negative integer, got ${w}`);
    }
  }
}

export function computeShares(
  members: MemberSignals[],
  commitWeight: number,
  prWeight: number,
  poolBaseUnits: bigint,
): SharesResult {
  assertValidWeights(commitWeight, prWeight);
  if (poolBaseUnits < 0n) {
    throw new Error(`poolBaseUnits must be >= 0, got ${poolBaseUnits}`);
  }
  // Signals share the weight guard's rationale: a fractional count would make
  // BigInt() throw mid-settlement; a negative one would mint a negative payout.
  for (const m of members) {
    for (const [name, v] of [
      ["commits", m.commits],
      ["prs", m.prs],
    ] as const) {
      if (!Number.isInteger(v) || v < 0) {
        throw new Error(
          `member ${m.id}: ${name} must be a non-negative integer, got ${v}`,
        );
      }
    }
  }

  const points = members.map(
    (m) => m.commits * commitWeight + m.prs * prWeight,
  );
  const totalPoints = points.reduce((a, b) => a + b, 0);

  // Zero-activity cycle: no division by zero, whole pool stays as dust.
  if (totalPoints === 0) {
    return {
      members: members.map((m) => ({
        id: m.id,
        points: 0,
        pct: 0,
        amountBaseUnits: 0n,
      })),
      dustBaseUnits: poolBaseUnits,
      noActivity: true,
    };
  }

  const totalPointsBig = BigInt(totalPoints);
  let distributed = 0n;
  const shares = members.map((m, i) => {
    // bigint division floors toward zero — per-member floor per PRD rule
    const amount = (poolBaseUnits * BigInt(points[i])) / totalPointsBig;
    distributed += amount;
    return {
      id: m.id,
      points: points[i],
      pct: (points[i] / totalPoints) * 100,
      amountBaseUnits: amount,
    };
  });

  return {
    members: shares,
    dustBaseUnits: poolBaseUnits - distributed,
    noActivity: false,
  };
}
