#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PRACTICE_PUZZLES, practiceGroupLabel } from "../plotted-config.js";
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
    date: "2027-11-23",
    title: "Walk away",
    story: "A quiet job. Who took what, and how did they leave?",
  },
  {
    id: "parked-pets",
    date: "2027-11-25",
    title: "Parked pets",
    story: "Rides and animals on a short block.",
  },
  {
    id: "last-lantern",
    date: "2027-11-04",
    title: "Last lantern",
    story: "Campers, kit, and one companion each.",
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

function catalogRow(packed) {
  return {
    id: packed.practiceId,
    label: packed.label,
    title: packed.theme.title,
    houseCount: packed.houseCount,
    clueCount: packed.clues.length,
    difficulty: packed.difficulty.label,
    hardest: packed.difficulty.hardest,
    steps: packed.difficulty.steps,
    categories: packed.attributes.map((attr) => attr.id),
    sourceDate: packed.difficulty.sourceDate || null,
  };
}

const byId = new Map();
for (const id of KEEP_IDS) {
  const packed = JSON.parse(fs.readFileSync(path.join(outDir, `${id}.json`), "utf8"));
  byId.set(id, packed);
  process.stdout.write(
    `${id} keep ${packed.theme.id} ${packed.houseCount}h ${packed.clues.length}c steps=${packed.difficulty.steps} ${packed.difficulty.hardest}\n`,
  );
}

for (const entry of COPIES) {
  const daily = JSON.parse(fs.readFileSync(path.join(plottedDir, `${entry.date}.json`), "utf8"));
  const packed = packFromDaily(entry, daily);
  fs.writeFileSync(path.join(outDir, `${entry.id}.json`), `${JSON.stringify(packed, null, 2)}\n`);
  byId.set(entry.id, packed);
  process.stdout.write(
    `${entry.id} ${entry.date} ${packed.theme.id} ${packed.houseCount}h ${packed.clues.length}c steps=${packed.difficulty.steps} ${packed.difficulty.hardest} tier=${packed.difficulty.hardestTier}\n`,
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
