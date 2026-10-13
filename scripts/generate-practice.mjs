#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generatePuzzle } from "../plotted-engine.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "practice");
fs.mkdirSync(outDir, { recursive: true });

const SPECS = [
  {
    id: "easy",
    label: "Easy",
    themeId: "dinner-party",
    title: "Pets and drinks",
    story: "Three neighbors. Match who, pet, and drink.",
    preferMaxTier: 5,
    spec: {
      houseCount: 3,
      types: ["at", "same"],
      minClues: 4,
      maxClues: 7,
      minSteps: 1,
      maxSteps: 80,
      label: "easy",
    },
  },
  {
    id: "easy-medium",
    label: "Easy–medium",
    themeId: "garden",
    title: "Garden row",
    story: "Gardeners, plants, and a drink in the dirt.",
    preferMaxTier: 6,
    spec: {
      houseCount: 3,
      types: ["at", "same", "next_to"],
      minClues: 5,
      maxClues: 7,
      minSteps: 1,
      maxSteps: 80,
      label: "easy-medium",
    },
  },
  {
    id: "medium",
    label: "Medium",
    themeId: "book-club",
    title: "Book club",
    story: "Same living room, different copies.",
    preferMinTier: 5,
    preferMaxTier: 7,
    spec: {
      houseCount: 3,
      types: ["at", "same", "next_to", "left_of"],
      minClues: 5,
      maxClues: 8,
      minSteps: 1,
      maxSteps: 80,
      label: "medium",
    },
  },
  {
    id: "medium-hard",
    label: "Medium–hard",
    themeId: "brunch",
    title: "Brunch table",
    story: "Plates, drinks, and one check.",
    preferMinTier: 6,
    spec: {
      houseCount: 3,
      types: ["same", "next_to", "left_of", "not_at"],
      minClues: 5,
      maxClues: 8,
      minSteps: 1,
      maxSteps: 80,
      label: "medium-hard",
    },
  },
  {
    id: "hard",
    label: "Hard",
    themeId: "neighborhood",
    title: "The block",
    story: "Four houses. Match resident, ride, and animal.",
    preferMinTier: 7,
    spec: {
      houseCount: 4,
      types: ["same", "next_to", "left_of", "not_at", "either_house"],
      minClues: 6,
      maxClues: 8,
      minSteps: 1,
      maxSteps: 80,
      label: "hard",
    },
  },
];

function scoreCandidate(puzzle, entry) {
  const tier = puzzle.difficulty.hardestTier || 0;
  const steps = puzzle.difficulty.steps || 0;
  const contra = String(puzzle.difficulty.hardest || "").startsWith("contradiction");
  let penalty = 0;
  if (entry.preferMaxTier && tier > entry.preferMaxTier) penalty += (tier - entry.preferMaxTier) * 20;
  if (entry.preferMinTier && tier < entry.preferMinTier) penalty += (entry.preferMinTier - tier) * 12;
  if (contra && entry.id !== "hard") penalty += 40;
  if (!contra && entry.id === "hard") penalty += 8;
  const wantLong = entry.id === "hard" || entry.id === "medium-hard" || entry.id === "medium";
  const stepTerm = wantLong ? -steps : steps;
  return penalty * 100 + stepTerm;
}

const catalog = [];
for (const entry of SPECS) {
  const found = [];
  for (const salt of [0, 1, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71]) {
    try {
      const puzzle = generatePuzzle(`practice-${entry.id}`, {
        spec: entry.spec,
        themeId: entry.themeId,
        salt,
        maxTries: 80,
      });
      found.push(puzzle);
    } catch {
      /* try another salt */
    }
  }
  if (!found.length) throw new Error(`No practice puzzle for ${entry.id}`);
  found.sort((a, b) => scoreCandidate(a, entry) - scoreCandidate(b, entry));
  const puzzle = found[0];
  const packed = {
    id: entry.id,
    practice: true,
    practiceId: entry.id,
    label: entry.label,
    source: "original-generated",
    theme: {
      ...puzzle.theme,
      title: entry.title,
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
      label: entry.id,
    },
  };
  fs.writeFileSync(path.join(outDir, `${entry.id}.json`), `${JSON.stringify(packed, null, 2)}\n`);
  catalog.push({
    id: entry.id,
    label: entry.label,
    title: entry.title,
    houseCount: packed.houseCount,
    clueCount: packed.clues.length,
    difficulty: packed.difficulty.label,
    hardest: packed.difficulty.hardest,
    steps: packed.difficulty.steps,
    categories: packed.attributes.map((attr) => attr.id),
  });
  process.stdout.write(
    `${entry.id} ${packed.theme.id} ${packed.houseCount}h ${packed.clues.length}c steps=${packed.difficulty.steps} ${packed.difficulty.hardest} tier=${packed.difficulty.hardestTier}\n`,
  );
}
fs.writeFileSync(path.join(outDir, "index.json"), `${JSON.stringify({ puzzles: catalog }, null, 2)}\n`);
