import { GithubApiError, ghPaginate } from "@/lib/github/gh-fetch";

export interface CommitItem {
  sha: string;
  html_url: string;
  message: string;
}

interface RawCommit {
  sha: string;
  html_url: string;
  commit: { message: string };
}

/**
 * Commits authored by `author` in [sinceISO, untilISO], server-side filtered.
 * GitHub attributes commits via the commit email linked to the account —
 * unlinked-email commits are invisible (PRD caveat, surfaced in setup UI).
 */
export async function fetchCommits(
  repo: string,
  author: string,
  sinceISO: string,
  untilISO: string,
): Promise<{ count: number; items: CommitItem[] }> {
  const since = Date.parse(sinceISO);
  const until = Date.parse(untilISO);
  if (!Number.isFinite(since) || !Number.isFinite(until) || since > until) {
    throw new Error(`Invalid window: since=${sinceISO} until=${untilISO}`);
  }
  const path =
    `/repos/${repo}/commits?author=${encodeURIComponent(author)}` +
    `&since=${encodeURIComponent(sinceISO)}&until=${encodeURIComponent(untilISO)}`;
  let raw: RawCommit[];
  try {
    raw = await ghPaginate<RawCommit>(path);
  } catch (error) {
    // 409 = repository is empty (no commits at all)
    if (error instanceof GithubApiError && error.status === 409) {
      return { count: 0, items: [] };
    }
    throw error;
  }
  const items = raw.map((c) => ({
    sha: c.sha,
    html_url: c.html_url,
    message: c.commit.message,
  }));
  return { count: items.length, items };
}
