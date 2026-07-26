"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MemberCard } from "@/components/dashboard/member-card";
import { SettleNowButton } from "@/components/dashboard/settle-now-button";
import { formatUsdcDisplay, timeAgo } from "@/lib/format/format-usdc-display";
import type { SignalsDto } from "@/lib/teams/load-signals";

type SignalsResponse = SignalsDto & { syncedAt: string };

const POLL_MS = 60_000;

export function DashboardView({ teamId }: { teamId: string }) {
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // re-render every 10s so "last synced X ago" ticks without refetching
  const [, setTick] = useState(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`/api/teams/${teamId}/signals`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
      setError(null);
    } catch (e) {
      // keep last good data on transient failure — never blank the page
      setError(e instanceof Error ? e.message : "failed to load signals");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, POLL_MS);
    const tick = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refresh]);

  if (loading) return <p className="text-muted-foreground">Loading signals…</p>;
  if (!data) return <p className="text-red-500">Couldn’t load team: {error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{data.teamName}</h1>
          <p className="text-muted-foreground text-sm">
            {data.repo} · {data.cycle} cycle · settles in {data.daysUntilSettlement}d
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            last synced {timeAgo(data.syncedAt)}
          </span>
          <Button size="sm" variant="outline" onClick={refresh}>
            Refresh
          </Button>
          <a href={`/team/${teamId}/history`} className="text-xs text-blue-500 hover:underline">
            History
          </a>
        </div>
      </div>

      <SettleNowButton teamId={teamId} onSettled={refresh} />

      <Card>
        <CardContent className="flex flex-wrap gap-6 py-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Pool balance</p>
            <p className="font-semibold">{formatUsdcDisplay(data.poolBalance)} USDC</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Distributable (after 1 USDC gas buffer)</p>
            <p className="font-semibold">{formatUsdcDisplay(data.distributable)} USDC</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Pool address</p>
            <p className="font-mono text-xs">{data.poolAddress}</p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-xs text-amber-500">
          refresh failed ({error}) — showing data from {timeAgo(data.syncedAt)}
        </p>
      )}
      {data.noActivity && (
        <p className="text-muted-foreground text-sm">
          No activity yet this cycle — pool rolls over if it stays that way.
        </p>
      )}

      <div className="space-y-2">
        {data.members.map((m) => (
          <MemberCard key={m.memberId} member={m} />
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        Projected shares update every 60s from public GitHub data. Dust{" "}
        {formatUsdcDisplay(data.dustBaseUnits)} USDC stays in the pool.
      </p>
    </div>
  );
}
