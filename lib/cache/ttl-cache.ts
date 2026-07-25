/**
 * [RT-C5] Minimal in-memory TTL cache. Shields the shared GITHUB_TOKEN quota
 * from the PUBLIC signals endpoint: any number of tabs / hostile pollers
 * within the TTL cost ONE GitHub fetch batch. Keyed by the caller (signals
 * uses the team's repo+id). Per-instance on serverless — good enough as a
 * quota/DoS damper, not a correctness mechanism.
 */
interface Entry<T> {
  value: T;
  storedAt: number;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export interface Cached<T> {
  value: T;
  /** When the value was computed — the UI's "last synced X ago". */
  storedAt: number;
  fromCache: boolean;
}

export async function withTtlCache<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
): Promise<Cached<T>> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) {
    return { value: hit.value, storedAt: hit.storedAt, fromCache: true };
  }
  const value = await compute();
  store.set(key, { value, storedAt: now, expiresAt: now + ttlMs });
  return { value, storedAt: now, fromCache: false };
}

/** Test/ops helper. */
export function clearTtlCache() {
  store.clear();
}
