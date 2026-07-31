/**
 * Settlement-pipeline ticker — a slow mono marquee of true engine facts.
 * Used along the hero's bottom edge and (reversed) above the footer.
 * Two copies of the fact list + translateX(-50%) loop = seamless scroll.
 */

const FACTS = [
  "points = commits × w₁ + merged PRs × w₂",
  "share = points / total_points",
  "payout = share × (pool − gas buffer)",
  "one transfer per member",
  "dust stays in the pool",
  "zero LLM in the money path",
  "receipts down to the commit",
  "auditable by anyone",
];

export function TickerStrip({
  reverse = false,
  className = "",
}: {
  reverse?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden border-y border-(--border-subtle) py-3.5 [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)] ${className}`}
    >
      <div
        className={`ticker-track flex w-max gap-9 ${reverse ? "[animation-direction:reverse]" : ""}`}
      >
        {[0, 1].map((copy) => (
          <div
            key={copy}
            className="flex shrink-0 items-center gap-9 font-mono text-xs whitespace-nowrap text-(--fg-tertiary)"
          >
            {FACTS.map((t) => (
              <span key={t} className="inline-flex items-center gap-9">
                {t} <span className="text-(--fg-accent)">·</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
