# Shared plot chrome

Every plot is one entry in `data/plots.json` plus the files its `paths` object points at. This note covers fields and behaviors that are the same across arrangements.

## Gallery card (`plots.json`)

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | URL slug; `?plot=<id>` opens the plot. |
| `title` | yes | Page title and picker label. |
| `kicker` | yes | Gold label on the card (e.g. People, Person, Country, History, Map, Marvel). |
| `cardLine` | yes | One-line blurb under the title on the card. |
| `lede` | yes | Intro paragraph under the plot title on the plot page. |
| `searchPlaceholder` | recommended | Hint in the plot search box. |
| `cardImage` | optional | Wikimedia Commons URL for the card face. Omit for a monogram (`plotCardFace` → `mono`). |
| `aliases` | optional | Extra `?plot=` tokens (e.g. `h3` → YouTubers). |
| `sourceNote` | optional | Footer line; defaults to “Plotmaniac”. |

Card image treatment: wars plots use a map face; `images: "flags"` uses a flag frame; other `cardImage` plots use a person crop.

## Search

Homepage search matches `title`, `kicker`, `cardLine`, and `lede` (`plotMatchesQuery`). Press `/` to focus the search field.

Inside a plot, search filters people, events, and (where relevant) countries by name and copy.

## Web vs timeline tabs

- **Wide screens** default to **Web** (or the arrangement’s board: map, topics wedges, etc.).
- **Narrow screens** default to **Full timeline** (or the arrangement’s chronological view).
- `?view=web` or `?view=timeline` share a specific tab; the UI remembers the last tab per plot when possible.
- Policy (`arrangement: "topics"`) and wars keep policy/map on the web tab; opening a “person” on a topics plot stays on the board (`boardViewForPerson`).

## Portraits and monograms

On **people** records, optional `portrait`:

```json
{
  "src": "https://commons.wikimedia.org/wiki/Special:FilePath/Example.jpg?width=480",
  "page": "https://commons.wikimedia.org/wiki/File:Example.jpg",
  "author": "Photographer name",
  "license": "CC BY 2.0",
  "licenseUrl": "https://creativecommons.org/licenses/by/2.0/"
}
```

- Only use files that are freely licensed on Wikimedia Commons.
- `portrait.frame: "flag"` with plot `images: "flags"` draws a rectangular flag (see United States).
- Missing portrait → monogram from initials.

Historical-map plots may instead use `paths.portraits` (see [historical-map-field-guide.md](historical-map-field-guide.md)).

## Friend / enemy kinds (person and country plots)

`friendKinds` and `enemyKinds` are lists of `kind` strings on **relations** from each node to the active **center** (`centerId`, or a hub’s `centerId` when a hub is focused).

- If any active relation to the center matches an `enemyKinds` entry, the person/country is a **foe** (enemy precedence over older friends).
- Else if any matches `friendKinds`, they are a **friend**.
- Else they land in **orbit** when `includeOrbit: true`, labeled with `orbitLabel` (e.g. “Around the sphere”, “Neutral”).

Optional copy overrides: `friendLabel`, `enemyLabel`, `friendCountOne` / `friendCountMany`, `enemyCountOne` / `enemyCountMany`.

Dated relations (`start`, optional `end` as year strings) apply only when a year is selected (`coversYear`); undated relations count at any year.

## `paths` (standard person/country/wars bundle)

| Key | When |
| --- | --- |
| `people` | Always for non–historical-map plots. |
| `events` | Always for non–historical-map plots. |
| `relations` | Always for non–historical-map plots. |
| `countries` | Country region plots (`disclosure: "regions"`). |
| `conflicts` | Wars plot (`arrangement: "wars"`). |
| `world` | GeoJSON for wars map (`data/world-countries.json`). |
| `reference` | Historical-map plot only. |
| `portraits` | Optional historical-map portraits file. |

## Verification

```bash
node scripts/test-never-ending-internet-lore.mjs
```

The script loads `data/plots.json`, exercises layout helpers, and asserts invariants on live plots (YouTubers hubs, US regions, Mexico/Russia/Iran timelines, wars span, partition frames, etc.). Run it after any data or manifest change; docs-only edits do not require it, but new plots should pass before merge.

## Out of scope here

- Picker behavior when only one plot is registered (site opens that plot).
- Partition / wars rendering internals in `app.js` — see the arrangement template for each plot type.
