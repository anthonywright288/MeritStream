import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Per-team admin token: shown to the lead exactly ONCE at create time; only
 * the SHA-256 hash is stored. It is the sole credential for mutations
 * (edit team, settle now). Lost token = no admin actions (accepted v1).
 * Never log the token or its hash.
 */
export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison — never early-exits on a partial match. */
export function verifyToken(input: string, storedHash: string): boolean {
  const inputHash = createHash("sha256").update(input).digest();
  const stored = Buffer.from(storedHash, "hex");
  if (inputHash.length !== stored.length) return false;
  return timingSafeEqual(inputHash, stored);
}
