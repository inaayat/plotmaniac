#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRACTICE_PUZZLES, practiceGroupLabel } from "../plotted-config.js";
import { GENERIC_HAS_ATTRS, generatePuzzle, validateEinsteinStyle } from "../plotted-engine.js";
import { themeById } from "../plotted-themes.js";
import { humanDifficulty, solvePuzzleByHuman } from "../plotted-human-solver.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "practice");
fs.mkdirSync(outDir, { recursive: true });

const GROUP_SPECS = {
  easy: {
    houseCount: 3,
    types: ["at", "same"],
    minClues: 5,
    maxClues: 5,
    minSteps: 1,
    maxSteps: 10,
    maxAtClues: 3,
    label: "easy",
  },
  "easy-medium": {
    houseCount: 3,
    types: ["at", "same", "next_to"],
    minClues: 5,
    maxClues: 7,
    minSteps: 2,
    maxSteps: 12,
    label: "easy-medium",
  },
  medium: {
    houseCount: 3,
    types: ["at", "same", "next_to", "left_of"],
    minClues: 5,
    maxClues: 8,
    minSteps: 3,
    maxSteps: 14,
    label: "medium",
  },
  "medium-hard": {
    houseCount: 3,
    types: ["at", "same", "next_to", "left_of", "not_at", "either_house"],
    minClues: 5,
    maxClues: 8,
    minSteps: 3,
    maxSteps: 18,
    label: "medium-hard",
  },
  hard: {
    houseCount: 4,
    types: ["at", "same", "next_to", "left_of", "not_next_to", "either_house", "not_at"],
    minClues: 6,
    maxClues: 8,
    minSteps: 4,
    maxSteps: 28,
    maxAtClues: 2,
    label: "hard",
  },
};

const KEEP = [
  {
    id: "easy",
    themeId: "dinner-party",
    seedDate: "2098-01-01",
    story: "Three neighbors. Match who, pet, and drink.",
  },
  {
    id: "easy-medium",
    themeId: "garden",
    seedDate: "2098-01-02",
    story: "Gardeners, plants, and a drink in the dirt.",
  },
  {
    id: "medium",
    themeId: "music-night",
    seedDate: "2098-01-03",
    story: "A short set in the front rooms.",
  },
  {
    id: "medium-hard",
    themeId: "brunch",
    seedDate: "2098-01-04",
    story: "A tiny brunch. Who eats what?",
  },
  {
    id: "hard",
    themeId: "neighborhood",
    seedDate: "2098-01-05",
    story: "Rides and animals on a wider block.",
    spec: { houseCount: 4 },
  },
];

const COPIES = [
  {
    id: "quiet-chapter",
    themeId: "book-club",
    seedDate: "2098-02-01",
    story: "Three readers. Match who, book, and drink.",
  },
  {
    id: "late-watering",
    themeId: "garden",
    seedDate: "2098-02-02",
    story: "Gardeners, plants, and a drink in the dirt.",
  },
  {
    id: "short-stack",
    themeId: "brunch",
    seedDate: "2098-02-03",
    story: "A tiny brunch. Who eats what?",
  },
  {
    id: "whos-pouring",
    themeId: "dinner-party",
    seedDate: "2098-02-04",
    story: "Three neighbors. Match who, pet, and drink.",
  },
  {
    id: "ribbon-aisle",
    themeId: "pet-show",
    seedDate: "2098-02-05",
    story: "Painted doors and a short aisle of pets.",
  },
  {
    id: "walk-away",
    themeId: "neighborhood",
    seedDate: "2098-02-06",
    story: "Rides and pets down a short block.",
  },
  {
    id: "parked-pets",
    themeId: "neighborhood",
    seedDate: "2098-02-07",
    story: "Rides and animals on a short block.",
  },
  {
    id: "last-lantern",
    themeId: "garden",
    seedDate: "2098-02-08",
    story: "Late light in the plots. Who grows which plant?",
  },
  {
    id: "night-set",
    themeId: "music-night",
    seedDate: "2098-02-09",
    story: "A short set in the front rooms.",
  },
  {
    id: "five-copies",
    themeId: "book-club",
    seedDate: "2098-02-10",
    story: "Five houses of readers. Who reads what?",
    spec: {
      houseCount: 5,
      types: ["at", "same", "next_to", "left_of", "not_next_to", "either_house", "not_at"],
      minClues: 6,
      maxClues: 10,
      minSteps: 4,
      maxSteps: 40,
      maxAtClues: 3,
      label: "hard",
    },
  },
  {
    id: "parcel-row",
    themeId: "holiday",
    seedDate: "2098-02-11",
    story: "Painted doors and pets down a wider lane.",
    spec: { houseCount: 4 },
  },
  {
    id: "four-plates",
    themeId: "brunch",
    seedDate: "2098-02-12",
    story: "Four houses. Who eats what?",
    spec: { houseCount: 4 },
  },
];

/** Last-Sunday dailies that already meet the Hard/Expert practice bar. */
const DAILY_COPIES = [
  {
    id: "sail-lane",
    sourceDate: "2027-08-29",
    story: "Five houses of rides and pets. Who has a rabbit?",
    question: {
      text: "Who has a rabbit?",
      givenAttr: "pet",
      givenItem: "rabbit",
      answerAttr: "person",
      answerItem: "ada",
    },
  },
];

const EXPERT_SPECS = [
  {
    id: "long-street",
    themeId: "expert-street",
    seedDate: "2099-01-01",
    story: "Five painted houses. Who, color, pet, and drink.",
  },
  {
    id: "five-trades",
    themeId: "expert-trades",
    seedDate: "2099-01-02",
    story: "Jobs, rides, and pets down the block.",
  },
  {
    id: "five-cities",
    themeId: "expert-cities",
    seedDate: "2099-01-03",
    story: "Visitors, drinks, and a plate each.",
  },
  {
    id: "hobby-houses",
    themeId: "expert-hobby",
    seedDate: "2099-01-04",
    story: "Hobbies, colors, and a drink on the street.",
  },
  {
    id: "five-plates",
    themeId: "expert-table",
    seedDate: "2099-01-05",
    story: "Five houses. Who eats what, and what color is the door?",
  },
];

const EXPERT_SPEC = {
  houseCount: 5,
  types: ["same", "next_to", "left_of", "not_at", "either_house", "not_next_to", "at"],
  minClues: 8,
  maxClues: 13,
  minSteps: 6,
  maxSteps: 80,
  maxAtClues: 1,
  minHumanTier: 8,
  maxContradiction: 2,
  preferHardTypes: true,
  label: "expert",
};

const SALTS = [0, 1, 2, 5, 11, 17, 23, 31, 43, 59];

function requireEinsteinStyle(packed) {
  const style = validateEinsteinStyle(packed);
  if (!style.ok) {
    const detail = style.failures.map((fail) => `${fail.id}: ${fail.reasons.join("; ")} (${fail.text})`).join(" | ");
    throw new Error(`${packed.practiceId || packed.id} failed Einstein-style copy: ${detail}`);
  }
  const cats = (packed.attributes || []).map((attr) => attr.id);
  const vague = cats.find((id) => GENERIC_HAS_ATTRS.has(id));
  if (vague) {
    throw new Error(`${packed.practiceId || packed.id} must not use ${vague} category`);
  }
  return packed;
}

function catalogMatchesTheme(packed) {
  const theme = themeById(packed.theme?.id);
  if (!theme) return false;
  for (const attr of packed.attributes || []) {
    const pool = theme.items[attr.id];
    if (!pool) return false;
    for (const item of packed.items?.[attr.id] || []) {
      const current = pool.find((entry) => entry.id === item.id);
      if (!current || current.label !== item.label) return false;
    }
  }
  return true;
}

function isAcceptable(packed, extra = () => true) {
  if (!packed) return false;
  try {
    requireEinsteinStyle(packed);
  } catch {
    return false;
  }
  return catalogMatchesTheme(packed) && extra(packed);
}

function catalogRow(packed) {
  return {
    id: packed.practiceId,
    label: packed.label,
    title: packed.theme.title,
    houseCount: packed.houseCount,
    clueCount: packed.clues.length,
    difficulty: packed.difficulty.label,
    hardest: packed.difficulty.hardest,
    hardestTier: packed.difficulty.hardestTier,
    steps: packed.difficulty.steps,
    categories: packed.attributes.map((attr) => attr.id),
    sourceDate: packed.difficulty.sourceDate || null,
  };
}

function harderTypeScore(puzzle) {
  const types = puzzle.clues.map((clue) => clue.type);
  let score = puzzle.difficulty.hardestTier || 0;
  if (types.includes("not_next_to")) score += 4;
  if (types.includes("either_house")) score += 4;
  if (puzzle.clues.some((clue) => clue.type === "left_of" && !clue.immediate)) score += 4;
  score += Math.max(0, 12 - puzzle.clues.length);
  return score;
}

function isValidExpert(puzzle) {
  if (!puzzle || puzzle.houseCount !== 5) return false;
  if ((puzzle.attributes || []).length < 4) return false;
  if (puzzle.clues.filter((clue) => clue.type === "at").length > 1) return false;
  if (!puzzle.difficulty?.solvedByHuman) return false;
  if ((puzzle.difficulty.hardestTier || 0) < 8) return false;
  const hasHarder =
    puzzle.clues.some((clue) => clue.type === "not_next_to") ||
    puzzle.clues.some((clue) => clue.type === "either_house") ||
    puzzle.clues.some((clue) => clue.type === "left_of" && !clue.immediate);
  return hasHarder;
}

function packPuzzle(entry, puzzle, source) {
  const meta = PRACTICE_PUZZLES.find((item) => item.id === entry.id);
  if (!meta) throw new Error(`Unknown practice id ${entry.id}`);
  const human = humanDifficulty(solvePuzzleByHuman(puzzle));
  return {
    id: entry.id,
    practice: true,
    practiceId: entry.id,
    label: practiceGroupLabel(meta.group),
    source,
    theme: {
      ...puzzle.theme,
      title: meta.title,
      story: entry.story,
    },
    houseCount: puzzle.houseCount,
    attributes: puzzle.attributes,
    items: puzzle.items,
    clues: puzzle.clues,
    question: entry.question || puzzle.question,
    solution: puzzle.solution,
    difficulty: {
      ...puzzle.difficulty,
      ...human,
      label: meta.group,
      ...(entry.sourceDate ? { sourceDate: entry.sourceDate } : {}),
    },
  };
}

function readDaily(iso) {
  return JSON.parse(fs.readFileSync(path.join(root, "data", "plotted", `${iso}.json`), "utf8"));
}

function packDailyCopy(entry) {
  return packPuzzle(entry, readDaily(entry.sourceDate), "practice-generated");
}

function isAcceptableDaily(packed) {
  if (!packed || packed.date) return false;
  if (packed.houseCount !== 5) return false;
  if ((packed.difficulty?.hardestTier || 0) < 6) return false;
  try {
    requireEinsteinStyle(packed);
  } catch {
    return false;
  }
  return Boolean(packed.difficulty?.solvedByHuman);
}

function readExisting(id) {
  const dest = path.join(outDir, `${id}.json`);
  if (!fs.existsSync(dest)) return null;
  return JSON.parse(fs.readFileSync(dest, "utf8"));
}

function generateWithSpec(entry, spec, source, accept, { seekBest = false } = {}) {
  let best = null;
  let bestScore = -1;
  let lastError = null;
  for (const salt of SALTS) {
    try {
      const puzzle = generatePuzzle(entry.seedDate, {
        spec,
        themeId: entry.themeId,
        salt,
        maxTries: spec.houseCount >= 5 ? 300 : 160,
      });
      const packed = packPuzzle(entry, puzzle, source);
      if (!isAcceptable(packed, accept)) continue;
      const score = harderTypeScore(packed);
      if (score > bestScore) {
        best = packed;
        bestScore = score;
      }
      if (!seekBest || score >= 16) break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!best) {
    throw lastError || new Error(`Could not generate practice puzzle ${entry.id}`);
  }
  return best;
}

function generateStandard(entry) {
  const meta = PRACTICE_PUZZLES.find((item) => item.id === entry.id);
  const spec = { ...GROUP_SPECS[meta.group], ...(entry.spec || {}) };
  return generateWithSpec(entry, spec, "practice-generated", () => true);
}

function generateExpert(entry) {
  return generateWithSpec(entry, EXPERT_SPEC, "expert-generated", isValidExpert, { seekBest: true });
}

function writePacked(packed) {
  fs.writeFileSync(path.join(outDir, `${packed.practiceId}.json`), `${JSON.stringify(packed, null, 2)}\n`);
}

const byId = new Map();

function adopt(entry, packed, note) {
  const accepted = requireEinsteinStyle(packed);
  byId.set(entry.id, accepted);
  process.stdout.write(
    `${entry.id} ${note} ${accepted.theme.id} ${accepted.houseCount}h ${accepted.clues.length}c steps=${accepted.difficulty.steps} ${accepted.difficulty.hardest}\n`,
  );
  return accepted;
}

for (const entry of KEEP) {
  const existing = readExisting(entry.id);
  const packed = isAcceptable(existing) ? existing : generateStandard(entry);
  if (packed !== existing) writePacked(packed);
  adopt(entry, packed, packed === existing ? "keep" : "gen");
}

for (const entry of COPIES) {
  const existing = readExisting(entry.id);
  const packed = isAcceptable(existing) ? existing : generateStandard(entry);
  if (packed !== existing) writePacked(packed);
  adopt(entry, packed, packed === existing ? "keep" : "gen");
}

for (const entry of DAILY_COPIES) {
  const existing = readExisting(entry.id);
  const packed = isAcceptableDaily(existing) ? existing : packDailyCopy(entry);
  if (packed !== existing) writePacked(packed);
  adopt(entry, packed, packed === existing ? "keep" : `daily:${entry.sourceDate}`);
}

for (const entry of EXPERT_SPECS) {
  const existing = readExisting(entry.id);
  const packed = isAcceptable(existing, isValidExpert) ? existing : generateExpert(entry);
  if (packed !== existing) writePacked(packed);
  const types = [...new Set(packed.clues.map((clue) => clue.type))].join(",");
  const atCount = packed.clues.filter((clue) => clue.type === "at").length;
  requireEinsteinStyle(packed);
  byId.set(entry.id, packed);
  process.stdout.write(
    `${entry.id} ${packed === existing ? "keep" : "gen"} ${packed.theme.id} ${packed.houseCount}h ${packed.attributes.length}a ${packed.clues.length}c at=${atCount} steps=${packed.difficulty.steps} ${packed.difficulty.hardest} tier=${packed.difficulty.hardestTier} types=${types}\n`,
  );
}

const catalog = {
  puzzles: PRACTICE_PUZZLES.map((entry) => {
    const packed = byId.get(entry.id);
    if (!packed) throw new Error(`Missing packed puzzle ${entry.id}`);
    return catalogRow(packed);
  }),
};
fs.writeFileSync(path.join(outDir, "index.json"), `${JSON.stringify(catalog, null, 2)}\n`);
