# Plotted

A daily logic grid in the Plotmaniac field-guide look. Three (sometimes four or five) houses, three attributes, five to eight clues, one unique solution, one question. Everyone gets the same puzzle each local day.

Play it at [https://plotmaniac.com](https://plotmaniac.com). Product plan: [docs/plotted-plan.md](docs/plotted-plan.md). The display name is `GAME_NAME` in [`plotted-config.js`](plotted-config.js).

Tap a slot, pick a Phosphor icon, long-press to rule a symbol out. Clues are swipeable cards. Score is time, mistakes, and hints. The share result is plain text (clipboard / Web Share), not an image:

```
Plotted #12
🏠🏠🏠🏠🏠
2️⃣3️⃣1️⃣5️⃣4️⃣
Solved in 2:45
https://plotmaniac.com
```

Light and dark follow the system unless you toggle them. The day’s puzzle is static JSON (`data/plotted/YYYY-MM-DD.json`) and the app is an installable PWA.

## Plotmaniac archive

The original Plotmaniac gallery — people webs, Marvel watch order, maps, SCOTUS boards — is unchanged in behavior and kept at **[https://plotmaniac.com/archive/](https://plotmaniac.com/archive/)**. Source lives under [`archive/`](archive/). Links of the form `/?plot=marvel-universe` still work: the root page forwards them to `/archive/?plot=…`.

Plot authoring templates: [docs/templates/](docs/templates/). They describe files that now sit in `archive/data/`.

## Local

```bash
python3 -m http.server 8000
```

Then [http://localhost:8000](http://localhost:8000) for Plotted and [http://localhost:8000/archive/](http://localhost:8000/archive/) for the field guide.

```bash
node scripts/test-plotted.mjs
node scripts/test-never-ending-internet-lore.mjs
node scripts/generate-plotted.mjs
```

## Hosting

Production is **GitHub Pages**, deployed from `main` by [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

- **Custom domain:** [https://plotmaniac.com](https://plotmaniac.com) (`CNAME` in the repo root)
- **Fallback:** [https://inaayat.github.io/plotmaniac/](https://inaayat.github.io/plotmaniac/)

No build step: the workflow uploads the repository root. **Vercel** is deprecated for this project.
