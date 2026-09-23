# Marvel Cinematic Universe / Marvel film multiverse plot

Reusable multi-hub mechanics (focus control, `minBeats`, event `hubs`): [templates/multi-hub-focus.md](templates/multi-hub-focus.md).

## Design

- **Plot id:** `marvel-universe`
- **Title:** Marvel Cinematic Universe
- **Kicker:** `Marvel`
- **Card line:** `Heroes, villains, timelines, and variant worlds`
- **Lede:** `Spoilers through Daredevil: Born Again season 2 and The Punisher: One Last Kill. Pick a title to study up: Watch Before on the left, Watch Next on the right, and the cast under the selected movie. MCU main means the shared Sacred Timeline / Earth-616 screen continuity (often called Earth-199999 by fans); guest worlds remain separate.`
- **Search placeholder:** `Avengers, TVA, Wakanda, Spider-Man, a film…`
- **Title filter:** `titleFilter: true` puts that search on the main chrome and focuses a matching chronology title (`?title=`).
- **Default view:** watch-order focus layout (`defaultView: "timeline"`). Opening `?plot=marvel-universe` or clicking Marvel on the homepage gallery lands here (`plotChooserHref` adds `view=timeline`), not on the character web.
- **Chronology view:** `?plot=marvel-universe&view=chronology` is the dedicated full story-order timeline (same horizontal lane as other plots on a wide screen, a vertical spine on a phone). Each title shows its poster and the characters in that title. **Full chronological list** on Watch Order, and Chronology in the nav, open that page. Choosing a title returns to Watch Order focused on that film.
- **Include TV shows:** checkbox beside Title / Watch Order. Off by default (movies, One-Shots, and film-adjacent specials Karan already marks as `kind: "movie"`). On (`?tv=1`, remembered in localStorage for in-app plot opens) includes Disney+/Netflix/series already in the chronology (`kind: "tv"`). Filter applies to Watch Before / Watch Next, the chip strip, the chronology page, and the title picker.
- **Center id:** `tony-stark`

### Primary view — watch-order focus

The main Marvel page is a three-column study-up board:

- **Watch Before** (left): portrait posters for listed prerequisites, with arrows toward the selected title. Must / should / could tiers still order the stack, without extra tier chrome.
- **Selected Movie** (center): large focal poster and title.
- **Characters** (under center): a horizontal row of circular cast avatars (Commons portraits, initials if none).
- **Watch Next** (right): titles this one feeds into, or the next chronological successors if there is no outbound edge.

Clicking a left or right poster refocuses that title (center updates, sides recompute, View Transitions when the browser allows). Title search in the chrome and the compact chronological chip strip at the top also change focus. Side-rail posters scale with stack length so every Watch Before / Watch Next title stays on screen.

### Chronology page

`?view=chronology` (Chronology in the Marvel nav, or **Full chronological list** on Watch Order) is a scrollable story-order timeline: posters and the characters in each title, oldest on the left on a wide screen and top-to-bottom on a phone. Choosing a title returns to Watch Order focused on that film.

### Archived character web

The universe-membership character web is kept, but it is not the default entry and is hidden from primary nav. Open it with `?plot=marvel-universe&view=web`, or the quiet **Character web (archived)** link on the watch-order page. Hub Focus remains on that archived view only. Homepage gallery cards and the plot switcher must not land here.

The web still uses the YouTubers-style hub field. Hubs are universe focus controls, not extra non-character nodes; each hub is anchored by a real character who appears in that universe. The hub’s `universe-member` relations are deliberately neutral, so focusing a hub reveals its exclusive membership without turning every member into a “friend” of the anchor. The plot sets the existing layout threshold to `minBeats: 1` and wires that option through the loader so one-film multiverse variants still appear in a universe focus; other plots retain the default two-beat web threshold.

| Hub id | Label | Center character | Scope |
| --- | --- | --- | --- |
| `mcu-main` | MCU main | Tony Stark / Iron Man | Shared MCU Sacred Timeline; Earth-616 screen labeling, with Earth-199999 noted as fan terminology |
| `raimi` | Raimi Spider-Man | Peter Parker / Spider-Man (Raimi) | Sam Raimi’s Spider-Man trilogy and its No Way Home variant |
| `webb` | Webb Spider-Man | Peter Parker / Spider-Man (Webb) | The Amazing Spider-Man continuity and its No Way Home variant |
| `fox` | Fox X-Men / Deadpool | Wade Wilson / Deadpool | Fox X-Men and Deadpool corridor, including the TVA bridge in Deadpool & Wolverine |
| `earth-838` | Earth-838 | Reed Richards / Mister Fantastic (Earth-838) | The Illuminati reality shown in Doctor Strange in the Multiverse of Madness |
| `first-steps` | First Steps universe | Reed Richards / Mister Fantastic (First Steps) | The retro-futuristic alternate universe of The Fantastic Four: First Steps |
| `venom` | Sony’s Venom universe | Eddie Brock / Venom | The distinct Sony universe and its temporary No Way Home bridge |

### Relations

The relation ontology is intentionally small:

- `ally`, `team`, `mentor`, `protégé`, `family`, `romance`, and `organization` are in `friendKinds`; they place trusted, team, family, or institutional ties on the green side of the web.
- `enemy`, `rival`, `conflict`, `betrayal`, and `murderer` are in `enemyKinds`; the engine’s enemy precedence keeps an active feud readable when an older alliance also exists.
- `universe-member` and `variant-of` are neutral orbit relations. `universe-member` encodes focusable universe membership; `variant-of` makes same-mantle links explicit without pretending that two variants are the same person. `organization` is used only for story relationships, while hub membership remains neutral.

The data prioritizes founding Avengers bonds and the Civil War fracture, the Guardians crew, Wakanda, Strange–Wanda–Wong, Daredevil–Kingpin–Punisher, Loki–Sylvie–Mobius and the TVA, the Thunderbolts cluster, and cross-universe Spider-Man, X-Men, Fantastic Four, and Venom variant links. No new rendering arrangement is required; the only engine-facing changes are passing the already-supported minimum-beat option from plot metadata and giving the seven-hub layout unique radial sectors instead of reusing the four cardinal slots.

The Marvel plot specializes the hub chrome slightly: Focus opens on `All`, with `Shared web` still available for the common cast, and its accessible web description explains universe focus rather than calling the board a YouTuber web. Other plots keep their existing labels and copy. Hub names wrap in full, including after the camera zooms.

### Cast

Principal names on each watch-order title come from Karan’s Wikipedia MCU character index (`data/marvel-universe/character-index.md`): a character is attached to a chronology title when that title appears in their Movies or TV Shows cell. Title matching strips years, `Thunderbolts*`, `What If…?` ellipses, and season suffixes (`Loki` → S1 and S2). Fox X-Men films, one-shots, and other titles the index never names keep the previous principal lists. Blank appearance rows are skipped.

Character faces use freely licensed Wikimedia Commons portraits (often event photos of the actor). A person without a free Commons file keeps a monogram.

### Timeline

Events follow the attached Karan guide’s **story-order** list. Because the guide supplies a sequence rather than exact in-universe calendar dates, `date` uses an approximate in-universe year with `01-01` for ordered beats in that year; it is not a release-date timeline. Series are split at major turning points where that improves the story rather than listing every episode. Each event includes its involved people and the universe hub or hubs that the beat belongs to. The official Marvel chronology page is used as the common source link, with title-specific links where useful.

The lede and source note carry the guide’s spoiler boundary. The source note also states that this is a compressed orientation timeline, not a complete episode guide.

### Intentionally out of scope for v1

- Every *What If...?* episode and every animated variant.
- Every Defenders supporting character, One-Shot, and background cameo.
- A full cast directory for legacy Fox, Sony, or earlier Fantastic Four films.
- Exact episode-by-episode dates, release-order viewing advice, and a complete Infinity Stone inventory.
- Copyrighted studio stills: only fully attributed Wikimedia Commons images are used for portraits.
