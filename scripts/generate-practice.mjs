#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRACTICE_PUZZLES, practiceGroupLabel } from "../plotted-config.js";
import { generatePuzzle, validateEinsteinStyle } from "../plotted-engine.js";
import { humanDifficulty, solvePuzzleByHuman } from "../plotted-human-solver.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "practice");
const plottedDir = path.join(root, "data", "plotted");
fs.mkdirSync(outDir, { recursive: true });

const KEEP_IDS = new Set(["easy", "easy-medium", "medium", "medium-hard", "hard"]);

/** Late-2027 dailies copied into practice so they do not collide with upcoming days. */
const COPIES = [
  {
    id: "quiet-chapter",
    date: "2027-11-01",
    title: "Quiet chapter",
    story: "Three readers. Match who, book, and drink.",
  },
  {
    id: "late-watering",
    date: "2027-11-08",
    title: "Late watering",
    story: "Gardeners, plants, and a drink in the dirt.",
  },
  {
    id: "short-stack",
    date: "2027-11-29",
    title: "Short stack",
    story: "A tiny brunch. Who ordered what?",
  },
  {
    id: "whos-pouring",
    date: "2027-11-03",
    title: "Who's pouring",
    story: "Three neighbors. Match who, pet, and drink.",
  },
  {
    id: "ribbon-aisle",
    date: "2027-11-02",
    title: "Ribbon aisle",
    story: "A short aisle of pets and prizes.",
  },
  {
    id: "walk-away",
    date: "2027-11-13",
    title: "Walk away",
    story: "Rides and pets down a short block. Someone still walked.",
  },
  {
    id: "parked-pets",
    date: "2027-11-25",
    title: "Parked pets",
    story: "Rides and animals on a short block.",
  },
  {
    id: "last-lantern",
    date: "2027-11-12",
    title: "Last lantern",
    story: "Late light in the plots. Who tends which plant?",
  },
  {
    id: "night-set",
    date: "2027-11-06",
    title: "Night set",
    story: "A short set in the front rooms.",
  },
  {
    id: "five-copies",
    date: "2027-11-28",
    title: "Five copies",
    story: "Five houses of readers. Who brought which book?",
  },
  {
    id: "parcel-row",
    date: "2027-11-21",
    title: "Parcel row",
    story: "Treats and parcels down a wider lane.",
  },
  {
    id: "four-plates",
    date: "2027-11-14",
    title: "Four plates",
    story: "Four houses. Who ordered what?",
  },
];

/** Five-house Expert puzzles generated with contradiction-tier grading. */
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
    story: "Visitors, drinks, and a treat each.",
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
    story: "Five houses. Who ordered what, and what color is the door?",
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

const EXPERT_SALTS = [0, 1, 2, 5, 11];

function packFromDaily(entry, daily) {
  const meta = PRACTICE_PUZZLES.find((puzzle) => puzzle.id === entry.id);
  if (!meta) throw new Error(`Unknown practice id ${entry.id}`);
  const human = humanDifficulty(solvePuzzleByHuman(daily));
  return {
    id: entry.id,
    practice: true,
    practiceId: entry.id,
    label: practiceGroupLabel(meta.group),
    source: `daily-${entry.date}`,
    theme: {
      ...daily.theme,
      title: entry.title,
      story: entry.story,
    },
    houseCount: daily.houseCount,
    attributes: daily.attributes,
    items: daily.items,
    clues: daily.clues,
    question: daily.question,
    solution: daily.solution,
    difficulty: {
      ...daily.difficulty,
      ...human,
      label: meta.group,
      sourceDate: entry.date,
    },
  };
}

function requireEinsteinStyle(packed) {
  const style = validateEinsteinStyle(packed);
  if (!style.ok) {
    const detail = style.failures.map((fail) => `${fail.id}: ${fail.reasons.join("; ")} (${fail.text})`).join(" | ");
    throw new Error(`${packed.practiceId || packed.id} failed Einstein-style copy: ${detail}`);
  }
  const cats = (packed.attributes || []).map((attr) => attr.id);
  if (cats.includes("loot") || cats.includes("getaway")) {
    throw new Error(`${packed.practiceId || packed.id} must not use loot/getaway categories`);
  }
  return packed;
}

function keepExistingExpert(entry) {
  const dest = path.join(outDir, `${entry.id}.json`);
  if (!fs.existsSync(dest)) return null;
  const packed = JSON.parse(fs.readFileSync(dest, "utf8"));
  return isValidExpert(packed) ? packed : null;
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

function packExpert(entry, puzzle) {
  const meta = PRACTICE_PUZZLES.find((item) => item.id === entry.id);
  if (!meta) throw new Error(`Unknown practice id ${entry.id}`);
  const human = humanDifficulty(solvePuzzleByHuman(puzzle));
  return {
    id: entry.id,
    practice: true,
    practiceId: entry.id,
    label: practiceGroupLabel(meta.group),
    source: "expert-generated",
    theme: {
      ...puzzle.theme,
      title: meta.title,
      story: entry.story,
    },
    houseCount: puzzle.houseCount,
    attributes: puzzle.attributes,
    items: puzzle.items,
    clues: puzzle.clues,
    question: puzzle.question,
    solution: puzzle.solution,
    difficulty: {
      ...puzzle.difficulty,
      ...human,
      label: meta.group,
    },
  };
}

function generateExpert(entry) {
  let best = null;
  let bestScore = -1;
  let lastError = null;
  for (const salt of EXPERT_SALTS) {
    try {
      const puzzle = generatePuzzle(entry.seedDate, {
        spec: EXPERT_SPEC,
        themeId: entry.themeId,
        salt,
        maxTries: 100,
      });
      if (!isValidExpert(puzzle)) continue;
      const score = harderTypeScore(puzzle);
      if (score > bestScore) {
        best = puzzle;
        bestScore = score;
      }
      if (score >= 16) break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!best) {
    throw lastError || new Error(`Could not generate expert puzzle ${entry.id}`);
  }
  return packExpert(entry, best);
}

const byId = new Map();
for (const id of KEEP_IDS) {
  const packed = requireEinsteinStyle(JSON.parse(fs.readFileSync(path.join(outDir, `${id}.json`), "utf8")));
  byId.set(id, packed);
  process.stdout.write(
    `${id} keep ${packed.theme.id} ${packed.houseCount}h ${packed.clues.length}c steps=${packed.difficulty.steps} ${packed.difficulty.hardest}\n`,
  );
}

for (const entry of COPIES) {
  const daily = JSON.parse(fs.readFileSync(path.join(plottedDir, `${entry.date}.json`), "utf8"));
  const packed = requireEinsteinStyle(packFromDaily(entry, daily));
  fs.writeFileSync(path.join(outDir, `${entry.id}.json`), `${JSON.stringify(packed, null, 2)}\n`);
  byId.set(entry.id, packed);
  process.stdout.write(
    `${entry.id} ${entry.date} ${packed.theme.id} ${packed.houseCount}h ${packed.clues.length}c steps=${packed.difficulty.steps} ${packed.difficulty.hardest} tier=${packed.difficulty.hardestTier}\n`,
  );
}

for (const entry of EXPERT_SPECS) {
  const existing = keepExistingExpert(entry);
  const packed = requireEinsteinStyle(existing || generateExpert(entry));
  if (!existing) {
    fs.writeFileSync(path.join(outDir, `${entry.id}.json`), `${JSON.stringify(packed, null, 2)}\n`);
  }
  byId.set(entry.id, packed);
  const types = [...new Set(packed.clues.map((clue) => clue.type))].join(",");
  const atCount = packed.clues.filter((clue) => clue.type === "at").length;
  process.stdout.write(
    `${entry.id} ${packed.theme.id} ${packed.houseCount}h ${packed.attributes.length}a ${packed.clues.length}c at=${atCount} steps=${packed.difficulty.steps} ${packed.difficulty.hardest} tier=${packed.difficulty.hardestTier} types=${types}\n`,
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
