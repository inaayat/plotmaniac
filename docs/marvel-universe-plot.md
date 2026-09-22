# Marvel Cinematic Universe / Marvel film multiverse plot

Reusable multi-hub mechanics (focus control, `minBeats`, event `hubs`): [templates/multi-hub-focus.md](templates/multi-hub-focus.md).

## Design

- **Plot id:** `marvel-universe`
- **Title:** Marvel Cinematic Universe
- **Kicker:** `Marvel`
- **Card line:** `Heroes, villains, timelines, and variant worlds`
- **Lede:** `Spoilers through Daredevil: Born Again season 2 and The Punisher: One Last Kill. Follow the character web, read the MCU in story order, or focus a universe to see who belongs there. MCU main means the shared Sacred Timeline / Earth-616 screen continuity (often called Earth-199999 by fans); guest worlds remain separate.`
- **Search placeholder:** `Avengers, TVA, Wakanda, Spider-Man, a film…`
- **Center id:** `tony-stark`

The plot uses the existing YouTubers-style hub field. Hubs are universe focus controls, not extra non-character nodes; each hub is anchored by a real character who appears in that universe. The hub’s `universe-member` relations are deliberately neutral, so focusing a hub reveals its exclusive membership without turning every member into a “friend” of the anchor. The plot sets the existing layout threshold to `minBeats: 1` and wires that option through the loader so one-film multiverse variants still appear in a universe focus; other plots retain the default two-beat web threshold.

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

The Marvel plot specializes the hub chrome slightly: its focus options read `Shared web` and `All characters`, and its accessible web description explains universe focus rather than calling the board a YouTuber web. Other plots keep their existing labels and copy.

### Timeline

Events follow the attached Karan guide’s **story-order** list. Because the guide supplies a sequence rather than exact in-universe calendar dates, `date` uses an approximate in-universe year with `01-01` for ordered beats in that year; it is not a release-date timeline. Series are split at major turning points where that improves the story rather than listing every episode. Each event includes its involved people and the universe hub or hubs that the beat belongs to. The official Marvel chronology page is used as the common source link, with title-specific links where useful.

The lede and source note carry the guide’s spoiler boundary. The source note also states that this is a compressed orientation timeline, not a complete episode guide.

### Intentionally out of scope for v1

- Every *What If...?* episode and every animated variant.
- Every Defenders supporting character, One-Shot, and background cameo.
- A full cast directory for legacy Fox, Sony, or earlier Fantastic Four films.
- Exact episode-by-episode dates, release-order viewing advice, and a complete Infinity Stone inventory.
- A portrait for every character: copyrighted studio stills are skipped, and only fully attributed Wikimedia Commons images are eligible.
