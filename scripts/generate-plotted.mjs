#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addDaysIso, generatePuzzle, specForDate } from "../plotted-engine.js";
import { LAUNCH_DATE } from "../plotted-config.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "data", "plotted");
const start = process.argv[2] || LAUNCH_DATE;
const days = Number(process.argv[3] || 396);
fs.mkdirSync(outDir, { recursive: true });

let date = start;
for (let i = 0; i < days; i += 1) {
  let puzzle = null;
  let lastError = null;
  for (const salt of [0, 1, 2, 5, 11]) {
    try {
      const tries = specForDate(date).houseCount >= 5 ? 180 : 80;
      puzzle = generatePuzzle(date, { maxTries: tries, salt });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!puzzle) throw lastError;
  const dest = path.join(outDir, `${date}.json`);
  fs.writeFileSync(dest, `${JSON.stringify(puzzle, null, 2)}\n`);
  process.stdout.write(`${date} ${puzzle.theme.id} ${puzzle.houseCount}h ${puzzle.clues.length}c steps=${puzzle.difficulty.steps}\n`);
  date = addDaysIso(date, 1);
}
