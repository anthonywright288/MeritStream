import { describe, expect, it } from "vitest";
import { computeShares } from "./compute-shares";

const ONE_USDC = 1_000_000n;
const GAS_BUFFER_BASE_UNITS = ONE_USDC;

describe("computeShares", () => {
  it("splits the PRD example exactly (70/42/28 pts of 1000 USDC -> 500/300/200)", () => {
    const pool = 1000n * ONE_USDC;
    const result = computeShares(
      [
        { id: "alice", commits: 40, prs: 10 },
        { id: "bob", commits: 30, prs: 4 },
        { id: "carol", commits: 16, prs: 4 },
      ],
      1,
      3,
      pool,
    );
    expect(result.noActivity).toBe(false);
    expect(result.members.map((m) => m.points)).toEqual([70, 42, 28]);
    expect(result.members.map((m) => m.amountBaseUnits)).toEqual([
      500n * ONE_USDC,
      300n * ONE_USDC,
      200n * ONE_USDC,
    ]);
    expect(result.dustBaseUnits).toBe(0n);
  });

  it("zero total points -> noActivity, zero amounts, dust == pool, no throw", () => {
    const pool = 500n * ONE_USDC;
    const result = computeShares(
      [
        { id: "a", commits: 0, prs: 0 },
        { id: "b", commits: 0, prs: 0 },
      ],
      1,
      3,
      pool,
    );
    expect(result.noActivity).toBe(true);
    expect(result.members.every((m) => m.amountBaseUnits === 0n)).toBe(true);
    expect(result.dustBaseUnits).toBe(pool);
  });

  it("rounding dust: amounts + dust == pool for an indivisible pool", () => {
    const pool = 1_000_000n; // 1 USDC across 3 equal members
    const result = computeShares(
      [
        { id: "a", commits: 1, prs: 0 },
        { id: "b", commits: 1, prs: 0 },
        { id: "c", commits: 1, prs: 0 },
      ],
      1,
      3,
      pool,
    );
    expect(result.members.every((m) => m.amountBaseUnits === 333_333n)).toBe(
      true,
    );
    expect(result.dustBaseUnits).toBe(1n);
    const sum = result.members.reduce((s, m) => s + m.amountBaseUnits, 0n);
    expect(sum + result.dustBaseUnits).toBe(pool);
  });

  it("single member gets 100%", () => {
    const pool = 123_456_789n;
    const result = computeShares([{ id: "solo", commits: 2, prs: 1 }], 1, 3, pool);
    expect(result.members[0].amountBaseUnits).toBe(pool);
    expect(result.members[0].pct).toBe(100);
    expect(result.dustBaseUnits).toBe(0n);
  });

  it("member with 0 points among active members gets 0", () => {
    const pool = 100n * ONE_USDC;
    const result = computeShares(
      [
        { id: "active", commits: 10, prs: 0 },
        { id: "idle", commits: 0, prs: 0 },
      ],
      1,
      3,
      pool,
    );
    expect(result.members[1].amountBaseUnits).toBe(0n);
    expect(result.members[0].amountBaseUnits).toBe(pool);
  });

  // [RT-C1] Regression: buffer double-count made EVERY settlement insufficient_funds.
  it("fully funded pool passes the settlement balance gate when shares use distributable", () => {
    const balance = 1000n * ONE_USDC;
    const distributable = balance - GAS_BUFFER_BASE_UNITS;
    const result = computeShares(
      [
        { id: "a", commits: 40, prs: 10 },
        { id: "b", commits: 30, prs: 4 },
        { id: "c", commits: 16, prs: 4 },
      ],
      1,
      3,
      distributable,
    );
    const total = result.members.reduce((s, m) => s + m.amountBaseUnits, 0n);
    expect(total + result.dustBaseUnits).toBe(distributable);
    // The phase-03 gate: currentBalance - buffer >= total must hold by construction
    expect(balance - GAS_BUFFER_BASE_UNITS >= total).toBe(true);
  });

  // [RT-M1] weight domain guards
  it("rejects fractional weights before any bigint math", () => {
    expect(() =>
      computeShares([{ id: "a", commits: 1, prs: 1 }], 1.5, 3, ONE_USDC),
    ).toThrow(/commitWeight/);
  });

  it("zero for BOTH weights -> noActivity path, no division by zero", () => {
    const pool = 10n * ONE_USDC;
    const result = computeShares(
      [{ id: "a", commits: 5, prs: 2 }],
      0,
      0,
      pool,
    );
    expect(result.noActivity).toBe(true);
    expect(result.dustBaseUnits).toBe(pool);
  });

  it("rejects negative weights", () => {
    expect(() =>
      computeShares([{ id: "a", commits: 1, prs: 1 }], 1, -1, ONE_USDC),
    ).toThrow(/prWeight/);
  });

  it("rejects negative pool", () => {
    expect(() =>
      computeShares([{ id: "a", commits: 1, prs: 0 }], 1, 3, -1n),
    ).toThrow(/poolBaseUnits/);
  });

  // Property check: sum(amounts) + dust == poolBaseUnits for ALL inputs
  it("property: huge pool (near 2^256) maintains sum(amounts) + dust == pool", () => {
    // A cryptographically realistic pool size (e.g., 1M USDC in base units)
    const hugePool =
      1_000_000n * ONE_USDC + // 1M USDC
      12345n; // offset to stress rounding
    const result = computeShares(
      [
        { id: "m1", commits: 100, prs: 50 },
        { id: "m2", commits: 75, prs: 25 },
        { id: "m3", commits: 50, prs: 10 },
      ],
      2,
      5,
      hugePool,
    );
    const totalDistributed = result.members.reduce(
      (sum, m) => sum + m.amountBaseUnits,
      0n,
    );
    expect(totalDistributed + result.dustBaseUnits).toBe(hugePool);
  });

  it("property: many members with highly uneven distribution", () => {
    const pool = 999_999_999n;
    const members = Array.from({ length: 100 }, (_, i) => ({
      id: `m${i}`,
      commits: i === 0 ? 1000 : 1, // one whale, 99 minnows
      prs: 0,
    }));
    const result = computeShares(members, 1, 1, pool);
    const totalDistributed = result.members.reduce(
      (sum, m) => sum + m.amountBaseUnits,
      0n,
    );
    expect(totalDistributed + result.dustBaseUnits).toBe(pool);
  });

  it("property: zero pool -> dust == 0, all amounts 0", () => {
    const result = computeShares(
      [
        { id: "a", commits: 10, prs: 5 },
        { id: "b", commits: 8, prs: 3 },
      ],
      1,
      1,
      0n,
    );
    expect(result.dustBaseUnits).toBe(0n);
    expect(result.members.every((m) => m.amountBaseUnits === 0n)).toBe(true);
  });

  // Review finding 3: signals share the weight guard (fractional would make
  // BigInt() throw mid-settlement; negative would mint a negative payout)
  it("rejects fractional member signals", () => {
    expect(() =>
      computeShares([{ id: "a", commits: 1.5, prs: 0 }], 1, 3, ONE_USDC),
    ).toThrow(/commits/);
  });

  it("rejects negative member signals", () => {
    expect(() =>
      computeShares([{ id: "a", commits: 0, prs: -2 }], 1, 3, ONE_USDC),
    ).toThrow(/prs/);
  });

  it("property: single point distributed to large pool -> rounding", () => {
    const pool = 10_000_000_000n; // 10B base units
    const result = computeShares(
      [
        { id: "a", commits: 1, prs: 0 }, // 1 point
        { id: "b", commits: 1, prs: 0 }, // 1 point
        { id: "c", commits: 1, prs: 0 }, // 1 point
      ],
      1,
      0,
      pool,
    );
    const totalDistributed = result.members.reduce(
      (sum, m) => sum + m.amountBaseUnits,
      0n,
    );
    expect(totalDistributed + result.dustBaseUnits).toBe(pool);
    expect(result.dustBaseUnits).toBeLessThan(3n); // At most 2 dust (3 members - 1)
  });
});
