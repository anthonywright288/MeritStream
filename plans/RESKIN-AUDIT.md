# RESKIN AUDIT

Date: 2026-08-03 | Scope: reskin range `661df10..e36dc8b` (12 commits, "reskin UI with lineaprompt frosted-glass design system" through "remove em dashes")

## 0. Scope note: term mismatch

Yêu cầu nhắc "escrow/settlement, submit, payout, refund". Codebase này (MeritStream) không
có "escrow" hay "refund" hay "submit" như flow riêng biệt:
- PRD nói thẳng: "No escrow contract needed... Explicitly absent: escrow contract" (`MeritStream-PRD-EN.md:55,197`).
- Không có "submit work" flow, không có "refund" flow/route/table nào trong code.
- Flow thật tương đương: pool wallet (~escrow) -> settlement engine (`runSettlement`) -> payout
  (USDC transfer per member) -> history (audit trail). Test bên dưới dùng flow thật này.

## 1. npm test + build

```
npm test   -> Test Files 5 passed (5), Tests 40 passed (40), 888ms
npm run build -> Compiled successfully, TypeScript clean, 9 routes generated, no errors
```

Route output (build):
```
○ /                          ƒ /api/agent/run
○ /_not-found                ƒ /api/teams
○ /apple-icon.png            ƒ /api/teams/[id]
○ /create                    ƒ /api/teams/[id]/settle
○ /icon.svg                  ƒ /api/teams/[id]/signals
                              ƒ /t/[teamId]
                              ƒ /team/[id]
                              ƒ /team/[id]/history
```
Cả build và test đều xanh.

## 2. Logic diff kiểm tra (thay flow tiền cũ vì term không khớp)

`git diff --stat 4622c3f..HEAD -- lib scripts db` = **1 file, 1 line** (toàn bộ business logic
layer). Diff duy nhất trong `lib/`:
```
lib/settlement/run-settlement.ts: "cycle was just settled — nothing new" -> "..., nothing new" (bỏ em-dash, không đổi status/code)
```
Diff duy nhất trong `app/api/`:
```
app/api/teams/[id]/route.ts: "settlement running — wallet edits blocked" -> "settlement running: ..." (bỏ em-dash, vẫn 409)
```
`app/(app)` file layout đổi (di chuyển vào route group `(app)`/`(marketing)`), nhưng route
group không đổi URL path — xác nhận bằng build output ở mục 1 và mục 4.

40/40 vitest xanh CHÍNH LÀ regression check cho money math/resume-safety/window rules
(`lib/points/compute-shares.test.ts`, `lib/settlement/pay-members.test.ts`,
`lib/cycle/window.test.ts`, `lib/auth/admin-token.test.ts`) — không đổi so với trước reskin.
`scripts/phase2-integration-test.ts` (atomic create/wallet-index/admin-token integration) tồn
tại nhưng không chạy lại lần này vì mục 3 dưới đây đã live-test đúng các path đó (create,
admin token, settle) trên chính API/UI đã reskin.

## 3. Live money-flow proof (localhost, real tx)

Team demo có sẵn không dùng được để test: `75pw8g1f` pool = 0.998995 USDC (dưới buffer 1
USDC), `v17oSNF_` noActivity=true (0 điểm, settle sẽ trả 0 cho tất cả). Cả 2 team đều MẤT
admin token (thiết kế: chỉ lưu SHA-256 hash, không phục hồi được). Đã hỏi và được duyệt tạo
team test mới để lấy bằng chứng thật.

Thực hiện trên localhost:3001 (reskinned UI/API):
1. `POST /api/teams` tạo team `6_pRFHu4`, pool `0xC4bf39Bec17936208341b1208372C8dfA36fb6C4`, admin token nhận 1 lần.
2. Chuyển 2 USDC test từ funding wallet (`0x9CcDb4ECc...883a1a2`, index 0) vào pool mới:
   tx `0x2d1150d42c6785964227ce16561c4492530839f5ef0cd81a6c2add5267697a94` — status success, block 55083766.
3. Push 1 commit rỗng thật lên `anthonywright288/MeritStream` (`acf3f07`) để có tín hiệu > 0 điểm.
4. `POST /api/teams/6_pRFHu4/settle` (x-admin-token, force) -> `{"code":200,"status":"paid","result":{"paid":1,"failed":0}}`.
5. Payout tx lấy từ trang history đã reskin: `0x44da55518fa39c16b688e72d6d9e7518da52b57083b0d8518f73a33af26537e8` — status success, block 55085324.

Cả 2 tx xác nhận on-chain qua `publicClient.getTransactionReceipt` (status=success). Flow
tiền (pool funding -> settlement -> payout -> audit trail hiển thị tx) chạy đúng sau reskin.

**Việc dọn dẹp:** xoá team test khỏi DB thất bại 1 phần — `members`/`teams` bị chặn bởi FK
`payouts_member_id_fkey` (payout row đang giữ audit trail thật, đúng theo thiết kế, không nên
force-cascade xoá). Team `6_pRFHu4` còn tồn tại vĩnh viễn trong DB chung với số dư nhỏ (~1
USDC dust) — không có API xoá team. Cờ lên cho user tự quyết định (xoá tay qua Supabase SQL
editor nếu muốn, hoặc để đó vì giá trị không đáng kể).

## 4. Route/URL không đổi

`git diff --name-status 4622c3f..HEAD -- app` cho thấy file di chuyển vào route group
(`(app)`, `(marketing)`) nhưng route group không tạo path segment — build output mục 1 xác
nhận path THẬT không đổi: `/`, `/create`, `/t/[teamId]`, `/team/[id]`, `/team/[id]/history`,
5 API routes, cron path `/api/agent/run` (khớp `vercel.json`).

3 demo link (từ `docs/demo-runbook.md`, chưa sửa) + link production đều là URL bên ngoài,
không phụ thuộc code local — path pattern local xác nhận vẫn khớp:
- `https://meritstream-six.vercel.app/team/75pw8g1f`
- `https://meritstream-six.vercel.app/team/75pw8g1f/history`
- `https://meritstream-six.vercel.app/t/75pw8g1f`
- Production: `https://meritstream-six.vercel.app`

Không đổi ký tự nào (không có thay đổi nào trong `docs/demo-runbook.md` hay README link
trong phạm vi reskin).

## 5. Trang public không lộ admin control

Code: `app/(app)/t/[teamId]/page.tsx` vẫn truyền `readOnly` cho `DashboardView`;
`dashboard-view.tsx:99-106` vẫn gate `SettleNowButton` sau `readOnly ? <p>...</p> : <SettleNowButton/>`;
`member-card.tsx` không có control mutation nào (chỉ hiển thị + `SignalsDrawer` đọc data
GitHub công khai).

Live: `curl http://localhost:3001/t/6_pRFHu4 | grep -i "settle now\|admin.token"` -> 0 match.
Public page sau reskin vẫn không lộ admin control.

## 6. Viewport điện thoại

**Giới hạn công cụ:** `resize_window` trong tool trình duyệt không thực sự đổi viewport render
(thử 3 lần: 390x844, 500x900, 420x900 — `window.innerWidth` luôn báo 1515, mâu thuẫn với
`outerWidth` 673, dấu hiệu bug môi trường tool chứ không phải bug trang). Dừng lại theo
nguyên tắc không lặp vô ích, chuyển sang review code:

- `marketing-nav.tsx:26`: link row (`How it works/Formula/...`) là `hidden ... sm:flex` —
  ẩn đúng dưới 640px, chỉ còn brand + "Launch app".
- `(marketing)/page.tsx`: hero grid mặc định 1 cột, chỉ `md:grid-cols-[...]` mới 2 cột; stat
  pill mặc định `grid-cols-1`, `sm:grid-cols-3`; stat strip dashboard dùng `flex-wrap`.
- Next.js App Router tự chèn `viewport width=device-width` mặc định (không có override).
- Rủi ro nhỏ CHƯA verify trực tiếp: `member-card.tsx` xếp 4 nhóm phần tử (user/wallet, commits/PRs,
  USDC amount, drawer button) trên 1 hàng `flex` KHÔNG có `flex-wrap` — có thể bị chật ở màn
  hình < ~360px. Khuyến nghị user tự mở `/team/<id>` trên điện thoại thật để xác nhận.

## Deviations tổng hợp (bước 1 AUDIT GATE)

1. 2 chỗ đổi text lỗi (em-dash -> dấu phẩy/hai chấm) trong `run-settlement.ts` và
   `app/api/teams/[id]/route.ts` — cosmetic, không đổi status code/logic.
2. File layout đổi sang route group `(app)`/`(marketing)` — không đổi URL.
3. Không có "escrow/submit/refund" flow trong sản phẩm này (xem mục 0) — test đã map sang
   flow thật tương đương.

## Update 2026-08-04: mobile overflow bug found + fixed

User test tay trên điện thoại thật: phải pinch-zoom-out mới thấy hết trang, riêng trang
`/team/[id]` không zoom ra đủ để hết tràn. Xác nhận là bug thật (không phải giới hạn tool như
lo ngại ở mục 6), root cause 2 chỗ:

1. `components/nav/app-nav.tsx` — nav row (brand + "app" pill + Dashboard/History/Public
   view + team-id chip + "New team") KHÔNG `flex-wrap`, không ẩn bớt link nào ở màn hẹp (khác
   `marketing-nav.tsx` vốn đã có `hidden ... sm:flex`). Trang `/team/[id]` render nhiều link
   nhất (teamId có giá trị) nên tràn nặng nhất — khớp đúng mô tả user.
2. `components/dashboard/member-card.tsx` — hàng member (`CardContent`) thiếu `flex-wrap`,
   nhóm phải (commits/PRs, USDC amount, drawer button) `shrink-0` nên không co được, cùng với
   nav tràn cộng dồn.

**Fix áp dụng:** bọc 3 link phụ của `app-nav.tsx` trong `hidden ... sm:flex` (giống pattern có
sẵn ở `marketing-nav.tsx`, team-id chip đổi từ `sm:inline` sang `lg:inline` cho đỡ chật); thêm
`flex-wrap` + `gap-x-4 gap-y-2` vào `member-card.tsx` CardContent (giống pattern `flex-wrap` đã
dùng ở `dashboard-view.tsx`). Chỉ đổi className, không đổi logic. `npm test` chạy lại sau fix:
40/40 xanh.

**Xác nhận (2026-08-04, sau deploy prod):** user tự test lại trên điện thoại thật, KHÔNG còn
phải zoom-out nữa — fix hoạt động đúng trên production (`meritstream-six.vercel.app`). Tool
trình duyệt của Claude vẫn không mô phỏng viewport hẹp đáng tin trong suốt phiên này (kể cả
sau nhiều lần thử) nên phần verify hình ảnh dựa hoàn toàn vào test tay của user.

## `scripts/phase2-integration-test.ts` — đã chạy

`TEST_BASE_URL=http://localhost:3001 npx tsx scripts/phase2-integration-test.ts` → **21 passed,
0 failed** (wallet_index monotonic, atomic create rollback, admin token 401, wallet edit audit,
signals cache, mid-cycle join, weight/repo/user validation 422). Script tự cleanup 3/4 team test
tạo ra, nhưng theo thiết kế sẵn của script **giữ lại 1 team demo mới**:
- `mvGrMD0q` (pool `0xdec7deD424437411f1E2D00390d5956E132Ed60b`, index 9, repo `vercel/next.js`)
- Admin token: `51236b95e0adb6293b28e175ffcb550257a5fe970acd64a5365e5c1d992382f7` (LƯU LẠI — lần
  này còn token nên settle được nếu muốn, khác 2 team demo cũ đã mất token).

## Ship: commit + push + deploy

- `0b1b000` fix: collapse app nav links and wrap member row on narrow viewports
- `77c904a` docs: record reskin audit findings and evidence
- Push: `acf3f07..77c904a master -> master` (origin, sau khi switch gh account đúng chủ repo
  `anthonywright288` — lưu ý account hay bị flip về `charlesmartin273` giữa các lệnh git, phải
  check `gh auth status` trước mỗi lần push).
- Deploy prod: 2 lần trong phiên này, lần cuối `dpl_Fys7rb8dxpwGvEW8a2BRzsbZFj8M`, alias
  `https://meritstream-six.vercel.app` không đổi, `/team/75pw8g1f` verify 200 sau deploy.
- `git status` sạch sau cùng.

## Đã đóng (không còn unresolved)

1. Team test `6_pRFHu4` — đã xoá qua Supabase SQL editor.
2. Mobile overflow — user confirm hết phải zoom trên điện thoại thật, tại production.
3. `scripts/phase2-integration-test.ts` — đã chạy, 21/21 pass.
4. Push + deploy — xong, evidence ở mục "Ship" trên.

## Unresolved còn lại

1. **`75pw8g1f`** — đã fauceted (20.998995 USDC) nhưng mất admin token vĩnh viễn (thiết kế:
   không phục hồi được) → không force-settle được. Chỉ còn chờ cron tự settle khi hết cửa sổ
   cycle (~6 ngày nữa từ 2026-08-04).
2. **Team `mvGrMD0q`** (tạo lúc chạy integration test, repo `vercel/next.js`, pool
   `0xdec7deD424437411f1E2D00390d5956E132Ed60b`, index 9) — còn nằm trong DB, CÒN admin token
   (`51236b95e0adb6293b28e175ffcb550257a5fe970acd64a5365e5c1d992382f7`). User tự quyết định:
   dùng để demo settle thật, hoặc xoá tay (SQL mẫu như team `6_pRFHu4`, đổi `team_id`).
