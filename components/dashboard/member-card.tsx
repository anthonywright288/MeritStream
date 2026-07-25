"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SignalsDrawer } from "@/components/dashboard/signals-drawer";
import { formatUsdcDisplay } from "@/lib/format/format-usdc-display";
import type { MemberSignalsDto } from "@/lib/teams/load-signals";

export function MemberCard({ member }: { member: MemberSignalsDto }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="min-w-0">
          <p className="font-medium">@{member.username}</p>
          <p className="text-muted-foreground truncate font-mono text-xs">{member.wallet}</p>
          {member.error && (
            <Badge variant="destructive" className="mt-1">
              signals for @{member.username} unavailable
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4 text-right">
          <div className="text-sm">
            <p>{member.commits} commits · {member.prs} PRs</p>
            <p className="text-muted-foreground text-xs">{member.points} pts · {member.pct.toFixed(1)}%</p>
          </div>
          <div className="w-28">
            <p className="font-semibold">{formatUsdcDisplay(member.amountBaseUnits)}</p>
            <p className="text-muted-foreground text-xs">USDC projected</p>
          </div>
          <SignalsDrawer username={member.username} commits={member.commitItems} prs={member.prItems} />
        </div>
      </CardContent>
    </Card>
  );
}
