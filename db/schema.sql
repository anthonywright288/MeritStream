-- MeritStream schema = PRD 6b + red-team deltas (see plans/PRD-ERRATA.md for deliberate deviations)

CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  lead_address TEXT NOT NULL,
  name TEXT NOT NULL,
  repo TEXT NOT NULL,               -- "owner/name"
  -- [RT-M1] integers >= 0 enforced at API layer AND here (defense in depth):
  -- a fractional/negative weight reaching computeShares would brick settlement
  commit_weight NUMERIC DEFAULT 1
    CHECK (commit_weight >= 0 AND commit_weight = trunc(commit_weight)),
  pr_weight NUMERIC DEFAULT 3
    CHECK (pr_weight >= 0 AND pr_weight = trunc(pr_weight)),
  cycle TEXT DEFAULT 'monthly',     -- weekly | monthly
  pool_address TEXT NOT NULL,       -- HD-derived; engine asserts derivation matches [RT-H5]
  wallet_index INT UNIQUE NOT NULL, -- HD addressIndex, one per team
  admin_token_hash TEXT NOT NULL,   -- SHA-256 of the one-time admin token
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES teams(id),
  github_username TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  -- [RT-H3] deviation from PRD 6b (absent there): mid-cycle join rule
  -- "accrues from the moment added" needs the join timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, github_username)
);

CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES teams(id),
  cycle_start TIMESTAMPTZ NOT NULL,
  cycle_end TIMESTAMPTZ NOT NULL,
  pool_amount NUMERIC NOT NULL,
  -- [RT-C4] deviation from PRD 6b (NOT NULL there): the row is created and
  -- claimed BEFORE the strict freeze writes the snapshot, so it starts null.
  snapshot JSONB,
  -- [RT-C3] 'running' = a run claimed this settlement via compare-and-set.
  -- PRD default 'paid' replaced: status is earned, never assumed.
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','paid','no_activity','partial','insufficient_funds')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- [RT-C3] backs idempotent create (INSERT ... ON CONFLICT DO NOTHING)
  UNIQUE(team_id, cycle_end)
);

CREATE TABLE payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id UUID NOT NULL REFERENCES settlements(id),
  member_id UUID NOT NULL REFERENCES members(id),
  amount NUMERIC NOT NULL,          -- USDC base units (6 decimals)
  -- [RT-C2] 'sending' = broadcast issued, receipt unconfirmed. Row is written
  -- BEFORE broadcast; resume must verify 'sending' tx on-chain, never re-send.
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sending','paid','failed')),
  -- [RT-C2] deviation from PRD 6b (NOT NULL there): null until broadcast
  tx_hash TEXT,
  -- [RT-H4] ACTUAL destination paid (current member wallet at send time);
  -- the true audit trail, may differ from the frozen snapshot wallet
  dest_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- [RT-C3] one payout per member per settlement, backs idempotent upsert
  UNIQUE(settlement_id, member_id)
);

-- Phase 3 resume queries payouts by settlement (FK columns are not auto-indexed)
CREATE INDEX idx_payouts_settlement_id ON payouts(settlement_id);

-- Row Level Security: ON for every table, ZERO policies. The anon browser key
-- therefore reads/writes NOTHING; all data access goes through the server-only
-- service-role client (supabaseAdmin), which bypasses RLS. Without this, the
-- shipped anon key could UPDATE members.wallet_address and steal payouts
-- (transfers pay the CURRENT wallet per RT-H4). Add narrow anon read policies
-- later only if a page truly needs client-side reads.
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
