import { mnemonicToAccount } from "viem/accounts";

/**
 * Per-team pool wallet: one server-only mnemonic, one HD account per team at
 * addressIndex = teams.wallet_index. Deterministic — the same mnemonic+index
 * always yields the same address.
 *
 * [RT-H5] The settlement engine must assert the derived address equals the
 * stored teams.pool_address before signing anything: a changed/typo'd
 * mnemonic in the runtime env would silently control a DIFFERENT wallet.
 */
export function deriveTeamPoolAccount(index: number) {
  const mnemonic = process.env.POOL_WALLET_MNEMONIC;
  if (!mnemonic) throw new Error("POOL_WALLET_MNEMONIC is not set");
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid wallet index: ${index}`);
  }
  return mnemonicToAccount(mnemonic, { addressIndex: index });
}
