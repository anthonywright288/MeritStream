# Design System — trích từ folder design `lineapromt`

Nguồn: `C:\Users\pc\Desktop\Clone Web\lineapromt\src\app\globals.css` (design tokens trích verbatim từ lineaprompt.com) + component TSX. **Mọi giá trị đọc thẳng từ CSS variables trong code, không phải ước lượng từ ảnh.** Light-mode only, không có dark mode.

> Đây là NGÔN NGỮ THIẾT KẾ để áp dụng cho MeritStream, không copy nội dung/layout của project gốc.

---

## 1. Màu (Color Palette)

### Nền & bề mặt
| Vai trò | Token gốc | Giá trị |
|---|---|---|
| Background trang | `--bg-page` (`--frost-100`) | `#edf3f8` |
| Frost scale (nền phụ) | `--frost-000/050/200` | `#fbfdff` / `#f5f8fc` / `#d9e4ee` |
| Surface chính (card) | `--surface-1` | `#ffffff9e` (white 62%) |
| Surface phụ | `--surface-2` / `--surface-3` | `#ffffff85` / `#ffffff6b` |
| Surface đậm (input, active) | `--surface-strong` | `#ffffffd1` |
| Surface hover | `--surface-hover` | `#ffffffe6` |
| Nền tối (panel "command") | `.magnetic-command` | `#0f1622e6` (ink đậm, dùng điểm nhấn) |

Lưu ý: surface đều là **trắng bán trong suốt + `backdrop-filter: blur(28px) saturate(1.25)`** — hiệu ứng glassmorphism đặt trên nền gradient.

Nền body = layered gradient: các `radial-gradient` trắng/teal/indigo rất nhạt trên `#edf3f8`, cộng thêm **lưới grid 56×56px** (`#1520300b`, fade dần xuống) và **noise SVG opacity 0.2** phủ toàn trang.

### Chữ (text)
| Vai trò | Token | Giá trị |
|---|---|---|
| Text chính | `--fg-primary` | `#0d1420f0` (ink-950 ~94%) |
| Text phụ | `--fg-secondary` | `#1d2a3bad` (~68%) |
| Text mờ (caption/meta) | `--fg-tertiary` | `#4350668f` (~56%) |
| Text accent | `--fg-accent` | `#32389f` (indigo-650) |

Ink scale: `--ink-950 #0d1420`, `--ink-800 #1d2a3b`, `--ink-650 #435066`, `--ink-500 #667288`.

### Accent
| Vai trò | Token | Giá trị |
|---|---|---|
| Accent chính (indigo) | `--indigo-500` | `#5157d8` |
| Accent đậm (CTA, link) | `--indigo-650` | `#32389f` |
| Accent phụ (teal) | `--teal-500` | `#0f9f9a` (dùng ở glow/gradient, mức 8–18% alpha) |
| Amber (nhấn ấm) | `--amber-500` | `#d88a1d` |

### Border
| Vai trò | Token | Giá trị |
|---|---|---|
| Border glass (panel) | `--border-glass` | `#ffffffe0` |
| Border subtle (card, input) | `--border-subtle` | `#3d4d6321` (~13% alpha) |
| Border magnetic (panel nổi) | `--border-magnetic` | `#54658029` |

### Trạng thái
| Trạng thái | Text | Nền | Border |
|---|---|---|---|
| Success | `--fg-success #0c6a4d` (base `#16815f`) | `#16815f1a` | `#16815f47` |
| Danger | `--fg-danger #8a1530` (base `#b91c3b`) | `#b91c3b1a` | `#b91c3b47` |
| Warning | `--fg-warning #8a5208` (base `#d88a1d`) | `#d88a1d1f` | `#d88a1d4d` |

### Khác
- Focus ring: `#5157d8b3`, soft `#5157d829`; glow focus: `box-shadow: 0 0 0 4px #5157d81f`
- Pill/badge: bg `#5157d817`, border `#5157d838`, text `#30368f`
- Selection glow: `#5157d85c`; accent glow: `#5157d847`

---

## 2. Typography

### Font family
- **Body/Display**: system native — `-apple-system, BlinkMacSystemFont, "SF Pro Text"/"SF Pro Display", "Helvetica Neue", Arial, sans-serif`
- **Mono (code, kbd, label, tag)**: **IBM Plex Mono** (weights 400/500/600/700, next/font) — dùng RẤT nhiều: eyebrow labels, tags, metadata, keyboard hints, giá trị kỹ thuật

### Scale (Tailwind classes thực dùng)
| Vai trò | Size | Weight | Ghi chú |
|---|---|---|---|
| H1 hero | `text-5xl → 6xl → 7xl` (48/60/72px) responsive | `font-bold` (700) | `leading-[0.96]`, `text-balance`, max-width ~10.8ch |
| H2 section | `text-4xl md:text-6xl` (36→60px), một số section `md:text-5xl` | 700 | `text-balance` |
| H3 card | `text-xl`–`text-2xl` (20–24px) | 700 | |
| H4 | `text-xl` (20px) | 700 | |
| Lead paragraph | `text-xl` (20px) | 400 | `leading-8` (32px) |
| Body | `text-sm`–`base` (14–16px) | 400 | line-height ~1.55–1.65 |
| Caption/meta | `text-xs` (12px), mono nhỏ `.62–.78rem` | 400–700 | |
| Eyebrow/label | `text-[11px]` hoặc `.66–.68rem` | 600–750 | **uppercase + `tracking-[0.12em]` + mono** |

- Letter-spacing: 0 cho heading/body; `.12em` chỉ dùng cho label uppercase
- Weight đặc biệt: code dùng cả weight lẻ `650`, `750`, `800`, `850` (variable font)
- Số/giá tiền: `text-4xl font-extrabold`

---

## 3. Spacing

- **Đơn vị cơ bản: 4px** (Tailwind scale), nhưng padding component hay dùng giá trị rem lẻ (`.72rem`, `.85rem`, `.95rem`)
- **Section spacing**: `--section-space: 104px` (padding-block cho mỗi section)
- **Container**: `width: min(1180px, 100vw - 40px)`, căn giữa
- Padding thường dùng:
  - Card/panel: `1rem` (16px); panel lớn: `clamp(1.25rem, 3vw, 2rem)`
  - Button lớn (CTA hero): `h-14 px-5` (height 56px, padding-x 20px)
  - Input: `.72rem .8rem`, `min-height: 44px`
  - Pill/badge: `px-2.5 py-1`; chip: `.38–.45rem .55–.7rem`
  - Row/list item: `.78rem .86rem`
- Gap trong grid/list: `.42–.75rem`; gap giữa heading và body: `mt-5`/`mt-7` (20/28px)
- Khoảng cách giữa các khối trong section: `mb-16` (64px), `space-y-20` (80px)

---

## 4. Bo góc & Đổ bóng

### Border-radius
| Cấp | Giá trị | Dùng cho |
|---|---|---|
| Control | `--radius-control: 8px` | button, input, chip nhỏ |
| Trung gian | 9–12px | card con, icon box, row, toolbar item |
| Panel | `--radius-panel: 14px` | card/panel chính |
| Lớn | 16–22px | instrument panel (18px), window mockup (22px) |
| Hero visual | 26–30px | khung visual lớn |
| Pill | `999px` | badge tròn, tag, dot |

### Box-shadow (đặc trưng: y-offset lớn, blur rất lớn, spread âm sâu → bóng "floating" mềm)
| Cấp | Giá trị |
|---|---|
| Card | `--shadow-card: 0 26px 70px -46px #34455c75, inset 0 1px 0 #ffffffdb` |
| HUD/panel nổi | `--shadow-hud: 0 34px 96px -48px #3a4a648c, inset 0 1px 0 #ffffffd1` |
| CTA button | `0 18px 34px -24px rgba(50,56,159,.9), inset 0 1px 0 rgba(255,255,255,.2)` |
| Hover card | `0 22–28px 58–78px -46px #2532489e` |
| Visual lớn | `0 42px 120px -72px #253248b3, inset 0 1px #ffffffeb` |

**Pattern nhất quán:** mọi shadow đều kèm `inset 0 1px 0 rgba(255,255,255,~.85)` — highlight viền trên tạo cảm giác kính/3D.

### Motion tokens
- Duration: `--dur-tap .12s`, `--dur-fast .18s`, `--dur-gentle .24s`, `--dur-soft .32s`
- Easing: `--ease-frost: cubic-bezier(.2, .72, .2, 1)` (đặc trưng, dùng khắp nơi)

---

## 5. Components

### Button
- **Primary (CTA)**: nền `#32389f` (indigo-650), chữ trắng, radius 8px, `text-sm font-semibold`, height 56px (hero) / 32px (default), shadow indigo đậm + inset highlight. **Hover**: `-translate-y-0.5` + nền sáng lên `#5157d8`. **Active**: về `translate-y-0` + shadow thu nhỏ (cảm giác nhấn phím)
- **Secondary**: nền `--surface-1` (trắng 62% + backdrop-blur), border `--border-subtle`, chữ `--fg-primary`, cùng radius/hover pattern
- **Focus**: `ring-2` màu `--focus-ring` + ring-offset — không dùng outline mặc định

### Input
- Nền `--surface-strong` (`#ffffffd1`), border 1px `--border-subtle`, radius 8px, `min-height 44px`, padding `.72rem .8rem`
- **Focus**: border → `--focus-ring`, nền → `--surface-hover`, glow `0 0 0 4px #5157d81f`
- Placeholder: `--fg-tertiary`

### Card / Panel ("frost-panel" — thành phần đặc trưng nhất)
- Border 1px `#ffffffe0` (viền trắng sáng), radius 14px, nền trắng bán trong `#ffffff9e`
- `backdrop-filter: blur(28px) saturate(1.25)` + `--shadow-card`
- **Hover** (card tương tác): `translateY(-1px đến -2px)`, nền → `--surface-hover`, border → tint indigo `#5157d833`, shadow đậm hơn — transition `.18s ease-frost`

### Row/list item active
- Nền chuyển sang **gradient indigo đặc** `linear-gradient(90deg, #5b5ef7, #454bd8)`, chữ trắng, glow indigo — item được chọn nổi bật hẳn

### Pill/badge (eyebrow)
- Mono/semibold, uppercase, `tracking-[0.12em]`, `text-[11px]`, nền `#5157d817`, border `#5157d838`, chữ `#30368f`, radius 8px

### Kbd (phím tắt)
- Mono, `font-size .72em`, radius 6px, nền `currentColor` 8% + border `currentColor` 20% (color-mix) — tự thích ứng theo màu chữ xung quanh

---

## 6. Vibe

**"Frosted-glass tech-minimal"**: nền frost xanh-xám lạnh nhiều lớp gradient + grid + noise, mọi bề mặt là kính trắng mờ với viền sáng và bóng floating sâu; một accent indigo `#5157d8` (điểm xuyết teal), chữ hệ thống đậm nét + mono IBM Plex cho mọi metadata — nghiêm túc, tinh xảo, đậm chất dev-tool cao cấp kiểu macOS.
