import { formatUsdcDisplay } from "@/lib/format/format-usdc-display";
import type { SettlementSnapshot } from "@/lib/settlement/freeze-snapshot";

const EXPLORER_TX = "https://testnet.arcscan.app/tx/";

export interface PayoutView {
  memberId: string;
  status: string;
  txHash: string | null;
  destAddress: string | null;
}

/** The audit trail: every share links back to the exact commits/PRs. */
export function SnapshotDetail({
  snapshot,
  payouts,
}: {
  snapshot: SettlementSnapshot;
  payouts: Map<string, PayoutView>;
}) {
  return (
    <div className="space-y-3 border-t pt-3 text-sm">
      <p className="text-muted-foreground text-xs">
        Window {new Date(snapshot.window.start).toLocaleString()} →{" "}
        {new Date(snapshot.window.end).toLocaleString()} · weights {snapshot.weights.commit}
        /commit, {snapshot.weights.pr}/PR · distributable{" "}
        {formatUsdcDisplay(snapshot.distributable)} USDC · dust{" "}
        {formatUsdcDisplay(snapshot.dustBaseUnits)} USDC stays in pool
      </p>
      {snapshot.members.map((m) => {
        const payout = payouts.get(m.memberId);
        // [RT-H4] the payout's dest_address is the truth of where money went;
        // flag divergence from the frozen snapshot wallet
        const diverged =
          payout?.destAddress &&
          payout.destAddress.toLowerCase() !== m.wallet.toLowerCase();
        return (
          <div key={m.memberId} className="rounded border p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">@{m.username}</span>
              <span>
                {m.points} pts · {formatUsdcDisplay(m.amountBaseUnits)} USDC ·{" "}
                {payout?.status ?? "no payout"}
                {payout?.txHash && (
                  <>
                    {" · "}
                    <a
                      className="text-blue-500 hover:underline"
                      href={`${EXPLORER_TX}${payout.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      tx ↗
                    </a>
                  </>
                )}
              </span>
            </div>
            {diverged && (
              <p className="text-xs text-amber-500">
                paid to {payout?.destAddress} (wallet edited after freeze; snapshot had {m.wallet})
              </p>
            )}
            <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-xs">
              {m.commitItems.map((c) => (
                <a key={c.sha} href={c.html_url} target="_blank" rel="noreferrer" className="hover:underline">
                  <code>{c.sha.slice(0, 7)}</code>
                </a>
              ))}
              {m.prItems.map((p) => (
                <a key={p.number} href={p.html_url} target="_blank" rel="noreferrer" className="hover:underline">
                  #{p.number}
                </a>
              ))}
              {m.commitItems.length + m.prItems.length === 0 && <span>no signals</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
