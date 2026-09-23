#!/usr/bin/env node
/**
 * Builds data/marvel-universe/chronology.json from Karan's order + principal cast lists.
 * Run: node scripts/build-marvel-chronology.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MARVEL_CHRONOLOGY_ORDER } from "./marvel-chronology-data.mjs";
import { CHRONOLOGY_PREREQ_EDGES } from "./marvel-chronology-prereqs.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const people = JSON.parse(fs.readFileSync(path.join(root, "data/marvel-universe/people.json"), "utf8"));
const peopleIds = new Set(people.map((p) => p.id));

const FOX_CORE = [
  "charles-xavier-fox",
  "magneto-fox",
  "mystique-fox",
  "beast-fox",
  "logan-wolverine",
  "cyclops-fox",
  "storm-fox",
  "jean-grey-fox",
  "rogue-fox",
  "iceman-fox",
  "kitty-pride-fox",
];

const FOX_CLASS = [...FOX_CORE, "havok-fox", "emma-frost-fox"];
const FOX_TRILOGY = [...FOX_CORE, "nightcrawler-fox"];
const FOX_APOCALYPSE = [...FOX_CORE, "nightcrawler-fox", "apocalypse-fox", "quicksilver-fox"];
const FOX_DARK_PHOENIX = [...FOX_CORE, "nightcrawler-fox", "quicksilver-fox"];
const FOX_ORIGINS = ["logan-wolverine", "charles-xavier-fox", "cyclops-fox", "storm-fox", "jean-grey-fox", "wade-wilson", "sabretooth-fox"];
const FOX_WOLVERINE = ["logan-wolverine", "charles-xavier-fox", "yukio-fox"];
const FOX_LOGAN = ["logan-wolverine", "charles-xavier-fox", "laura-fox"];
const FOX_DEADPOOL = ["wade-wilson", "vanessa-fox", "colossus-fox", "negasonic-fox"];
const FOX_DEADPOOL_2 = [...FOX_DEADPOOL, "cable-fox", "domino-fox"];
const FOX_DAW = ["wade-wilson", "logan-wolverine", "charles-xavier-fox", "beast-fox", "johnny-storm-fox", "loki-tva", "hunter-b15"];

const STREET_CORE = ["matt-murdock", "karen-page", "wilson-fisk", "frank-castle"];
const DEFENDERS = ["matt-murdock", "jessica-jones", "luke-cage", "danny-rand", "karen-page"];
const NETFLIX_DAREDEVIL = [...STREET_CORE, "jessica-jones", "elektra-natchios"];
const NETFLIX_JESSICA = ["jessica-jones", "luke-cage", "trish-walker", "matt-murdock"];
const NETFLIX_LUKE = ["luke-cage", "misty-knight", "jessica-jones", "claire-temple"];
const NETFLIX_IRON_FIST = ["danny-rand", "colleen-wing", "luke-cage", "jessica-jones"];
const NETFLIX_PUNISHER = ["frank-castle", "matt-murdock", "karen-page", "microchip"];

const CAST_BY_ID = {
  "eyes-of-wakanda": ["tchalla", "shuri", "okoye", "nakia"],
  "captain-america-first-avenger": ["steve-rogers", "peggy-carter", "bucky-barnes", "nick-fury", "howard-stark"],
  "one-shot-agent-carter": ["peggy-carter", "howard-stark"],
  "x-men-first-class": FOX_CLASS,
  "ff-first-steps-1964": ["reed-richards-first", "sue-storm-first", "johnny-storm-first", "ben-grimm-first", "shalla-bal", "galactus-first"],
  "x-men-days-of-future-past": FOX_DARK_PHOENIX,
  "x-men-origins-wolverine": FOX_ORIGINS,
  "x-men-apocalypse": FOX_APOCALYPSE,
  "x-men-dark-phoenix": FOX_DARK_PHOENIX,
  "captain-marvel": ["carol-danvers", "nick-fury", "talos", "monica-rambeau"],
  "x-men": FOX_TRILOGY,
  "x-men-2": FOX_TRILOGY,
  "x-men-last-stand": FOX_TRILOGY,
  "iron-man": ["tony-stark", "pepper-potts", "james-rhodes", "nick-fury"],
  "iron-man-2": ["tony-stark", "pepper-potts", "james-rhodes", "natasha-romanoff", "nick-fury"],
  "incredible-hulk": ["bruce-banner", "betty-ross", "thaddeus-ross"],
  "one-shot-funny-thing-thor": ["phil-coulson"],
  "thor": ["thor", "loki-main", "jane-foster", "odin-borson", "heimdall"],
  "one-shot-consultant": ["phil-coulson", "nick-fury", "james-rhodes"],
  "the-avengers": ["tony-stark", "steve-rogers", "thor", "bruce-banner", "natasha-romanoff", "clint-barton", "nick-fury", "loki-main", "pepper-potts"],
  "the-wolverine": FOX_WOLVERINE,
  "one-shot-item-47": ["nick-fury", "james-rhodes"],
  "thor-dark-world": ["thor", "loki-main", "jane-foster", "odin-borson"],
  "iron-man-3": ["tony-stark", "pepper-potts", "james-rhodes", "trevor-slattery"],
  "one-shot-all-hail-king": ["trevor-slattery"],
  "winter-soldier": ["steve-rogers", "natasha-romanoff", "bucky-barnes", "sam-wilson", "nick-fury", "peggy-carter"],
  "guardians-1": ["peter-quill", "gamora", "rocket", "groot", "drax", "nebula", "thanos"],
  "guardians-2": ["peter-quill", "gamora", "rocket", "groot", "drax", "mantis", "nebula"],
  "i-am-groot-s1": ["groot"],
  "i-am-groot-s2": ["groot"],
  "daredevil-s1": NETFLIX_DAREDEVIL,
  "jessica-jones-s1": NETFLIX_JESSICA,
  "age-of-ultron": ["tony-stark", "steve-rogers", "thor", "bruce-banner", "natasha-romanoff", "clint-barton", "james-rhodes", "wanda-maximoff", "vision"],
  "ant-man": ["scott-lang", "hope-van-dyne", "hank-pym", "janet-van-dyne", "cassie-lang"],
  "daredevil-s2": NETFLIX_DAREDEVIL,
  "luke-cage-s1": NETFLIX_LUKE,
  "deadpool": FOX_DEADPOOL,
  "iron-fist-s1": NETFLIX_IRON_FIST,
  "the-defenders": DEFENDERS,
  "civil-war": ["tony-stark", "steve-rogers", "bucky-barnes", "sam-wilson", "natasha-romanoff", "james-rhodes", "tchalla", "peter-parker-mcu", "clint-barton"],
  "black-widow": ["natasha-romanoff", "yelena-belova", "alexei-shostakov"],
  "black-panther": ["tchalla", "shuri", "okoye", "mbaku", "nakia", "ayo", "everett-ross"],
  "homecoming": ["peter-parker-mcu", "tony-stark", "may-parker", "mj-mcu", "ned-leeds"],
  "punisher-s1": NETFLIX_PUNISHER,
  "doctor-strange": ["stephen-strange", "wong", "mordo", "the-ancient-one"],
  "jessica-jones-s2": NETFLIX_JESSICA,
  "luke-cage-s2": NETFLIX_LUKE,
  "iron-fist-s2": NETFLIX_IRON_FIST,
  "daredevil-s3": NETFLIX_DAREDEVIL,
  "ragnarok": ["thor", "loki-main", "valkyrie", "bruce-banner", "heimdall"],
  "punisher-s2": NETFLIX_PUNISHER,
  "jessica-jones-s3": NETFLIX_JESSICA,
  "ant-man-wasp": ["scott-lang", "hope-van-dyne", "hank-pym", "janet-van-dyne", "cassie-lang"],
  "infinity-war": ["thanos", "tony-stark", "steve-rogers", "thor", "bruce-banner", "wanda-maximoff", "vision", "stephen-strange", "peter-parker-mcu", "peter-quill", "gamora", "nebula", "rocket", "groot", "drax", "mantis", "loki-main", "carol-danvers"],
  "deadpool-2": FOX_DEADPOOL_2,
  "endgame": ["tony-stark", "steve-rogers", "thor", "bruce-banner", "natasha-romanoff", "clint-barton", "scott-lang", "nebula", "rocket", "carol-danvers", "sam-wilson", "bucky-barnes", "peter-parker-mcu", "pepper-potts", "thanos"],
  "loki-s1": ["loki-tva", "sylvie", "mobius", "hunter-b15", "he-who-remains"],
  "what-if-s1": ["loki-tva", "peggy-carter", "tchalla", "stephen-strange", "wanda-maximoff", "natasha-romanoff"],
  "marvel-zombies": ["wanda-maximoff", "stephen-strange", "peter-parker-mcu", "bruce-banner", "scott-lang"],
  "wandavision": ["wanda-maximoff", "vision", "billy-maximoff", "agatha-harkness", "monica-rambeau"],
  "shang-chi": ["shang-chi", "katy-chen", "xu-wenwu", "xu-xialing", "trevor-slattery"],
  "falcon-winter-soldier": ["sam-wilson", "bucky-barnes", "yelena-belova", "valentina-fontaine", "tchalla", "shuri"],
  "far-from-home": ["peter-parker-mcu", "mj-mcu", "ned-leeds", "nick-fury", "talos"],
  "eternals": ["sersi", "thena", "ikaris", "sprite", "phastos", "kingo"],
  "no-way-home": ["peter-parker-mcu", "peter-parker-raimi", "peter-parker-webb", "stephen-strange", "mj-mcu", "ned-leeds", "may-parker", "norman-osborn-raimi", "otto-octavius-raimi", "curt-connors-webb", "max-dillon-webb", "eddie-brock-venom"],
  "multiverse-madness": ["stephen-strange", "america-chavez", "wanda-maximoff", "wong", "reed-richards-838", "charles-xavier-838"],
  "hawkeye": ["clint-barton", "kate-bishop", "maya-lopez", "wilson-fisk", "yelena-belova"],
  "moon-knight": ["marc-spector", "layla-el-faouly", "steven-grant"],
  "wakanda-forever": ["shuri", "okoye", "mbaku", "nakia", "namor", "riri-williams", "everett-ross"],
  "echo": ["maya-lopez", "wilson-fisk"],
  "she-hulk": ["jennifer-walters", "bruce-banner", "wong", "titania"],
  "ms-marvel": ["kamala-khan", "monica-rambeau"],
  "love-and-thunder": ["thor", "valkyrie", "peter-quill", "mantis", "jane-foster"],
  "ironheart": ["riri-williams", "shuri"],
  "werewolf-by-night": ["jack-russell", "elsa-bloodstone"],
  "gotg-holiday": ["peter-quill", "mantis", "drax", "nebula", "rocket", "groot"],
  "quantumania": ["scott-lang", "hope-van-dyne", "janet-van-dyne", "hank-pym", "cassie-lang", "he-who-remains"],
  "gotg-3": ["rocket", "groot", "peter-quill", "gamora", "nebula", "drax", "mantis", "adam-warlock"],
  "secret-invasion": ["nick-fury", "talos", "carol-danvers"],
  "the-marvels": ["carol-danvers", "monica-rambeau", "kamala-khan", "beast-fox"],
  "loki-s2": ["loki-tva", "sylvie", "mobius", "hunter-b15", "he-who-remains"],
  "what-if-s2": ["loki-tva", "peggy-carter", "nebula", "peter-quill", "wanda-maximoff"],
  "logan-mid": FOX_LOGAN,
  "deadpool-wolverine": FOX_DAW,
  "agatha": ["agatha-harkness", "billy-maximoff", "wanda-maximoff"],
  "what-if-s3": ["loki-tva", "peggy-carter", "sam-wilson", "stephen-strange"],
  "born-again-s1": ["matt-murdock", "wilson-fisk", "karen-page", "frank-castle"],
  "brave-new-world": ["sam-wilson", "bucky-barnes", "everett-ross", "shuri", "valentina-fontaine"],
  "thunderbolts": ["yelena-belova", "bucky-barnes", "alexei-shostakov", "valentina-fontaine", "bob-reynolds"],
  "ff-first-steps-official": ["reed-richards-first", "sue-storm-first", "johnny-storm-first", "ben-grimm-first", "shalla-bal", "galactus-first"],
  "wonder-man": ["simon-williams", "bob-reynolds", "valentina-fontaine", "trevor-slattery"],
  "born-again-s2": ["matt-murdock", "wilson-fisk", "karen-page", "frank-castle"],
  "punisher-one-last-kill": ["frank-castle", "matt-murdock", "karen-page"],
  "logan-final": FOX_LOGAN,
};

const orderIds = new Set(MARVEL_CHRONOLOGY_ORDER.map((entry) => entry.id));
const prereqsByTarget = new Map();
for (const edge of CHRONOLOGY_PREREQ_EDGES) {
  if (!orderIds.has(edge.target) || !orderIds.has(edge.source)) {
    throw new Error(`Prereq edge references unknown id: ${edge.target} <- ${edge.source}`);
  }
  if (!prereqsByTarget.has(edge.target)) prereqsByTarget.set(edge.target, []);
  prereqsByTarget.get(edge.target).push({ id: edge.source, tier: edge.tier });
}

const outPath = path.join(root, "data/marvel-universe/chronology.json");
const existingPosters = new Map();
try {
  const previous = JSON.parse(fs.readFileSync(outPath, "utf8"));
  (previous.titles || []).forEach((row) => {
    if (row.posterPath || row.posterUrl) {
      existingPosters.set(row.id, {
        posterPath: row.posterPath,
        posterUrl: row.posterUrl,
      });
    }
  });
} catch {
  /* first build */
}

const missing = new Set();
const titles = MARVEL_CHRONOLOGY_ORDER.map((entry) => {
  const characters = CAST_BY_ID[entry.id];
  if (!characters?.length) {
    throw new Error(`Missing cast for ${entry.id}`);
  }
  characters.forEach((id) => {
    if (!peopleIds.has(id)) missing.add(id);
  });
  const row = {
    id: entry.id,
    title: entry.title,
    characters: [...characters],
  };
  if (entry.filterLabel) row.filterLabel = entry.filterLabel;
  if (entry.note) row.note = entry.note;
  if (entry.era) row.era = entry.era;
  if (entry.essential) row.essential = true;
  const prereqs = prereqsByTarget.get(entry.id);
  if (prereqs?.length) row.prereqs = prereqs;
  const poster = existingPosters.get(entry.id);
  if (poster?.posterPath) {
    row.posterPath = poster.posterPath;
    row.posterUrl = poster.posterUrl || `https://image.tmdb.org/t/p/w342${poster.posterPath}`;
  }
  return row;
});

if (missing.size) {
  console.error("Missing people ids (add to people.json first):");
  console.error([...missing].sort().join("\n"));
  process.exit(1);
}

const out = {
  version: 1,
  source: "Karan MCU + Mutant Legacy chronology (September 2026)",
  titles,
};

fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
console.log(`Wrote ${titles.length} titles to ${outPath}`);
