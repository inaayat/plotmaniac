# Plotmaniac gun-regulation board plan

Status: V1 implemented as the **Gun Rights / Gun Control** topic on the SCOTUS hub
(`?plot=scotus&topic=gun-rights`). Legacy plot aliases (`gun-regulation`, `guns`,
`second-amendment`) still open this board. Hub overview: [scotus-hub.md](./scotus-hub.md).
Data loads from `data/gun-regulation/`.

The product brief is authoritative. The central editorial choice is to show
regulation intensity over time, not to label people or jurisdictions as
“good” or “bad” on guns:

- `+2` sharp federal tightening
- `+1` modest tightening or a Supreme Court decision upholding a limit
- `0` mixed, procedural, or status quo
- `-1` rights expansion or a significant rule sunset
- `-2` major rights expansion or constitutional rollback

Blue means higher/tighter regulation intensity. Yellow means lower/looser
intensity. Amber/gray means mixed or state-dependent. The statistics ribbon is
neutral and must never use blue/yellow as moral coding.

## 1. Repository grounding

Plotmaniac is a static, manifest-driven app. Existing plots are registered in
`data/plots.json` and loaded through `app.js`; there is no separate page-router
framework to introduce for this feature.

The canonical entry is the SCOTUS parent plot **`scotus`** with topic
**`gun-rights`**. Legacy queries `?plot=gun-regulation` (and `guns`,
`second-amendment`) alias into that topic. Do not add a standalone top-level
gun-only plot in the gallery.

Existing patterns to reuse:

| Need | Existing seam | How the gun board should use it |
| --- | --- | --- |
| Full-width chronological rail | `lane.js`: `buildLaneChrome`, `laneYear`, `layoutLane`, zoom/fit/pan | Render the federal rail from `1791`, with alternating cards on wide screens and the existing vertical spine on compact screens. |
| Year scrubber | `app.js`: `renderYearBar`, `readYear`, `parseYear`, URL state | Add the gun board’s range and marks; keep the selected year in the URL so a scrubbed board is shareable. |
| Sticky board-side panel | `app.js`: `usesPolicyPanel`, `policy-drawer`, `paintPolicySelection`, `renderPolicyLinks`, `renderPolicyBeats` | Generalize or parallel this pattern for the ownership-criteria checklist. Do not create a separate checklist page. |
| Topic/state selection | `renderTopicBar`, `paintWeb`, `paintWebPeople`, `web-people` | Use filter chips for `SCOTUS`, `statute`, `agency`, and `state`; do not overload friend/foe semantics. |
| Source chips | `renderSourceChips`, `httpsSourceLinks` in `app.js`/`engine.js` | Use typed, outbound links for every substantive beat. Enforce `https`, labels, and `noopener noreferrer`. |
| Tone visualization | `relationToneClass`, `relationRideLayout`, `relationSentimentChart` | Reuse the geometry ideas only if useful. Use new regulation-intensity names/classes; the existing warmth labels and green/red palette are semantically wrong here. |
| Rich timeline records | `data/united-states/countries.json`, especially Mexico/Russia/Iran | Copy the `year`/`event`/`tone`/`links` discipline, while making the beat `kind` and plain-English holding explicit. |
| Vance/Obama focus UX | `arrangement: "topics"` plus `policy-drawer` | Preserve board-first interaction: click a concept, keep the scrubber visible, read the explanation in a sticky side panel. |

The current country timeline docs use `links` consistently and allow thin
records. The gun board should be stricter: a federal SCOTUS or major-statute
beat is not publishable without a plain-English explanation and a verified
primary link.

## 2. V1 — build now

### Information architecture

One board, one focus route, two synchronized tracks:

1. **Header and legend**
   - Title: “Gun regulation in the United States”
   - One-sentence scope note: federal baseline, with selected state divergence
   - Regulation-intensity legend: tighter/high blue, looser/low yellow,
     mixed/state-dependent amber/gray
   - Neutral statistics legend and a “modeled” caveat for civilian stock
2. **Year scrubber**
   - Minimum `1791`
   - Initial year should be a readable modern anchor, proposed `2022`
   - Marks at `1791`, `1868`, `1934`, `1968`, `1986`, `1993`, `1994`,
     `2008`, `2010`, `2022`, and the latest dated content
   - Scrubbing updates the checklist, state mini-grid, and stats readout
3. **Federal regulation rail**
   - Timeline cards from `1791`
   - Dense beats may share a year but must retain separate source records
   - `SCOTUS`, statute, agency, constitutional, and state landmark chips
   - Filter chips remove cards from view without changing the selected year
4. **Sticky ownership-criteria checklist**
   - Plain-English rows, not legal shorthand
   - Federal baseline always visible
   - A row that is not uniform uses `varies_by_state` and amber/gray; never
     synthesize a federal yes/no from a majority of states
   - At `2010`, show a McDonald context banner; at `2022`, show a Bruen
     context banner
5. **Neutral statistics ribbon**
   - Civilian gun stock, clearly labeled modeled estimate
   - Guns per capita / per 100 people
   - Gun death rates per 100,000, split into homicide and suicide
   - Values begin only where the selected series is defensible, approximately
     `1945` or `1968`; before coverage, show a faded empty state rather than
     interpolating invented history
6. **Exemplar mini-grid**
   - California, New York, Texas
   - Same selected year and checklist rows
   - Each cell shows `required`, `not required`, `partial`, or
     `varies_by_state` plus one short explanation
   - A visible “Explore all 50 states — coming soon” CTA that is intentionally
     non-functional or points to an announced future state-picker route
7. **Accessible reading order**
   - On desktop: rail and stats in the main column; checklist sticky in the
     side column
   - On small screens: scrubber, stats, federal beats, checklist, then
     exemplars; checklist opens as a drawer using the existing scrim/close
     behavior
   - No content is available only through color, hover, or a map

### Route and URL state

Use the existing plot query grammar:

```text
?plot=gun-regulation
?plot=gun-regulation&year=2022
?plot=gun-regulation&year=2022&kind=scotus
?plot=gun-regulation&year=2022&state=ca
```

`state=ca` is only an exemplar selection in V1. It must not imply that the
full 50-state picker is already available. A future picker can retain the
same parameter and replace the exemplar-only control.

The implementation should keep view state in the existing URL writer rather
than adding a second history mechanism. Back/forward must restore the selected
year, filter, and exemplar state.

### Component/data seams for the V1 builder

The builder should first make the existing generic seams capable of representing
this plot, then add the manifest/data record:

1. Add a plot arrangement or capability for a **regulation board**, rather than
   pretending the board is a friend/foe web.
2. Extract a reusable `StickyInfoPanel`/drawer contract from the Vance policy
   panel. The contract should accept a title, current-year status, sections,
   source chips, and a close callback. This is a refactor suggestion for this
   board and future policy plots; do not duplicate `paintPolicySelection`.
3. Extract the existing year-bar URL/scrubber behavior into a shared helper if
   the regulation board needs a different visual shell. Keep one source of
   truth for parsing/clamping a year.
4. Reuse `lane.js` for the rail. Add a small adapter from gun beats to the
   lane’s expected card shape instead of duplicating zoom, pan, fit, and
   mobile spine logic.
5. Add neutral stats rendering as a separate component/data adapter. Do not
   reuse `relationToneClass` for stats or use regulation blue/yellow for
   outcomes.
6. Add source validation to the static test path: beat links must be labeled
   `https://` URLs; SCOTUS beats must include an official opinion link; statute
   beats must include an official statutory/congressional link.

Potential future refactor: `renderSourceChips`, `renderPolicyLinks`, and the
country source block each solve a related link-chip problem. After V1, combine
them behind one typed `SourceLinks` renderer with variants for compact chips,
drawer lists, and source groups. Do not copy another source renderer into the
gun board.

## 3. Schema sketches

These are documentation sketches, not files to wire into the app in this
planning pass. IDs are stable slugs; display copy can change without changing
IDs.

### 3.1 Timeline beats

```json
{
  "id": "scotus-2008-heller",
  "year": "2008",
  "date": "2008-06-26",
  "tone": -2,
  "kind": "scotus",
  "scope": "federal",
  "event": "District of Columbia v. Heller",
  "plainEnglish": "The Court held that the Second Amendment protects an individual right to possess a handgun for a lawful purpose such as self-defense in the home. It also said the right is not unlimited and listed examples of presumptively lawful regulation.",
  "tags": ["handgun", "self-defense", "individual-right"],
  "links": [
    {
      "id": "heller-opinion-official",
      "label": "Supreme Court opinion PDF",
      "url": "https://www.supremecourt.gov/",
      "sourceType": "opinion",
      "publisher": "Supreme Court of the United States",
      "primary": true,
      "verified": false
    },
    {
      "id": "heller-justia",
      "label": "Justia case text",
      "url": "https://supreme.justia.com/cases/federal/us/554/570/",
      "sourceType": "opinion",
      "publisher": "Justia",
      "primary": false,
      "verified": true
    },
    {
      "id": "heller-oyez",
      "label": "Oyez case record",
      "url": "https://www.oyez.org/cases/2007/07-290",
      "sourceType": "case-summary",
      "publisher": "Oyez",
      "primary": false,
      "verified": true
    }
  ],
  "supersedes": ["collective-right-reading"],
  "notes": "The official opinion URL must be replaced with the verified PDF before publication."
}
```

Required fields:

- `id`, `year`, `tone`, `kind`, `scope`, `event`, `plainEnglish`, `links`
- `tone` is an integer from `-2` through `2` and describes regulation
  intensity, not the moral value of the result
- `kind` is one of `constitutional`, `scotus`, `statute`, `agency`, or `state`
- `scope` is `federal` for the main rail and a state slug for a state beat
- `links` is non-empty for every `scotus`, `statute`, and `agency` beat
- `plainEnglish` must distinguish a holding, enacted statute, proposed bill,
  agency rule, lawsuit, and commentary
- `supersedes` is optional and records an earlier public/legal frame that this
  beat changed; it is not a claim that precedent disappeared

Official links are required, with optional corroborating links:

- SCOTUS: official opinion PDF at `supremecourt.gov`, then Justia, Oyez,
  Cornell LII, or another stable case-text mirror
- Statute: Congress.gov bill/statute page, Statutes at Large, or official
  U.S. Code text; CRS is useful context but not a substitute for enacted text
- Agency: Federal Register, ATF final rule, or another official publication
- State: official legislature/code, state supreme court, or attorney-general
  publication before secondary explainers

The example’s `verified: false` is deliberate: the build agent must not copy a
homepage as if it were an opinion PDF. A content review must replace it.

### 3.2 Checklist keyframes

Checklist rows are stable across federal and state records:

```json
{
  "id": "dealer-background-check",
  "label": "Dealer background check",
  "question": "Must a licensed dealer run a background check before completing the sale?",
  "order": 2
}
```

Each jurisdiction has dated keyframes. A keyframe is a change point, not a
snapshot copied for every year:

```json
{
  "year": "1998",
  "effectiveDate": "1998-11-30",
  "jurisdiction": "federal",
  "changes": [
    {
      "criterion": "dealer-background-check",
      "status": "required",
      "plainEnglish": "A federally licensed dealer generally must contact NICS or use an approved alternative before transferring a firearm, subject to the law’s exceptions and delay rules.",
      "links": [
        {
          "label": "FBI NICS overview",
          "url": "https://www.fbi.gov/how-we-can-help-you/more-fbi-services-and-information/nics",
          "sourceType": "agency",
          "primary": true
        }
      ]
    }
  ]
}
```

Allowed `status` values:

| Status | Display meaning |
| --- | --- |
| `required` | A requirement applies to the described transaction |
| `not_required` | No such broad requirement applies in this scope |
| `partial` | The rule applies only to a class, transaction, or item |
| `varies_by_state` | Federal law does not provide one uniform answer |
| `not_applicable` | The criterion does not apply to that item/time/scope |
| `unknown` | Research is incomplete; never publish this as a legal answer |

The V1 checklist rows are: minimum age for long gun; minimum age for
handgun; dealer background check; private-sale check; waiting period; purchase
permit; carry permit; felony prohibition; domestic-violence conviction or
restraining-order prohibition; mental-health adjudication/commitment
prohibition; handgun registration; assault-weapons restriction; magazine
capacity limit; NFA-item registration/tax; and ghost-gun/unfinished-frame
rules.

The rendering layer resolves the selected year to the latest keyframe at or
before that year. If a row has no applicable keyframe, it renders “research
pending” in a planning build and fails the V1 content check before launch.

### 3.3 Exemplar/state overrides

```json
{
  "id": "ca",
  "postal": "CA",
  "name": "California",
  "coverage": "v1-exemplar",
  "timeline": [],
  "checklist": {
    "federalBaseline": "federal",
    "overrides": [
      {
        "criterion": "waiting-period",
        "from": "1991",
        "status": "required",
        "plainEnglish": "California’s state waiting-period rule applies to covered transfers; verify exceptions and historical effective dates in the official code."
      }
    ]
  }
}
```

State records deliberately share the same `timeline` and `checklist` shapes:
V1 uses three records; the future picker can add the other 47 without a schema
migration. State overrides should be sparse and inherit the federal baseline
only when the legal relationship is explicitly documented.

### 3.4 Statistics series

```json
{
  "id": "gun-death-rate",
  "label": "Gun deaths",
  "unit": "per 100,000 people",
  "display": "neutral",
  "coverage": { "from": 1968, "to": 2025, "quality": "observed" },
  "sourceMethod": "CDC mortality data; firearm mechanism split into homicide and suicide",
  "measures": [
    {
      "id": "homicide",
      "label": "Homicide",
      "points": [
        { "year": 1999, "value": 5.7, "status": "observed" }
      ]
    },
    {
      "id": "suicide",
      "label": "Suicide",
      "points": [
        { "year": 1999, "value": 6.0, "status": "observed" }
      ]
    }
  ],
  "sources": [
    {
      "label": "CDC WISQARS",
      "url": "https://wisqars.cdc.gov/",
      "sourceType": "dataset",
      "primary": true
    }
  ]
}
```

Other series use the same envelope:

```json
{
  "id": "civilian-gun-stock",
  "label": "Civilian gun stock",
  "unit": "estimated firearms in civilian hands",
  "display": "neutral",
  "coverage": { "from": 1945, "to": 2025, "quality": "modeled" },
  "sourceMethod": "ATF manufacturing/import/export records and CRS/NSSF methodology",
  "points": [
    { "year": 1945, "value": 0, "status": "modeled", "low": 0, "high": 0 }
  ],
  "sources": []
}
```

The zero value above is a non-publishable placeholder illustrating shape only;
the implementation must not render it. Use `status: "missing"` or omit points
before a defensible series begins.

`guns-per-capita` should store both `per100` and the denominator source
(decennial census/intercensal estimates). Rates are preferred to raw counts.
Show source year and “modeled”/“observed” status in the accessible text.

### 3.5 Source link objects

```json
{
  "id": "bruen-opinion-official",
  "label": "Supreme Court opinion PDF",
  "url": "https://www.supremecourt.gov/",
  "sourceType": "opinion",
  "publisher": "Supreme Court of the United States",
  "primary": true,
  "accessed": "2026-09-22",
  "verified": false
}
```

The actual data should use the direct verified document URL, not a domain
homepage. `accessed` supports later link audits. Link labels should tell the
reader what they will open. No Wikipedia section anchor may be the primary
source for any beat.

## 4. V1 content outline

### 4.1 Starter federal beat list

This is the editorial queue, not permission to publish uncited claims. The
research pass should split or combine beats only when the legal effect remains
clear. Each final beat needs a plain-English card and verified links.

| Year | Candidate beat | Kind | Editorial treatment |
| --- | --- | --- | --- |
| 1791 | Second Amendment ratified | `constitutional` | Quote/describe the text; explain that later incorporation and interpretation are separate beats. |
| 1868 | Fourteenth Amendment ratified | `constitutional` | Context for later incorporation, not a claim that it instantly created a modern state-law rule. |
| 1876 | *United States v. Cruikshank* | `scotus` | Explain the federal/state-rights boundary and what the decision did not decide. |
| 1886 | *Presser v. Illinois* | `scotus` | Explain organized militia language and the state-regulation question without presenting dicta as a current rule. |
| 1934 | National Firearms Act | `statute` | Short-barreled rifles/shotguns, machine guns, silencers, and the tax/registration structure; link to enacted text. |
| 1939 | *United States v. Miller* | `scotus` | Explain the narrow record and the Court’s treatment of the short-barreled shotgun; do not overstate the holding. |
| 1968 | Gun Control Act | `statute` | FFL system, prohibited categories, age rules, interstate transfer structure, and federal enforcement baseline. |
| 1972 | *United States v. Vuitch* | `scotus` | Optional supporting beat for the mental-health prohibition; include only if the research note establishes its relevance. |
| 1986 | Firearm Owners’ Protection Act | `statute` | Explain the changes to federal transfer/recordkeeping rules and the machine-gun restriction. |
| 1993–98 | Brady Act and NICS launch | `statute`/`agency` | Separate enactment, interim waiting period, and NICS operational start; do not collapse them into one date. |
| 1994 | Federal assault-weapons and magazine-capacity ban | `statute` | Record the 10-year sunset and the federal scope; distinguish federal law from state bans. |
| 1996 | Lautenberg domestic-violence prohibition | `statute` | Explain misdemeanor domestic-violence and qualifying restraining-order categories. |
| 2005 | Protection of Lawful Commerce in Arms Act | `statute` | Explain the liability limits and exceptions, not “immunity from all lawsuits.” |
| 2008 | *District of Columbia v. Heller* | `scotus` | Individual right, home handgun, and non-unlimited-right language. |
| 2009 | *United States v. Hayes* | `scotus` | If included, explain the federal domestic-violence definition’s reach with a source chip. |
| 2010 | *McDonald v. City of Chicago* | `scotus` | Explain incorporation against states through the Fourteenth Amendment. |
| 2016 | *Caetano v. Massachusetts* | `scotus` | Explain the per curiam remand and why modern arms cannot be excluded merely because they did not exist in 1791. |
| 2016 | *Voisine v. United States* | `scotus` | Explain the misdemeanor domestic-violence prohibition and the limits of the holding. |
| 2017 | Bump-stock rule and later litigation | `agency` | Keep rulemaking, judicial review, and later disposition as separate dated beats. |
| 2020 | *N.Y. State Rifle & Pistol Ass’n v. City of New York* | `scotus` | Explain mootness/procedure; do not present it as the merits test later used in *Bruen*. |
| 2022 | Bipartisan Safer Communities Act | `statute` | Explain enhanced juvenile/mental-health records, domestic-violence categories, and dealer/business definitions; mark enacted provisions precisely. |
| 2022 | *N.Y. State Rifle & Pistol Ass’n v. Bruen* | `scotus` | Explain the public-carry licensing holding and the historical-tradition framework in plain English. |
| 2022–24 | Frames/receivers agency rule | `agency` | Record the final rule and court status separately; link Federal Register and controlling orders. |
| 2024 | *United States v. Rahimi* | `scotus` | Explain why the Court upheld disarmament while a qualifying domestic-violence restraining order is in force, and what the opinion did not decide. |
| 2024 | *Garland v. Cargill* | `scotus` | Explain the bump-stock statutory interpretation and its effect on the agency rule. |

The content editor should add other major federal statutes, regulations, and
decisions discovered in research. “Every SCOTUS and major beat” is a release
gate, not a promise that this starter queue is exhaustive. Each final card
must say whether it is a holding, enactment, agency action, proposal, or
litigation posture.

### 4.2 Checklist change eras

Use these as keyframe research bands; do not imply that every row changed in
every band:

1. `1791–1933`: constitutional text, early federal baseline, and state/local
   divergence. Avoid pretending a modern dealer-check model existed.
2. `1934–1967`: NFA items and federal tax/registration; ordinary firearms
   remain mostly outside that structure.
3. `1968–1985`: GCA FFL, prohibited-person, age, interstate-transfer, and
   mental-health categories.
4. `1986–1992`: FOPA changes and federal recordkeeping/transfer limits.
5. `1993–1998`: Brady enactment, interim waiting period, then NICS.
6. `1994–2004`: federal assault-weapons/magazine ban, with sunset tracked
   explicitly.
7. `2005–2007`: PLCAA and federal baseline after the sunset.
8. `2008–2015`: Heller/McDonald legal framework and state responses.
9. `2016–2021`: domestic-violence case law, bump-stock rule, ghost-gun and
   state-level responses; mark federal/state scope.
10. `2022–present`: BSCA, Bruen, agency rules, Rahimi, Cargill, and
    post-Bruen state responses. Date the content snapshot.

### 4.3 CA/NY/TX exemplar cell map by era

The mini-grid is an explanatory seed, not legal advice. Cells below describe
the override modules the V1 data must contain. “Verify” is a research task and
must be replaced by a sourced status before that cell is presented as fact.

| Era/keyframe | California | New York | Texas |
| --- | --- | --- | --- |
| `1791–1933` | `state-history: local/state arms rules`; age, carry, and sale rows require historical source review | `state-history: local/state arms rules`; trace city and state licensing separately | `state-history: frontier/state rules`; do not back-project modern permitless carry |
| `1934–1967` | `federal NFA + state item rules`; registration and NFA rows need state-code verification | `federal NFA + state item rules`; registration and NFA rows need state-code verification | `federal NFA + state item rules`; distinguish federal tax/registration from state treatment |
| `1968–1985` | `dealer/private-sale, age, waiting, handgun-registration, and carry modules; verify effective dates | `dealer/private-sale, age, permit, carry, and registration modules; verify city/state split | `dealer/private-sale, age, and carry modules; verify the historical baseline rather than assume no regulation |
| `1986–1993` | `state transfer and waiting-period overrides`; FOPA remains federal baseline | `state transfer, permit, and waiting-period overrides`; preserve state/city distinctions | `state transfer and carry overrides`; source each change |
| `1994–2004` | `state AWB + magazine modules` alongside the federal 10-year ban | `state AWB + magazine modules` alongside the federal 10-year ban | `federal sunset module`; do not infer a Texas ban from the federal row |
| `2005–2007` | `state restrictions continue after federal sunset`; PLCAA is federal only | `state restrictions continue after federal sunset`; PLCAA is federal only | `post-sunset state baseline`; PLCAA is federal only |
| `2008–2015` | `post-Heller/McDonald response`; carry, roster, waiting, magazine, and registration keyframes | `post-Heller/McDonald response`; carry licensing and sensitive-location research | `post-Heller/McDonald response`; carry/licensing and prohibited-place research |
| `2016–2021` | `DVRO, ghost-gun, AWB/magazine, and carry litigation modules` | `DVRO, licensing, magazine/AWB, and sensitive-place modules` | `permit and carry change modules`; include the 2021 carry change only after official-source verification |
| `2022–present` | `post-Bruen response`; separate enacted rules, injunctions, and pending cases | `post-Bruen response`; separate enacted rules, injunctions, and pending cases | `post-Bruen response`; distinguish state law from court challenges and federal overlays |

For every era, the data author must fill all 15 checklist rows. The map above
identifies which modules deserve a state override; it is not a shortcut to
marking every other row “not required.” Each state cell needs at least one
official code, statute, court, or agency link when its status differs from the
federal baseline.

### 4.4 Statistics series and sources

| Series | V1 display | Source/research rule |
| --- | --- | --- |
| Civilian gun stock | Modeled line/card; show uncertainty or a “modeled estimate” badge | Reconcile ATF manufacturing/import/export reports with CRS and other transparent methodology; record assumptions and do not present a single precise count as observed fact. |
| Guns per capita | Neutral per-100 line/card | Derive from the stock series and Census population denominator; display the denominator/source year and preserve modeled status. |
| Gun death rate | Neutral rate card with homicide and suicide measures | Use CDC WISQARS/WONDER and underlying mortality documentation; prefer rates per 100,000, keep homicide and suicide separate, and document coding/coverage breaks. |
| Optional later ownership | Not in V1 | GSS household ownership percentage, with survey methodology and missing-year treatment. |

The statistics ribbon should not be drawn back to `1791`. It begins at the
first defensible point for each series (approximately `1945`/`1968`, with CDC
death-rate coverage handled honestly). A series with a later source start
shows “no comparable series yet” before that point.

## 5. V1 acceptance criteria

V1 is ready for a build PR when all of the following are true:

- The canonical Plotmaniac entry is `?plot=gun-regulation`; the page does not
  create a separate duplicated route or separate checklist page.
- The scrubber can select every year from `1791` through the content snapshot,
  URL state round-trips, and timeline cards remain readable on compact and
  wide layouts.
- The federal rail contains the reviewed SCOTUS and major federal beat set.
  Every substantive card has a one- or two-sentence plain-English explanation.
- Every SCOTUS beat has a verified official opinion PDF link, plus at least
  one useful secondary case-text link where available. Every statute beat has
  an official statute/Congress.gov/Statutes at Large link.
- Filter chips can isolate SCOTUS, statutes, agency actions, and state
  landmarks. State landmarks are visibly sparse and never replace the federal
  baseline.
- The checklist is sticky on wide screens and drawer-based on small screens.
  It includes all 15 rows, resolves by year, and uses `varies_by_state` for
  non-uniform rules.
- McDonald and Bruen context banners appear at their respective years without
  rewriting the federal checklist into a state snapshot.
- CA, NY, and TX each have a same-scrubber mini-grid with the complete row
  contract, sourced overrides, and a visible Coming Soon full-picker CTA.
- Stats are scrubber-synced, neutral-colored, separately labeled homicide vs
  suicide, and empty/faded before their real source coverage. Modeled stock
  estimates are labeled.
- External links are labeled, HTTPS, keyboard reachable, and opened safely.
- Static/script verification and code review pass. No Computer Use, browser
  automation, or screenshot requirement is introduced.

## 6. V1 non-goals

- No full 50-state picker, interactive U.S. map, or claim of complete
  state-by-state coverage.
- No legal advice, current-case prediction, or partisan “pro/anti-gun”
  ranking.
- No invented estimates before a series’ real coverage, no false precision,
  and no moral color coding of mortality or ownership statistics.
- No Wikipedia section anchors as primary sources.
- No separate V1 page for every state, no account system, no CMS, and no live
  database.
- No full state research project in the V1 implementation branch.
- No Computer Use/browser automation/screenshots.
- No unrelated redesign of country timelines, Vance/Obama pages, or the
  gallery.

## 7. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Legal history is compressed into misleading yes/no cells | Use dated keyframes, plain-English scope notes, `partial`/`varies_by_state`, and editorial review by row. |
| A court case is mistaken for a statute or vice versa | Require `kind`, `sourceType`, effective date, and plain-English procedural posture. |
| Current state law changes while the board is being built | Put the data snapshot date in the manifest/footer and run a source/link audit before release. |
| SCOTUS official URLs are copied incorrectly | Store source IDs, verify direct PDFs manually during content QA, and fail static checks for homepage-only URLs. |
| Regulation colors are confused with outcomes | Keep blue/yellow only on regulation intensity; use neutral stats styles and explicit legends. |
| A sticky panel obscures the rail or traps mobile users | Reuse the existing drawer/scrim/close/focus-return pattern and test with keyboard/static DOM assertions. |
| Sparse state beats become a second federal timeline | Require `scope` and state filter chips; render state landmarks as annotations on the federal rail. |
| Duplicated helpers drift | Extract shared scrubber, source-link, and sticky-panel contracts before adding board-specific variants. |

## 8. Full 50-state picker — plan now, build later

### Picker UX

The future state route should retain the V1 plot shell and selected year:

```text
?plot=gun-regulation&state=ca&year=2022
```

The picker is a two-mode control:

1. A lightweight U.S. map for recognition and quick selection. The map is
   optional if it creates accessibility or bundle cost problems.
2. A searchable, keyboard-navigable list of all 50 states that is the
   authoritative fallback. Search matches name and postal abbreviation.

Selection changes the main board to that state’s timeline and checklist
history, not a static current snapshot:

- Header identifies the state and the data coverage date.
- Same year scrubber and same `timeline[]` schema as the federal rail.
- Same `tone` semantics, interpreted at state level.
- State-specific checklist keyframes resolve at the selected year.
- Federal baseline remains available as a comparison layer or “Federal
  baseline” toggle; it must not be silently mixed into the state answer.
- Missing/incomplete content shows a coverage badge and the next research
  phase, never a confident “no rule.”

Map/list selection, deep links, browser history, Escape/back, and mobile drawer
behavior should share the existing URL and focus-panel utilities. The V1
CA/NY/TX mini-grid is the first content adapter for this picker; its state IDs,
overrides, and same-scrubber behavior must not be thrown away.

### Registry and data model

Create the registry for all 50 now, even when only three have content:

```json
{
  "states": [
    {
      "id": "al",
      "postal": "AL",
      "name": "Alabama",
      "coverage": "planned",
      "timeline": [],
      "checklistKeyframes": [],
      "sources": [],
      "lastReviewed": null
    }
  ]
}
```

The complete registry IDs are:

`al`, `ak`, `az`, `ar`, `ca`, `co`, `ct`, `de`, `fl`, `ga`, `hi`, `id`, `il`,
`in`, `ia`, `ks`, `ky`, `la`, `me`, `md`, `ma`, `mi`, `mn`, `ms`, `mo`, `mt`,
`ne`, `nv`, `nh`, `nj`, `nm`, `ny`, `nc`, `nd`, `oh`, `ok`, `or`, `pa`, `ri`,
`sc`, `sd`, `tn`, `tx`, `ut`, `vt`, `va`, `wa`, `wv`, `wi`, `wy`.

Every state record uses:

- `timeline`: the exact beat schema in section 3.1, with `scope` equal to the
  state ID and links to official statutes, code, or state court materials
- `checklistKeyframes`: the exact keyframe schema in section 3.2
- `federalBaseline`: a reference to the federal keyframes, not a copied fork
- `sources`: state code, legislature, supreme court, AG, administrative
  materials, and carefully selected secondary context
- `coverage`: `planned`, `seed`, `researching`, `reviewed`, or `complete`
- `lastReviewed`: date for change monitoring

### Research template per state

For each state, researchers should complete this checklist:

1. Lock the research cutoff date and identify the current official code
   repository and legislature search.
2. Establish constitutional text and major state constitutional decisions.
3. Build a dated timeline of:
   - permit/license regime and changes from may-issue to shall-issue to
     permitless carry, where applicable
   - purchase permits, dealer/private-sale checks, waiting periods, and age
     rules
   - assault-weapons and magazine restrictions
   - handgun registration/roster, storage, and transfer rules
   - NFA-item treatment and state prohibited weapons
   - ghost-gun/unfinished-frame rules
   - domestic-violence and extreme-risk/DVRO provisions
   - sensitive places, public carry, and post-*Bruen* changes
   - state supreme court and controlling federal litigation
4. Record an official source and effective date for each checklist change.
5. Write a neutral, plain-English beat summary and assign `tone` with a note
   explaining the intensity judgment.
6. Mark pre-digital or contested history as uncertain rather than filling gaps
   from a modern summary.
7. Run link, schema, chronology, and duplicate-ID checks.
8. Have a second reviewer confirm that “not required” is not being used where
   the answer is actually “unknown” or “varies by transaction.”

### Rollout phases

| Phase | Coverage | Exit condition |
| --- | --- | --- |
| 0 — schema/registry | All 50 registry entries, empty-safe loader, picker contract | Any state can be selected without a crash or schema fork. |
| 1 — V1 seeds | CA, NY, TX mini-grid and federal rail annotations | Three seeds meet the full checklist/source contract and power the future picker. |
| 2 — representative research | Add a mix of regulatory regimes and regions: e.g. AZ, CO, FL, IL, MA, OH, PA, WA, plus a low-population sample | Each chosen state has reviewed timeline/keyframes, not only a current snapshot. |
| 3 — remaining states | Fill the other states in research batches, preserving the same source and tone rules | 50 selectable records, with coverage badges for any still-thin history. |
| 4 — review/maintenance | Legal/editorial review, broken-link audit, post-*Bruen* update sweep | “50-state done” acceptance criteria pass and a recurring review process exists. |

### 50-state completion criteria

The full product is complete only when:

- all 50 states are searchable/selectable by name and postal code;
- each state has at least one reviewed historical timeline, not just a current
  card;
- each state has checklist keyframes covering the major change eras relevant
  to that state, with explicit gaps;
- each substantive beat has a plain-English summary and a verified source;
- federal/state scope is visible at every beat and checklist row;
- the selected year synchronizes the state rail, checklist, and stats context;
- mobile, keyboard, URL deep links, and empty/incomplete coverage states work;
- a source audit and change-date audit are documented.

## 9. Ready-to-paste handoff prompt for Composer 2.5 fast / Grok

Copy the prompt below only after this planning PR is accepted. It is
self-contained for a V1-only implementation; it does not authorize the build
agent to implement the 50-state picker.

```text
You are implementing Plotmaniac V1: the dual-track U.S. gun-regulation board.

Read first:
- docs/gun-regulation-board-plan.md
- README.md
- docs/templates/country-bilateral-timeline.md
- docs/templates/policy-topics-bubbles.md
- docs/templates/shared-chrome.md
- lane.js, engine.js, app.js, data/plots.json
- existing U.S. country records for Mexico, Russia, and Iran

Goal:
Add one Plotmaniac plot with the canonical identity ?plot=gun-regulation.
If a hosting rewrite for /guns is trivial, it may point to this same plot; do
not build a second route or duplicate page. The board is federal-first and
uses CA, NY, and TX only as sourced V1 exemplars. Show a Coming Soon CTA for
the future 50-state picker.

Hard constraints:
- This is V1 only. Do not implement the full 50-state picker, map, or 47
  additional state histories.
- Do not add a production feature outside the gun board.
- Use one branch, one PR, and one merge to main for this related effort.
- No Computer Use, browser automation, or screenshots. Verify with scripts,
  static DOM/data checks, and code review only.
- Do not use Wikipedia section anchors as primary sources.
- Every SCOTUS beat needs a plain-English holding and a verified official
  Supreme Court opinion PDF link; add Justia/Oyez/Cornell LII when useful.
- Every statute beat needs a plain-English summary and an official
  Congress.gov, Statutes at Large, U.S. Code, or agency link.
- Never invent pre-coverage statistics. Render missing/faded states before
  the real series begins.
- Never use blue/yellow moral coding for stats. Blue is tighter/high
  regulation intensity; yellow is looser/low; amber/gray is mixed or varies
  by state.
- Do not represent state divergence as a federal yes/no. Use
  varies_by_state.

Interaction and IA:
1. Header and legend.
2. Russia/Mexico-style year scrubber and full federal timeline rail starting
   at 1791. Use lane.js for wide zoom/pan/fit and the existing mobile spine.
3. Sticky ownership-criteria checklist panel on desktop; existing drawer,
   scrim, close, and focus-return behavior on compact screens. Keep it on the
   board, not a separate page.
4. Scrubber-synced neutral stats ribbon:
   - modeled civilian gun stock
   - guns per capita/per 100
   - gun death rates per 100,000 split into homicide and suicide
   Start each series at its defensible source coverage (about 1945/1968 as
   applicable) and show no data before then.
5. CA/NY/TX mini-grid below/alongside the checklist, driven by the same year
   and the same checklist row schema.
6. Coming Soon CTA for full 50-state picker.
7. Filter chips for SCOTUS, statute, agency, and state landmark beats.
8. McDonald and Bruen context banners at 2010 and 2022.

Data:
- Keep the new content under a gun-specific data directory or another
  clearly isolated, manifest-referenced location.
- Use stable IDs and the documented schemas:
  timeline beats have id/year/tone/kind/scope/event/plainEnglish/links;
  checklist rows use dated keyframes and required/not_required/partial/
  varies_by_state/not_applicable/unknown;
  state exemplars inherit a federal baseline and contain sparse overrides;
  stats contain coverage, status, units, points, and source metadata.
- The tone scale is regulation intensity: +2 tightens sharply, +1 modest
  tightening/limit upheld, 0 mixed/status quo, -1 rights expansion/rule
  sunset, -2 major rights expansion/rollback.
- Include a reviewed starter federal beat set covering 1791, 14th Amendment
  context, Cruikshank, Presser, NFA, Miller, GCA, FOPA, Brady/NICS, the
  1994 federal ban and sunset, Lautenberg, PLCAA, Heller, McDonald, Caetano,
  Voisine, NYSRPA v NYC, BSCA, Bruen, frames/receivers agency rule, Rahimi,
  and Cargill. Split procedural/enacted/holding events where needed.
- Do not publish placeholder homepage URLs as if they were official opinions.
  If a direct source is not verified, leave the content out or mark it in a
  non-rendered planning fixture; do not silently weaken the source contract.

Reuse/refactor:
- Reuse lane.js instead of duplicating timeline zoom/pan/fit.
- Reuse the existing year parser/URL state and extract a shared scrubber
  helper only if needed.
- Reuse the Vance/Obama policy-drawer interaction. Extract a generic sticky
  info-panel or source-link renderer if that avoids duplicating
  paintPolicySelection/renderPolicyLinks/renderSourceChips.
- Do not use country warmth CSS/classes for regulation intensity or stats.
- Keep the changes scoped; do not redesign country/person plots.

Accessibility:
- All controls have labels and keyboard states.
- Meaning is present in text, not only color.
- Source links are labeled, HTTPS, target blank only with noopener/noreferrer.
- A compact layout can read the complete timeline, checklist, stats, and
  exemplar grid without horizontal clipping or a trapped drawer.

Verification:
- Run the repository’s static test script:
  node scripts/test-never-ending-internet-lore.mjs
- Add focused data/schema assertions for the new plot if the repository’s
  test style supports them.
- Use node/static checks to verify every rendered SCOTUS/statute beat has
  required source fields, all 15 checklist rows exist, CA/NY/TX exist, the
  stats have explicit coverage, and all 50-state picker code is absent from
  this V1 implementation.
- Do not use Computer Use, Playwright, browser automation, or screenshots.
- Commit and push the implementation before handoff. Prepare exactly one PR
  for this V1 implementation branch.

Do not implement the “full 50-state picker — plan now, build later” section.
The planning document’s schemas must remain future-compatible, but V1 ships
only the three exemplar records and the Coming Soon affordance.
```

## 10. Planning-pass verification

This planning change intentionally adds documentation only. Verification is:

- Markdown headings and code fences are balanced.
- JSON sketches are visually valid and explicitly labeled where values are
  placeholders/non-publishable.
- The plan references only existing repository seams or clearly labels new
  adapters/refactors.
- No `data/plots.json`, JavaScript, CSS, or production JSON is changed by the
  planning pass.
- The implementation handoff explicitly repeats the no-browser-testing and
  one-branch/one-PR constraints.
