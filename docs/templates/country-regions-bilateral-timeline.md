# Country regions field (foreign-relations board)

**When to use:** A **country-centered** foreign-relations **board**: major allies and foes on first load, every other relationship behind **region** disclosure, each flag opening that country’s bilateral view.

**Exemplar plot on main:** `united-states`

**Pair with:** [country-bilateral-timeline.md](country-bilateral-timeline.md) — the **detailed** drawer/ride (Mexico, Russia, Iran) is its own template. The board and the deep timeline are two reusable elements on the same plot.

## `plots.json` fields

| Field | Required | Example |
| --- | --- | --- |
| `centerId` | yes | `"united-states"` (must exist in `people.json`) |
| `disclosure` | yes | `"regions"` |
| `images` | yes | `"flags"` |
| `friendKinds` | yes | `["ally"]` |
| `enemyKinds` | yes | `["foe"]` |
| `orbitLabel` | optional | `"Neutral"` |
| `paths.people` / `events` / `relations` | yes | Center + per-country people stubs |
| `paths.countries` | yes | `data/united-states/countries.json` |

No `arrangement` — disclosure drives the board (`document.body.dataset.board` = `regions`).

## Data files

### `people.json`

- Plot **center** country with `portrait.frame: "flag"` when using Commons flag art.
- One person record per country (slug aligns with `countries.json` `slug`) for search and timeline routing.

### `countries.json` (array) — board + click target

Every country needs board fields so it can appear on the field and open a timeline:

| Field | Required | Notes |
| --- | --- | --- |
| `country` | yes | Display name |
| `slug` | yes | URL `?country=<slug>` |
| `status` | yes | `friend`, `foe`, or `neutral` |
| `outline` | yes | `green`, `red`, or `none` |
| `region` | yes | Region name for disclosure chips |
| `first_load` | yes | `true` for majors on the initial board |
| `timeline` | yes | At minimum `[{ "year", "event" }, …]` oldest first |

**After click — two depths:**

| Depth | When | Doc |
| --- | --- | --- |
| **Thin stub** | Neutrals and minor relationships | Few `year`/`event` rows; no `tone` or beat `links` |
| **Detailed bilateral** | Flagship relationships | `notes_summary`, full `timeline[]` with `tone` and `links`, country-level `links` — [country-bilateral-timeline.md](country-bilateral-timeline.md) |

Research workflow for rich records: [country-relation-timeline-template.md](../country-relation-timeline-template.md). Example sketch: [country-relation-timeline.example.json](../country-relation-timeline.example.json).

### `events.json` / `relations.json`

Optional narrative layer for the plot center; the field view is driven primarily by `countries.json`.

## UI behavior (board only)

- **First load:** Only `first_load` **friends** and **foes** (green/red ring on circular flags). Neutrals hidden until a region opens.
- **Lines:** Center to each visible country — green/red/gray by stance; sparse gold links for shared blocs (`RELATION_BLOCS`, e.g. NATO).
- **Region pick:** **Exclusive** — replaces majors with **all** countries in that region (friends, foes, neutrals), reflowed across the stage. Toggle same region again to return to majors.
- **Country click:** Opens bilateral UI (stub drawer or detailed ride — see [country-bilateral-timeline.md](country-bilateral-timeline.md)).
- **Mobile:** Timeline-first plot entry; relation pages support escape/back stack.

## Verification

```bash
node scripts/test-never-ending-internet-lore.mjs
```

Asserts US `disclosure`, `first_load` majors, Mexico/Russia/Iran detailed timelines, and stub countries without `links`.

## Out of scope

- Authoring a flagship bilateral record (detailed template above).
- Time-varying ally/foe on the **field** — [country-camps-year-scrubber.md](country-camps-year-scrubber.md).
- Wars map — [wars-scrubber-map.md](wars-scrubber-map.md).
