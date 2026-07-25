const GITHUB_API = "https://api.github.com";

export class GithubApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    body: string,
  ) {
    super(`GitHub ${status} on ${path}: ${body.slice(0, 200)}`);
    this.name = "GithubApiError";
  }
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/** GET a GitHub REST path (leading slash, query included). Throws GithubApiError on non-2xx. */
export async function ghGet<T>(path: string): Promise<T> {
  // Timeout guard: a hung connection would otherwise stall a settlement cron
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: headers(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    throw new GithubApiError(res.status, path, await res.text());
  }
  return res.json() as Promise<T>;
}

export const GH_PER_PAGE = 100;

/**
 * Paginate a list endpoint until a short page. `path` must already contain a
 * query string (per_page is appended here). `stopAfterPage(page)` may return
 * true to end pagination early (e.g. results sorted desc are past the window).
 */
export async function ghPaginate<T>(
  path: string,
  stopAfterPage?: (page: T[]) => boolean,
): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  const all: T[] = [];
  for (let page = 1; ; page++) {
    const items = await ghGet<T[]>(
      `${path}${sep}per_page=${GH_PER_PAGE}&page=${page}`,
    );
    all.push(...items);
    if (items.length < GH_PER_PAGE) break;
    if (stopAfterPage?.(items)) break;
  }
  return all;
}
