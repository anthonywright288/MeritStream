/**
 * Base-URL resolution for integration tests. Regression guard for the
 * 2026-07-25 incident: port 3000 was serving a DIFFERENT app (TokenGate),
 * MeritStream had auto-shifted to 3002, and the test died inside JSON.parse
 * with an incomprehensible "<!DOCTYPE" error. Rules encoded here:
 *  - never assume a fixed port: honor TEST_BASE_URL, else scan candidates;
 *  - verify the app IDENTITY, not just "GET / == 200";
 *  - hitting a foreign app fails FAST with a human-readable message.
 */

export class WrongAppError extends Error {
  constructor(base: string) {
    super(
      `Expected MeritStream at ${base} but found a different app. ` +
        `Is another dev server running on this port? ` +
        `Set TEST_BASE_URL to the port shown in MeritStream's "npm run dev" output.`,
    );
    this.name = "WrongAppError";
  }
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Identity probe: only MeritStream answers this route with JSON
 * {"error":"team not found"}. A foreign Next app returns an HTML 404 page.
 */
export async function probeApp(
  base: string,
  fetchImpl: FetchLike = fetch,
): Promise<"meritstream" | "wrong-app" | "down"> {
  try {
    const res = await fetchImpl(`${base}/api/teams/__identity_probe__/signals`);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return "wrong-app";
    const body = (await res.json()) as { error?: unknown; teamId?: unknown };
    return typeof body.error === "string" || typeof body.teamId === "string"
      ? "meritstream"
      : "wrong-app";
  } catch {
    return "down";
  }
}

const DEFAULT_CANDIDATES = [3000, 3001, 3002, 3003, 3004, 3005].map(
  (p) => `http://localhost:${p}`,
);

/**
 * Resolve the MeritStream base URL. Explicit TEST_BASE_URL is authoritative:
 * if it points at a foreign app that's an ERROR, never a silent fallback.
 * Without it, scan localhost candidates and return the first genuine hit.
 */
export async function resolveMeritStreamBase(
  explicitBase: string | undefined,
  fetchImpl: FetchLike = fetch,
  candidates: string[] = DEFAULT_CANDIDATES,
): Promise<string> {
  if (explicitBase) {
    const result = await probeApp(explicitBase, fetchImpl);
    if (result === "meritstream") return explicitBase;
    if (result === "wrong-app") throw new WrongAppError(explicitBase);
    throw new Error(`No server responding at ${explicitBase} (TEST_BASE_URL)`);
  }
  const wrongApps: string[] = [];
  for (const base of candidates) {
    const result = await probeApp(base, fetchImpl);
    if (result === "meritstream") return base;
    if (result === "wrong-app") wrongApps.push(base);
  }
  throw new Error(
    `MeritStream dev server not found on ${candidates.join(", ")}.` +
      (wrongApps.length
        ? ` Found OTHER apps at: ${wrongApps.join(", ")} — is another project's dev server running?`
        : "") +
      ` Start it with "npm run dev" or set TEST_BASE_URL.`,
  );
}
