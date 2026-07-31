import Link from "next/link";

/**
 * Final CTA — closing frost panel (design §1 shadow-hud) repeating the two
 * entry points: create a team, or inspect the live demo without an account.
 */
export function FinalCtaSection({ demoTeamId }: { demoTeamId: string }) {
  return (
    <section className="pb-[104px]">
      <div className="rounded-(--radius-panel) border border-(--border-glass) bg-card p-8 text-center shadow-hud backdrop-blur-xl md:p-14">
        <span className="inline-flex items-center rounded-(--radius-control) border border-(--pill-border) bg-(--pill-bg) px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-(--pill-fg) uppercase">
          Two minutes to first cycle
        </span>
        <h2 className="font-heading mx-auto mt-5 max-w-2xl text-4xl font-bold tracking-tight text-balance">
          Agree on the formula once. Never argue about the split again.
        </h2>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-(--fg-secondary)">
          Create a team, fund the pool, and let the cycle run. No login, no
          wallet popup — just a repo and a list of who gets paid.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/create"
            className="inline-flex h-13 items-center gap-2 rounded-(--radius-control) border border-black/10 bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_18px_34px_-24px_rgba(50,56,159,.9),inset_0_1px_0_rgba(255,255,255,.2)] transition-[translate,background-color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-indigo-500 active:translate-y-0"
          >
            Create your team →
          </Link>
          <Link
            href={`/t/${demoTeamId}`}
            className="inline-flex h-13 items-center rounded-(--radius-control) border border-(--border-subtle) bg-(--surface-strong) px-6 text-sm font-semibold text-(--fg-primary) shadow-card transition-[translate,background-color] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-(--surface-hover) active:translate-y-0"
          >
            Audit the demo team
          </Link>
        </div>
        <p className="mt-5 font-mono text-xs text-(--fg-tertiary)">
          zero LLM · deterministic · auditable by anyone
        </p>
      </div>
    </section>
  );
}
