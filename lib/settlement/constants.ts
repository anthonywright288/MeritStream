/**
 * [RT-C1] Shared money constants. The dashboard projection AND the settlement
 * freeze both compute shares over `distributable = balance - GAS_BUFFER`, so
 * the projected split always equals what settlement will pay. Defined once
 * here — never duplicate the literal.
 *
 * Buffer sizing: measured gas on Arc testnet = 1,849 base units per USDC
 * transfer (tx 0x8567...07b8, 2026-07-25) -> 1 USDC covers ~540 transfers.
 */
export const GAS_BUFFER_BASE_UNITS = 1_000_000n; // 1 USDC (6 decimals)

export function distributableFrom(balanceBaseUnits: bigint): bigint {
  const d = balanceBaseUnits - GAS_BUFFER_BASE_UNITS;
  return d > 0n ? d : 0n;
}
