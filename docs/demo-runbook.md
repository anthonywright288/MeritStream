# MeritStream Demo Runbook (3 minutes)

Production: **https://meritstream-six.vercel.app** | Demo team: `75pw8g1f` (repo `anthonywright288/MeritStream`, the app pays for its own commits)

## Pre-demo checklist (do 15 minutes before)

- [ ] **Pool balance** of team `75pw8g1f` ≥ **3 USDC** (settle pays `balance − 1 USDC buffer`; below 1 USDC nothing can settle).
      Top up from the funding wallet (HD index 0) or faucet: **https://faucet.circle.com** → Arc Testnet → 20 USDC per address per 2h.
- [ ] **Funding wallet (index 0)** `0x9CcDb4ECc1ea8BCBeC896420AC5053268883a1a2` holds ≥ **5 USDC** spare (top-ups + gas; ~10.9 as of 2026-07-26).
- [ ] **Admin token** for `75pw8g1f` pasted somewhere reachable (it is sessionStorage-only, so a fresh browser tab will prompt for it).
- [ ] `GITHUB_TOKEN` set in Vercel env (5,000 req/h), already configured.
- [ ] A terminal on this repo, logged in as `anthonywright288` (`gh auth status`; other sessions on this machine flip the active account!).
- [ ] Rehearse once end-to-end. Signals cache is 60s, see step 3 timing.

## Tabs to open BEFORE the demo

1. `https://meritstream-six.vercel.app/team/75pw8g1f` (dashboard)
2. `https://meritstream-six.vercel.app/team/75pw8g1f/history` (audit trail)
3. `https://meritstream-six.vercel.app/t/75pw8g1f` (public view)

## Script

**0:00-0:30, the problem.** Open tab 3 (public view): "Who did how much is
usually a spreadsheet argument. Here it's public GitHub data, a declared
formula, and on-chain payouts anyone can verify. This page is read-only, so
share it with your team."

**0:30-1:20, live signal.** Switch to tab 1 (dashboard). Point at the pool
balance (real on-chain USDC) and the member's commit count. In the terminal:

```bash
git commit --allow-empty -m "demo: live signal from the stage"
git push
```

Say one sentence about weights (commit=1, merged PR=3). Click **Refresh**. The
server caches signals for 60s, so if the count hasn't moved, count to ten and
click again. The commit count and projected USDC share jump.

**1:20-2:15, settle.** Click **Settle now** (paste admin token if
prompted). ~5-10s: status `paid`. Switch to tab 2 (history): a new settlement
row, expand it for the frozen snapshot, the member's share, and the **tx
hash**. Click it → Arc explorer shows the USDC transfer. "From money back to
the exact commit: that's the audit trail."

**2:15-2:40, the failure path (on purpose).** Click **Settle now** AGAIN.
It returns **409, "cycle was just settled, nothing new to settle"**. "Double
click, concurrent cron, retry after a crash: one payment, ever. We red-teamed
this engine and locked every double-pay path with regression tests."

**2:40-3:00, close.** "Zero LLM. Same inputs, same split, every time.
Weekly cron settles automatically; the button is just the manual override.
Built on Arc because gas is USDC itself, one asset end to end."

## If something goes wrong

| Symptom | Fix |
|---------|-----|
| Commit count doesn't move | Cache TTL, wait to 60s, Refresh. Check the push actually landed (`git log origin/master -1`) |
| Settle → `insufficient_funds` + shortfall | Pool below owed + 1 USDC buffer, top up from index-0 wallet, settle again (it reports the exact shortfall) |
| Settle → 401 | Wrong/expired admin token in sessionStorage, clear and re-paste |
| Settle → `already_settled` on the FIRST click | A previous rehearsal settled this window <60s ago, push another commit, wait a minute |
| Anything looks stale | Hard refresh; the public URL needs no login (verified, no Vercel SSO) |
