/**
 * Static hero visual for the landing page: a frosted "settlement console"
 * showing the product story in one glance — signals in, weighted split,
 * one settlement run. Pure presentation, numbers are illustrative.
 * Styling mirrors the design system's magnetic-panel / summon-row language.
 */

const ROWS = [
  { user: "alice", signals: "14 commits · 3 PRs", pts: 23, pct: "51.1", usdc: "122.64", active: true },
  { user: "bob", signals: "9 commits · 2 PRs", pts: 15, pct: "33.3", usdc: "79.92", active: false },
  { user: "carol", signals: "4 commits · 1 PR", pts: 7, pct: "15.6", usdc: "37.44", active: false },
];

export function SettlementConsoleMock() {
  return (
    <div aria-hidden className="relative w-full max-w-[560px]">
      {/* Ghost panel peeking out behind — cheap depth, opposite tilt */}
      <div className="absolute inset-x-5 -top-4 bottom-12 rotate-2 rounded-(--radius-panel) border border-(--border-glass) bg-(--surface-3) shadow-card" />
      <div className="float-y relative -rotate-2 rounded-(--radius-panel) border border-(--border-magnetic) bg-[linear-gradient(180deg,#ffffffdb,transparent_38%),radial-gradient(520px_260px_at_82%_16%,#0f9f9a2e,transparent_62%),radial-gradient(440px_280px_at_30%_0%,#5157d81a,transparent_64%)] p-4 shadow-hud backdrop-saturate-150 transition-[rotate] duration-(--dur-soft) ease-(--ease-frost) hover:rotate-0">
      {/* Top bar: run status + cycle tag */}
      <div className="flex items-center justify-between gap-3 text-xs text-(--fg-tertiary)">
        <span className="inline-flex items-center gap-2 rounded-full border border-(--border-subtle) bg-(--surface-1) px-2.5 py-1.5 text-(--fg-secondary)">
          <span className="pulse-glow size-1.5 rounded-full bg-(--success) shadow-[0_0_10px_var(--success-glow)]" />
          settlement run · deterministic
        </span>
        <span className="font-mono tracking-[0.12em] uppercase">weekly · arc testnet</span>
      </div>

      {/* Member rows: the weighted split */}
      <div className="mt-3 grid gap-1.5">
        {ROWS.map((r) => (
          <div
            key={r.user}
            className={
              r.active
                ? "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[11px] border border-[#5157d85c] bg-[linear-gradient(90deg,#5b5ef7fa,#454bd8fa)] px-3.5 py-3 text-white shadow-[0_20px_48px_-28px_#5157d8eb,inset_0_1px_0_#ffffff38]"
                : "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[11px] border border-(--border-subtle) bg-(--surface-2) px-3.5 py-3 text-(--fg-primary)"
            }
          >
            <span className={r.active ? "size-2 rounded-full bg-white/90" : "size-2 rounded-full bg-current opacity-30"} />
            <span className="min-w-0">
              <strong className="block truncate text-sm">@{r.user}</strong>
              <em className={`block truncate font-mono text-[11px] not-italic tabular-nums ${r.active ? "text-white/75" : "text-(--fg-secondary)"}`}>
                {r.signals} → {r.pts} pts · {r.pct}%
              </em>
            </span>
            <span className="text-right font-mono text-sm font-semibold tabular-nums">
              {r.usdc}
              <span className={`ml-1 text-[10px] font-medium ${r.active ? "text-white/75" : "text-(--fg-tertiary)"}`}>USDC</span>
            </span>
          </div>
        ))}
      </div>

      {/* Footer: pool → payouts, every number mono */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-(--border-subtle) pt-3 font-mono text-[11px] text-(--fg-tertiary) tabular-nums">
        <span>pool 241.00 USDC − 1.00 gas buffer</span>
        <span className="text-(--fg-success)">3 payouts · tx confirmed ✓</span>
      </div>
      </div>
    </div>
  );
}
