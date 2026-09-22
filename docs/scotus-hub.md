# SCOTUS topic hub

Plot id: **`scotus`** (aliases: `supreme-court`, and legacy gun links `gun-regulation`, `guns`, `second-amendment`).

## V1 information architecture

1. **Hub (default)** — `?plot=scotus`  
   Justia-style grid of 27 landmark topic tiles. Only **Gun Rights / Gun Control** is interactive.

2. **Gun regulation board (live topic)** — `?plot=scotus&topic=gun-rights`  
   Sideways timeline in the country-relation ride style (scroll to move through years). Neutral stats are numbers only. Ownership criteria open from a Criteria control. CA/NY/TX state divergence is not on the page yet. Data still lives under `data/gun-regulation/`.

3. **Legacy URLs** — `?plot=gun-regulation`, `?plot=guns`, or `?plot=second-amendment` resolve to the `scotus` plot and open `topic=gun-rights` when no other topic is set.

4. **Coming soon** — Every non–gun-rights tile is disabled with a “Coming soon” label (same affordance pattern as the 50-state picker on the gun board).

## URL parameters (gun topic)

Same as the gun board plan, plus `topic`:

- `?plot=scotus&topic=gun-rights&year=2022`
- `?plot=scotus&topic=gun-rights&year=2022&kind=scotus`
- `?plot=scotus&topic=gun-rights&year=2022&state=ca`

## Expansion path

Add `status: "live"` on a topic in `data/plots.json`, ship a topic data pack, and register a board renderer for that topic id—without forking the hub shell.

See also: [gun-regulation-board-plan.md](./gun-regulation-board-plan.md) for gun board schemas and acceptance criteria.
