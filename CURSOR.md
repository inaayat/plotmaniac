# Plotmaniac / Plotted — agent context

**Plotted** is the site at the repo root: a daily logic-grid game (`index.html`, `plotted.js`, `plotted-engine.js`, JSON under `data/plotted/`). Display name: `GAME_NAME` in `plotted-config.js`.

The older Plotmaniac field guide is archived (not deleted) under `archive/`: `archive/index.html`, ES modules, plot views, and JSON under `archive/data/`. Old `?plot=` URLs at the domain root redirect into `/archive/`.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Plotted shell (theme boot, `?plot=` redirect, PWA) |
| `plotted.js` | Game UI: typed slots, hint list, scratchpad notes, timer, share text |
| `plotted-engine.js` | CSP uniqueness solver, generator, share formatter |
| `plotted-human-solver.js` | Named human deduction techniques used to grade generated puzzles |
| `plotted-config.js` | `GAME_NAME` and storage keys |
| `plotted-icons.js` | Vendored Phosphor duotone paths |
| `plotted-themes.js` | Daily themes built from those icons |
| `data/plotted/YYYY-MM-DD.json` | One puzzle per date |
| `data/practice/` | Standalone easy→hard set (`?puzzle=<id>`), separate storage |
| `docs/plotted-plan.md` | Product plan |
| `archive/index.html` | Plotmaniac gallery + plot chrome |
| `archive/app.js` | Boot, routing (`?plot=`, `?view=`), gallery |
| `archive/engine.js` | Shared plot engine |
| `archive/data/plots.json` | Plot registry |
| `scripts/test-plotted.mjs` | Solver, share text, icon, archive-path checks |
| `scripts/test-plotted-dom.mjs` | happy-dom: index.html paints Einstein + generated days, ghost completion |
| `scripts/generate-plotted.mjs` | Precompute a year of JSON |
| `scripts/generate-practice.mjs` | Rebuild the five practice puzzles |
| `scripts/test-never-ending-internet-lore.mjs` | Plotmaniac archive / UI regression checks |

Plotmaniac details (Marvel chronology, gun boards, templates) still apply to files under `archive/`. Templates live in `docs/templates/` and still describe `data/<id>/` paths relative to the **archive** app (those files are now `archive/data/<id>/`).

## Local dev

```bash
python3 -m http.server 8000
node scripts/test-plotted.mjs
node scripts/test-plotted-dom.mjs
node scripts/test-never-ending-internet-lore.mjs
```

Plotted: [http://localhost:8000/](http://localhost:8000/). Archive: [http://localhost:8000/archive/](http://localhost:8000/archive/).

## Deploy

GitHub Pages from **`main`** via `.github/workflows/pages.yml`. Custom domain: `plotmaniac.com` (`CNAME`). Fallback URL: `https://inaayat.github.io/plotmaniac/`. No build step: the workflow uploads the repository root.
