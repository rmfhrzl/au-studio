# `au` — Minji × Hanni Interactive AU

Reverse-engineered study of **`https://au.jean-team-2.lamund.web.id/`** — a single-file, zero-dependency interactive AU that simulates an iPhone as the delivery layer for a branching story.

Author of the original: [@jeanverseis](https://x.com/jeanverseis/status/2112781328567697621) (software engineering student, Indonesia).
Original format reference: [@kki_jose](https://x.com/kki_jose/status/2112160772436726157) → `wonbin-phone.pages.dev`.

---

## Files

| File | Language | Purpose |
|---|---|---|
| **[`REPORT.md`](REPORT.md)** | Bahasa Indonesia | Analisis lengkap: arsitektur, mesin cerita, temuan, kelemahan, rekomendasi roadmap. **Mulai di sini.** |
| **[`SPEC.md`](SPEC.md)** | English | Spesifikasi teknis untuk AI/developer: kontrak API, state machine, extension recipes, smoke-test checklist. **Paste-ready ke AI lain.** |

Both documents are derived by static analysis of the deployed `index.html` (324,905 bytes) — no source repository was published. Line references are relative to the extracted 3,470-line `<script>` block.

---

## Quick facts

```
Platform      Static host, Lamund (free ID student hosting) · subdomain jean-team-2
Stack         Vanilla ES2020+ · 1 HTML file · 0 deps · 0 build step · 0 backend
Size          index.html 325 KB + 13 assets ≈ 2.5 MB total
Surface       13 apps · 45 views · iOS simulator + full X/Twitter simulation
Story         3 beats × 2 options = 8 paths → 2 endings · 240 authored chat lines
i18n          7 locales in data (ko/en/ja/zh/vi/th/id) · switcher exposes 2 · story is KO-only
Persistence   3 localStorage keys (+3 legacy migrated) · all writes schema-validated
3rd-party     Twitter widgets.js (3 real tweets) · Apple Music embed · both need network
```

---

## The three findings that matter

1. **The branching is scored, not tree-shaped.** `endingKey()` (app.js:2652) sums `point` values across 3 binary choices and thresholds at ≥2. Eight possible paths collapse onto two endings, with no failure state and no dead branch. Highest-leverage fix in the codebase — see SPEC.md §13.2.

2. **The upper layer patches the lower layer at runtime.** The AU layer doesn't extend the iOS simulator — it *reassigns* its functions (`show`, `back`, `endCall`, `tick`, `notify`, …) and replaces `VIEWS.chat` wholesale. 12 patch sites, order-dependent, zero tests. Documented in SPEC.md §12.

3. **All narrative content is inline JS literals.** 237 KB of data-literals in the engine file. This is exactly the problem the author wants the drag-and-drop editor to solve — and the reason content must be extracted to `story.json` before an editor is possible. SPEC.md §13.7.

---

## Terminology

> **Interactive fiction AU** — more specifically, **phone-sim branching fiction**; technically, a **dialogue-tree narrative**. The story is delivered through a simulated device, the player writes their own replies, and a scoring dialogue tree selects the ending.

---

## Next steps (proposed, in order)

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | Replace score threshold with an explicit path→ending table (≥4 endings) | ~2h | ★★★★★ |
| 2 | Extract all story content into `story.json` | ~4h | ★★★★★ |
| 3 | Translate story content to `en` + `id` | ~4h | ★★★★☆ |
| 4 | Add `manifest.json` + favicon + `sw.js` (installable, offline) | ~1h | ★★★☆☆ |
| 5 | Vary `HISTORY_DAYS` density (6 msgs/day × 30 days reads as filler) | ~3h | ★★★☆☆ |
| 6 | Add a failure state so choices carry cost | ~3h | ★★★★☆ |
| 7 | Refactor base layer into ES modules (prerequisite for the editor) | ~1d | ★★★☆☆ |
| 8 | Build the drag-and-drop editor + phone preview + ending-coverage view | ~2-3w | ★★★★★ |

---

*Analysed 21 October 2026 from the deployed artifact.*
