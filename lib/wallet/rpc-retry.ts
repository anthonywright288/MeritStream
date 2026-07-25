/**
 * Exponential-backoff wrapper for Arc RPC calls. The public RPC rate-limits
 * aggressively (observed: -32011 "request limit reached" after ~4 rapid
 * requests), so EVERY chain read and receipt-wait must go through this.
 *
 * [RT-C2] NEVER wrap a transaction broadcast (writeContract/sendTransaction)
 * in withRetry: a timeout after the tx reached the mempool would re-send with
 * a fresh nonce and pay twice. Retries are for idempotent operations only —
 * reads and waitForTransactionReceipt.
 */
export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  factor?: number;
  /** Return false to rethrow immediately (permanent errors). */
  shouldRetry?: (error: unknown) => boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Default: retry only transient failures — Arc's rate limit (-32011 / 429),
 * timeouts, and network drops. Deterministic failures (revert, bad address)
 * rethrow immediately instead of burning ~7.5s of pointless backoff.
 */
export function isTransientRpcError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /request limit|-32011|429|rate.?limit|timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|fetch failed|network/i.test(
    message,
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  {
    retries = 5,
    baseDelayMs = 500,
    factor = 2,
    shouldRetry = isTransientRpcError,
  }: RetryOptions = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt >= retries - 1) throw error;
      await sleep(baseDelayMs * factor ** attempt);
    }
  }
  throw lastError;
}
