import Link from "next/link";

/**
 * Marketing nav — floating frosted-glass pill (design §5/§6). No wallet, no
 * app state: just the brand and a single "Launch app" CTA into the app area.
 * Tier 3 will mount this in the (marketing) route-group layout.
 */
export function MarketingNav() {
  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav
        aria-label="Marketing"
        className="flex w-full max-w-[1180px] items-center justify-between rounded-full border border-(--border-glass) bg-(--surface-strong) py-2 pr-2 pl-5 shadow-card backdrop-blur-xl backdrop-saturate-125"
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[15px] font-bold tracking-tight text-(--fg-primary)"
        >
          {/* Brand mark: indigo dot with glow, echoes the design's status dot */}
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full bg-indigo-500 shadow-[0_0_14px_var(--accent-glow)]"
          />
          MeritStream
        </Link>
        <div className="hidden items-center gap-6 sm:flex">
          {[
            ["#how", "How it works"],
            ["#formula", "Formula"],
            ["#features", "Features"],
            ["#transparency", "Transparency"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium text-(--fg-secondary) transition-colors duration-(--dur-fast) hover:text-(--fg-primary)"
            >
              {label}
            </a>
          ))}
        </div>
        <Link
          href="/create"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-black/10 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_34px_-24px_rgba(50,56,159,.9),inset_0_1px_0_rgba(255,255,255,.2)] transition-[translate,background-color,box-shadow] duration-(--dur-fast) ease-(--ease-frost) hover:-translate-y-0.5 hover:bg-indigo-500 active:translate-y-0"
        >
          Launch app
          <span aria-hidden>→</span>
        </Link>
      </nav>
    </header>
  );
}
