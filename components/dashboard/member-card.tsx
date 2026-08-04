"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SignalsDrawer } from "@/components/dashboard/signals-drawer";
import { formatUsdcDisplay } from "@/lib/format/format-usdc-display";
import type { MemberSignalsDto } from "@/lib/teams/load-signals";

export function MemberCard({ member }: { member: MemberSignalsDto }) {
  return (
    // workflow-card hover (design §5): lift 2px, surface brightens
    <Card className="transition-[translate,background-color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-(--surface-hover)">
      <CardContent className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4">
        <div className="min-w-0">
          <p className="font-semibold">@{member.username}</p>
          <p className="text-muted-foreground mt-0.5 truncate font-mono text-xs">{member.wallet}</p>
          {member.error && (
            <Badge variant="destructive" className="mt-1">
              signals for @{member.username} unavailable
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4 text-right">
          <div className="font-mono text-sm tabular-nums">
            <p>{member.commits} commits · {member.prs} PRs</p>
            <p className="text-muted-foreground text-xs">{member.points} pts · {member.pct.toFixed(1)}%</p>
          </div>
          <div className="w-28">
            <p className="font-mono text-lg font-semibold tabular-nums">{formatUsdcDisplay(member.amountBaseUnits)}</p>
            <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-(--fg-tertiary) uppercase">USDC projected</p>
          </div>
          <SignalsDrawer username={member.username} commits={member.commitItems} prs={member.prItems} />
        </div>
      </CardContent>
    </Card>
  );
}
