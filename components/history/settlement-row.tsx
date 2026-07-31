"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsdcDisplay } from "@/lib/format/format-usdc-display";
import { SnapshotDetail, type PayoutView } from "@/components/history/snapshot-detail";
import type { SettlementSnapshot } from "@/lib/settlement/freeze-snapshot";

export interface SettlementView {
  id: string;
  cycleStart: string;
  cycleEnd: string;
  poolAmount: string;
  status: string;
  snapshot: SettlementSnapshot | null;
  payouts: PayoutView[];
}

// Status → design-system triad (success/danger/warning surfaces, §1)
const STATUS_VARIANT: Record<
  string,
  "success" | "secondary" | "destructive" | "warning" | "outline"
> = {
  paid: "success",
  no_activity: "secondary",
  partial: "destructive",
  insufficient_funds: "destructive",
  running: "warning",
};

export function SettlementRow({ settlement }: { settlement: SettlementView }) {
  const [open, setOpen] = useState(false);
  const payoutMap = new Map(settlement.payouts.map((p) => [p.memberId, p]));
  return (
    <Card className="transition-[translate,background-color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-px hover:bg-(--surface-hover)">
      <CardContent className="py-3">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setOpen(!open)}
        >
          <span className="font-mono text-sm tabular-nums">
            {new Date(settlement.cycleEnd).toLocaleDateString()} · pool{" "}
            {formatUsdcDisplay(settlement.poolAmount)} USDC
          </span>
          <span className="flex items-center gap-2">
            <Badge variant={STATUS_VARIANT[settlement.status] ?? "outline"}>
              {settlement.status.replace("_", " ")}
            </Badge>
            <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
          </span>
        </button>
        {open && settlement.snapshot && (
          <SnapshotDetail snapshot={settlement.snapshot} payouts={payoutMap} />
        )}
        {open && !settlement.snapshot && (
          <p className="text-muted-foreground pt-2 text-xs">No snapshot (aborted before freeze).</p>
        )}
      </CardContent>
    </Card>
  );
}
