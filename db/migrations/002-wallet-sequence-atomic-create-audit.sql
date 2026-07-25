-- Migration 002 — Phase 2 user-locked constraints (run AFTER schema.sql)
--
-- Constraint #1: wallet_index is IMMUTABLE, MONOTONIC, NEVER REUSED — even
-- when a team is deleted. max(wallet_index)+1 would reuse the top index after
-- deleting the newest team, silently changing that HD address's owner. A
-- sequence never goes backward; a burned index (failed create) stays burned.
CREATE SEQUENCE IF NOT EXISTS wallet_index_seq START 0 MINVALUE 0;

-- Seed past any pre-existing rows (idempotent on a fresh DB: sets next=0).
SELECT setval(
  'wallet_index_seq',
  COALESCE((SELECT MAX(wallet_index) FROM teams), -1) + 1,
  false
);

-- App calls this FIRST to obtain the index, derives the HD pool address from
-- it, then calls create_team_atomic. If the create later fails, the index is
-- burned — exactly the no-reuse property we want.
CREATE OR REPLACE FUNCTION allocate_wallet_index()
RETURNS integer
LANGUAGE sql
AS $$ SELECT nextval('wallet_index_seq')::integer $$;

-- Constraint #2: team + members insert is ONE transaction. Any failure
-- (bad member row, constraint violation) rolls back everything — no orphan
-- team, no team with members but missing index. Function body IS the
-- transaction (plpgsql functions are atomic).
CREATE OR REPLACE FUNCTION create_team_atomic(
  p_id TEXT,
  p_lead_address TEXT,
  p_name TEXT,
  p_repo TEXT,
  p_commit_weight NUMERIC,
  p_pr_weight NUMERIC,
  p_cycle TEXT,
  p_pool_address TEXT,
  p_wallet_index INT,
  p_admin_token_hash TEXT,
  p_members JSONB  -- [{github_username, wallet_address}, ...]
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO teams (id, lead_address, name, repo, commit_weight, pr_weight,
                     cycle, pool_address, wallet_index, admin_token_hash)
  VALUES (p_id, p_lead_address, p_name, p_repo, p_commit_weight, p_pr_weight,
          p_cycle, p_pool_address, p_wallet_index, p_admin_token_hash);

  INSERT INTO members (team_id, github_username, wallet_address)
  SELECT p_id, m->>'github_username', m->>'wallet_address'
  FROM jsonb_array_elements(p_members) AS m;

  RETURN p_id;
END;
$$;

-- Constraint #3: every member wallet change is logged (audit trail for the
-- money destination). Written by the PATCH handler in the same breath as the
-- update; never deleted.
CREATE TABLE IF NOT EXISTS member_wallet_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id),
  team_id TEXT NOT NULL REFERENCES teams(id),
  old_address TEXT NOT NULL,
  new_address TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE member_wallet_audit ENABLE ROW LEVEL SECURITY;
