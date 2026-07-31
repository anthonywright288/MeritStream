/**
 * FAQ — native <details> (no JS, no state) styled as frost rows with the
 * design system's focus treatment. Answers stick to shipped behavior only.
 */

const FAQS = [
  {
    q: "Do contributors need a wallet extension or an account?",
    a: "No. There is no login and no wallet popup anywhere. Members are listed by GitHub username + payout address at team creation, and anyone can verify their share on the public read-only page.",
  },
  {
    q: "What exactly counts as a signal?",
    a: "Commits and merged pull requests in the team's public GitHub repo, inside the current cycle window. Nothing self-reported, nothing private. If it isn't visible on GitHub, it doesn't count.",
  },
  {
    q: "What happens if the pool can't cover a cycle?",
    a: "The run reports insufficient funds and stops before any transfer, so nobody gets a partial surprise. Fund the pool and settle again; a 1 USDC buffer is always kept back for gas.",
  },
  {
    q: "Can the split be gamed or quietly edited?",
    a: "The weights are fixed when the team is created, and every settlement freezes a snapshot of the window, weights and counted signals before paying. Each payout links to its commits, PRs and tx hash, so anyone can re-derive the math.",
  },
  {
    q: "Where does the money actually live?",
    a: "Each team has its own USDC pool address on Arc. You fund it like any address (QR shown at creation); settlement sends one direct transfer per member, and rounding dust stays in the pool for next cycle.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-28 pb-[104px]">
      <span className="reveal inline-flex items-center rounded-(--radius-control) border border-(--pill-border) bg-(--pill-bg) px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-(--pill-fg) uppercase">
        FAQ
      </span>
      <h2 className="reveal font-heading mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance">
        The questions every team asks first.
      </h2>
      <div className="mt-10 grid gap-3">
        {FAQS.map((f) => (
          <details
            key={f.q}
            className="group reveal rounded-(--radius-panel) border border-(--border-subtle) bg-(--surface-2) transition-[border-color,background-color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) open:border-(--focus-ring-soft) open:bg-card open:shadow-card"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold select-none [&::-webkit-details-marker]:hidden">
              {f.q}
              <span
                aria-hidden
                className="font-mono text-(--fg-tertiary) transition-transform duration-(--dur-fast) group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-(--fg-secondary)">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
