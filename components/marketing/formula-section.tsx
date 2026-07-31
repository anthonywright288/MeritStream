/**
 * "The formula" section — the product's core promise rendered as a dark
 * command panel (design §1 magnetic-command: the one dark accent surface on
 * the landing page). Everything here mirrors the real settlement math.
 */
export function FormulaSection() {
  return (
    <section id="formula" className="scroll-mt-28 pb-[104px]">
      <span className="inline-flex items-center rounded-(--radius-control) border border-(--pill-border) bg-(--pill-bg) px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-(--pill-fg) uppercase">
        The formula
      </span>
      <h2 className="font-heading mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance">
        Small enough to memorize. Strict enough to trust.
      </h2>
      <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        {/* Dark command panel with the actual math */}
        <div className="reveal rounded-(--radius-panel) border border-white/15 bg-[#0f1622] bg-[image:linear-gradient(#ffffff1c,transparent_28%),radial-gradient(520px_280px_at_88%_20%,#1288802e,transparent_64%)] p-6 text-[#fafdff]/95 shadow-[0_34px_90px_-34px_#0c1420b8,inset_0_1px_0_#ffffff24] md:p-8">
          <p className="flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.12em] text-white/50 uppercase">
            <span className="pulse-glow inline-block size-1.5 rounded-full bg-[#81e7dd] shadow-[0_0_10px_#0f9f9a99]" />
            settlement.ts — deterministic core
          </p>
          <div className="mt-4 space-y-2 font-mono text-sm leading-7 tabular-nums md:text-base">
            <p>
              <span className="text-[#81e7dd]">points</span>
              <span className="text-white/60"> = </span>
              commits × w₁ <span className="text-white/60">+</span> merged_prs × w₂
            </p>
            <p>
              <span className="text-[#81e7dd]">share</span>
              <span className="text-white/60"> = </span>
              points / total_points
            </p>
            <p>
              <span className="text-[#81e7dd]">payout</span>
              <span className="text-white/60"> = </span>
              share × (pool <span className="text-white/60">−</span> 1 USDC gas buffer)
              <span className="caret-blink ml-1 inline-block h-[1.1em] w-[0.55ch] translate-y-[0.18em] bg-[#81e7dd]" />
            </p>
          </div>
          <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-relaxed text-white/60">
            Weights w₁ and w₂ are fixed at team creation. Rounding dust never
            disappears into anyone&apos;s pocket — it stays in the pool for the
            next cycle.
          </p>
        </div>
        {/* Why it matters */}
        <div className="flex flex-col justify-center gap-4">
          {[
            {
              t: "No judgment calls",
              b: "No manager mood, no end-of-month negotiation. The split is computed, not decided.",
            },
            {
              t: "No AI in the money path",
              b: "Zero LLM anywhere in settlement. The same inputs always produce the same payouts — reproducible by anyone with the repo.",
            },
            {
              t: "Agreed once, enforced every cycle",
              b: "The team signs off on the weights up front; after that the formula is the only authority.",
            },
          ].map((x) => (
            <div
              key={x.t}
              className="reveal rounded-(--radius-panel) border border-(--border-glass) bg-card p-5 shadow-card"
            >
              <h3 className="font-heading text-base font-bold">{x.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-(--fg-secondary)">{x.b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
