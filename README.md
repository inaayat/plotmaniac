# Plotmaniac

A dark field guide. The homepage is a compact gallery of equal-height plot cards with a quiet search (`/` focuses it). Pick a person or a country, then read the web of friends and foes or the timeline under it. On a person’s web, people with more timeline beats sit closer to the center, and the ring still refits when the window changes. YouTubers is the person plot: one shared web for the H3, Vlog Squad, Trisha Paytas, and Jeffree Star orbits, with a Focus control. None is the default: the web shows the hubs and people tied to more than one hub, and the timeline shows every beat. All draws every person who belongs on that web. Choosing Ethan Klein, David Dobrik, Trisha Paytas, or Jeffree Star reads that timeline and adds the people tied only to that hub. The view eases its zoom so the people in the current focus fill the page. On a hub web you can also zoom with the slider, the + and − buttons, or Control-scroll, and drag to pan; Fit puts the current field back on the page. Names stay inside their cell so they do not run over a neighbor. People tied to more than one hub sit in the center. The hubs sit just outside that cluster. People tied to only one hub appear farther out beside that hub, on All and while that hub is the focus. Someone with a single timeline beat stays off the web. On a phone, that web fits the map, and names sit in a list under it. The United States plot is a current snapshot of foreign relations. Major allies (green outline) and major foes (red outline) fill the first view. Every flag is a circle, and the friend or foe outline is a ring around that circle. Neutrals have no ring. A line runs from the United States to each visible country: green-tinted for friends, red-tinted for foes, and gray for neutrals. Shared alliances such as NATO and Five Eyes add a thinner gold link between those countries, kept to a sparse tree so the first view stays readable. Choosing one region replaces the majors view with that region’s complete set of friends, foes, and neutrals, reflowed across the full field; choosing it again returns to the majors. Major countries within the selected region stay closer to the United States. Choosing a country opens its relationship timeline.

The timeline spans the browser width on a large screen. Zoom with the slider, the + and − buttons, or Control-scroll. Fit scales the whole line into the window. An opened beat stays inside that lane, summary and sources included, without a scrollbar on the card. On a phone, the same timeline becomes a vertical chronological scroll.

On a phone, opening a plot starts on the full timeline. The web is still a tap away; on a narrow screen it pans, and names sit in a list under the map so they do not clip. A wide screen still opens on the web. Shared `?view=` links and a saved tab choice keep their place.

Serve the folder locally:

```bash
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000).

Check the archive with:

```bash
node scripts/test-never-ending-internet-lore.mjs
```

## Hosting

Production is **GitHub Pages**, deployed from `main` by [`.github/workflows/pages.yml`](.github/workflows/pages.yml) (GitHub Actions only — feature branches do not publish).

- **Custom domain:** [https://plotmaniac.com](https://plotmaniac.com) (`CNAME` in the repo root)
- **Fallback until DNS points here:** [https://inaayat.github.io/plotmaniac/](https://inaayat.github.io/plotmaniac/)

No build step: the workflow uploads the repository root as a static site (`index.html`, assets, and `data/`). Query-string routes such as `?plot=` work without server rewrites.

**Vercel** was used earlier for hosting; it is deprecated for this project. You do not need a Vercel project to run or deploy Plotmaniac.

First-time repo setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The workflow passes `enablement: true` to `configure-pages` so the first run can turn Pages on when the token allows it; if that step still fails, use the same Settings path once, then re-run **Deploy GitHub Pages**. Custom domain `plotmaniac.com` comes from the root `CNAME` file in the deployed artifact; if the domain is missing, set **Custom domain** to `plotmaniac.com` under **Settings → Pages** (API may return 403 for automation tokens).

## Plot templates

Start here when adding a plot. Each template lists the `data/plots.json` fields the loader reads today, the files under `data/<id>/`, JSON shapes with short examples, UI behavior, and how to verify with the test script above.

Shared gallery, search, tabs, portraits, and `paths` keys: [docs/templates/shared-chrome.md](docs/templates/shared-chrome.md).

| Template | One line | Doc | Exemplar plot id(s) |
| --- | --- | --- | --- |
| Person web + timeline | Single-center cast; friends/foes web and full timeline | [docs/templates/person-web-timeline.md](docs/templates/person-web-timeline.md) | *(base shape — copy `youtubers` files; omit `hubs` for one center)* |
| Multi-hub focus | `hubs` + event `hubs`; None / All / named focus | [docs/templates/multi-hub-focus.md](docs/templates/multi-hub-focus.md) | `youtubers`, `marvel-universe` |
| Policy topics bubbles | Topic wedges, stance year scrubber, side panel | [docs/templates/policy-topics-bubbles.md](docs/templates/policy-topics-bubbles.md) | `barack-obama`, `jd-vance` |
| Country regions field | `disclosure: regions`, majors, exclusive region reveal | [docs/templates/country-regions-bilateral-timeline.md](docs/templates/country-regions-bilateral-timeline.md) | `united-states` |
| Country bilateral timeline (detailed) | Drawer/ride beats with tone, chips, and sources per country | [docs/templates/country-bilateral-timeline.md](docs/templates/country-bilateral-timeline.md) | `mexico`, `russia`, `iran` (on `united-states`) |
| Historical map field guide | `arrangement: historical-map`, reference + portraits | [docs/templates/historical-map-field-guide.md](docs/templates/historical-map-field-guide.md) | `partition-of-india` |
| Wars scrubber map | World map, year span, conflict arcs | [docs/templates/wars-scrubber-map.md](docs/templates/wars-scrubber-map.md) | `wars` |
| Country camps + year scrubber | Dated ally/foe left/right camps (engine-ready) | [docs/templates/country-camps-year-scrubber.md](docs/templates/country-camps-year-scrubber.md) | *(none on main yet)* |

**Also indexed:** Bilateral research checklist — [docs/country-relation-timeline-template.md](docs/country-relation-timeline-template.md) (companion to the detailed country timeline template). Marvel hub design — [docs/marvel-universe-plot.md](docs/marvel-universe-plot.md).

## Add another plot

1. Pick a template from the table above and create `data/<id>/` with the files that template requires (most person plots use `people.json`, `events.json`, and `relations.json` like `data/youtubers/`).
2. Register the plot in `data/plots.json`: `id`, `title`, `kicker`, `cardLine`, `lede`, `centerId`, `friendKinds`, `enemyKinds`, and `paths`. Add arrangement-specific fields from the template (`hubs`, `disclosure`, `arrangement`, `topics`, `year`, etc.).
3. Open `?plot=<id>` to preview. With more than one plot registered, the site opens on the picker; `?plot=h3` still opens YouTubers via `aliases`.

Quick reference (details live in the templates):

- **Multi-hub** — `hubs` array (`id`, `label`, `centerId`); tag events with `hubs: ["h3"]`; optional `includeOrbit`, `minBeats`, `hubNoneLabel` / `hubAllLabel`. See [multi-hub-focus.md](docs/templates/multi-hub-focus.md) and [marvel-universe-plot.md](docs/marvel-universe-plot.md).
- **Portraits** — Commons `portrait` on a person, or `paths.portraits` on historical-map plots; `portrait.frame: "flag"` with `images: "flags"` for countries.
- **Policy topics** — `arrangement: "topics"`, `images: "bubbles"`, `topics[]`, `year` range; relations use `supported` / `opposed` with `start` / `end` years.
- **Country regions field** — `disclosure: "regions"`, `images: "flags"`, `paths.countries`; `first_load` majors; exclusive region reveal — [country-regions-bilateral-timeline.md](docs/templates/country-regions-bilateral-timeline.md).
- **Country bilateral timeline (detailed)** — per-country record in `countries.json`: `notes_summary`, `timeline[]` with `year`/`event`/`tone`/`links`, country `links` — [country-bilateral-timeline.md](docs/templates/country-bilateral-timeline.md); research depth in [country-relation-timeline-template.md](docs/country-relation-timeline-template.md).
- **Historical map** — `arrangement: "historical-map"` (exact string), `paths.reference`, optional `paths.portraits` (Partition-style).
- **Wars** — `arrangement: "wars"`, `year` range, `paths.conflicts` and `paths.world`; rebuild with `scripts/build-wars.py`.
- **Camps (optional)** — `arrangement: "camps"` and dated `ally` / `foe` relations; foes left, friends right. No live plot yet — [country-camps-year-scrubber.md](docs/templates/country-camps-year-scrubber.md).

Friend and enemy placement comes from each person’s relationship to the active center. A feud or lawsuit outweighs an older collaboration. Everyone else sits in “Around the sphere” on the YouTubers web when `includeOrbit` is true, or the plot’s `orbitLabel` elsewhere. Dated relations are ignored on the default web until a year scrubber plot (`topics` or `camps`) selects a year.
