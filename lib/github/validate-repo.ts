import { GithubApiError, ghGet } from "@/lib/github/gh-fetch";

/** GET /repos/{owner}/{name} == 200. 404 -> false; other errors rethrow. */
export async function repoExists(repo: string): Promise<boolean> {
  try {
    await ghGet(`/repos/${repo}`);
    return true;
  } catch (error) {
    if (error instanceof GithubApiError && error.status === 404) return false;
    throw error;
  }
}

/** GET /users/{login} == 200. 404 -> false; other errors rethrow. */
export async function userExists(login: string): Promise<boolean> {
  try {
    await ghGet(`/users/${encodeURIComponent(login)}`);
    return true;
  } catch (error) {
    if (error instanceof GithubApiError && error.status === 404) return false;
    throw error;
  }
}
