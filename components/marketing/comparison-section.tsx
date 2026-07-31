/**
 * Comparison section — "the spreadsheet way vs the MeritStream way". Two
 * frost columns; the MeritStream column gets the indigo-tinted border so the
 * eye lands on the product side. Rows mirror real shipped behavior only.
 */

const ROWS = [
  {
    dim: "Tracking effort",
    old: "Someone tallies contributions in a spreadsheet — when they remember.",
    stream: "Commits and merged PRs pulled straight from the public GitHub repo.",
  },
  {
    dim: "Deciding the split",
    old: "End-of-cycle negotiation. The loudest voice wins the biggest share.",
    stream: "One weighted formula the team agreed on before the first commit.",
  },
  {
    dim: "Paying out",
    old: "Manual transfers, one by one, “sometime next week”.",
    stream: "One settlement run pays every member their USDC share on Arc.",
  },
  {
    dim: "Settling disputes",
    old: "Rehash who did what from memory, weeks after the fact.",
    stream: "Re-derive the exact number from the frozen snapshot and public data.",
  },
  {
    dim: "Trusting the result",
    old: "Take the admin’s word for it.",
    stream: "Receipts down to the commit, the PR and the tx hash — auditable by anyone.",
  },
];

function Column({
  title,
  accent,
  items,
}: {
  title: string;
  accent?: boolean;
  items: { dim: string; text: string }[];
}) {
  return (
    <div
      className={`rounded-(--radius-panel) border bg-card p-6 shadow-card md:p-7 ${
        accent ? "border-(--focus-ring-soft)" : "border-(--border-glass)"
      }`}
    >
      <p
        className={`font-mono text-[11px] font-semibold tracking-[0.12em] uppercase ${
          accent ? "text-(--fg-accent)" : "text-(--fg-tertiary)"
        }`}
      >
        {title}
      </p>
      <ul className="mt-4 space-y-4">
        {items.map((i) => (
          <li key={i.dim} className="border-t border-(--border-subtle) pt-4 first:border-t-0 first:pt-0">
            <p className="font-mono text-[10px] font-bold tracking-[0.14em] text-(--fg-tertiary) uppercase">
              {i.dim}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-(--fg-secondary)">{i.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComparisonSection() {
  return (
    <section id="why" className="scroll-mt-28 pb-[104px]">
      <span className="inline-flex items-center rounded-(--radius-control) border border-(--pill-border) bg-(--pill-bg) px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-(--pill-fg) uppercase">
        Why switch
      </span>
      <h2 className="font-heading mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance">
        Splitting money by vibes is how teams break up.
      </h2>
      <p className="mt-4 max-w-2xl leading-relaxed text-(--fg-secondary)">
        Every side project dies the same way: the work was uneven, the split
        was even, and nobody wants to have the conversation. MeritStream
        replaces the conversation with a formula.
      </p>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Column
          title="The spreadsheet way"
          items={ROWS.map((r) => ({ dim: r.dim, text: r.old }))}
        />
        <Column
          title="The MeritStream way"
          accent
          items={ROWS.map((r) => ({ dim: r.dim, text: r.stream }))}
        />
      </div>
    </section>
  );
}
