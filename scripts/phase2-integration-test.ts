/**
 * Phase 2 live integration test (run with dev server up):
 *   npx tsx scripts/phase2-integration-test.ts
 *
 * Covers the user-locked constraints:
 *  #1 wallet_index: create 3 teams, delete the middle one, create a 4th —
 *     assert the new index was never used before and survivors' addresses
 *     are unchanged (sequence semantics, no reuse ever).
 *  #2 atomicity: create_team_atomic with a broken member rolls back the team
 *     row entirely (no orphan), the burned index stays burned.
 *  #3 admin token 401 on wrong token; wallet edit writes an audit row.
 *  #4 signals served from server cache within TTL (fromCache on 2nd hit).
 * Plus [RT-M1] weight 422s, 422 unknown repo/user, [RT-H3] mid-cycle join.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

try {
  const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of envFile.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
} catch {}

import { resolveMeritStreamBase } from "./detect-meritstream-base";

// Resolved in main(): TEST_BASE_URL if set (identity-verified), else port scan.
// Never a hardcoded port — see detect-meritstream-base.ts for the incident.
let BASE = "";
const SB = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const REPO = "vercel/next.js";
const W = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
];

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name} ${detail}`);
  }
}

const sb = (path: string, init: RequestInit = {}) =>
  fetch(`${SB}/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

async function createTeam(name: string, username: string, wallet: string) {
  const res = await fetch(`${BASE}/api/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      repo: REPO,
      leadAddress: "0x0",
      commitWeight: 1,
      prWeight: 3,
      cycle: "weekly",
      members: [{ githubUsername: username, walletAddress: wallet }],
    }),
  });
  const json = await res.json();
  return { status: res.status, ...json };
}

async function deleteTeam(id: string) {
  await sb(`member_wallet_audit?team_id=eq.${id}`, { method: "DELETE" });
  await sb(`members?team_id=eq.${id}`, { method: "DELETE" });
  await sb(`teams?id=eq.${id}`, { method: "DELETE" });
}

async function main() {
  BASE = await resolveMeritStreamBase(process.env.TEST_BASE_URL);
  console.log(`MeritStream verified at ${BASE}\n`);

  console.log("— constraint #1: wallet_index monotonic, never reused —");
  const t1 = await createTeam("itest-1", "styfle", W[0]);
  const t2 = await createTeam("itest-2", "bgw", W[1]);
  const t3 = await createTeam("itest-3", "gaearon", W[2]);
  check("3 teams created", [t1, t2, t3].every((t) => t.status === 201));
  check("indexes strictly increasing", t2.walletIndex === t1.walletIndex + 1 && t3.walletIndex === t2.walletIndex + 1, JSON.stringify([t1.walletIndex, t2.walletIndex, t3.walletIndex]));

  await deleteTeam(t2.teamId); // delete the MIDDLE team
  const t4 = await createTeam("itest-4", "styfle", W[0]);
  check("post-delete index NOT reused (> all prior)", t4.status === 201 && t4.walletIndex > t3.walletIndex, `t4=${t4.walletIndex}`);

  const survivors = await (await sb(`teams?id=in.(${t1.teamId},${t3.teamId})&select=id,pool_address,wallet_index`)).json();
  const a1 = survivors.find((r: { id: string }) => r.id === t1.teamId);
  const a3 = survivors.find((r: { id: string }) => r.id === t3.teamId);
  check("survivor addresses unchanged", a1?.pool_address === t1.poolAddress && a3?.pool_address === t3.poolAddress);

  console.log("— constraint #2: atomic create, rollback leaves nothing —");
  const burn = await (await sb("rpc/allocate_wallet_index", { method: "POST", body: "{}" })).json();
  const bad = await sb("rpc/create_team_atomic", {
    method: "POST",
    body: JSON.stringify({
      p_id: "itest-broken", p_lead_address: "0x0", p_name: "broken", p_repo: REPO,
      p_commit_weight: 1, p_pr_weight: 3, p_cycle: "weekly", p_pool_address: "0x0",
      p_wallet_index: burn, p_admin_token_hash: "h",
      p_members: [{ github_username: "x" }], // missing wallet -> NOT NULL violation
    }),
  });
  check("broken create rejected", !bad.ok, `HTTP ${bad.status}`);
  const orphan = await (await sb("teams?id=eq.itest-broken&select=id")).json();
  check("no orphan team row (rolled back)", orphan.length === 0);
  const nextIdx = await (await sb("rpc/allocate_wallet_index", { method: "POST", body: "{}" })).json();
  check("burned index stays burned (sequence advanced)", nextIdx > burn);

  console.log("— constraint #3: admin token + wallet audit —");
  const wrong = await fetch(`${BASE}/api/teams/${t1.teamId}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-token": "deadbeef" }, body: JSON.stringify({ commitWeight: 2 }) });
  check("wrong token -> 401", wrong.status === 401);
  const badWeight = await fetch(`${BASE}/api/teams/${t1.teamId}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-token": t1.adminToken }, body: JSON.stringify({ commitWeight: 1.5 }) });
  check("fractional weight -> 422", badWeight.status === 422);
  const badWallet = await fetch(`${BASE}/api/teams/${t1.teamId}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-token": t1.adminToken }, body: JSON.stringify({ editWallet: { memberId: "ignored", walletAddress: "0x123" } }) });
  check("invalid wallet -> 422", badWallet.status === 422);
  const members = await (await sb(`members?team_id=eq.${t1.teamId}&select=id,wallet_address`)).json();
  const editOk = await fetch(`${BASE}/api/teams/${t1.teamId}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-token": t1.adminToken }, body: JSON.stringify({ editWallet: { memberId: members[0].id, walletAddress: W[1] } }) });
  check("valid wallet edit -> 200", editOk.status === 200);
  const audit = await (await sb(`member_wallet_audit?team_id=eq.${t1.teamId}&select=old_address,new_address`)).json();
  check("audit row logged old->new", audit.length === 1 && audit[0].old_address === W[0] && audit[0].new_address === W[1], JSON.stringify(audit));

  console.log("— constraint #4 + [RT-H3]: signals cache + mid-cycle join —");
  const addMember = await fetch(`${BASE}/api/teams/${t1.teamId}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-admin-token": t1.adminToken }, body: JSON.stringify({ addMember: { githubUsername: "bgw", walletAddress: W[2] } }) });
  check("mid-cycle addMember -> 200", addMember.status === 200);
  const s1 = await (await fetch(`${BASE}/api/teams/${t1.teamId}/signals`)).json();
  const s2 = await (await fetch(`${BASE}/api/teams/${t1.teamId}/signals`)).json();
  check("signals 200 with members", Array.isArray(s1.members) && s1.members.length === 2);
  check("2nd request served from cache", s2.fromCache === true && s1.syncedAt === s2.syncedAt);
  const joined = s1.members.find((m: { username: string }) => m.username === "bgw");
  check("[RT-H3] joiner since == join instant (> window start)", !!joined && Date.parse(joined.memberSince) > Date.parse(s1.window.start), joined?.memberSince);
  check("[RT-H3] joiner shows zero pre-join signals", joined?.commits === 0 && joined?.prs === 0);

  console.log("— [RT-M1] create-level 422s —");
  const frac = await createTeam("itest-frac", "styfle", W[0]);
  check("create weight 1.5 -> 422", (await (async () => { const r = await fetch(`${BASE}/api/teams`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "x", repo: REPO, leadAddress: "0x0", commitWeight: 1.5, prWeight: 3, cycle: "weekly", members: [{ githubUsername: "styfle", walletAddress: W[0] }] }) }); return r.status; })()) === 422);
  check("(frac control team created for cleanup)", frac.status === 201);
  const badRepo = await fetch(`${BASE}/api/teams`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "x", repo: "no-such-owner-xx/no-such-repo-xx", leadAddress: "0x0", commitWeight: 1, prWeight: 3, cycle: "weekly", members: [{ githubUsername: "styfle", walletAddress: W[0] }] }) });
  check("unknown repo -> 422", badRepo.status === 422);
  const badUser = await fetch(`${BASE}/api/teams`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "x", repo: REPO, leadAddress: "0x0", commitWeight: 1, prWeight: 3, cycle: "weekly", members: [{ githubUsername: "no-such-user-xyz-999-abc", walletAddress: W[0] }] }) });
  check("unknown user -> 422", badUser.status === 422);

  // cleanup: keep t1 as the demo team; remove the rest
  await deleteTeam(t3.teamId);
  await deleteTeam(t4.teamId);
  if (frac.teamId) await deleteTeam(frac.teamId);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  console.log(`Demo team kept: ${t1.teamId} (pool ${t1.poolAddress}, index ${t1.walletIndex})`);
  console.log(`Demo admin token: ${t1.adminToken}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("integration test crashed:", e);
  process.exit(1);
});
