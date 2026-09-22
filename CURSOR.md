# Plotmaniac — agent context

Static single-page app: `index.html` at the repo root, ES modules in `app.js`, `engine.js`, plot-specific views, and JSON under `data/`.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Shell, gallery, plot chrome |
| `app.js` | Boot, routing (`?plot=`, `?view=`), gallery |
| `engine.js` | Shared plot engine (webs, timelines, country field) |
| `data/plots.json` | Plot registry |
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
