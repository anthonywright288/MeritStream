import Link from "next/link";
import { SettlementConsoleMock } from "@/components/marketing/settlement-console-mock";

const DEMO_TEAM_ID = "75pw8g1f";

/** One step card in the "how it works" rail. */
function StepCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="rounded-(--radius-panel) border border-(--border-glass) bg-card p-5 shadow-card backdrop-blur-xl transition-[translate,background-color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-(--surface-hover)">
      <span className="inline-grid size-7 place-items-center rounded-full border border-(--pill-border) bg-(--pill-bg) font-mono text-[11px] font-bold text-(--fg-accent)">
        {n}
      </span>
      <h3 className="font-heading mt-3 text-lg font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-(--fg-secondary)">{body}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1180px] px-5">
      {/* ============================== Hero ============================== */}
      <section className="grid min-h-[92vh] items-center gap-12 pt-32 md:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] md:pt-24">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-[10px] border border-(--border-subtle) bg-(--surface-1) px-3 py-2 text-sm font-medium text-(--fg-secondary) shadow-card backdrop-blur-xl">
            <span className="size-2 rounded-full bg-(--success) shadow-[0_0_14px_var(--success-glow)]" />
            Zero LLM · deterministic · on Arc
          </div>
          <h1 className="font-heading mt-6 max-w-[12ch] text-5xl leading-[0.96] font-bold tracking-tight text-balance sm:text-6xl">
            Merit in. USDC out.
          </h1>
          <p className="mt-6 max-w-xl text-xl leading-8 text-pretty text-(--fg-secondary)">
            GitHub signals in, weighted USDC splits out, one automated
            settlement on Arc. Every payout links back to the exact commits
            that earned it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/create"
              className="inline-flex h-13 items-center gap-2 rounded-(--radius-control) border border-black/10 bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_18px_34px_-24px_rgba(50,56,159,.9),inset_0_1px_0_rgba(255,255,255,.2)] transition-[translate,background-color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-indigo-500 active:translate-y-0"
            >
              Launch app →
            </Link>
            <Link
              href={`/team/${DEMO_TEAM_ID}`}
              className="inline-flex h-13 items-center rounded-(--radius-control) border border-(--border-subtle) bg-card px-5 text-sm font-semibold text-(--fg-primary) shadow-card backdrop-blur-xl transition-[translate,background-color] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-(--surface-strong) active:translate-y-0"
            >
              Live demo team
            </Link>
          </div>
          <p className="mt-4 text-sm text-(--fg-tertiary)">
            No wallet popup. No login. Auditable by anyone —{" "}
            <Link href={`/t/${DEMO_TEAM_ID}`} className="text-(--fg-accent) hover:underline">
              public view ↗
            </Link>
          </p>
          {/* Spec chips (design §5: mono glass chips) */}
          <div className="mt-8 grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-3">
            {["Zero LLM", "Deterministic formula", "Auditable by anyone"].map((chip) => (
              <div
                key={chip}
                className="rounded-[9px] border border-(--border-subtle) bg-(--surface-3) px-3 py-2 text-center font-mono text-xs text-(--fg-secondary)"
              >
                {chip}
              </div>
            ))}
          </div>
        </div>
        <div className="hidden justify-center sm:flex">
          <SettlementConsoleMock />
        </div>
      </section>

      {/* ========================= How it works ========================= */}
      <section id="how" className="scroll-mt-28 py-[104px]">
        <span className="inline-flex items-center rounded-(--radius-control) border border-(--pill-border) bg-(--pill-bg) px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-(--pill-fg) uppercase">
          How it works
        </span>
        <h2 className="font-heading mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance">
          Three moves. No judgment calls.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <StepCard
            n="01"
            title="Signals in"
            body="Public GitHub activity only: commits and merged PRs in the cycle window. Pulled straight from the repo — nothing self-reported."
          />
          <StepCard
            n="02"
            title="Weighted split"
            body="points = commits × w₁ + merged PRs × w₂. A formula the whole team agreed on up front. Zero LLM, zero discretion."
          />
          <StepCard
            n="03"
            title="One settlement run"
            body="Cron freezes a snapshot, then pays every member their share in USDC on Arc — one transfer each, dust stays in the pool."
          />
        </div>
      </section>

      {/* ========================= Transparency ========================= */}
      <section id="transparency" className="scroll-mt-28 pb-[104px]">
        <div className="rounded-(--radius-panel) border border-(--border-glass) bg-card p-8 shadow-hud backdrop-blur-xl md:p-10">
          <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <span className="inline-flex items-center rounded-(--radius-control) border border-(--pill-border) bg-(--pill-bg) px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-(--pill-fg) uppercase">
                Transparency
              </span>
              <h2 className="font-heading mt-4 max-w-2xl text-3xl font-bold tracking-tight text-balance">
                Every payout carries its receipts.
              </h2>
              <p className="mt-3 max-w-2xl leading-relaxed text-(--fg-secondary)">
                Each settlement freezes a snapshot: the window, the weights,
                every counted commit and PR, and the tx hash of every USDC
                transfer. Contributors verify their share on a read-only page —
                no account needed.
              </p>
            </div>
            <Link
              href={`/t/${DEMO_TEAM_ID}`}
              className="inline-flex h-12 items-center gap-2 rounded-(--radius-control) border border-(--border-subtle) bg-(--surface-strong) px-5 text-sm font-semibold text-(--fg-primary) shadow-card transition-[translate,background-color] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-(--surface-hover)"
            >
              See the public demo page →
            </Link>
          </div>
        </div>
      </section>

      {/* ============================= Footer ============================= */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border-subtle) py-8 text-xs text-(--fg-tertiary)">
        <span className="font-mono">MeritStream · GitHub-weighted USDC settlements on Arc</span>
        <span className="font-mono">zero LLM · deterministic · auditable</span>
      </footer>
    </main>
  );
}
