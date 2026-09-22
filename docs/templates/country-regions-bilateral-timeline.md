# Country regions + bilateral timeline

**When to use:** A **country-centered** foreign-relations snapshot: major allies and foes on first load, every other relationship behind **region** disclosure, each country clickable into a bilateral timeline (stub or rich).

**Exemplar plot on main:** `united-states`

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

### `countries.json` (array)

Core fields (see also [country-relation-timeline-template.md](../country-relation-timeline-template.md)):

| Field | Required | Notes |
| --- | --- | --- |
| `country` | yes | Display name |
| `slug` | yes | URL `?country=<slug>` |
| `status` | yes | `friend`, `foe`, or `neutral` |
| `outline` | yes | `green`, `red`, or `none` |
| `region` | yes | Region name for disclosure chips |
| `first_load` | yes | `true` for majors on the initial board |
| `timeline` | yes | `[{ "year", "event" }, …]` oldest first |
| `wiki_bilateral` | recommended | Wikipedia fallback link |
| `notes_summary` | recommended | One-sentence arc |
| `tone` | optional per beat | −2…+2 for sentiment chart |
| `links` | optional per beat / country | `{ "label", "url" }` chips |

**Rich bilateral upgrade:** Follow the full workflow in **[country-relation-timeline-template.md](../country-relation-timeline-template.md)** (Mexico, Russia, Iran exemplars). Example sketch: [country-relation-timeline.example.json](../country-relation-timeline.example.json).

Thin stubs (year + event only) remain valid; the UI must not require `tone` or `links`.

### `events.json` / `relations.json`

Optional narrative layer for the plot center; the field view is driven primarily by `countries.json`.

## UI behavior

- **First load:** Only `first_load` **friends** and **foes** (green/red ring on circular flags). Neutrals hidden until a region opens.
- **Lines:** Center to each visible country — green/red/gray by stance; sparse gold links for shared blocs (`RELATION_BLOCS`, e.g. NATO).
- **Region pick:** **Exclusive** — replaces majors with **all** countries in that region (friends, foes, neutrals), reflowed across the stage. Toggle same region again to return to majors.
- **Country click:** Bilateral timeline drawer / full relation page; rich `tone` enables sentiment chart (`relationTimelineHasTone`).
- **Mobile:** Timeline-first entry; relation pages support escape/back stack.

## Verification

```bash
node scripts/test-never-ending-internet-lore.mjs
```

Asserts US `disclosure`, `first_load` majors, Mexico/Russia/Iran tone timelines, and stub countries without `links`.

## Out of scope

- Time-varying ally/foe on the **field** (use [country-camps-year-scrubber.md](country-camps-year-scrubber.md) for year-scrubbed camps).
- Wars map — [wars-scrubber-map.md](wars-scrubber-map.md).
