/**
 * Stats band — a strip of mono stat tiles under the hero (design §2: numbers
 * as extrabold display, labels as tracked mono). Every figure is a true
 * product fact, not vanity metrics.
 */

const STATS = [
  { value: "2", label: "signal types — commits & merged PRs" },
  { value: "1", label: "formula, fixed at team creation" },
  { value: "1", label: "USDC transfer per member per cycle" },
  { value: "0", label: "LLM calls in the money path" },
];

export function StatsBand() {
  return (
    <section aria-label="Product facts" className="pb-[104px]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            style={{ animationDelay: `${i * 0.7}s` }}
            className="float-y rounded-(--radius-panel) border border-(--border-glass) bg-(--surface-2) px-5 py-4 shadow-card"
          >
            <p className="font-heading text-4xl font-extrabold tracking-tight tabular-nums text-(--fg-accent)">
              {s.value}
            </p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-(--fg-tertiary)">
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
