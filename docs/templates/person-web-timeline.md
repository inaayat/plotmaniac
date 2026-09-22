# Person web + timeline (base)

**When to use:** A cast of people with a relationship web around one center character and a full-width chronological timeline. No `arrangement`, `disclosure`, or `hubs` unless you graduate to another template.

**Exemplar on main:** No live plot uses *only* this shape today. Copy file layout and field names from **`youtubers`** and omit `hubs` / event `hubs` for a single-center cast. Plot id **`youtubers`** adds multi-hub focus on top — see [multi-hub-focus.md](multi-hub-focus.md).

## `plots.json` fields

| Field | Required | Example |
| --- | --- | --- |
| `centerId` | yes | `"ethan-klein"` |
| `friendKinds` | yes | `["ally", "crew", "collaborator", "family"]` |
| `enemyKinds` | yes | `["feud", "litigation"]` |
| `includeOrbit` | optional | `true` keeps non-friend/non-foe people on the web |
| `orbitLabel` | optional | `"Around the show"` |
| `paths.people` / `events` / `relations` | yes | `data/<id>/…` |
| `kicker`, `cardLine`, `lede`, `searchPlaceholder` | yes | See [shared-chrome.md](shared-chrome.md) |

Do **not** set `arrangement`, `disclosure`, `hubs`, `topics`, or `year` unless you switch templates.

## Data files

```
data/<plot-id>/people.json
data/<plot-id>/events.json
data/<plot-id>/relations.json
```

### `people.json` (array)

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Stable slug; referenced by events and relations. |
| `name` | yes | Display name. |
| `role` | yes | Short subtitle on cards and list rows. |
| `tags` | optional | Freeform labels for search/filter copy. |
| `links` | optional | `{ "label", "url" }` sources. |
| `portrait` | optional | Commons attribution object; see [shared-chrome.md](shared-chrome.md). |

### `events.json` (array)

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | Unique per plot. |
| `date` | yes | ISO `YYYY-MM-DD` (sort key). |
| `title` | yes | Beat headline. |
| `summary` | yes | Opened-card body; should not repeat the title verbatim. |
| `era` | yes | Era filter token (e.g. `frenemies`). |
| `people` | yes | Array of person `id`s on this beat. |
| `links` | yes on YouTubers-quality plots | `{ "label", "url", "type" }`; use `https://`. |
| `tease` | optional | Short preview; if omitted, engine derives from summary (≤140 chars). |

### `relations.json` (array)

| Field | Required | Notes |
| --- | --- | --- |
| `from` | yes | Person `id`. |
| `to` | yes | Person `id` (usually the center or another cast member). |
| `kind` | yes | Must be in `friendKinds` or `enemyKinds` (or neutral for orbit-only ties between non-center pairs). |
| `label` | yes | Human-readable edge label. |
| `start` / `end` | optional | Year strings; ignored on the web until a year scrubber plot uses them. |

**Center edges:** Relations between each cast member and `centerId` drive friend/foe placement. Feud kinds should win over older ally kinds when both exist.

## Friend / enemy patterns

- Mirror YouTubers: collaborators and family in `friendKinds`; active feuds and litigation in `enemyKinds`.
- People with **fewer than two** timeline beats are **hidden from the web** by default (`WEB_MIN_BEATS = 2` in `engine.js`). Override with `minBeats: 1` on the plot if needed (Marvel uses this).

## UI behavior

- **Web:** Center in the middle; friends on one side, foes on the other; orbit ring when `includeOrbit` is true. Beat count pulls nodes inward on the ring.
- **Timeline:** Full-width lane; zoom, fit, and opened beats stay in-lane without card scrollbars. Mobile: vertical chronological scroll.
- **Mobile:** Opens on timeline; web remains one tap away with pan + name list under the map.

## Verification

```bash
node scripts/test-never-ending-internet-lore.mjs
```

For a new plot, add assertions only if you extend the test script; at minimum confirm the manifest loads and manual spot-check `?plot=<id>`.

## Out of scope

- Hub focus, policy bubbles, country flags, historical map, wars map — other templates.
- Dated relation scrubber without `arrangement: "camps"` or `topics` — year is ignored on the default web.
