/**
 * Feature grid — six true product facts as frost cards (design §5
 * workflow-card hover). Icons are inline SVG dots/glyph-free to avoid icon
 * dependency drift; each card leads with a mono tag.
 */

const FEATURES = [
  {
    tag: "engine",
    title: "Deterministic engine",
    body: "Signals → points → shares → transfers. Same inputs, same payouts, every time. No model, no randomness, no discretion.",
  },
  {
    tag: "snapshot",
    title: "Frozen snapshots",
    body: "Before paying, each run freezes the window, weights, member list and every counted signal. The record can't drift after the fact.",
  },
  {
    tag: "receipts",
    title: "Receipts down to the commit",
    body: "Every payout links to the exact commits and merged PRs that earned it — and to the USDC transfer hash on Arc.",
  },
  {
    tag: "custody",
    title: "One pool per team",
    body: "Each team gets its own pool address. Fund it with USDC; settlement pays members directly from it, one transfer each.",
  },
  {
    tag: "safety",
    title: "Fails safe on shortfall",
    body: "If the pool can't cover the split, the run stops before any transfer. A 1 USDC buffer is always reserved for gas.",
  },
  {
    tag: "autopilot",
    title: "Settles on schedule",
    body: "A daily cron closes finished cycles automatically. Admins can also settle on demand with a one-time token — no login system to breach.",
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="scroll-mt-28 pb-[104px]">
      <span className="inline-flex items-center rounded-(--radius-control) border border-(--pill-border) bg-(--pill-bg) px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-(--pill-fg) uppercase">
        Built in
      </span>
      <h2 className="font-heading mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance">
        Everything a payout needs. Nothing it doesn&apos;t.
      </h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.tag}
            className="rounded-(--radius-panel) border border-(--border-glass) bg-card p-5 shadow-card backdrop-blur-xl transition-[translate,background-color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-(--surface-hover)"
          >
            <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-(--fg-accent) uppercase">
              {f.tag}
            </span>
            <h3 className="font-heading mt-2 text-lg font-bold">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-(--fg-secondary)">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
