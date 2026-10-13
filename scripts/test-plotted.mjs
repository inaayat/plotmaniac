import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_NAME, KEYCAP_DIGITS, LAUNCH_DATE, SITE_URL } from "../plotted-config.js";
import { ICONS, iconSvg } from "../plotted-icons.js";
import { THEMES } from "../plotted-themes.js";
import {
  clueHolds,
  countSolutions,
  formatShare,
  formatTime,
  generatePuzzle,
  gridMatchesSolution,
  houseIsCompleteAndCorrect,
  puzzleNumber,
  specForDate,
  pruneClues,
} from "../plotted-engine.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

assert.equal(GAME_NAME, "Plotted");
assert.equal(LAUNCH_DATE, "2026-10-13");
assert.equal(puzzleNumber("2026-10-13"), 1);
assert.equal(puzzleNumber("2026-10-14"), 2);
assert.equal(formatTime(165000), "2:45");
assert.equal(formatTime(0), "0:00");

const repoFiles = [
  "index.html",
  "plotted.js",
  "plotted.css",
  "plotted-config.js",
  "plotted-engine.js",
  "plotted-themes.js",
  "docs/plotted-plan.md",
  "README.md",
  "CURSOR.md",
];
for (const rel of repoFiles) {
  const text = read(rel);
  assert.equal(/whodunit/i.test(text), false, `${rel} should not mention Whodunit`);
}

const monday = specForDate("2026-10-12"); // Monday
assert.equal(monday.houseCount, 3);
assert.deepEqual(monday.types, ["at", "same"]);
const sunday = specForDate("2026-10-18");
assert.equal(sunday.houseCount, 4);
assert.ok(sunday.types.includes("not_next_to"));
assert.ok(sunday.types.includes("left_of"));
assert.ok(sunday.types.includes("either_house"));
const lastSunday = specForDate("2026-10-25");
assert.equal(lastSunday.houseCount, 5);

const attributes = ["person", "pet", "drink"];
const items = {
  person: ["ada", "bo", "cam"],
  pet: ["cat", "dog", "bird"],
  drink: ["tea", "coffee", "wine"],
};
const solution = [
  { person: "ada", pet: "cat", drink: "tea" },
  { person: "bo", pet: "dog", drink: "coffee" },
  { person: "cam", pet: "bird", drink: "wine" },
];
const uniqueClues = [
  { type: "same", left: { attr: "person", item: "ada" }, right: { attr: "pet", item: "cat" } },
  { type: "at", attr: "person", item: "bo", house: 1 },
  { type: "same", left: { attr: "person", item: "cam" }, right: { attr: "drink", item: "wine" } },
  { type: "next_to", left: { attr: "pet", item: "dog" }, right: { attr: "pet", item: "bird" } },
  { type: "left_of", left: { attr: "drink", item: "tea" }, right: { attr: "drink", item: "wine" }, immediate: false },
  { type: "same", left: { attr: "person", item: "bo" }, right: { attr: "pet", item: "dog" } },
  { type: "same", left: { attr: "person", item: "ada" }, right: { attr: "drink", item: "tea" } },
];
for (const clue of uniqueClues) {
  assert.equal(clueHolds(clue, solution), true, `${clue.type} should hold`);
}
const unique = countSolutions(3, attributes, items, uniqueClues, 4);
assert.equal(unique.count, 1, "hand-built puzzle must be unique");
assert.deepEqual(unique.solution, solution);

const underconstrained = countSolutions(3, attributes, items, uniqueClues.slice(0, 1), 4);
assert.ok(underconstrained.count > 1, "one clue is not unique");

const contradiction = countSolutions(
  3,
  attributes,
  items,
  [
    { type: "at", attr: "person", item: "ada", house: 0 },
    { type: "at", attr: "person", item: "ada", house: 2 },
  ],
  2,
);
assert.equal(contradiction.count, 0);

const pruned = pruneClues(3, attributes, items, uniqueClues);
assert.ok(pruned.length >= 1);
assert.equal(countSolutions(3, attributes, items, pruned, 2).count, 1);

const generated = generatePuzzle("2026-10-13", { maxTries: 80 });
assert.equal(generated.date, "2026-10-13");
assert.ok(generated.clues.length >= 5 && generated.clues.length <= 8);
assert.equal(generated.houseCount, 3);
const generatedCount = countSolutions(
  generated.houseCount,
  generated.attributes.map((attr) => attr.id),
  Object.fromEntries(generated.attributes.map((attr) => [attr.id, generated.items[attr.id].map((item) => item.id)])),
  generated.clues,
  2,
);
assert.equal(generatedCount.count, 1);
assert.deepEqual(generatedCount.solution, generated.solution);

const sundayPuzzle = generatePuzzle("2026-10-18", { maxTries: 80 });
assert.equal(sundayPuzzle.houseCount, 4);
assert.equal(
  countSolutions(
    sundayPuzzle.houseCount,
    sundayPuzzle.attributes.map((attr) => attr.id),
    Object.fromEntries(sundayPuzzle.attributes.map((attr) => [attr.id, sundayPuzzle.items[attr.id].map((item) => item.id)])),
    sundayPuzzle.clues,
    2,
  ).count,
  1,
);

assert.ok(houseIsCompleteAndCorrect(solution, solution, 0));
assert.equal(houseIsCompleteAndCorrect([{ person: "ada" }, {}, {}], solution, 0), false);
assert.ok(gridMatchesSolution(solution, solution));

const share = formatShare({
  number: 12,
  houseCount: 5,
  completionOrder: [2, 3, 1, 5, 4],
  elapsedMs: 165000,
});
assert.equal(
  share,
  [
    `${GAME_NAME} #12`,
    "🏠🏠🏠🏠🏠",
    `${KEYCAP_DIGITS[1]}${KEYCAP_DIGITS[2]}${KEYCAP_DIGITS[0]}${KEYCAP_DIGITS[4]}${KEYCAP_DIGITS[3]}`,
    "Solved in 2:45",
    SITE_URL,
  ].join("\n"),
);
assert.match(share, /^Plotted #\d+/m);
assert.equal(share.split("\n")[1], "🏠".repeat(5));
assert.match(share, /Solved in 2:45/);

const threeShare = formatShare({
  number: 1,
  houseCount: 3,
  completionOrder: [1, 2, 3],
  elapsedMs: 61000,
});
assert.equal(threeShare.split("\n")[1], "🏠".repeat(3));

for (const theme of THEMES) {
  for (const attr of theme.attributes) {
    assert.ok(theme.items[attr].length >= 5, `${theme.id} ${attr} needs enough icons`);
    for (const item of theme.items[attr]) {
      assert.ok(ICONS[item.icon], `${theme.id} missing Phosphor icon ${item.icon}`);
    }
  }
}

assert.match(iconSvg("cat"), /viewBox="0 0 256 256"/);
assert.match(iconSvg("house"), /opacity="0.2"/);

const html = read("index.html");
assert.match(html, /plotted.css/);
assert.match(html, /manifest.webmanifest/);
assert.match(html, /plotted-theme/);
assert.match(html, /archive\//);
assert.match(html, /params.has\("plot"\)/);
assert.match(html, /id="sheet"/);
assert.doesNotMatch(html, /Nunito|Fredoka|peach|lavender/);

const css = read("plotted.css");
assert.match(css, /--bg: #0c0b09/);
assert.match(css, /--gold: #e8c47a/);
assert.match(css, /IBM Plex Mono/);
assert.match(css, /Fraunces/);
assert.match(css, /html\[data-theme="light"\]/);
assert.match(css, /min-height: var\(--tap\)/);
assert.match(css, /100dvh/);
assert.match(css, /\.hint-block/);
assert.match(css, /\.clue-num/);
assert.match(css, /\.sheet-panel/);
assert.doesNotMatch(css, /scroll-snap/);
assert.doesNotMatch(css, /Nunito|Fredoka/);

const app = read("plotted.js");
assert.match(app, /GAME_NAME/);
assert.match(app, /formatShare/);
assert.match(app, /LONG_PRESS_MS/);
assert.match(app, /navigator.clipboard/);
assert.match(app, /navigator.share/);
assert.match(app, /serviceWorker/);
assert.match(app, /Hints/);
assert.match(app, /openSheet/);
assert.doesNotMatch(app, /Tap a slot/);
assert.doesNotMatch(app, /[\u{1F300}-\u{1FAFF}]/u);

const archiveHtml = read("archive/index.html");
assert.match(archiveHtml, /Plotmaniac archive/);
assert.match(archiveHtml, /href="\.\.\/"/);
assert.match(archiveHtml, /Gallery of obsessions/);
assert.ok(fs.existsSync(path.join(root, "archive/app.js")));
assert.ok(fs.existsSync(path.join(root, "archive/data/plots.json")));

const plan = read("docs/plotted-plan.md");
assert.match(plan, /Plotted/);
assert.match(plan, /Plotmaniac archive/);
assert.match(plan, /🏠/);
assert.match(plan, /Solved in/);
assert.match(plan, /All clues are hints/);
assert.doesNotMatch(plan, /swipeable/);
assert.doesNotMatch(plan, /share-card|share card/i);

const dailyPath = path.join(root, "data/plotted/2026-10-13.json");
assert.ok(fs.existsSync(dailyPath), "launch-day puzzle JSON");
const daily = JSON.parse(fs.readFileSync(dailyPath, "utf8"));
assert.equal(daily.date, "2026-10-13");
assert.ok(daily.clues.length >= 5 && daily.clues.length <= 8);
assert.equal(
  countSolutions(
    daily.houseCount,
    daily.attributes.map((attr) => attr.id),
    Object.fromEntries(daily.attributes.map((attr) => [attr.id, daily.items[attr.id].map((item) => item.id)])),
    daily.clues,
    2,
  ).count,
  1,
);
const fiveHouse = JSON.parse(fs.readFileSync(path.join(root, "data/plotted/2026-10-25.json"), "utf8"));
assert.equal(fiveHouse.houseCount, 5);
assert.equal(
  countSolutions(
    fiveHouse.houseCount,
    fiveHouse.attributes.map((attr) => attr.id),
    Object.fromEntries(fiveHouse.attributes.map((attr) => [attr.id, fiveHouse.items[attr.id].map((item) => item.id)])),
    fiveHouse.clues,
    2,
  ).count,
  1,
);
const jsonCount = fs.readdirSync(path.join(root, "data/plotted")).filter((name) => name.endsWith(".json")).length;
assert.ok(jsonCount >= 365, `expected a year of puzzles, got ${jsonCount}`);

console.log("plotted tests ok");
