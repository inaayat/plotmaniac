# Plotted

Working product name: **Plotted**. The string lives in `plotted-config.js` (`GAME_NAME`) and is reused for the page title, PWA manifest, share result, and UI chrome. Do not scatter a second display name.

Plotted is the site at `/`. The older Plotmaniac field guide is preserved, not deleted, at `/archive/` (see [Archive](#9-plotmaniac-archive)).

This is a planning note for the daily game. Implementation follows the existing static stack: HTML, ES modules, CSS, JSON on GitHub Pages. No backend.

## 1. Concept

A bite-size daily version of Einstein’s Riddle / the zebra puzzle (“who owns the fish”).

- **3 houses** on most days, **4** on harder days, **5** on occasional special Sundays.
- Each house has **3 attributes** (for example person, pet, drink). Themes pick attributes from what Phosphor actually contains.
- **5–8 clues** that always lead to **exactly one** solution.
- **One question** to answer, while the player fills the whole grid.
- **2–5 minutes** to solve.
- **Same puzzle for everyone** each local calendar day, served as JSON keyed by date.

## 2. Gameplay

No typing in the grid. Each house has one slot per attribute.

- **Tap** a slot to open a bottom-sheet picker of Phosphor icons for that attribute (no empty placeholder tray).
- **Tap** an icon to place it. Placing the same item elsewhere on that attribute clears the old slot.
- **Long-press** an icon to mark it ruled out for the selected slot (a gold slash through the icon, as a note). Long-press again to clear.
- Optional **tiny free-text notes** field on each house.
- **All clues are hints:** a compact numbered list, shown in full, wrapping so nothing is cut off. Tap a line to cross it off. A hint also **auto-crosses** when the current grid makes it true.
- **Hint** fills one empty cell with the correct item and costs score.
- **Check** scores a mistake if the grid is full but wrong; it finishes the day if the grid matches the unique solution.
- Score is `max(0, 1000 − seconds − 50×mistakes − 120×hints)`.
- Streak calendar in `localStorage`. Timer starts on first place/hint/check.

### Share result (plain text)

Share is **clipboard copy** and, where the browser allows it, the **Web Share API**. It is not an image and not an in-app tile card. Emoji are allowed **only in this pasted text**. The in-app UI still uses icon libraries, never emoji.

Format:

```
Plotted #12
🏠🏠🏠🏠🏠
2️⃣3️⃣1️⃣5️⃣4️⃣
Solved in 2:45
https://plotmaniac.com
```

- Optional leading line: `Plotted #N` (N is days since launch, inclusive) and the site URL on the last line.
- Line of houses: one 🏠 per house in that day’s puzzle (3, 4, or 5).
- Keycap digits: the **order in which the player first completed each house fully and correctly**, left to right. In the example, the leftmost house was finished 2nd, then 3rd, 1st, 5th, 4th.
- Time line: `Solved in M:SS` (minute:second, including `0:42`).

## 3. Weekly difficulty curve

| Day | Houses | Clue mix |
| --- | --- | --- |
| Monday | 3 | Direct only (`at`, `same`) |
| Tuesday–Wednesday | 3 | Direct plus next-to |
| Thursday–Friday | 3 | Add left-of / not-in-house |
| Saturday | 3 | Mixed, including either/or |
| Sunday | 4 | Tricky: not next to, left of, either/or |
| Last Sunday of the month | 5 | Same tricky mix on a wider street |

Holiday-dated JSON can swap the theme (New Year, Valentine, Halloween, Christmas Eve/Day, New Year’s Eve) without changing the solver.

## 4. Puzzle generation

1. Seed from the date string so a given day is reproducible.
2. Pick a theme and a random solution.
3. Draw true clues of the day’s allowed types until a solver proves **exactly one** assignment.
4. Prune clues that are not required for uniqueness, then clamp to 5–8.
5. Rate difficulty by **constraint-propagation steps** (search beyond propagation counts as harder).
6. Reject near-duplicate solutions and clue-type patterns seen earlier in the year.
7. Hand-check samples; schedule **one JSON file per date** under `data/plotted/YYYY-MM-DD.json`. No backend.

The solver is a domain-reduction CSP with all-different per attribute, then backtracking that stops at two solutions. It is shared by the generator, tests, and (for verification) the client.

Precompute about a year at a time: `node scripts/generate-plotted.mjs`.

## 5. Variety / how long before running out

Solution space:

- 3 houses × 3 attributes: `(3!)^3 = 6^3 = 216`
- 4 houses × 3 attributes: `(4!)^3 = 24^3 = 13,824`
- 4 houses × 4 attributes (future): `24^4 = 331,776`

Many valid clue sets exist per solution. Roughly a dozen themes, each with ~6–10 Phosphor-backed items per attribute, plus a rotating question. Combined, that is effectively endless schedule capacity.

The real constraint is **freshness**:

- Rotate themes (avoid repeating one within about a month when the generator can).
- Log past solutions and clue-type patterns; reject near-duplicates.
- Add new clue types every few months (still only types the solver implements).
- Add themes only when Phosphor (or the Tabler/Lucide fallback) already has the icons.

## 6. Aesthetic

Keep **Plotmaniac’s** field-guide look, not a pastel cottage skin.

- Dark cream ink on `#0c0b09`, gold `#e8c47a`, hairline grid overlay, Fraunces titles, IBM Plex Mono UI, Oswald available for labels.
- Light mode inverts to cream paper and dark ink, with a darker gold so type still reads. **Toggle** in the header; default is `prefers-color-scheme`; the choice is stored in `localStorage` (`plotted-theme`).
- Houses are numbered panels with the Phosphor house icon — the same bordered panels as Plotmaniac cards, not rounded cottages.
- Motion stays small (selection underline, complete-house gold inset). No confetti requirement.
- Each day still has a short themed lede (dinner party, heist, pet show) under the gold arc.

## 7. Icons

**No emoji in the app UI** and **no custom-drawn icons**. Emoji appear only in the **share paste**.

Use existing libraries only:

- **Phosphor Icons, duotone**, primary, vendored as SVG paths in `plotted-icons.js` and recolored with `currentColor` (gold/ink from the Plotmaniac tokens).
- **Tabler Icons** or **Lucide** as fallback if a future theme needs a glyph Phosphor lacks.

Build themes around what those sets actually contain (cat, dog, coffee, wine, detective, bicycle, and so on). Do not invent pictograms.

## 8. Mobile-first

- Compact header (title, theme, reveal/check as icon buttons), **question prominent**, house grid, then the full hint list.
- Mobile-first portrait: fit one screen where possible; the page may scroll if an 8-hint / 5-house day needs it. No horizontal clue carousel.
- Desktop: constrained column (~560–640px), same stack, sensible use of space.
- Icon picker is a **bottom sheet**, only while a slot is selected.
- Tap targets **≥ 44px**.
- Haptic feedback via `navigator.vibrate` where the OS allows it.
- Installable **PWA** (`manifest.webmanifest` + `sw.js`) that can reload the shell and the day’s JSON offline after the first fetch.
- Lightweight: static files, no bundler.

## 9. Plotmaniac archive

The previous site is the archive, not a deletion:

| Was at repo root | Now |
| --- | --- |
| `index.html`, `app.js`, `engine.js`, view/model JS, CSS, `favicon.svg` | `archive/` |
| `data/` (plots, people, chronology, …) | `archive/data/` |
| `https://plotmaniac.com/` gallery | `https://plotmaniac.com/archive/` |
| `?plot=` links | Root redirects to `/archive/?plot=…` |

Git history is kept (`git mv`). Rebuild scripts under `scripts/` now write into `archive/data/`. The archive page links back to Plotted. Root footer links to the archive.

## 10. Build steps

1. Generator + uniqueness solver in JS (`plotted-engine.js`) with tests (`scripts/test-plotted.mjs`).
2. Small web app: grid, clues, timer, hint, check, plain-text share.
3. Daily puzzle JSON by date (`data/plotted/YYYY-MM-DD.json`).
4. Playtest with ~10 friends and tune the weekday curve.
5. Launch on this host; later add accounts, leaderboard, and a puzzle archive.

Existing Plotmaniac regression tests remain: `node scripts/test-never-ending-internet-lore.mjs` (paths retargeted at `archive/`).
