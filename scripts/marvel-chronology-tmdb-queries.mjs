/**
 * TMDB lookup hints per chronology id (optional). `type`: movie | tv; `query` search string;
 * `tmdbId` skips search; `year` disambiguates search.
 */
export const TMDB_CHRONOLOGY_HINTS = {
  "one-shot-agent-carter": { type: "movie", query: "Marvel One-Shot: Agent Carter" },
  "one-shot-funny-thing-thor": { type: "movie", query: "A Funny Thing Happened on the Way to Thor's Hammer" },
  "one-shot-consultant": { type: "movie", query: "Marvel One-Shot: The Consultant" },
  "one-shot-item-47": { type: "movie", query: "Marvel One-Shot: Item 47" },
  "one-shot-all-hail-king": { type: "movie", query: "Marvel One-Shot: All Hail the King" },
  "x-men-2": { type: "movie", query: "X2: X-Men United" },
  "x-men": { type: "movie", query: "X-Men", year: 2000 },
  "incredible-hulk": { type: "movie", query: "The Incredible Hulk", year: 2008 },
  "the-avengers": { type: "movie", query: "The Avengers", year: 2012 },
  "captain-marvel": { type: "movie", query: "Captain Marvel", year: 2019 },
  "i-am-groot-s1": { type: "tv", query: "I Am Groot" },
  "i-am-groot-s2": { type: "tv", query: "I Am Groot" },
  "daredevil-s1": { type: "tv", query: "Daredevil", year: 2015 },
  "daredevil-s2": { type: "tv", query: "Daredevil", year: 2015 },
  "daredevil-s3": { type: "tv", query: "Daredevil", year: 2015 },
  "jessica-jones-s1": { type: "tv", query: "Jessica Jones", year: 2015 },
  "jessica-jones-s2": { type: "tv", query: "Jessica Jones", year: 2015 },
  "jessica-jones-s3": { type: "tv", query: "Jessica Jones", year: 2015 },
  "luke-cage-s1": { type: "tv", query: "Luke Cage", year: 2016 },
  "luke-cage-s2": { type: "tv", query: "Luke Cage", year: 2016 },
  "iron-fist-s1": { type: "tv", query: "Iron Fist", year: 2017 },
  "iron-fist-s2": { type: "tv", query: "Iron Fist", year: 2017 },
  "punisher-s1": { type: "tv", query: "The Punisher", year: 2017 },
  "punisher-s2": { type: "tv", query: "The Punisher", year: 2017 },
  "the-defenders": { type: "tv", query: "The Defenders", year: 2017 },
  "loki-s1": { type: "tv", query: "Loki", year: 2021 },
  "loki-s2": { type: "tv", query: "Loki", year: 2021 },
  "what-if-s1": { type: "tv", query: "What If...?" },
  "what-if-s2": { type: "tv", query: "What If...?" },
  "what-if-s3": { type: "tv", query: "What If...?" },
  "wandavision": { type: "tv", query: "WandaVision" },
  "falcon-winter-soldier": { type: "tv", query: "The Falcon and the Winter Soldier" },
  "hawkeye": { type: "tv", query: "Hawkeye", year: 2021 },
  "moon-knight": { type: "tv", query: "Moon Knight" },
  "ms-marvel": { type: "tv", query: "Ms. Marvel" },
  "she-hulk": { type: "tv", query: "She-Hulk: Attorney at Law" },
  "secret-invasion": { type: "tv", query: "Secret Invasion", year: 2023 },
  "echo": { type: "tv", query: "Echo", year: 2024 },
  "ironheart": { type: "tv", query: "Ironheart" },
  "agatha": { type: "tv", query: "Agatha All Along" },
  "marvel-zombies": { type: "tv", query: "Marvel Zombies" },
  "werewolf-by-night": { type: "movie", query: "Werewolf by Night" },
  "gotg-holiday": { type: "movie", query: "The Guardians of the Galaxy Holiday Special" },
  "born-again-s1": { type: "tv", query: "Daredevil: Born Again", year: 2025 },
  "born-again-s2": { type: "tv", query: "Daredevil: Born Again", year: 2025 },
  "wonder-man": { type: "tv", query: "Wonder Man" },
  "punisher-one-last-kill": { type: "movie", query: "The Punisher: One Last Kill" },
  "ff-first-steps-1964": { type: "movie", query: "The Fantastic Four: First Steps", year: 2025 },
  "logan-mid": { type: "movie", query: "Logan", year: 2017 },
  "brand-new-day": { type: "movie", query: "Spider-Man: Brand New Day", year: 2026 },
  "thunderbolts": { type: "movie", query: "Thunderbolts", year: 2025 },
  "eyes-of-wakanda": { type: "tv", query: "Eyes of Wakanda" },
  "deadpool-wolverine": { type: "movie", query: "Deadpool & Wolverine", year: 2024 },
};

/** Default search query from display title. */
export function defaultTmdbQuery(title) {
  return String(title || "")
    .replace(/^Marvel Studios One Shot:\s*/i, "")
    .replace(/\*$/, "")
    .replace(/…/g, "...")
    .trim();
}

/** Guess TMDB media type from title text. One-Shots stay movies in TMDB search. */
export function guessTmdbType(title) {
  if (/\bS\d+\b/i.test(title)) return "tv";
  if (/One Shot|Holiday Special|Werewolf By Night|One Last Kill/i.test(title)) return "movie";
  if (/Vision|Attorney at Law|Born Again|Zombies|Groot|What If/i.test(title)) return "tv";
  return "movie";
}

/** One-Shots and other short stories follow the TV filter, not the feature-film list. */
export function chronologyTitleIsShort(id, title = "") {
  if (/^one-shot-/.test(String(id || ""))) return true;
  return /One Shot|Holiday Special|Werewolf By Night|One Last Kill/i.test(String(title || ""));
}

/**
 * Watch-order kind. Shorts are `tv` so Include TV hides them by default.
 * TMDB lookup type stays separate (`guessTmdbType`).
 */
export function chronologyKindForId(id, title) {
  if (chronologyTitleIsShort(id, title)) return "tv";
  const hinted = TMDB_CHRONOLOGY_HINTS[id]?.type;
  if (hinted === "tv" || hinted === "movie") return hinted;
  return guessTmdbType(title) === "tv" ? "tv" : "movie";
}
