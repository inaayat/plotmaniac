# Plotmaniac — agent context

Static single-page app: `index.html` at the repo root, ES modules in `app.js`, `engine.js`, plot-specific views, and JSON under `data/`.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Shell, gallery, plot chrome |
| `app.js` | Boot, routing (`?plot=`, `?view=`), gallery. Homepage cards use `plotChooserHref` so Marvel opens Watch Order (`view=timeline`). |
| `engine.js` | Shared plot engine (webs, timelines, country field, chronology helpers, `plotChooserHref`) |
| `data/plots.json` | Plot registry |
| `data/marvel-universe/chronology.json` | MCU + Mutant Legacy watch-order titles, `kind` (`movie` \| `tv`), cast, prereqs, optional TMDB `posterUrl` |
| `data/marvel-universe/character-index.md` | Wikipedia MCU character index (appearances used to overlay chronology casts) |
| `scripts/marvel-character-index.mjs` | Parse the index and map appearances onto chronology titles + `people.json` ids |
| `scripts/enrich-marvel-chronology-posters.mjs` | Bakes TMDB posters into chronology (`TMDB_API_KEY` env only; CI skips) |
| `marvel-chronology-view.js` | Marvel default: Watch Before / Selected / Watch Next focus layout with circular cast and block arrows. Chronology nav opens `?view=chronology`, a scrollable poster timeline. Cast avatars open that character’s timeline; Marvel has no character-web screen |
| `presidential-doctrines-view.js` | Single-page scroll layout for U.S. presidential doctrines |
| `data/us-presidential-doctrines/` | Doctrine summary data (`arrangement: doctrine-summary` in `plots.json`) |
| `data/gun-regulation/` | SCOTUS gun-rights board (federal timeline, checklist, exemplars) |
| `data/gun-laws-by-state/` | Separate state-law plot: Wikipedia snapshot, filter labels, Albers map paths |
| `scripts/build-states-wikipedia-snapshot.mjs` | Wikipedia → `states-snapshot.json` + `docs/gun-laws-by-state-table.md` |
| `scripts/test-never-ending-internet-lore.mjs` | Archive / UI regression checks |
| `docs/templates/` | Plot authoring templates |

## Local dev

```bash
python3 -m http.server 8000
node scripts/test-never-ending-internet-lore.mjs
```

## Deploy

GitHub Pages from **`main`** via `.github/workflows/pages.yml`. Custom domain: `plotmaniac.com` (`CNAME`). Fallback URL: `https://inaayat.github.io/plotmaniac/`. Vercel is deprecated for hosting; no build step required.
