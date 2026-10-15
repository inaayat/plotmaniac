# Plotted

Working product name: **Plotted**. The string lives in `plotted-config.js` (`GAME_NAME`) and is reused for the page title, PWA manifest, share result, and UI chrome. Do not scatter a second display name.

Plotted is the site at `/`. The older Plotmaniac field guide is preserved, not deleted, at `/archive/` (see [Archive](#9-plotmaniac-archive)).

This is a planning note for the daily game. Implementation follows the existing static stack: HTML, ES modules, CSS, JSON on GitHub Pages. No backend.

## 1. Concept

A bite-size daily version of Einstein’s Riddle / the zebra puzzle (“who owns the fish”).

- **Launch day (`2026-10-13`) is the original Einstein riddle**, hand-authored: **5 houses**, **5 attributes** (color, nationality, beverage, cigar, pet), **15 classic clues**, setup paragraph, question **Who owns the fish?** (the German). Later dates keep the generated 3–5 house puzzles.
- **Today is pinned to Einstein** via `TODAY_OVERRIDE = "einstein"` in `plotted-config.js` while we iterate. Progress, notes, and streak key off that puzzle’s date (`LAUNCH_DATE`), so they do not reset at midnight. Set the flag to `""` to restore calendar dailies. Dated JSON under `data/plotted/` is unchanged.
- **3 houses** on most generated days, **4** on harder days, **5** on occasional special Sundays.
- Generated days have **3 attributes** (for example person, pet, drink). Themes pick attributes from what Phosphor actually contains.
- Generated puzzles have **5–8 clues** that always lead to **exactly one** solution; Einstein day has the classic 15.
- **One question** to answer, while the player fills the whole grid.
- **Same puzzle for everyone** each local calendar day, served as JSON keyed by date.

## 2. Gameplay

Each house has one **text input** per attribute. The player types the exact word (for example `Bo`, `fish`, `Brit`, `Pall Mall`). Matching is case-insensitive and trims whitespace; light autocomplete lists that attribute’s valid words; unknown text gets a gentle highlight so typos are obvious. Placing the same word in another house on that attribute clears the old slot.

- Phosphor icons stay as **decorative** attribute / item markers, not as the placement UI. There is no bottom-sheet icon picker.
- **Notes** are one free-form scratchpad (a single textarea, no per-house fields), saved per puzzle date in `localStorage`. The pad is a rounded flat paper surface with no ruled lines and no gradients. On desktop the notes panel sits on the **left** and the puzzle (clues above the grid) on the **right**, both in the one-screen fit. On a phone the puzzle stays the main view and notes collapse into a toggle overlay.
- **Start over** (Phosphor `arrow-counter-clockwise`, next to Check/hint) asks for confirmation, then clears every grid entry and resets the timer and hint count. Notes stay unless the player also chooses to clear them. Only that puzzle’s progress resets; the streak is unchanged. A solved puzzle can be restarted for fun without counting again.
- A compact **word bank** sits above the grid, one line per category, listing every typeable word in IBM Plex Mono. Already-placed words are struck through. There is no picker sheet. The lists are flat (no gradients) and share the same standard type size as the clues and row headers.
- As the player types, the best matching valid word appears as **ghost** text inside the same input. Tab, Enter, right-arrow, or tapping the ghost remainder accepts it. There is no dropdown or datalist.
- **All clues are hints:** a compact numbered list **above** the grid. Sortable item words are **plain bold** in the normal ink color (no per-item, per-attribute, or per-house coloring in clues or inputs). Tap a line to cross it off. A hint also **auto-crosses** when the current grid makes it true.
- Every puzzle has a short **setup** line in the collapsible **How to play** block, in the Einstein vein (“There are five houses in a row…”). Einstein day keeps the classic paragraph.
- One-line helper: each house has one owner; type the bold words; next to means a neighboring house. A gold dashed outline means that word isn’t in this row.
- **Hint** fills one empty cell with the correct item and costs score.
- Completing the unique solution **solves immediately** (timer stops, tiles hop, results card, streak). **Check** is only for a full grid that might be wrong: it scores a mistake if it doesn’t match.
- Score is `max(0, 1000 − seconds − 50×mistakes − 120×hints)`.
- Streak calendar in `localStorage`. Timer starts on first type/hint/check.

### Generated clue voice

Generated clues follow Einstein’s 15: person-first subjects, a closed set of `CLUE_STYLE_TEMPLATES` per relation (same, next-to, directly-left, somewhere-left, position, either-or, not-next-to, not-same), and canonical subjects/verbs per category (pets **has a** / **the dog owner**, drinks **drink**, colors **the owner of the X house** or **the X house** on position clues, vehicles **drive/ride**, food **the X lover** in the singular). House places are always **the first/second/center/fourth/last house**, never **house N**. Objects never “live.” Each clue starts with a capital letter and one ending period. `validateClueStyle` (also exposed as `validateEinsteinStyle`) is a required publish check with uniqueness and `solvedByHuman`. Einstein day keeps classic house/cigar wording; pet lines use **has a** / **the X owner** (never **keeps** or **rears**). The validator bans **keeps** and **the person who keeps**.

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
5. Keep uniqueness via the CSP solver, then require a **human-style** solve (direct placement, elimination, singles, pairs, same-house/next-to/left-of/not, edge cases, then contradiction chains of depth 1–2). No backtracking search. Reject puzzles that still need a guess.
6. Rate difficulty by human step count plus the hardest technique tier. Prefer easier puzzles early in the week and harder ones on weekends.
7. Reject near-duplicate solutions and clue-type patterns seen earlier in the year.
8. Hand-check samples; schedule **one JSON file per date** under `data/plotted/YYYY-MM-DD.json`. No backend. Do not regenerate a dated file without checking it first.

The uniqueness solver is a domain-reduction CSP with all-different per attribute, then backtracking that stops at two solutions. New generated puzzles also have to be finished by the human-technique solver. Existing dated JSON is left as published unless an audit finds a uniqueness failure.

Precompute about a year at a time: `node scripts/generate-plotted.mjs`.

A **standalone practice set** of 23 puzzles lives under `data/practice/`, grouped by difficulty (easy through Expert). Twelve of them are late-2027 dailies copied in with new titles so they do not collide with upcoming days; the hard copies prefer 4–5 house grids. Five Expert puzzles are generated 5-house / 4-category grids whose hardest human step is contradiction. One more Expert copy (`sail-lane`) is a 5-house last-Sunday daily that already met the Hard/Expert bar. Pick one from the in-page menu or `?puzzle=<id>`. Practice uses separate `localStorage` keys, is not assigned to a date, and does not change the daily streak or share numbering (`Plotted practice · Easy`). Refresh with `node scripts/generate-practice.mjs`; the original five files are kept.

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

Keep **Fraunces** titles and **IBM Plex Mono** UI. The skin is Wordle-like: clean, bold, minimal, confident. No gradients.

- **Light:** flat warm paper `#fff6eb`, ink `#2a1f18`. **Dark:** plum-navy `#1a1230`, ink `#f8f1ff`.
- Square-ish tiles with crisp 2px solid borders and even gaps. Entries are bold uppercase. Color is reserved for **Check** feedback: correct `#6aaa64`, wrong `#c94c4c`.
- Simple centered header bar with a thin divider. Clue bold words stay in normal ink so they cannot leak the solution.
- Micro-interactions: pop when a word is committed, tile shake on an invalid word, Wordle-style flip on **Check**, celebratory bounce plus a results modal (time, streak, hints, score, Share) on solve. Honor `prefers-reduced-motion`.
- **Toggle** in the header; default is `prefers-color-scheme`; stored in `localStorage` (`plotted-theme`).

## 7. Icons

**No emoji in the app UI** and **no custom-drawn icons**. Emoji appear only in the **share paste**.

Use existing libraries only:

- **Phosphor Icons, duotone**, primary, vendored as SVG paths in `plotted-icons.js` and recolored with `currentColor` (house and attribute tints).
- **Tabler Icons** or **Lucide** as fallback if a future theme needs a glyph Phosphor lacks.

Build themes around what those sets actually contain (cat, dog, coffee, wine, detective, bicycle, and so on). Do not invent pictograms.

## 8. Mobile-first

- Compact centered header (title, reveal/check/start-over as icon buttons), **question prominent**, then **all clues**, the **word bank**, and a compact table (houses as columns, attributes as rows).
- Clue, word-bank, and row-header type is a **fixed size** (about 13px mono on phones, a modest step up on desktop) no matter how many hints there are. The fit-to-viewport step sizes tiles to the leftover space and may shrink clue type only if the standard size cannot fit; leftover height stays below the grid, never as a gap above the hints. Centered column ~720–900px.
- Mobile-first portrait: 16px inputs (no zoom-on-focus), `autocapitalize=none`. Ghost completion stays inside the tile. No horizontal clue carousel.
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

1. Generator + uniqueness solver in JS (`plotted-engine.js`) with tests (`scripts/test-plotted.mjs`, `scripts/test-plotted-dom.mjs`).
2. Small web app: grid, clues, timer, hint, check, plain-text share.
3. Daily puzzle JSON by date (`data/plotted/YYYY-MM-DD.json`).
4. Playtest with ~10 friends and tune the weekday curve.
5. Launch on this host; later add accounts, leaderboard, and a puzzle archive.

Existing Plotmaniac regression tests remain: `node scripts/test-never-ending-internet-lore.mjs` (paths retargeted at `archive/`).
