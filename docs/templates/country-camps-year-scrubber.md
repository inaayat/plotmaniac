# Country camps + year scrubber (optional)

**When to use:** A **country-centered** web where **allies and foes swap by year** — foes on the **left**, friends on the **right**, center in the middle — driven by dated relations and a year scrubber.

**Exemplar plot on main:** *None today.* The engine and test suite support this arrangement; register a new plot when you have dated ally/foe data.

**Status:** Engine-supported, optional template — safe to document before a live plot ships.

## `plots.json` fields

| Field | Required | Example |
| --- | --- | --- |
| `centerId` | yes | `"united-states"` |
| `arrangement` | yes | **`"camps"`** |
| `friendKinds` | yes | `["ally"]` |
| `enemyKinds` | yes | `["foe"]` |
| `year` | yes | Same object as policy plots: `min`, `max`, `initial`, `marks` |
| `yearHint` | optional | Scrubber copy |
| `paths.people` / `events` / `relations` | yes | Standard trio |

Do **not** combine with `hubs` (hub field is disabled when `arrangement === "camps"`).

## `relations.json` (dated camps)

Relations between each country-person and the **center** must include year span:

```json
{
  "from": "united-states",
  "to": "germany",
  "kind": "foe",
  "start": "1941",
  "end": "1945",
  "label": "World War II belligerents"
}
```

```json
{
  "from": "united-states",
  "to": "united-kingdom",
  "kind": "ally",
  "start": "1785",
  "label": "Formal relations and wartime alliance"
}
```

- `coversYear(relation, year)` filters which edges count for the scrubber.
- Relations **without** `start`/`end` are treated as always active when no year is set; with a year selected, undated edges still count (`coversYear` returns true if year is null).
- `campOf` assigns **enemy** if any active edge matches `enemyKinds`, else **friend**, else **orbit**.

## `people.json`

One record per state on the board (same id used in relations). Center is the focal country.

## UI behavior

- Horizontal **camps** layout: `campArrangement` places enemies left, center middle, friends right (`node.side` `left` / `right`).
- Year scrubber updates camps without reloading data.
- Scroll container uses `is-camps` styling; distinct from topics wedges and default web.
- No region disclosure or flag ring field — this is a person-node camp web, not `disclosure: "regions"`.

## Verification

```bash
node scripts/test-never-ending-internet-lore.mjs
```

The script builds a synthetic 1942 layout (US center, Germany foe left, UK friend right) via `webLayout({ arrangement: "camps", year: 1942, … })`.

## Out of scope

- NATO-style gold cross-links between third countries (regions plot feature).
- Policy topic bubbles — [policy-topics-bubbles.md](policy-topics-bubbles.md).
- Static snapshot majors (`first_load`) — use [country-regions-bilateral-timeline.md](country-regions-bilateral-timeline.md) instead.
