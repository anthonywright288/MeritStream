import Link from "next/link";
import { ComparisonSection } from "@/components/marketing/comparison-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FeatureGrid } from "@/components/marketing/feature-grid";
import { FinalCtaSection } from "@/components/marketing/final-cta-section";
import { FormulaSection } from "@/components/marketing/formula-section";
import { LifecycleSection } from "@/components/marketing/lifecycle-section";
import { SettlementConsoleMock } from "@/components/marketing/settlement-console-mock";
import { StatsBand } from "@/components/marketing/stats-band";
import { TickerStrip } from "@/components/marketing/ticker-strip";

const DEMO_TEAM_ID = "75pw8g1f";

/** One step card in the "how it works" rail. Staggered idle float. */
function StepCard({ n, title, body, delay }: { n: string; title: string; body: string; delay: string }) {
  return (
    <div
      style={{ animationDelay: delay }}
      className="reveal-float rounded-(--radius-panel) border border-(--border-glass) bg-card p-5 shadow-card transition-[background-color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) hover:bg-(--surface-hover)"
    >
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
      <section className="relative grid items-center gap-x-12 gap-y-14 pt-36 md:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] md:pt-40">
        {/* Ambient aurora orbs — pre-blurred radial gradients drifting on the
            compositor (no filter: blur), purely decorative depth */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="aurora-drift absolute -top-16 right-[6%] size-[440px] rounded-full bg-[radial-gradient(circle,#5157d842,transparent_70%)]" />
          <div className="aurora-drift absolute top-[42%] -left-40 size-[500px] rounded-full bg-[radial-gradient(circle,#0f9f9a38,transparent_70%)] [animation-delay:-7s]" />
        </div>
        <div>
          <div className="rise-in inline-flex items-center gap-2.5 rounded-[10px] border border-(--border-subtle) bg-(--surface-1) px-3 py-2 text-sm font-medium text-(--fg-secondary) shadow-card">
            <span className="pulse-glow size-2 rounded-full bg-(--success) shadow-[0_0_14px_var(--success-glow)]" />
            Zero LLM · deterministic · on Arc
          </div>
          <h1 className="rise-in font-heading mt-6 max-w-[12ch] text-5xl leading-[0.96] font-bold tracking-tight text-balance [animation-delay:90ms] sm:text-6xl">
            Merit in. <span className="text-(--fg-accent)">USDC out.</span>
          </h1>
          <p className="rise-in mt-6 max-w-xl text-xl leading-8 text-pretty text-(--fg-secondary) [animation-delay:170ms]">
            GitHub signals in, weighted USDC splits out, one automated
            settlement on Arc. Every payout links back to the exact commits
            that earned it.
          </p>
          <div className="rise-in mt-8 flex flex-wrap gap-3 [animation-delay:250ms]">
            <Link
              href="/create"
              className="inline-flex h-13 items-center gap-2 rounded-(--radius-control) border border-black/10 bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_18px_34px_-24px_rgba(50,56,159,.9),inset_0_1px_0_rgba(255,255,255,.2)] transition-[translate,background-color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-indigo-500 active:translate-y-0"
            >
              Launch app →
            </Link>
            <Link
              href={`/team/${DEMO_TEAM_ID}`}
              className="inline-flex h-13 items-center rounded-(--radius-control) border border-(--border-subtle) bg-card px-5 text-sm font-semibold text-(--fg-primary) shadow-card transition-[translate,background-color] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-(--surface-strong) active:translate-y-0"
            >
              Live demo team
            </Link>
          </div>
          <p className="rise-in mt-4 text-sm text-(--fg-tertiary) [animation-delay:330ms]">
            No wallet popup. No login. Auditable by anyone —{" "}
            <Link href={`/t/${DEMO_TEAM_ID}`} className="text-(--fg-accent) hover:underline">
              public view ↗
            </Link>
          </p>
          {/* Spec chips (design §5: mono glass chips) */}
          <div className="rise-in mt-8 grid max-w-xl grid-cols-1 gap-2 [animation-delay:410ms] sm:grid-cols-3">
            {["Zero LLM", "Deterministic formula", "Auditable by anyone"].map((chip) => (
              <div
                key={chip}
                className="flex items-center justify-center rounded-[9px] border border-(--border-subtle) bg-(--surface-3) px-3 py-2 text-center font-mono text-xs text-(--fg-secondary)"
              >
                {chip}
              </div>
            ))}
          </div>
        </div>
        <div className="rise-in hidden justify-center [animation-delay:200ms] sm:flex">
          <SettlementConsoleMock />
        </div>
        {/* Settlement-pipeline ticker along the hero's bottom edge */}
        <TickerStrip className="md:col-span-2" />
      </section>

      {/* ========================= Stats band ========================= */}
      <div className="pt-[104px]">
        <StatsBand />
      </div>

      {/* ========================= How it works ========================= */}
      <section id="how" className="scroll-mt-28 pb-[104px]">
        <span className="reveal inline-flex items-center rounded-(--radius-control) border border-(--pill-border) bg-(--pill-bg) px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-(--pill-fg) uppercase">
          How it works
        </span>
        <h2 className="reveal font-heading mt-5 max-w-3xl text-4xl font-bold tracking-tight text-balance">
          Three moves. No judgment calls.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <StepCard
            n="01"
            delay="0s"
            title="Signals in"
            body="Public GitHub activity only: commits and merged PRs in the cycle window. Pulled straight from the repo — nothing self-reported."
          />
          <StepCard
            n="02"
            delay="0.9s"
            title="Weighted split"
            body="points = commits × w₁ + merged PRs × w₂. A formula the whole team agreed on up front. Zero LLM, zero discretion."
          />
          <StepCard
            n="03"
            delay="1.8s"
            title="One settlement run"
            body="Cron freezes a snapshot, then pays every member their share in USDC on Arc — one transfer each, dust stays in the pool."
          />
        </div>
      </section>

      {/* ==================== Formula / Features / Why ==================== */}
      <FormulaSection />
      <FeatureGrid />
      <ComparisonSection />
      <LifecycleSection />

      {/* ========================= Transparency ========================= */}
      <section id="transparency" className="scroll-mt-28 pb-[104px]">
        <div className="reveal-scale rounded-(--radius-panel) border border-(--border-glass) bg-card p-8 shadow-hud md:p-10">
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

      {/* ========================= FAQ + final CTA ========================= */}
      <FaqSection />
      <FinalCtaSection demoTeamId={DEMO_TEAM_ID} />

      {/* Closing ticker, mirrored direction */}
      <div className="pb-14">
        <TickerStrip reverse />
      </div>

      {/* ============================= Footer ============================= */}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border-subtle) py-8 text-xs text-(--fg-tertiary)">
        <span className="font-mono">MeritStream · GitHub-weighted USDC settlements on Arc</span>
        <span className="font-mono">zero LLM · deterministic · auditable</span>
      </footer>
    </main>
  );
}
