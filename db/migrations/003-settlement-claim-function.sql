-- Migration 003 — Phase 3: atomic settlement claim [RT-C3]
--
-- One function = one transaction: INSERT-if-absent + compare-and-set claim.
-- Exactly ONE invocation (cron or manual, however concurrent) may proceed to
-- the pay loop; everyone else learns why (already settled / already running).
-- claimed_at gives 'running' a freshness marker so a crashed run becomes
-- resumable after the staleness window without ever double-claiming a live one.

ALTER TABLE settlements ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION claim_settlement(
  p_team_id TEXT,
  p_cycle_start TIMESTAMPTZ,
  p_cycle_end TIMESTAMPTZ,
  p_stale_minutes INT DEFAULT 10
)
RETURNS TABLE (settlement_id UUID, prior_status TEXT, claimed BOOLEAN)
LANGUAGE plpgsql
AS $$
DECLARE
  v_row settlements%ROWTYPE;
BEGIN
  INSERT INTO settlements (team_id, cycle_start, cycle_end, pool_amount, status, claimed_at)
  VALUES (p_team_id, p_cycle_start, p_cycle_end, 0, 'running', now())
  ON CONFLICT (team_id, cycle_end) DO NOTHING;

  IF FOUND THEN
    SELECT s.id INTO settlement_id FROM settlements s
      WHERE s.team_id = p_team_id AND s.cycle_end = p_cycle_end;
    prior_status := NULL;  -- fresh row, we own it
    claimed := TRUE;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Row exists: lock it so concurrent claimants serialize here.
  SELECT * INTO v_row FROM settlements s
    WHERE s.team_id = p_team_id AND s.cycle_end = p_cycle_end
    FOR UPDATE;

  settlement_id := v_row.id;
  prior_status := v_row.status;

  IF v_row.status IN ('paid', 'no_activity') THEN
    claimed := FALSE;  -- terminal: idempotency 409, never pay twice
  ELSIF v_row.status = 'running'
        AND v_row.claimed_at IS NOT NULL
        AND v_row.claimed_at > now() - make_interval(mins => p_stale_minutes) THEN
    claimed := FALSE;  -- someone else is actively running this settlement
  ELSE
    -- partial | insufficient_funds | stale running -> we take over (resume)
    UPDATE settlements SET status = 'running', claimed_at = now()
      WHERE id = v_row.id;
    claimed := TRUE;
  END IF;
  RETURN NEXT;
END;
$$;
