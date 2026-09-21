# Plotmaniac

A dark field guide. Open the site and pick a person or a country, then read the web of friends and foes or the timeline under it. On a person’s web, people with more timeline beats sit closer to the center, and the ring still refits when the window changes. H3 is the person plot. The United States is the country plot: flags stand in for portraits, and a year dragger on the web moves each country between foe (left) and friend (right).

The timeline spans the browser width. Zoom with the slider, the + and − buttons, or Control-scroll. Fit scales the whole line into the window.

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

1. Add `data/<id>/people.json`, `events.json`, and `relations.json` using the same fields as `data/h3/`.
2. Register it in `data/plots.json` with a `centerId`, `friendKinds`, and `enemyKinds`. With more than one plot, the site opens on a picker. Open `?plot=<id>` to jump straight in.
3. A person can include a `portrait` only when the file is freely licensed on Wikimedia Commons. Store `src`, `page`, `author`, `license`, and `licenseUrl`. People without one get a monogram. Set `portrait.frame` to `flag` for a rectangular flag, and `images` to `flags` on the plot.
4. A country plot can set `arrangement` to `camps` and a `year` range (`min`, `max`, `initial`, `marks`). Give each relation `start` and, when it ends, `end` as years. The web dragger keeps only the spans that cover the chosen year. Foes sit on the left and friends on the right.

Friend and enemy placement comes from each person’s relationship to the center. A feud or lawsuit outweighs an older collaboration. Everyone else sits in “Around the show.” Dated relations are ignored until a year is chosen.
