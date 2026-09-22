# Wars scrubber map

**When to use:** Global **conflicts since 1900** on a world map with a **year span** scrubber, arcs between opposing states, and per-country war lists.

**Exemplar plot on main:** `wars`

## `plots.json` fields

| Field | Required | Example |
| --- | --- | --- |
| `arrangement` | yes | `"wars"` |
| `centerId` | yes | `"wars"` (synthetic center in `people.json`) |
| `friendKinds` / `enemyKinds` | yes | `[]` (map does not use friend camps) |
| `year` | yes | `{ "min": 1900, "max": 2026, "initial": 2026, "marks": [...] }` |
| `yearHint` | optional | Span scrubber helper |
| `sources` | optional | `[{ "label", "url" }]` bibliography |
| `paths.people` / `events` / `relations` | yes | Minimal stubs if unused |
| `paths.conflicts` | yes | `data/wars/conflicts.json` |
| `paths.world` | yes | `data/world-countries.json` (GeoJSON `FeatureCollection`) |

## `conflicts.json` shape

Top-level:

- `countries` — map of ISO-like codes → `{ "name" }`
- `conflicts` — array of wars

Per conflict:

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Stable slug |
| `name` | yes | Display title |
| `start` / `end` | yes | Integer years |
| `wikipedia` | recommended | Article URL |
| `sides` | yes | Array of belligerent groups |

Each side:

```json
{
  "states": ["US", "GB"],
  "groups": ["Optional non-state label"]
}
```

- **Civil wars:** single country in one side — marks the country, **no outbound arc**.
- **Former states:** drawn on the modern country that holds their capital (see build script).

## Rebuild script

Regenerate conflicts from English Wikipedia war lists:

```bash
python3 scripts/build-wars.py
```

Writes `data/wars/conflicts.json` and refreshes `data/world-countries.json`. Direct belligerents only; support/allegation sections in Wikipedia are excluded by design (see script header).

## UI behavior

- Board: world map fitted to the window; **From** / **To** year controls keep wars overlapping the span (`warOverlapsSpan`).
- One **arc** per opposing state pair per active war.
- **Country click:** list of wars in span, each linked to Wikipedia.
- Default view is the map (`boardViewForPerson` forces web).
- **Mobile:** map above scrolling list; year marks scroll sideways.
- Gallery card uses map face when `cardImage` points at a blank world SVG.

## Verification

```bash
node scripts/test-never-ending-internet-lore.mjs
```

War span, arc, and country-list helpers are covered in the same script.

## Out of scope

- Pre-1900 conflicts unless you extend `year.min` and sources.
- Bilateral diplomacy timelines — [country-regions-bilateral-timeline.md](country-regions-bilateral-timeline.md).
- Person relationship webs.
