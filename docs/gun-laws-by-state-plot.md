# Gun laws by state plot

**Plot id:** `gun-laws-by-state` (aliases: `state-gun-laws`, `gun-laws-map`, `gun-laws-states`)

**Not the SCOTUS board.** The federal timeline, year scrubber, and CA/NY/TX exemplars live on `?plot=scotus&topic=gun-rights`. This plot is a separate reference board for **all states + D.C.**, seeded from [Gun laws in the United States by state](https://en.wikipedia.org/wiki/Gun_laws_in_the_United_States_by_state).

## URL

```text
?plot=gun-laws-by-state
?plot=gun-laws-by-state&gun=handgun
?plot=gun-laws-by-state&gun=longgun
?plot=gun-laws-by-state&criteria=carry-permit:not_required,open-carry-permit:not_required
?plot=gun-laws-by-state&state=tx
```

- **`gun`** — `handgun` (default) or `longgun`; filters and table use that Wikipedia column.
- **`criteria`** — comma-separated `criterionId:status` pairs (`not_required`, `required`, `partial`, `not_applicable`).
- **`state`** — optional selected jurisdiction for the detail panel.

**Scope:** 50 states + **D.C. only** (no territories). **Time:** current Wikipedia snapshot only (no year scrubber).

## Data

| File | Role |
| --- | --- |
| `data/gun-laws-by-state/states-snapshot.json` | Parsed Wikipedia tables → checklist-shaped cells per state |
| `data/gun-laws-by-state/filter-criteria.json` | Filter labels and wiki subject mapping |
| `docs/gun-laws-by-state-table.md` | Auto-generated 51-row summary table |

Rebuild snapshot from a fresh wiki dump:

```bash
node scripts/build-states-wikipedia-snapshot.mjs --input /path/to/wiki-markdown.txt
```

## Wikipedia → ownership criteria

| Wikipedia subject | Checklist / filter id |
| --- | --- |
| State permit required to purchase? | `purchase-permit` |
| Background checks required for private sales? | `private-sale-check` |
| Waiting period? | `waiting-period` |
| Permit required for concealed carry? | `carry-permit` |
| Permit required for open carry? | `open-carry-permit` |
| Firearm registration? | `handgun-registration` |
| Assault weapon law? | `assault-weapons-restriction` |
| Magazine capacity restriction? | `magazine-capacity-limit` |
| NFA weapons restricted? | `nfa-item-registration` |
| Home-built firearms restriction? | `ghost-gun-rules` |

Federal baseline (dealer NICS, ages 18/21 from FFLs, prohibited persons, NFA tax) is **not** in Wikipedia state tables; the UI notes that it applies everywhere.

## Layout

Desktop: criteria checkboxes on the left, U.S. map on the right. Checked rules light states where that Wikipedia cell is **not required**. Unchecking a rule stops filtering on it. On a narrow screen the criteria stack above the map.

Map shapes: `data/gun-laws-by-state/us-states-paths.json` (Albers USA, 50 states + D.C.).

## Roadmap

1. **Now:** checkbox criteria beside a choropleth that lights matching states, plus a table of lit jurisdictions.
2. **Later:** replace Wikipedia seed with official-code keyframes (same schema as `docs/gun-regulation-board-plan.md` §3.3).

See also: [gun-laws-by-state-table.md](./gun-laws-by-state-table.md), [gun-regulation-board-plan.md](./gun-regulation-board-plan.md) (SCOTUS timeline plot only).
