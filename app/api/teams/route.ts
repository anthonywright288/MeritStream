import { NextResponse } from "next/server";
import { CreateTeamError, createTeam } from "@/lib/teams/create-team";

/** POST /api/teams — create team. Returns the admin token EXACTLY ONCE. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  try {
    // createTeam validates everything server-side (authoritative)
    const result = await createTeam(body as Parameters<typeof createTeam>[0]);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof CreateTeamError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("create team failed:", error); // never logs the token
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
