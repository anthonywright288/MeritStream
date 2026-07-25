/** Client-safe display helpers — pure string math, no chain imports. */

/** "1234567" base units -> "1.234567" (trailing zeros trimmed to 2 dp min). */
export function formatUsdcDisplay(baseUnits: string): string {
  const negative = baseUnits.startsWith("-");
  const digits = (negative ? baseUnits.slice(1) : baseUnits).padStart(7, "0");
  const whole = digits.slice(0, -6).replace(/^0+(?=\d)/, "");
  const frac = digits.slice(-6).replace(/0+$/, "").padEnd(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/** Relative "X ago" for the last-synced label. */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}
