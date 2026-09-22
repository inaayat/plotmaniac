# Country bilateral timeline (detailed view)

**When to use:** Upgrade **one country record** inside `paths.countries` into a deep bilateral history — drawer and full **relation ride** with narrative beats, warmth **tone** chart, per-beat source chips, and country-level **Sources**. This is not a separate `plots.json` arrangement; it is the **per-country payload** readers open after clicking a flag on a country plot.

**Exemplar countries on main** (`united-states` → `data/united-states/countries.json`):

| Slug | Notes |
| --- | --- |
| `mexico` | Neighbors, trade, migration arc (~28 beats) |
| `russia` | Empire → Soviet → Russian Federation (~35 beats) |
| `iran` | Recognition through modern sanctions (~36 beats) |

Thin stubs (Afghanistan-style: `year` + `event` only) stay valid on the same board; the UI does not require `tone` or `links`.

## How this relates to the regions board

Two layers on one plot (see [country-regions-bilateral-timeline.md](country-regions-bilateral-timeline.md)):

| Layer | What it is | Data |
| --- | --- | --- |
| **Regions field** | Majors on first load, region disclosure, flag web, `?country=` routing | Plot `disclosure: "regions"`, `images: "flags"`, whole `countries.json` |
| **Bilateral timeline** | What opens for that country — stub list **or** this detailed timeline | **One object** in `countries.json` for that `slug` |

Quick build path:

1. Register the plot with the regions template (board + `paths.countries`).
2. Add or upgrade **individual country objects** using this template when the relationship deserves a ride, not only a drawer list.

## Where the record lives

Single array entry in `data/<plot-id>/countries.json` (no extra file per country). Keep board fields the regions template already requires:

`country`, `slug`, `wiki_bilateral`, `wiki_pdf`, `recognition_date`, `status`, `outline`, `formal_relations`, `region`, `first_load`

## Required and rich fields (quick build)

| Field | Rich bilateral | Thin stub |
| --- | --- | --- |
| `notes_summary` | **yes** — one vivid sentence for the arc | optional |
| `timeline` | **yes** — oldest first, **~25–40** beats for a flagship | **yes** — few `year`/`event` rows |
| `timeline[].year` | **yes** — string; ranges like `"1942–1964"` OK (chart uses first year) | **yes** |
| `timeline[].event` | **yes** — one narrative sentence | **yes** |
| `timeline[].tone` | **yes** on every beat (−2…+2) so the chart has no holes | omit |
| `timeline[].links` | most beats — `{ "label", "url" }`, `https://` | omit |
| `links` (country-level) | **yes** — bilateral wiki + 1–2 primary overviews | omit |

Use the field name **`links`** only (not `sources`, `citations`, or `refs`) unless you change `renderCountryHistory` / `renderRelationRide` in app code.

### Minimal rich beat

```json
{
  "year": "1942",
  "event": "The two governments coordinate as wartime allies after Pearl Harbor.",
  "tone": 2,
  "links": [
    {
      "label": "Office of the Historian — Mexico",
      "url": "https://history.state.gov/countries/mexico"
    }
  ]
}
```

### Country-level sources block

```json
"links": [
  {
    "label": "Mexico–United States relations",
    "url": "https://en.wikipedia.org/wiki/Mexico%E2%80%93United_States_relations"
  },
  {
    "label": "A Guide to the United States' History of Recognition, Diplomatic, and Consular Relations, by Country, since 1776: Mexico",
    "url": "https://history.state.gov/countries/mexico"
  }
]
```

`wiki_bilateral` still powers “Read more on Wikipedia”; country `links` can repeat it with a clearer label.

### Tone scale (−2 to +2)

| Value | Meaning |
| --- | --- |
| **+2** | Strongly warm — wartime alliance, landmark treaty, deep reset |
| **+1** | Warm — recognition, cooperation |
| **0** | Mixed / transactional |
| **−1** | Strained — sanctions prelude, public clash |
| **−2** | Strongly strained — war, occupation, rupture |

## UI behavior (drawer + ride)

- **Drawer** (`renderCountryHistory`): beat list; chips from `timeline[].links`; **Sources** from country `links`; Wikipedia fallback from `wiki_bilateral`.
- **Sentiment chart** when any beat has numeric `tone` (`relationTimelineHasTone`).
- **Full relation page / ride** (`renderRelationRide`): same beats with warmth chart; rider flags — partner flag left, plot center right (`relationRiderFlags`); chips follow the active beat.
- Stubs without `tone` look as before (no chart required).

## Example JSON

Sketch file: [country-relation-timeline.example.json](../country-relation-timeline.example.json)

## Research workflow, coverage checklist, and QA

Long-form research steps, major-relationship checklist, and copy rules:

**[country-relation-timeline-template.md](../country-relation-timeline-template.md)**

## Verification

```bash
node scripts/test-never-ending-internet-lore.mjs
```

Asserts Mexico, Russia, and Iran tone-bearing timelines, https links on a majority of beats, and that countries without `links` still load.

## Out of scope

- Redesigning the regions field or `first_load` majors (regions template).
- Person plot timelines (`events.json`) — [person-web-timeline.md](person-web-timeline.md).
- Year-scrubbed camp layout — [country-camps-year-scrubber.md](country-camps-year-scrubber.md).
