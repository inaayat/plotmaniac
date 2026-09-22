# Plotmaniac

A dark field guide. Open the site and pick a person or a country, then read the web of friends and foes or the timeline under it. On a person’s web, people with more timeline beats sit closer to the center, and the ring still refits when the window changes. YouTubers is the person plot: one shared web for the H3 and Vlog Squad orbits, with a Focus control to read Ethan Klein’s timeline or David Dobrik’s. Overlapping people such as Trisha Paytas appear once. The United States plot is a current snapshot of foreign relations. Major allies (green outline) and major foes (red outline) fill the first view. Every flag is a circle, and the friend or foe outline is a ring around that circle. Neutrals have no ring. A line runs from the United States to each visible country: green-tinted for friends, red-tinted for foes, and gray for neutrals. Shared alliances such as NATO and Five Eyes add a thinner gold link between those countries, kept to a sparse tree so the first view stays readable. Choosing one region replaces the majors view with that region’s complete set of friends, foes, and neutrals, reflowed across the full field; choosing it again returns to the majors. Major countries within the selected region stay closer to the United States. Choosing a country opens its relationship timeline.

The timeline spans the browser width on a large screen. Zoom with the slider, the + and − buttons, or Control-scroll. Fit scales the whole line into the window. On a phone, the same timeline becomes a vertical chronological scroll.

On a phone, opening a plot starts on the full timeline. The web is still a tap away; on a narrow screen it pans, and names sit in a list under the map so they do not clip. A wide screen still opens on the web. Shared `?view=` links and a saved tab choice keep their place.

Serve the folder locally:

```bash
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000).

Check the archive with:

```bash
node scripts/test-never-ending-internet-lore.mjs
```

## Add another plot

1. Add `data/<id>/people.json`, `events.json`, and `relations.json` using the same fields as `data/youtubers/`.
2. Register it in `data/plots.json` with a `centerId`, `friendKinds`, and `enemyKinds`. A person plot can add `hubs` (each with `id`, `label`, `centerId`) and tag events with `hubs: ["h3"]` so one page can switch timeline focuses without duplicating people. Set `includeOrbit` when the web should keep people who are not friends or foes of the active center. With more than one plot, the site opens on a picker. Open `?plot=<id>` to jump straight in. `?plot=h3` still opens YouTubers.
3. A person can include a `portrait` only when the file is freely licensed on Wikimedia Commons. Store `src`, `page`, `author`, `license`, and `licenseUrl`. People without one get a monogram. Set `portrait.frame` to `flag` for a rectangular flag, and `images` to `flags` on the plot.
4. A country plot can set `arrangement` to `camps` and a `year` range (`min`, `max`, `initial`, `marks`). Give each relation `start` and, when it ends, `end` as years. The web dragger keeps only the spans that cover the chosen year. Foes sit on the left and friends on the right.
5. A country plot can instead set `disclosure` to `regions` and add `paths.countries`. Each country needs `status` (`friend`, `foe`, or `neutral`), `outline` (`green`, `red`, or `none`), `region`, `first_load`, and a `timeline` of `{ year, event }`. The field shows only `first_load` friends and foes until a region is selected. Region selection is exclusive: it replaces the majors view with every country in that region, then reflows those countries across the stage. Majors in that region stay nearer the center, the wider set runs out to the edges, and a neutral never gets a green or red outline.
6. A person plot can set `arrangement` to `topics` and `images` to `bubbles`. Policy nodes sit in topic wedges with a year scrubber. Choosing a policy opens a side panel on the same board — stance spans, blurb, links, and related beats — instead of navigating to a separate page.

Friend and enemy placement comes from each person’s relationship to the active center. A feud or lawsuit outweighs an older collaboration. Everyone else sits in “Around the sphere” on the YouTubers web, or “Around the show” when a plot leaves orbit off the first view. Dated relations are ignored until a year is chosen.
