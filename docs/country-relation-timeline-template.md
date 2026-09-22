# Country relation timeline template

Use this when upgrading a thin United States country stub in `data/united-states/countries.json` into a Mexico-depth bilateral history. Mexico (`slug: "mexico"`) and Russia (`slug: "russia"`) are the current exemplars. Thin records (year + event only, no `tone` or `links`) remain valid; the UI must not require chips.

A minimal JSON sketch lives beside this file: `country-relation-timeline.example.json`.

## Record schema

Keep the existing country fields (`country`, `slug`, `wiki_bilateral`, `wiki_pdf`, `recognition_date`, `status`, `outline`, `formal_relations`, `region`, `first_load`). Add or upgrade:

| Field | Required | Notes |
| --- | --- | --- |
| `notes_summary` | yes | One vivid sentence covering the arc (neighbors/trade, Empire→Soviet→RF, etc.). |
| `timeline` | yes | Array of beats, oldest first. Aim for **~25–40** narrative beats for a major relationship (Mexico has ~28; Russia ~35). Thin neutrals may stay at 2–5. |
| `timeline[].year` | yes | Display year as a string. Ranges like `"1942–1964"` are allowed; the chart uses the first year (`parseRelationTimelineYear`). |
| `timeline[].event` | yes | One narrative sentence, Mexico style—not a telegram label. |
| `timeline[].tone` | for rich histories | Number from **-2** (strongly strained) to **+2** (strongly warm). Typical steps: `-2, -1, 0, 1, 2`. The sentiment chart (`relationTimelineHasTone` / `renderRelationSentimentChart`) only plots beats with a numeric `tone`. |
| `timeline[].links` | optional | Array of `{ "label", "url" }`. Use this field name consistently. Omit entirely when there is no solid source. |
| `links` | optional | Country-level sources shown under a **Sources** heading. Wikipedia bilateral pages plus 1–2 primary overviews (Office of the Historian, CFR, treaty texts). Successor-state cases (Russia) should include Empire / Soviet / RF wiki pages. |

Do **not** invent a second field name (`sources`, `citations`, `refs`) unless you also wire `renderCountryHistory` and this template.

`wiki_bilateral` still drives the “Read more on Wikipedia” fallback. Country-level `links` can repeat that URL with a clearer label; the Wikipedia control stays either way.

## Tone scale

Used by `renderRelationRide`-style readout / the warmth chart in `app.js`:

- **+2** strongly warm (wartime allies, landmark treaty, deep institutional reset)
- **+1** warm (recognition, mediation, limited cooperation)
- **0** mixed / transactional (standoffs averted, present-tense wrap-ups)
- **−1** strained (sanctions prelude, treaty walk-backs, public clashes)
- **−2** strongly strained (war, occupation, annexation, nuclear brink, full rupture)

Every rich-history beat should have a tone so the chart has no holes. Do not put `tone` on a stub timeline unless you are ready to score the whole arc.

## Research workflow

1. Start with the English Wikipedia **bilateral** page (survey spine only).
2. For successor states, also mine analog pages (Russian Empire–US, Soviet Union–US). Other splits (Germany, Korea, Yemen) follow the same pattern.
3. Pull **direct** URLs from MediaWiki `extlinks` and cite/reference lists—Office of the Historian, FRUS, treaty texts, National Archives, ODNI/congressional intel, NYT/WaPo/Reuters/AP/BBC. Do **not** invent citations or Wikipedia section anchors as if they were primary sources.
4. Prefer `https://` links. Archive.org / web.archive.org is fine when the live page is gone.
5. Flag contested claims in the sentence (“U.S. intelligence assesses…”, “Moscow denies…”, “Reporting describes…”). Treat very recent (current-year) diplomacy as provisional.
6. Compress 60–90 research events into **25–40** drawer beats. One sentence each. Skip cultural footnotes unless they changed the relationship.

## Coverage checklist (major relationships)

- Recognition / first diplomats
- 19th-century treaties, wars, or purchases
- Revolution / rupture / non-recognition if it happened
- World wars and postwar settlement
- Cold War crises **and** détente/arms control, not only the crises
- Post–Cold War reset or drift
- The events that define the current status (invasion, alliance, trade pact, sanctions)
- A present-tense wrap beat (usually `2026` in this snapshot) with tone `0` or matching current status

## UI contract

`renderCountryHistory` in `app.js` (drawer) and `renderRelationRide` (full relation page):

- Chart / ride appears when some beat has numeric `tone`.
- Each beat may render `links` as chips (`target="_blank"`, `rel="noreferrer"`). On the ride, chips follow the active readout beat.
- Country-level `links` render under a **Sources** label.
- Wikipedia “Read more” remains if `wiki_bilateral` is set.
- Records without `links` look as they did before (Afghanistan-style stubs).
- The full-page header and the ride rider use that country’s Commons flag (`relationRiderFlags`): partner on the left, plot center on the right. Do not hardcode Mexico stripes.

Helper: `httpsSourceLinks` in `engine.js` drops non-https / unlabeled chips. `relationRiderFlags` reads Commons portraits from `people.json`, then falls back to `commonsFlagSrc("Russia")` → `Flag_of_Russia.svg`.

## QA

- [ ] `notes_summary` is one sentence, not a paragraph.
- [ ] 25–40 beats for a flagship country; every beat has `year`, `tone`, `event`.
- [ ] Majority of beats have ≥1 https `links` entry with a human label.
- [ ] Country-level `links` include the bilateral wiki plus at least one non-wiki overview.
- [ ] Chart years stay in human range; first/last beats bracket the arc.
- [ ] No Computer Use / browser automation. Verify with:

```bash
node scripts/test-never-ending-internet-lore.mjs
```

That script asserts Mexico/Russia tone-bearing timelines, https links on a majority of beats, and that countries without `links` still load.
