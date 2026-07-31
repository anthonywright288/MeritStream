/**
 * Lifecycle section — one settlement cycle end to end as a vertical rail.
 * Each stop is a frost row with a mono phase tag; the rail line uses the
 * subtle border token. All five stops describe shipped behavior.
 */

const STOPS = [
  {
    phase: "day 0",
    title: "Create the team",
    body: "Name, public repo, members (GitHub username + payout address), and the two weights. The team gets its own USDC pool address on Arc — fund it by QR or plain transfer.",
  },
  {
    phase: "during the cycle",
    title: "Signals accrue in the open",
    body: "Commits and merged PRs are counted from the repo as they land. The dashboard and the public read-only page show live standings — no one is surprised at the end.",
  },
  {
    phase: "cycle closes",
    title: "The snapshot freezes",
    body: "A daily cron (or an admin with a one-time token) closes the cycle: window, weights, member list and every counted signal are frozen before a single cent moves.",
  },
  {
    phase: "settlement",
    title: "One transfer per member",
    body: "The pool, minus a 1 USDC gas buffer, is split by share and paid out — one direct USDC transfer per member on Arc. If the pool can’t cover it, the run stops instead.",
  },
  {
    phase: "forever after",
    title: "The receipts stay public",
    body: "Every settlement lives on the history page with its snapshot and tx hashes. Anyone can re-derive any payout from public data, years later, without an account.",
  },
];

export function LifecycleSection() {
  return (
    <section id="lifecycle" className="relative scroll-mt-28 pb-[104px]">
      {/* Ambient aurora behind the rail */}
      <div
        aria-hidden
        className="aurora-drift pointer-events-none absolute top-40 -left-44 -z-10 size-[480px] rounded-full bg-[radial-gradient(circle,#0f9f9a1c,transparent_70%)] [animation-delay:-5s]"
      />
      <span className="inline-flex items-center rounded-(--radius-control) border border-(--pill-border) bg-(--pill-bg) px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-(--pill-fg) uppercase">
        A cycle, end to end
      </span>
      <h2 className="font-heading mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance">
        From first commit to final receipt.
      </h2>
      <ol className="relative mt-10 space-y-4 border-l border-(--border-subtle) pl-6 md:pl-8">
        {STOPS.map((s, i) => (
          <li key={s.phase} className="relative">
            {/* Rail dot — indigo for active-feel on the money step. Staggered
                pulse delays make the signal appear to travel down the rail. */}
            <span
              aria-hidden
              style={{ animationDelay: `${i * 0.55}s` }}
              className={`pulse-glow absolute top-6 -left-6 grid size-3 -translate-x-1/2 place-items-center rounded-full border md:-left-8 ${
                i === 3
                  ? "border-indigo-500 bg-indigo-500 shadow-[0_0_14px_var(--accent-glow)]"
                  : "border-(--border-magnetic) bg-indigo-500/35"
              }`}
            />
            <div className="reveal rounded-(--radius-panel) border border-(--border-glass) bg-card p-5 shadow-card transition-[translate,background-color] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-(--surface-hover) md:p-6">
              <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-(--fg-accent) uppercase">
                {s.phase}
              </p>
              <h3 className="font-heading mt-1.5 text-lg font-bold">{s.title}</h3>
              <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-(--fg-secondary)">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
