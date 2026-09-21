# Plotmaniac

A dark field guide for public internet plots. The first plot is H3: an animated web of Ethan Klein’s friends and enemies, a person page for each relationship, and a left-to-right timeline of the sourced beats.

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
2. Register it in `data/plots.json` with a `centerId`, `friendKinds`, and `enemyKinds`.
3. A person can include a `portrait` only when the file is freely licensed on Wikimedia Commons. Store `src`, `page`, `author`, `license`, and `licenseUrl`. People without one get a monogram.
4. Open `?plot=<id>`. With a single plot, the site opens on its web.

Friend and enemy placement comes from each person’s relationship to the center. A feud or lawsuit outweighs an older collaboration. Everyone else sits in “Around the show.”
