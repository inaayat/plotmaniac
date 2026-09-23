/**
 * Parse Karan's Wikipedia MCU character index and map appearances onto
 * chronology titles + people.json ids.
 *
 * Vague labels like "Multiple MCU films" do not invent new titles: those people
 * stay only on MCU-film chronology rows they already occupied.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CHARACTER_INDEX_PATH = path.join(root, "data/marvel-universe/character-index.md");

const SEASON_SUFFIX = /^(.+) s\d+$/;

/** Explicit multi-title phrases from the Wikipedia appearance cells. */
const TITLE_EXPANSIONS = {
  "iron man films": ["iron-man", "iron-man-2", "iron-man-3"],
  "thor films": ["thor", "thor-dark-world", "ragnarok", "love-and-thunder"],
  "spider man films": ["homecoming", "far-from-home", "no-way-home"],
  "avengers films": ["the-avengers", "age-of-ultron", "infinity-war", "endgame"],
};

const SKIP_APPEARANCES = new Set([
  "multiple mcu films",
  "upcoming",
]);

const FAMILY_NAME = /\bfamily\b/i;

export function normalizeTitleKey(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[*…]+/g, " ")
    .replace(/\.{3}/g, " ")
    .replace(/&/g, " and ")
    .replace(/vol\.?/g, "vol")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeNameKey(value) {
  return String(value || "")
    .toLocaleLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCellList(cell) {
  const text = String(cell || "").trim();
  if (!text) return [];
  const parts = [];
  let current = "";
  let depth = 0;
  for (const ch of text) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parsePipeRow(line) {
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  return cells;
}

export function parseCharacterIndex(markdown) {
  const characters = [];
  const movies = [];
  const shows = [];
  let section = "";
  for (const raw of String(markdown || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      const heading = line.slice(3).trim();
      if (heading === "Movies") section = "movies";
      else if (heading === "TV / Streaming Series") section = "";
      else if (heading.startsWith("Marvel Television") || heading.startsWith("Marvel Studios")) {
        section = "shows";
      } else if (heading.length === 1) {
        section = "characters";
      } else {
        section = "";
      }
      continue;
    }
    if (!line.startsWith("|") || /^\|[-| ]+\|$/.test(line) || line.includes("Real Name") || line.includes("Release Date") || line.includes("Year(s)")) {
      continue;
    }
    const cells = parsePipeRow(line);
    if (section === "characters" && cells.length >= 5) {
      const [realName, alias, actor, moviesCell, showsCell] = cells;
      if (FAMILY_NAME.test(realName)) continue;
      characters.push({
        realName,
        alias,
        actor,
        movies: splitCellList(moviesCell),
        shows: splitCellList(showsCell),
      });
    } else if (section === "movies" && cells.length >= 2) {
      movies.push(cells[1]);
    } else if (section === "shows" && cells.length >= 1) {
      shows.push(cells[0]);
    }
  }
  return { characters, movies, shows };
}

function personKeys(person) {
  const keys = new Set();
  const stripped = String(person.name || "").replace(/\s*\([^)]*\)/g, "");
  keys.add(normalizeNameKey(stripped));
  stripped.split("/").forEach((part) => {
    const key = normalizeNameKey(part);
    if (key) keys.add(key);
  });
  keys.add(person.id.replace(/-/g, " "));
  return [...keys].filter(Boolean);
}

const PERSON_ALIASES = {
  "ancient one": "the-ancient-one",
  "michelle mj jones watson": "mj-mcu",
  "mj": "mj-mcu",
  "kang conqueror": "he-who-remains",
  "he who remains": "he-who-remains",
  "valentina allegra de fontaine": "valentina-fontaine",
  "rocket raccoon": "rocket",
  "drax destroyer": "drax",
  "hunter b 15": "hunter-b15",
  "sylvie laufeydottir": "sylvie",
  "loki laufeyson": "loki-main",
  "james rhodey rhodes": "james-rhodes",
  "carl lucas": "luke-cage",
  "vanessa carlysle": "vanessa-fox",
  "negasonic teenage warhead": "negasonic-fox",
  "piotr rasputin": "colossus-fox",
  "colossus": "colossus-fox",
  "laura": "laura-fox",
  "hank mccoy": "beast-fox",
  "beast": "beast-fox",
  "mbaku": "mbaku",
};

export function buildPersonIndex(people) {
  const byKey = new Map();
  const byId = new Map(people.map((person) => [person.id, person]));
  for (const person of people) {
    for (const key of personKeys(person)) {
      if (!byKey.has(key)) byKey.set(key, []);
      const list = byKey.get(key);
      if (!list.some((item) => item.id === person.id)) list.push(person);
    }
  }
  return { byKey, byId };
}

function pickPerson(candidates, titleId) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const ids = new Set(candidates.map((item) => item.id));
  if (ids.has("loki-tva") || ids.has("loki-main")) {
    return candidates.find((item) => item.id === ((titleId === "loki-s1" || titleId === "loki-s2") ? "loki-tva" : "loki-main"));
  }
  if ([...ids].some((id) => id.startsWith("peter-parker"))) {
    if (titleId === "deadpool-wolverine") return null;
    return candidates.find((item) => item.id === "peter-parker-mcu") || candidates[0];
  }
  if (ids.has("charles-xavier-fox") || ids.has("charles-xavier-838")) {
    return candidates.find((item) => item.id === (titleId === "multiverse-madness" ? "charles-xavier-838" : "charles-xavier-fox"));
  }
  if (ids.has("reed-richards-first") || ids.has("reed-richards-838")) {
    return candidates.find((item) => item.id === (titleId === "multiverse-madness" ? "reed-richards-838" : "reed-richards-first"));
  }
  if (ids.has("johnny-storm-first") || ids.has("johnny-storm-fox")) {
    return candidates.find((item) => item.id === (titleId === "deadpool-wolverine" ? "johnny-storm-fox" : "johnny-storm-first"));
  }
  if (ids.has("otto-octavius-raimi") && titleId !== "no-way-home") return null;
  if (ids.has("norman-osborn-raimi") && titleId !== "no-way-home") return null;
  return candidates[0];
}

const VARIANT_TITLES = new Set([
  "deadpool-wolverine",
  "the-marvels",
  "no-way-home",
  "multiverse-madness",
  "what-if-s1",
  "what-if-s2",
  "what-if-s3",
]);

function allowedOnTitle(person, titleId) {
  if (/-(fox|raimi|webb|838)$/.test(person.id)) return VARIANT_TITLES.has(titleId);
  return true;
}

export function matchIndexRowToPeople(row, personIndex, titleId) {
  const real = normalizeNameKey(row.realName);
  const alias = normalizeNameKey(row.alias);
  if (real === "loki laufeyson" || real === "loki") {
    const pair = ["loki-main", "loki-tva"].map((id) => personIndex.byId.get(id)).filter(Boolean);
    const picked = pickPerson(pair, titleId);
    return picked ? [picked] : [];
  }

  const scored = new Map();
  const consider = (person, score) => {
    if (!person || !allowedOnTitle(person, titleId)) return;
    const prev = scored.get(person.id) || 0;
    if (score > prev) scored.set(person.id, score);
  };

  const aliasId = PERSON_ALIASES[real] || PERSON_ALIASES[alias];
  if (aliasId) consider(personIndex.byId.get(aliasId), 5);

  (personIndex.byKey.get(real) || []).forEach((person) => consider(person, 4));
  if (alias) (personIndex.byKey.get(alias) || []).forEach((person) => consider(person, 1));

  const ranked = [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => personIndex.byId.get(id));
  if (!ranked.length) return [];
  const best = scored.get(ranked[0].id);
  if (best <= 1 && real && !(personIndex.byKey.get(real) || []).length && !PERSON_ALIASES[real]) {
    return [];
  }
  const top = ranked.filter((person) => scored.get(person.id) === best);
  const picked = pickPerson(top, titleId);
  return picked ? [picked] : [];
}

function buildTitleLookup(titles) {
  const byKey = new Map();
  const add = (key, id) => {
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, []);
    const list = byKey.get(key);
    if (!list.includes(id)) list.push(id);
  };
  titles.forEach((entry) => {
    add(normalizeTitleKey(entry.title), entry.id);
    if (entry.filterLabel) add(normalizeTitleKey(entry.filterLabel), entry.id);
  });
  titles.forEach((entry) => {
    const key = normalizeTitleKey(entry.title);
    const season = key.match(SEASON_SUFFIX);
    if (!season) return;
    add(season[1], entry.id);
  });
  return byKey;
}

export function appearanceToTitleIds(raw, titleLookup) {
  const key = normalizeTitleKey(raw);
  if (!key || SKIP_APPEARANCES.has(key)) return { ids: [], kind: key === "multiple mcu films" ? "vague" : "skip" };
  if (TITLE_EXPANSIONS[key]) return { ids: TITLE_EXPANSIONS[key], kind: "expansion" };
  const exact = titleLookup.get(key) || [];
  if (exact.length) return { ids: exact, kind: "exact" };
  return { ids: [], kind: "unmatched" };
}

const MCU_FILM_IDS = new Set([
  "iron-man", "iron-man-2", "iron-man-3", "incredible-hulk", "thor", "captain-america-first-avenger",
  "the-avengers", "thor-dark-world", "winter-soldier", "guardians-1", "age-of-ultron", "ant-man",
  "civil-war", "doctor-strange", "guardians-2", "homecoming", "ragnarok", "black-panther",
  "infinity-war", "ant-man-wasp", "captain-marvel", "endgame", "far-from-home", "black-widow",
  "shang-chi", "eternals", "no-way-home", "multiverse-madness", "love-and-thunder", "wakanda-forever",
  "quantumania", "gotg-3", "the-marvels", "deadpool-wolverine", "brave-new-world", "thunderbolts",
  "ff-first-steps-1964", "ff-first-steps-official",
]);

/**
 * Overlay Wikipedia appearances onto chronology titles.
 * Returns { titles, report }.
 */
export function overlayChronologyCast(chronologyTitles, people, index) {
  const personIndex = buildPersonIndex(people);
  const titleLookup = buildTitleLookup(chronologyTitles);
  const byTitle = new Map(chronologyTitles.map((entry) => [entry.id, []]));
  const unmatchedAppearances = new Map();
  const vaguePersonIds = new Set();
  const addToTitle = (titleId, personId) => {
    if (!byTitle.has(titleId)) return;
    const list = byTitle.get(titleId);
    if (!list.includes(personId)) list.push(personId);
  };
  for (const row of index.characters) {
    const hasSpecific = row.movies.length + row.shows.length > 0;
    if (!hasSpecific) continue;
    for (const appearance of [...row.movies, ...row.shows]) {
      const mapped = appearanceToTitleIds(appearance, titleLookup);
      if (mapped.kind === "vague") {
        matchIndexRowToPeople(row, personIndex, "iron-man").forEach((person) => vaguePersonIds.add(person.id));
        continue;
      }
      if (mapped.kind === "unmatched") {
        const label = normalizeTitleKey(appearance);
        unmatchedAppearances.set(label, (unmatchedAppearances.get(label) || 0) + 1);
        continue;
      }
      if (!mapped.ids.length) continue;
      for (const titleId of mapped.ids) {
        const peopleHits = matchIndexRowToPeople(row, personIndex, titleId);
        peopleHits.forEach((person) => addToTitle(titleId, person.id));
      }
    }
  }

  const updated = [];
  const kept = [];
  const titles = chronologyTitles.map((entry) => {
    const overlay = byTitle.get(entry.id) || [];
    const previous = entry.characters || [];
    if (overlay.length) {
      const extra = MCU_FILM_IDS.has(entry.id)
        ? previous.filter((id) => vaguePersonIds.has(id) && !overlay.includes(id))
        : [];
      const characters = [...overlay, ...extra];
      if (characters.join() !== previous.join()) updated.push(entry.id);
      return { ...entry, characters };
    }
    kept.push(entry.id);
    return entry;
  });

  return {
    titles,
    report: {
      updatedTitleIds: updated,
      keptTitleIds: kept,
      unmatchedAppearances: [...unmatchedAppearances.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([label, count]) => ({ label, count })),
    },
  };
}

export function loadCharacterIndex(filePath = CHARACTER_INDEX_PATH) {
  return parseCharacterIndex(fs.readFileSync(filePath, "utf8"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const people = JSON.parse(fs.readFileSync(path.join(root, "data/marvel-universe/people.json"), "utf8"));
  const chronology = JSON.parse(fs.readFileSync(path.join(root, "data/marvel-universe/chronology.json"), "utf8"));
  const index = loadCharacterIndex();
  const { titles, report } = overlayChronologyCast(chronology.titles, people, index);
  console.log(`index characters: ${index.characters.length}`);
  console.log(`updated titles: ${report.updatedTitleIds.length}`);
  console.log(`kept (no index hits): ${report.keptTitleIds.join(", ")}`);
  console.log("sample updates:");
  for (const id of report.updatedTitleIds.slice(0, 12)) {
    const next = titles.find((entry) => entry.id === id);
    const prev = chronology.titles.find((entry) => entry.id === id);
    console.log(`  ${id}: ${prev.characters.join(", ")}`);
    console.log(`    -> ${next.characters.join(", ")}`);
  }
  console.log("unmatched appearance labels:", report.unmatchedAppearances.slice(0, 25));
}
