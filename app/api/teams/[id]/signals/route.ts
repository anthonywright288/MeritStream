import { NextResponse } from "next/server";
import { loadSignals } from "@/lib/teams/load-signals";
import { withTtlCache } from "@/lib/cache/ttl-cache";

const SIGNALS_TTL_MS = 60_000;

/**
 * GET /api/teams/[id]/signals — public, tolerant, [RT-C5] served from a 60s
 * server cache (key carries the repo: N tabs or hostile pollers within the
 * TTL cost one GitHub batch). Response includes syncedAt for "last synced".
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const cached = await withTtlCache(`signals:${id}`, SIGNALS_TTL_MS, () =>
      loadSignals(id, { strict: false }),
    );
    if (!cached.value) {
      return NextResponse.json({ error: "team not found" }, { status: 404 });
    }
    return NextResponse.json({
      ...cached.value,
      syncedAt: new Date(cached.storedAt).toISOString(),
      fromCache: cached.fromCache,
    });
  } catch (error) {
    console.error("signals failed:", error);
    const detail = error instanceof Error ? error.message : "unknown";
    return NextResponse.json(
      { error: "signals unavailable", detail },
      { status: 502 },
    );
  }
}
