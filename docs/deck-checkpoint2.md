# MeritStream — Mid-Submission Deck (Checkpoint 2)

Track: **Agentic Economy** (primary), DeFi (secondary) | 7 slides

---

## Slide 1 — MeritStream

**GitHub signals in, weighted USDC splits out, one automated settlement on Arc.**

- Live: **https://meritstream-six.vercel.app**
- Repo: **https://github.com/anthonywright288/MeritStream**
- A payout agent that turns contribution into compensation

📸 *Screenshot: landing page (hero + 3 buttons), full browser window*

---

## Slide 2 — The problem

**Team payouts are spreadsheet arguments.**

- "Who did how much" is decided from memory at payday
- Contribution is public on GitHub — but invisible at payout time
- N manual transfers every cycle, zero audit trail from money back to work

📸 *Screenshot: none — keep this slide text-only for contrast*

---

## Slide 3 — How it works

# GitHub signals → weighted points → one settlement run in USDC

- Commits (1 pt) + merged PRs (3 pts), weights declared upfront
- Agent freezes a signal snapshot each cycle, then pays every member
- Cron settles automatically; "Settle now" for on-demand

📸 *Screenshot: dashboard `/team/75pw8g1f` — member card with points, projected USDC share, pool balance*

---

## Slide 4 — What is LIVE today

**Real settlements, on Arc, right now.**

- Real USDC settlements on Arc Testnet — **zero double-pays across ~10 runs** (double-clicks, crashes, resumes — all replayed against production)
- Every payout links back to **the exact commits that earned it**
- First settlement ever: MeritStream paid for its own Phase-3 commits (tx `0x353e2543…97b896`)

📸 *Screenshot: history page — expanded snapshot showing per-member share + tx hash; second shot: Arc explorer for that tx*

---

## Slide 5 — The engine is deterministic

# NO LLM anywhere.

- Same inputs = same split, every time — a pure bigint formula, not a model's opinion
- Anyone can recompute the split from public GitHub data + the frozen snapshot
- Red-teamed: 12 accepted findings, 40 regression tests locking every double-pay path

📸 *Screenshot: snapshot detail in history — the frozen signals + amounts (the "receipt" anyone can verify)*

---

## Slide 6 — Built on Arc

**One asset, end to end.**

- Gas IS USDC — measured on-chain: **0.001849 USDC per transfer** (1 USDC buffer covers ~540 payouts)
- Sub-second finality: settle button to confirmed receipts in seconds
- Pool, payouts, and fees in the same stablecoin — no gas-token babysitting

📸 *Screenshot: verify-gas script output (tx hash + "gas paid in USDC — CONFIRMED") or the explorer tx fee field*

---

## Slide 7 — Next

**Checkpoint 2 → Demo Day**

- Demo video: the 3-minute live-settlement script (`docs/demo-runbook.md`) — push a commit on stage, watch it get paid
- Demo Day: live run + the deliberate failure path (double-settle → 409)
- v2 seeds: review-weighted signals, private repos, batch settlement via Multicall

📸 *Screenshot: public view `/t/75pw8g1f` — the shareable transparency page*
