# Multi-hub focus

**When to use:** One shared cast and timeline, but readers need to **focus** a sub-community (creator orbit, fictional universe, franchise strand) without duplicating `people.json`.

**Exemplar plots on main:**

| Plot id | Variant |
| --- | --- |
| `youtubers` | Creator orbits (H3, Vlog Squad, Trisha, Jeffree) |
| `marvel-universe` | Universe membership (MCU main, Raimi, Webb, Fox, etc.) |

Deep Marvel copy and hub table: [marvel-universe-plot.md](../marvel-universe-plot.md) — do not duplicate that doc here.

## `plots.json` fields

Everything in [person-web-timeline.md](person-web-timeline.md), plus:

| Field | Required | Notes |
| --- | --- | --- |
| `hubs` | yes (≥2) | `[{ "id", "label", "centerId" }, …]` — each hub is a real person who anchors that focus. |
| `includeOrbit` | recommended | `true` — shared “none” view and orbit ring. |
| `minBeats` | optional | Default web threshold is **2** beats; Marvel sets **`1`** so one-off variants appear. |
| `orbitLabel` | optional | Marvel: `"Across universes"`. |
| `hubNoneLabel` | optional | Marvel: `"Shared web"`. |
| `hubAllLabel` | optional | Marvel: `"All characters"`. |
| `hubAriaLabel` | optional | Accessible description for the focus control. |

Hub field activates when `includeOrbit` is true, `hubs.length >= 2`, and `arrangement` is not `camps` or `topics`.

## Event tagging

Each event that belongs to a focus must list hub ids:

```json
"hubs": ["h3", "trisha"]
```

- **None** (default): web shows people tied to **more than one** hub plus hub anchors; timeline shows beats tagged with any hub or shared cast logic.
- **All**: every person who qualifies for the web at the current `minBeats`.
- **Named hub**: timeline and web filter to that hub’s membership; stage zooms to fit the focused set.

YouTubers: people tied to only one hub sit farther out beside that hub on **All** and while that hub is focused; multi-hub people sit in the center cluster.

## Relations: two variants

### Creator orbit (YouTubers)

- `friendKinds` / `enemyKinds` classify ties **to the active hub center** (or plot center when no hub).
- Orbit holds everyone else tied to the sphere but not friend/foe of the center.
- Relations are mostly story kinds (`co-host`, `feud`, …) between people; no special membership kind.

### Universe membership (Marvel)

- Story relations use `friendKinds` / `enemyKinds` as in the Marvel doc.
- **`universe-member`** and **`variant-of`** are **neutral** — they encode focus membership without painting every character green.
- Hub centers get `universe-member` edges from members (see `data/marvel-universe/relations.json`); story feuds still use `enemy` / `rival` etc.

## UI behavior

- Focus control in the chrome (labels customizable per plot).
- Web reflows and **eases zoom** so the current focus fills the viewport.
- People below `minBeats` timeline beats stay off the web unless they are hub nodes (`plotHub`).
- Mobile: fitted map + name list under the web.

## Verification

```bash
node scripts/test-never-ending-internet-lore.mjs
```

Script checks YouTubers hub filtering, shared-web beat thresholds, and Marvel `minBeats: 1` layout.

## Out of scope

- Separate data folders per universe (one `people.json` only).
- Release-order vs in-universe date policy — document in `sourceNote` / lede (Marvel uses approximate `YYYY-01-01` story order).
