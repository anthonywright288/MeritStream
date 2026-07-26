import { isAddress, type Address } from "viem";
import type { HDAccount } from "viem/accounts";
import type { SettlementSnapshot } from "@/lib/settlement/freeze-snapshot";

/**
 * [RT-C2][RT-C4][RT-H4] The money loop. Sequential, resume-safe:
 *  - per-payout row written 'sending' BEFORE broadcast (crash after broadcast
 *    leaves a hash to verify, never a blind re-send);
 *  - 'failed' means pre-broadcast failure or confirmed revert ONLY — a
 *    receipt timeout stays 'sending' (outcome unknown, re-check next run);
 *  - amounts come from the stored snapshot (never recomputed on resume);
 *  - destination = CURRENT member wallet, recorded on the payout row.
 * Dependencies are injected so regression tests can simulate crashes between
 * any two steps without touching a chain.
 */
export interface PayoutRow {
  memberId: string;
  status: "pending" | "sending" | "paid" | "failed";
  txHash: string | null;
  destAddress: string | null;
  amountBaseUnits: string;
}

export interface PayoutStore {
  /** All payout rows for this settlement, keyed by member id. */
  load(): Promise<Map<string, PayoutRow>>;
  /** Upsert one member's payout state (UNIQUE(settlement_id, member_id)). */
  upsert(row: PayoutRow): Promise<void>;
  /** CURRENT wallet address for a member (may differ from snapshot). */
  currentWallet(memberId: string): Promise<string | null>;
}

export interface ChainDeps {
  broadcast(account: HDAccount, to: Address, amount: bigint): Promise<`0x${string}`>;
  /** Throws with message containing "reverted" on revert; other throws = unknown. */
  awaitReceipt(txHash: `0x${string}`): Promise<unknown>;
  /** null = not found/not mined; {status} = mined. */
  getReceipt(txHash: `0x${string}`): Promise<{ status: string } | null>;
}

export interface PayResult {
  paid: number;
  failed: number;
  unknown: number; // still 'sending' — receipt not yet observable
  skippedAlreadyPaid: number;
}

export async function payMembers(
  snapshot: SettlementSnapshot,
  account: HDAccount,
  store: PayoutStore,
  chain: ChainDeps,
): Promise<PayResult> {
  const existing = await store.load();
  const result: PayResult = { paid: 0, failed: 0, unknown: 0, skippedAlreadyPaid: 0 };

  for (const member of snapshot.members) {
    const amount = BigInt(member.amountBaseUnits);
    if (amount === 0n) continue; // zero-point member: nothing to pay
    const row = existing.get(member.memberId);

    if (row?.status === "paid") {
      result.skippedAlreadyPaid++;
      continue;
    }

    // [RT-C2] 'sending' with NO hash = crash in the tiny window between the
    // intent-write and the hash-write: a tx MAY be in the mempool with a hash
    // we never learned. Re-sending risks double-pay; leave for manual review.
    if (row?.status === "sending" && !row.txHash) {
      result.unknown++;
      continue;
    }

    // [RT-C2] resume path: broadcast happened, outcome unknown — verify, never re-send
    if (row?.status === "sending" && row.txHash) {
      const receipt = await chain.getReceipt(row.txHash as `0x${string}`);
      if (receipt?.status === "success") {
        await store.upsert({ ...row, status: "paid" });
        result.paid++;
      } else if (receipt) {
        // mined AND reverted -> money did not move -> safe to retry next run
        await store.upsert({ ...row, status: "failed" });
        result.failed++;
      } else {
        result.unknown++; // not mined yet: leave 'sending', do NOT re-send
      }
      continue;
    }

    // clean attempt (pending / failed / no row)
    const dest = await store.currentWallet(member.memberId);
    if (!dest || !isAddress(dest)) {
      await store.upsert({
        memberId: member.memberId,
        status: "failed",
        txHash: null,
        destAddress: dest,
        amountBaseUnits: member.amountBaseUnits,
      });
      result.failed++;
      continue;
    }

    // [RT-C2] intent row BEFORE the irreversible action
    await store.upsert({
      memberId: member.memberId,
      status: "sending",
      txHash: null,
      destAddress: dest,
      amountBaseUnits: member.amountBaseUnits,
    });

    let txHash: `0x${string}`;
    try {
      txHash = await chain.broadcast(account, dest as Address, amount);
    } catch {
      // nothing reached the mempool -> genuinely failed, retryable
      await store.upsert({
        memberId: member.memberId,
        status: "failed",
        txHash: null,
        destAddress: dest,
        amountBaseUnits: member.amountBaseUnits,
      });
      result.failed++;
      continue;
    }

    // [RT-C2] persist the hash IMMEDIATELY, before awaiting the receipt
    await store.upsert({
      memberId: member.memberId,
      status: "sending",
      txHash,
      destAddress: dest,
      amountBaseUnits: member.amountBaseUnits,
    });

    try {
      await chain.awaitReceipt(txHash);
      await store.upsert({
        memberId: member.memberId,
        status: "paid",
        txHash,
        destAddress: dest,
        amountBaseUnits: member.amountBaseUnits,
      });
      result.paid++;
    } catch (error) {
      const reverted = error instanceof Error && /reverted/i.test(error.message);
      if (reverted) {
        await store.upsert({
          memberId: member.memberId,
          status: "failed",
          txHash,
          destAddress: dest,
          amountBaseUnits: member.amountBaseUnits,
        });
        result.failed++;
      } else {
        // receipt timeout — outcome UNKNOWN, stay 'sending' for next-run verify
        result.unknown++;
      }
    }
  }
  return result;
}
