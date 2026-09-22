# Policy topics bubbles

**When to use:** One public figure (or fixed center) with **policy positions** grouped by topic, colored by stance over time, and opened in a side panel on the same board — not a separate person page.

**Exemplar plots on main:** `barack-obama`, `jd-vance`

## `plots.json` fields

| Field | Required | Example |
| --- | --- | --- |
| `centerId` | yes | `"barack-obama"` |
| `arrangement` | yes | `"topics"` |
| `images` | yes | `"bubbles"` |
| `topics` | yes | `[{ "id": "economy", "label": "Economy" }, …]` |
| `year` | yes | `{ "min", "max", "initial", "marks": [1996, 2004, …] }` |
| `friendKinds` | yes | `["supported"]` |
| `enemyKinds` | yes | `["opposed"]` |
| `friendLabel` / `enemyLabel` | optional | `"Supported"` / `"Opposed"` |
| `friendCountOne` / `friendCountMany` | optional | `"supported"` |
| `enemyCountOne` / `enemyCountMany` | optional | `"opposed"` |
| `orbitLabel` | optional | `"No stance yet"` |
| `yearHint` | optional | Scrubber helper text |
| `paths.people` / `events` / `relations` | yes | Standard trio |

## Data files

### `people.json`

- **Center** person: `tags` includes `"center"`; optional `topic: "center"`.
- **Policy nodes** (each bubble): own `id`, `name`, `role`, `topic` matching a `topics[].id`, optional `tags` and `links`.
- Center gets a Commons `portrait` when available.

Example policy node:

```json
{
  "id": "same-sex-marriage",
  "name": "Same-sex marriage",
  "role": "One sentence on how the stance shifted.",
  "tags": ["social", "evolved"],
  "topic": "social"
}
```

### `relations.json` (stance spans)

Edges from **center** → **policy id**:

| Field | Required | Notes |
| --- | --- | --- |
| `from` | yes | Center `id` |
| `to` | yes | Policy `id` |
| `kind` | yes | `"supported"` or `"opposed"` (must match `friendKinds` / `enemyKinds`) |
| `start` | yes | Year string |
| `end` | optional | Omit if still current |
| `label` | yes | What changed in that span |

```json
{
  "from": "barack-obama",
  "to": "same-sex-marriage",
  "kind": "supported",
  "start": "2012",
  "label": "First sitting president to back legalization"
}
```

`campOf` picks the active stance for the scrubber year; enemy kind wins if both existed (unusual for policy plots).

### `events.json`

Same core fields as [person-web-timeline.md](person-web-timeline.md) (`id`, `date`, `title`, `summary`, `era`, `people`, `links`). `people` lists center + relevant policy ids. No `hubs` field.

## UI behavior

- Board: topic **wedges** with circular bubbles; color reflects supported vs opposed at the selected year.
- Year scrubber (`year.min`–`max`, `marks` on the rail).
- Clicking a policy opens a **panel** on the board: stance history, blurb, links, related beats (`usesPolicyPanel`).
- Mobile: wedges collapse to a **list grouped by topic**.
- Timeline tab still shows the full event chronology.

## Verification

```bash
node scripts/test-never-ending-internet-lore.mjs
```

## Out of scope

- Multi-person debate graphs (no friend web between policies).
- Country-level foreign policy maps — use [country-regions-bilateral-timeline.md](country-regions-bilateral-timeline.md).
