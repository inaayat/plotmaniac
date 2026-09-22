# Historical map field guide

**When to use:** A **history** plot where the page is a compact map plus players, princely states, and a researched chronology — not a standard people/events/relations web.

**Exemplar plot on main:** `partition-of-india`

## `plots.json` fields

| Field | Required | Notes |
| --- | --- | --- |
| `arrangement` | yes | **`"historical-map"`** (exact string; `app.js` and tests key off this) |
| `centerId` | yes | Primary player id for chrome (e.g. `"jinnah"`) |
| `friendKinds` / `enemyKinds` | yes | May be empty arrays `[]` when the board is not a friend/foe web |
| `paths.reference` | yes | Research JSON (see below) |
| `paths.portraits` | optional | Wikimedia portrait map by player id |
| `sourceNote` | recommended | Footer provenance |

**No** `paths.people`, `events`, or `relations` — loader fetches only `reference` (+ optional `portraits`).

## Data files

### `paths.reference` (e.g. `data/partition-of-india/reference.json`)

Large structured research file consumed by `partition-model.js` / `partition-view.js`. Top-level sections include:

- `schemaVersion`, `title`, `scope`, `sourcesCatalog`
- `keyPlayers` — roster with ids, roles, allegiances, incentives, positions
- Timeline / frame data for map years and beats
- Princely states, geography overlays (Kashmir claims, etc.)

Treat Partition as the **authoritative shape**; new historical plots should fork the file and trim scope in `scope.included` / `scope.excluded`.

### `paths.portraits` (optional)

JSON object keyed by player `id` → Commons attribution objects (`src`, `page`, `author`, `license`, `licenseUrl`). Players without an entry get monograms.

## UI behavior

- **Web tab:** Compact coastline map, regions, year slider, princely states, optional Kashmir claims overlay. Pakistan and Bangladesh keep full outlines.
- **People:** Opens a **full-width reading page** — identity header, who agreed beside it, wanted/feared/positions/actions; switching players updates in place.
- **Full timeline:** Researched chronology across the width; beats name other players and incentives.
- **Mobile:** Short title, full-width player rows, sideways-scroll year ticks.
- Loading copy: “Drawing the map…”

Views: `web`, `person`, `timeline` (not the standard person-web lane).

## Verification

```bash
node scripts/test-never-ending-internet-lore.mjs
```

Includes partition `arrangement === "historical-map"` and frame/player assertions.

## Out of scope

- Live GeoJSON wars arcs — [wars-scrubber-map.md](wars-scrubber-map.md).
- Standard `people.json` + relationship web — [person-web-timeline.md](person-web-timeline.md).
- Automated rebuild script for reference JSON (manual research workflow).
