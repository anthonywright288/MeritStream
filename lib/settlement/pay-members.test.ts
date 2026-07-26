import { describe, expect, it } from "vitest";
import type { SettlementSnapshot } from "./freeze-snapshot";
import { payMembers, type PayoutRow, type PayoutStore } from "./pay-members";
import { computeFinalStatus } from "./finalize";
import type { HDAccount } from "viem/accounts";

const account = { address: "0xpool" } as unknown as HDAccount;
const W = {
  a: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  b: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  c: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
};

function snapshot(members: { id: string; amount: bigint }[]): SettlementSnapshot {
  return {
    window: { start: "2026-07-01T00:00:00Z", end: "2026-07-08T00:00:00Z" },
    weights: { commit: 1, pr: 3 },
    poolBalance: "0",
    distributable: "0",
    dustBaseUnits: "0",
    noActivity: false,
    members: members.map((m) => ({
      memberId: m.id,
      username: m.id,
      wallet: W.a,
      commits: 1,
      prs: 0,
      commitItems: [],
      prItems: [],
      points: 1,
      pct: 0,
      amountBaseUnits: m.amount.toString(),
    })),
  };
}

function memStore(
  initial: PayoutRow[],
  wallets: Record<string, string | null>,
): PayoutStore & { rows: Map<string, PayoutRow>; upserts: PayoutRow[] } {
  const rows = new Map(initial.map((r) => [r.memberId, { ...r }]));
  const upserts: PayoutRow[] = [];
  return {
    rows,
    upserts,
    async load() {
      return new Map([...rows].map(([k, v]) => [k, { ...v }]));
    },
    async upsert(row) {
      rows.set(row.memberId, { ...row });
      upserts.push({ ...row });
    },
    async currentWallet(id) {
      return wallets[id] ?? null;
    },
  };
}

const okChain = (calls: { broadcasts: string[] }) => ({
  async broadcast(_a: unknown, to: string) {
    calls.broadcasts.push(to);
    return `0xtx${calls.broadcasts.length}` as `0x${string}`;
  },
  async awaitReceipt() {
    return {};
  },
  async getReceipt() {
    return { status: "success" };
  },
});

describe("payMembers resume safety (user constraint #5 / RT-C2)", () => {
  // (a) THE money regression: crash after broadcast, before paid-upsert.
  it("kill-between-broadcast-and-upsert: resume verifies on-chain, NEVER re-broadcasts", async () => {
    const snap = snapshot([{ id: "m1", amount: 100n }]);
    // run 2 state: row left 'sending' WITH a hash from the crashed run 1
    const store = memStore(
      [{ memberId: "m1", status: "sending", txHash: "0xdead", destAddress: W.a, amountBaseUnits: "100" }],
      { m1: W.a },
    );
    const calls = { broadcasts: [] as string[] };
    const chain = okChain(calls);
    const result = await payMembers(snap, account, store, chain);
    expect(calls.broadcasts).toHaveLength(0); // no second transfer, money safe
    expect(store.rows.get("m1")?.status).toBe("paid"); // confirmed from chain
    expect(result.paid).toBe(1);
  });

  // (b) RT-C4: resume pays the remaining member the ORIGINAL snapshot amount
  it("resume after partial pays member 3+ from stored snapshot amounts; paid members untouched", async () => {
    const snap = snapshot([
      { id: "m1", amount: 100n },
      { id: "m2", amount: 200n },
      { id: "m3", amount: 300n },
    ]);
    const store = memStore(
      [
        { memberId: "m1", status: "paid", txHash: "0x1", destAddress: W.a, amountBaseUnits: "100" },
        { memberId: "m2", status: "paid", txHash: "0x2", destAddress: W.b, amountBaseUnits: "200" },
      ],
      { m1: W.a, m2: W.b, m3: W.c },
    );
    const calls = { broadcasts: [] as string[] };
    const chain = okChain(calls);
    const amounts: bigint[] = [];
    const spyChain = {
      ...chain,
      async broadcast(a: unknown, to: string, amount: bigint) {
        amounts.push(amount);
        return chain.broadcast(a, to);
      },
    };
    const result = await payMembers(snap, account, store, spyChain);
    expect(result.skippedAlreadyPaid).toBe(2); // members 1-2 NOT re-paid
    expect(result.paid).toBe(1);
    expect(amounts).toEqual([300n]); // original snapshot amount, no drift
    expect(calls.broadcasts).toEqual([W.c]);
  });

  it("receipt timeout stays 'sending' (unknown), NOT 'failed' — never blind-retried", async () => {
    const snap = snapshot([{ id: "m1", amount: 100n }]);
    const store = memStore([], { m1: W.a });
    const chain = {
      async broadcast() {
        return "0xabc" as `0x${string}`;
      },
      async awaitReceipt() {
        throw new Error("timed out waiting for receipt"); // NOT a revert
      },
      async getReceipt() {
        return null;
      },
    };
    const result = await payMembers(snap, account, store, chain);
    expect(store.rows.get("m1")?.status).toBe("sending");
    expect(store.rows.get("m1")?.txHash).toBe("0xabc"); // hash persisted pre-receipt
    expect(result.unknown).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("'sending' with NO hash (crash inside the intent window) is left for manual review", async () => {
    const snap = snapshot([{ id: "m1", amount: 100n }]);
    const store = memStore(
      [{ memberId: "m1", status: "sending", txHash: null, destAddress: W.a, amountBaseUnits: "100" }],
      { m1: W.a },
    );
    const calls = { broadcasts: [] as string[] };
    const result = await payMembers(snap, account, store, okChain(calls));
    expect(calls.broadcasts).toHaveLength(0); // no re-send into the unknown
    expect(result.unknown).toBe(1);
  });

  it("confirmed revert on resume -> failed (retryable), then a clean retry pays", async () => {
    const snap = snapshot([{ id: "m1", amount: 100n }]);
    const store = memStore(
      [{ memberId: "m1", status: "sending", txHash: "0xdead", destAddress: W.a, amountBaseUnits: "100" }],
      { m1: W.a },
    );
    const revertedChain = {
      async broadcast() {
        return "0xnew" as `0x${string}`;
      },
      async awaitReceipt() {},
      async getReceipt() {
        return { status: "reverted" };
      },
    };
    const r1 = await payMembers(snap, account, store, revertedChain);
    expect(r1.failed).toBe(1);
    expect(store.rows.get("m1")?.status).toBe("failed");
    const calls = { broadcasts: [] as string[] };
    const r2 = await payMembers(snap, account, store, okChain(calls));
    expect(calls.broadcasts).toHaveLength(1); // reverted = money never moved -> safe retry
    expect(r2.paid).toBe(1);
  });

  it("invalid current wallet -> failed for that member, loop continues, intent written before broadcast", async () => {
    const snap = snapshot([
      { id: "bad", amount: 100n },
      { id: "good", amount: 200n },
    ]);
    const store = memStore([], { bad: "not-an-address", good: W.b });
    const calls = { broadcasts: [] as string[] };
    const result = await payMembers(snap, account, store, okChain(calls));
    expect(result.failed).toBe(1);
    expect(result.paid).toBe(1);
    expect(calls.broadcasts).toEqual([W.b]);
    // [RT-C2] intent row precedes hash write precedes paid
    const goodUpserts = store.upserts.filter((u) => u.memberId === "good");
    expect(goodUpserts.map((u) => `${u.status}:${u.txHash ?? "-"}`)).toEqual([
      "sending:-",
      "sending:0xtx1",
      "paid:0xtx1",
    ]);
  });

  it("zero-amount member is skipped entirely (no payout row)", async () => {
    const snap = snapshot([{ id: "zero", amount: 0n }]);
    const store = memStore([], { zero: W.a });
    const calls = { broadcasts: [] as string[] };
    const result = await payMembers(snap, account, store, okChain(calls));
    expect(calls.broadcasts).toHaveLength(0);
    expect(result.paid + result.failed + result.unknown).toBe(0);
  });
});

describe("computeFinalStatus", () => {
  it("unknown in flight -> running; all paid -> paid; any failed -> partial", () => {
    expect(computeFinalStatus({ paid: 1, failed: 0, unknown: 1, skippedAlreadyPaid: 0 }, 2)).toBe("running");
    expect(computeFinalStatus({ paid: 2, failed: 0, unknown: 0, skippedAlreadyPaid: 1 }, 3)).toBe("paid");
    expect(computeFinalStatus({ paid: 1, failed: 1, unknown: 0, skippedAlreadyPaid: 0 }, 2)).toBe("partial");
  });
});
