import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { verifyToken } from "@/lib/auth/admin-token";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/teams/[id] — public team meta (never the token hash). */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { data: team } = await db
    .from("teams")
    .select("id, name, repo, commit_weight, pr_weight, cycle, pool_address, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!team) {
    return NextResponse.json({ error: "team not found" }, { status: 404 });
  }
  const { data: members } = await db
    .from("members")
    .select("id, github_username, wallet_address, created_at")
    .eq("team_id", id);
  return NextResponse.json({ team, members: members ?? [] });
}

interface PatchBody {
  commitWeight?: number;
  prWeight?: number;
  addMember?: { githubUsername: string; walletAddress: string };
  editWallet?: { memberId: string; walletAddress: string };
}

/**
 * PATCH /api/teams/[id] — admin-token guarded (x-admin-token header,
 * constant-time verify). Supports weight edits [RT-M1], add member, and
 * [RT-H4] wallet edits (audited; 409 while a settlement is running).
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: team } = await db
    .from("teams")
    .select("id, admin_token_hash")
    .eq("id", id)
    .maybeSingle();
  if (!team) {
    return NextResponse.json({ error: "team not found" }, { status: 404 });
  }

  const token = request.headers.get("x-admin-token") ?? "";
  if (!verifyToken(token, team.admin_token_hash)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // [RT-M1] weights: integers >= 0, never both zero (server authoritative)
  if (body.commitWeight !== undefined || body.prWeight !== undefined) {
    const cw = body.commitWeight;
    const pw = body.prWeight;
    for (const [label, w] of [["commit_weight", cw], ["pr_weight", pw]] as const) {
      if (w !== undefined && (!Number.isInteger(w) || w < 0)) {
        return NextResponse.json(
          { error: `${label} must be a non-negative integer` },
          { status: 422 },
        );
      }
    }
    if (cw === 0 && pw === 0) {
      return NextResponse.json(
        { error: "weights cannot both be zero" },
        { status: 422 },
      );
    }
    const update: Record<string, number> = {};
    if (cw !== undefined) update.commit_weight = cw;
    if (pw !== undefined) update.pr_weight = pw;
    const { error } = await db.from("teams").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (body.addMember) {
    const { githubUsername, walletAddress } = body.addMember;
    if (!githubUsername?.trim() || !isAddress(walletAddress)) {
      return NextResponse.json({ error: "invalid member" }, { status: 422 });
    }
    const { error } = await db.from("members").insert({
      team_id: id,
      github_username: githubUsername.trim(),
      wallet_address: walletAddress,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  }

  if (body.editWallet) {
    const { memberId, walletAddress } = body.editWallet;
    if (!isAddress(walletAddress)) {
      return NextResponse.json({ error: "invalid wallet address" }, { status: 422 });
    }
    // [RT-H4] never change the payout destination while a run is in flight
    const { data: running } = await db
      .from("settlements")
      .select("id")
      .eq("team_id", id)
      .eq("status", "running")
      .limit(1);
    if (running?.length) {
      return NextResponse.json(
        { error: "settlement running: wallet edits blocked" },
        { status: 409 },
      );
    }
    const { data: member } = await db
      .from("members")
      .select("id, wallet_address")
      .eq("id", memberId)
      .eq("team_id", id)
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ error: "member not found" }, { status: 404 });
    }
    const { error } = await db
      .from("members")
      .update({ wallet_address: walletAddress })
      .eq("id", memberId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // User-locked constraint #3: every wallet change leaves an audit row
    await db.from("member_wallet_audit").insert({
      member_id: memberId,
      team_id: id,
      old_address: member.wallet_address,
      new_address: walletAddress,
    });
  }

  return NextResponse.json({ ok: true });
}
