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

/**
 * readOnly = the public /t/[teamId] transparency view: same live data, ZERO
 * mutation controls (no Settle button, no token prompt) and nothing
 * admin-only in the payload — the signals endpoint is already public data.
 */
export function DashboardView({
  teamId,
  readOnly = false,
}: {
  teamId: string;
  readOnly?: boolean;
}) {
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
  if (!data) return <p className="text-(--fg-danger)">Couldn’t load team: {error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {/* Eyebrow + display title + mono meta chips (design §2) */}
          <p className="font-mono text-[11px] font-semibold tracking-[0.12em] text-(--fg-accent) uppercase">
            {readOnly ? "Public transparency view" : "Team dashboard"}
          </p>
          <h1 className="font-heading mt-1 text-3xl font-bold tracking-tight text-balance">
            {data.teamName}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-(--radius-control) border border-(--border-subtle) bg-(--surface-2) px-2 py-0.5 font-mono text-xs text-(--fg-secondary)">
              {data.repo}
            </span>
            <span className="text-(--fg-tertiary)">
              {data.cycle} cycle · settles in{" "}
              <span className="font-mono tabular-nums">{data.daysUntilSettlement}d</span>
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-xs">
            last synced {timeAgo(data.syncedAt)}
          </span>
          <Button size="sm" variant="outline" onClick={refresh}>
            Refresh
          </Button>
          <a href={`/team/${teamId}/history`} className="text-xs text-(--fg-accent) hover:underline">
            History
          </a>
        </div>
      </div>

      {readOnly ? (
        <p className="text-muted-foreground text-xs">
          Public transparency view — read-only. Every number below is derived
          from public GitHub data and the on-chain pool balance.
        </p>
      ) : (
        <SettleNowButton teamId={teamId} onSettled={refresh} />
      )}

      {/* Stat strip: eyebrow labels + large mono figures, straight columns */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-x-10 gap-y-4 py-4">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-(--fg-tertiary) uppercase">
              Pool balance
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
              {formatUsdcDisplay(data.poolBalance)}
              <span className="ml-1.5 text-sm font-medium text-(--fg-tertiary)">USDC</span>
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-(--fg-tertiary) uppercase">
              Distributable · after 1 USDC gas buffer
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-(--fg-accent)">
              {formatUsdcDisplay(data.distributable)}
              <span className="ml-1.5 text-sm font-medium text-(--fg-tertiary)">USDC</span>
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold tracking-[0.12em] text-(--fg-tertiary) uppercase">
              Pool address
            </p>
            <p className="mt-1.5 truncate rounded-(--radius-control) border border-(--border-subtle) bg-(--surface-2) px-2 py-1 font-mono text-xs text-(--fg-secondary)">
              {data.poolAddress}
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-(--radius-control) border border-(--border-warning) bg-(--surface-warning) px-3 py-2 text-xs text-(--fg-warning)">
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
        <span className="font-mono tabular-nums">{formatUsdcDisplay(data.dustBaseUnits)} USDC</span>{" "}
        stays in the pool.
      </p>
    </div>
  );
}
