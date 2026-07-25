import { ghPaginate } from "@/lib/github/gh-fetch";

export interface MergedPrItem {
  number: number;
  html_url: string;
  merged_at: string;
}

interface RawPr {
  number: number;
  html_url: string;
  merged_at: string | null;
  updated_at: string;
  user: { login: string } | null;
}

/**
 * PRs by `author` with merged_at inside [sinceISO, untilISO].
 *
 * `state=closed` INCLUDES unmerged PRs (merged_at null) — must filter.
 * Sorted by `updated` desc (not `created`, deviation from the plan text):
 * merging updates updated_at, so once a whole page is older than `since` no
 * later page can contain a merge inside the window — safe early stop. Sorting
 * by created would early-stop past old PRs that were merged recently.
 */
export async function fetchMergedPrs(
  repo: string,
  author: string,
  sinceISO: string,
  untilISO: string,
): Promise<{ count: number; items: MergedPrItem[] }> {
  const since = Date.parse(sinceISO);
  const until = Date.parse(untilISO);
  // Invalid dates make every NaN comparison false: the early-stop would never
  // fire (paginating ALL closed PRs) and the filter would silently return 0.
  if (!Number.isFinite(since) || !Number.isFinite(until) || since > until) {
    throw new Error(`Invalid window: since=${sinceISO} until=${untilISO}`);
  }
  const authorLower = author.toLowerCase();
  const path = `/repos/${repo}/pulls?state=closed&sort=updated&direction=desc`;

  const raw = await ghPaginate<RawPr>(path, (page) =>
    page.every((pr) => Date.parse(pr.updated_at) < since),
  );

  const items = raw
    .filter((pr) => {
      // GitHub logins are case-insensitive but the API returns canonical
      // casing — a case-sensitive compare silently zeroes a member's PRs.
      if (!pr.merged_at || pr.user?.login.toLowerCase() !== authorLower) {
        return false;
      }
      const mergedAt = Date.parse(pr.merged_at);
      // Half-open [since, until): a merge at the exact cycle boundary must
      // count in exactly one of two adjacent cycles, never both.
      return mergedAt >= since && mergedAt < until;
    })
    .map((pr) => ({
      number: pr.number,
      html_url: pr.html_url,
      merged_at: pr.merged_at as string,
    }));
  return { count: items.length, items };
}
