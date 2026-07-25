import { randomBytes } from "node:crypto";
import { isAddress } from "viem";
import { generateToken, hashToken } from "@/lib/auth/admin-token";
import { repoExists, userExists } from "@/lib/github/validate-repo";
import { deriveTeamPoolAccount } from "@/lib/wallet/derive-pool-account";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface CreateTeamInput {
  name: string;
  repo: string; // "owner/name"
  leadAddress: string;
  commitWeight: number;
  prWeight: number;
  cycle: "weekly" | "monthly";
  members: { githubUsername: string; walletAddress: string }[];
}

export class CreateTeamError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const REPO_RE = /^[\w.-]+\/[\w.-]+$/;

/** [RT-M1] weights: integers >= 0, not both zero. Server is authoritative. */
function validate(input: CreateTeamInput) {
  if (!input.name?.trim()) throw new CreateTeamError(400, "name required");
  if (!REPO_RE.test(input.repo)) {
    throw new CreateTeamError(400, "repo must be owner/name");
  }
  for (const [label, w] of [
    ["commit_weight", input.commitWeight],
    ["pr_weight", input.prWeight],
  ] as const) {
    if (!Number.isInteger(w) || w < 0) {
      throw new CreateTeamError(422, `${label} must be a non-negative integer`);
    }
  }
  if (input.commitWeight === 0 && input.prWeight === 0) {
    throw new CreateTeamError(422, "weights cannot both be zero");
  }
  if (!["weekly", "monthly"].includes(input.cycle)) {
    throw new CreateTeamError(400, "cycle must be weekly|monthly");
  }
  if (!input.members?.length) {
    throw new CreateTeamError(400, "at least one member required");
  }
  const names = input.members.map((m) => m.githubUsername.toLowerCase());
  if (new Set(names).size !== names.length) {
    throw new CreateTeamError(400, "duplicate github usernames");
  }
  for (const m of input.members) {
    if (!isAddress(m.walletAddress)) {
      throw new CreateTeamError(422, `invalid wallet for ${m.githubUsername}`);
    }
  }
}

/**
 * Creation flow (user-locked constraints):
 *  1. allocate_wallet_index() — Postgres SEQUENCE: monotonic, NEVER reused,
 *     even across team deletion. A failed create burns its index (by design).
 *  2. derive HD pool address from the index.
 *  3. create_team_atomic(...) — team + members in ONE transaction; any
 *     failure rolls back everything (no orphan team, no member-less index).
 *  4. Admin token surfaces to the caller ONLY after the commit succeeds.
 */
export async function createTeam(input: CreateTeamInput) {
  validate(input);

  if (!(await repoExists(input.repo))) {
    throw new CreateTeamError(422, `repo ${input.repo} not found`);
  }
  for (const m of input.members) {
    if (!(await userExists(m.githubUsername))) {
      throw new CreateTeamError(422, `github user ${m.githubUsername} not found`);
    }
  }

  const db = supabaseAdmin();

  const { data: index, error: allocError } = await db.rpc(
    "allocate_wallet_index",
  );
  if (allocError || typeof index !== "number") {
    throw new CreateTeamError(503, "wallet index allocation failed");
  }

  const poolAddress = deriveTeamPoolAccount(index).address;
  const adminToken = generateToken();
  const teamId = randomBytes(6).toString("base64url");

  const { error: createError } = await db.rpc("create_team_atomic", {
    p_id: teamId,
    p_lead_address: input.leadAddress || "0x0",
    p_name: input.name.trim(),
    p_repo: input.repo,
    p_commit_weight: input.commitWeight,
    p_pr_weight: input.prWeight,
    p_cycle: input.cycle,
    p_pool_address: poolAddress,
    p_wallet_index: index,
    p_admin_token_hash: hashToken(adminToken),
    p_members: input.members.map((m) => ({
      github_username: m.githubUsername,
      wallet_address: m.walletAddress,
    })),
  });
  if (createError) {
    // Transaction rolled back atomically; index stays burned (no reuse).
    throw new CreateTeamError(500, `create failed: ${createError.message}`);
  }

  return { teamId, poolAddress, walletIndex: index, adminToken };
}
