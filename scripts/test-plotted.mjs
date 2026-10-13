import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_NAME, KEYCAP_DIGITS, LAUNCH_DATE, NOTES_STORAGE_KEY, PRACTICE_GROUPS, PRACTICE_NOTES_KEY, PRACTICE_PROGRESS_KEY, PRACTICE_PUZZLES, SITE_URL } from "../plotted-config.js";
import { normalizeNotes, progressFitsPuzzle, slotFitPlan } from "../plotted.js";
import { ICONS, iconSvg } from "../plotted-icons.js";
import { THEMES } from "../plotted-themes.js";
import {
  clueHolds,
  clueText,
  countSolutions,
  einsteinPuzzle,
  EINSTEIN_SETUP,
  EINSTEIN_SOLUTION,
  formatShare,
  formatTime,
  generatePuzzle,
  gridMatchesSolution,
  highlightItemWordsHtml,
  houseIsCompleteAndCorrect,
  labelsMissingFromCopy,
  livesSubjectIsBareObject,
  bestTypedCompletion,
  matchTypedItem,
  puzzleNumber,
  specForDate,
  pruneClues,
} from "../plotted-engine.js";
import { solveByHuman, solvePuzzleByHuman } from "../plotted-human-solver.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const flattenItems = (items) => Object.values(items).flat();

assert.equal(GAME_NAME, "Plotted");
assert.equal(LAUNCH_DATE, "2026-10-13");
assert.equal(NOTES_STORAGE_KEY, "plotted-notes");
assert.equal(PRACTICE_PROGRESS_KEY, "plotted-practice");
assert.equal(PRACTICE_NOTES_KEY, "plotted-practice-notes");
assert.equal(PRACTICE_PUZZLES.length, 17);
assert.deepEqual(
  PRACTICE_GROUPS.map((entry) => entry.id),
  ["easy", "easy-medium", "medium", "medium-hard", "hard"],
);
assert.deepEqual(
  PRACTICE_PUZZLES.map((entry) => entry.id),
  [
    "easy",
    "quiet-chapter",
    "late-watering",
    "short-stack",
    "easy-medium",
    "medium",
    "whos-pouring",
    "ribbon-aisle",
    "walk-away",
    "medium-hard",
    "parked-pets",
    "last-lantern",
    "night-set",
    "hard",
    "five-copies",
    "parcel-row",
    "four-plates",
  ],
);
assert.equal(PRACTICE_PUZZLES.filter((entry) => entry.group === "easy").length, 4);
assert.equal(PRACTICE_PUZZLES.filter((entry) => entry.group === "medium").length, 4);
assert.equal(PRACTICE_PUZZLES.filter((entry) => entry.group === "medium-hard").length, 4);
assert.equal(PRACTICE_PUZZLES.filter((entry) => entry.group === "hard").length, 4);
assert.equal(normalizeNotes("scratch"), "scratch");
assert.equal(normalizeNotes(["Brit", "green"]), "Brit\ngreen");
assert.equal(normalizeNotes(null), "");

const itemLabels = [
  ...THEMES.flatMap((theme) => Object.values(theme.items || {}).flat().map((item) => item.label)),
  ...Object.values(einsteinPuzzle("2026-10-13").items).flat().map((item) => item.label),
];
const longestLabel = itemLabels.reduce((best, label) => (String(label).length > best.length ? String(label) : best), "");
assert.ok(longestLabel.length >= 10, `expected a long item label, got ${longestLabel}`);
for (const label of ["Norwegian", "BlueMaster", "Pall Mall", "yellow", longestLabel]) {
  const plan = slotFitPlan(label, 75, 36);
  const lines = plan.display.split("\n");
  const width = Math.max(...lines.map((line) => line.length * 0.64 * plan.fontSize));
  assert.ok(width <= 75.5, `${label} is ${width.toFixed(1)}px at ${plan.fontSize}px in a 75px tile`);
  assert.ok(plan.fontSize >= 9);
  assert.ok(plan.lines <= 2);
}
assert.equal(slotFitPlan("", 75).display, "");
assert.equal(slotFitPlan("tea", 200).fontSize, 16);
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
  "plotted-human-solver.js",
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
assert.equal(generated.difficulty.solvedByHuman, true);
assert.ok(generated.difficulty.hardest);
assert.ok(generated.difficulty.hardestTier >= 1);

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

const practiceShare = formatShare({
  heading: `${GAME_NAME} practice · Easy`,
  houseCount: 3,
  completionOrder: [1, 2, 3],
  elapsedMs: 61000,
});
assert.match(practiceShare, /^Plotted practice · Easy\n/);
assert.doesNotMatch(practiceShare.split("\n")[0], /#\d/);

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
assert.match(iconSvg("arrow-counter-clockwise"), /opacity="0.2"/);
assert.ok(ICONS["arrow-counter-clockwise"]);

const html = read("index.html");
assert.match(html, /plotted.css/);
assert.match(html, /manifest.webmanifest/);
assert.match(html, /plotted-theme/);
assert.match(html, /archive\//);
assert.match(html, /params.has\("plot"\)/);
assert.match(html, /id="how-to"/);
assert.match(html, /gold dashed outline/);
assert.match(html, /list above the grid/);
assert.match(html, /id="howto"/);
assert.match(html, /id="setup"/);
assert.match(html, /How to play/);
assert.match(html, /import \{ boot \}/);
assert.match(html, /id="btn-help"/);
assert.match(html, /id="btn-start-over"/);
assert.doesNotMatch(html, /id="btn-hint"/);
assert.match(html, /id="practice-nav"/);
assert.match(html, /id="start-over"/);
assert.match(html, /Reset grid and notes/);
assert.match(html, /win-stats/);
assert.doesNotMatch(html, /id="confetti"/);
assert.doesNotMatch(html, /id="sheet"/);
assert.doesNotMatch(html, /Nunito|Fredoka|peach|lavender/);

const sw = read("sw.js");
assert.match(sw, /plotted-v17/);
assert.match(sw, /skipWaiting/);
assert.match(sw, /clients\.claim/);
assert.match(sw, /isShellRequest/);
assert.match(sw, /fetch\(request\)/);
assert.match(sw, /path\.endsWith\("\.js"\)/);
assert.match(sw, /path\.endsWith\("\.html"\)/);

const css = read("plotted.css");
assert.match(css, /--bg: #1a1230/);
assert.match(css, /--bg: #fff6eb/);
assert.match(css, /--correct: #6aaa64/);
assert.match(css, /--wrong: #c94c4c/);
assert.match(css, /--unknown: #e0b43a/);
assert.match(css, /--unknown: #b57a12/);
assert.match(css, /\.slot\.is-unknown \{[^}]*border-style: dashed/);
assert.doesNotMatch(css, /--unknown: #c94c4c/);
assert.match(css, /IBM Plex Mono/);
assert.match(css, /Fraunces/);
assert.match(css, /html\[data-theme="light"\]/);
assert.match(css, /min-height: var\(--tap\)/);
assert.match(css, /font-size: 16px/);
assert.match(css, /100dvh/);
assert.match(css, /\.hint-block/);
assert.match(css, /\.hint-heading \{[^}]*justify-content: center/);
assert.match(css, /\.hint-reveal \{[^}]*min-height: 44px/);
assert.match(css, /\.clue-num/);
assert.match(css, /\.clue-num \{[^}]*font-size: inherit/);
assert.match(css, /\.clue-num \{[^}]*tabular-nums/);
assert.match(css, /--clue-size: 13px/);
assert.match(css, /@media \(min-width: 640px\)[\s\S]*--clue-size: 15px/);
assert.match(css, /\.grid-table \.attr-head \{[^}]*font-size: var\(--clue-size/);
assert.match(css, /\.slot-input/);
assert.match(css, /\.slot-ghost/);
assert.match(css, /\.slot-input \{[^}]*text-align: center/);
assert.match(css, /\.slot-fit/);
assert.match(css, /\.slot\.is-editing/);
assert.match(css, /min-height: 40px/);
assert.match(css, /min-width: 260px/);
assert.match(css, /100dvh - var\(--mast-h/);
assert.match(css, /overflow: auto/);
assert.match(css, /\.grid-table/);
assert.match(css, /\.notes-panel/);
assert.match(css, /\.puzzle-col/);
assert.match(css, /\.word-bank/);
assert.match(css, /\.practice-nav \{[^}]*max-width: 100%/);
assert.match(css, /\.practice-nav \{[^}]*overflow-x: hidden/);
assert.match(css, /\.practice-nav select \{[^}]*width: 100%/);
assert.match(css, /\.practice-nav select \{[^}]*font-size: var\(--clue-size/);
assert.doesNotMatch(css, /\.practice-nav[^{]*\{[^}]*gradient/);
assert.doesNotMatch(css, /\.practice-nav select[^{]*\{[^}]*gradient/);
assert.match(css, /\.word-bank-word\.is-placed \{[^}]*line-through/);
assert.doesNotMatch(css, /\.word-bank[^{]*\{[^}]*gradient/);
assert.match(css, /border-radius: 18px/);
assert.match(css, /--notes-border/);
assert.match(css, /\.notes::placeholder/);
assert.doesNotMatch(css, /repeating-linear-gradient/);
assert.doesNotMatch(css, /--notes-rule/);
assert.match(css, /\.grid-table \.attr-head \{[^}]*white-space: nowrap/);
assert.match(css, /min-width: 7rem/);
assert.match(css, /--notes-size/);
assert.match(css, /@media \(min-width: 640px\)/);
assert.match(css, /@media \(max-width: 639px\)[\s\S]*\.notes-panel\[open\]/);
assert.doesNotMatch(css, /\.notes-grid/);
assert.doesNotMatch(css, /\.notes-block/);
assert.match(css, /@keyframes pop/);
assert.match(css, /@keyframes flip/);
assert.match(css, /@keyframes shake/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /\.clue-text strong[\s\S]*color:\s*inherit/);
assert.doesNotMatch(css, /scroll-snap/);
assert.doesNotMatch(css, /\.sheet-panel/);
assert.doesNotMatch(css, /Nunito|Fredoka/);
assert.doesNotMatch(css, /body::before/);
assert.doesNotMatch(css, /radial-gradient/);
assert.doesNotMatch(css, /\.clue:nth-child[^{]*strong/);
assert.doesNotMatch(css, /\.slot\.is-match/);
assert.doesNotMatch(css, /grid-template-columns: minmax\(0, 1\.15fr\)/);

const app = read("plotted.js");
assert.match(app, /GAME_NAME/);
assert.match(app, /formatShare/);
assert.match(app, /matchTypedItem/);
assert.match(app, /highlightItemWordsHtml/);
assert.match(app, /autocapitalize/);
assert.match(app, /bestTypedCompletion/);
assert.match(app, /fitPlayfield/);
assert.match(app, /CLUE_SIZE_PHONE = 13/);
assert.match(app, /CLUE_SIZE_DESKTOP = 15/);
assert.match(app, /applyTiles/);
assert.match(app, /applyClues/);
assert.doesNotMatch(app, /11 \+ t \* 7/);
assert.match(app, /revealCheck/);
assert.match(app, /slot-ghost/);
assert.match(app, /slotFitPlan/);
assert.match(app, /slot-fit/);
assert.match(app, /is-editing/);
assert.match(app, /navigator.clipboard/);
assert.match(app, /navigator.share/);
assert.match(app, /serviceWorker/);
assert.match(app, /Hints/);
assert.match(app, /hint-heading/);
assert.match(app, /hint-reveal/);
assert.match(app, /aria-label", "Reveal a cell"/);
assert.match(app, /puzzle\.setup/);
assert.match(app, /progressFitsPuzzle/);
assert.match(app, /grid-table/);
assert.match(app, /NOTES_STORAGE_KEY/);
assert.match(app, /notes-panel/);
assert.match(app, /Jot your deductions here/);
assert.match(app, /puzzle-col/);
assert.match(app, /maybeFinishIfSolved/);
assert.match(app, /startOver/);
assert.match(app, /PRACTICE_PROGRESS_KEY/);
assert.match(app, /practiceId/);
assert.match(app, /practice-select/);
assert.match(app, /PRACTICE_GROUPS/);
assert.match(app, /streakAwarded/);
assert.match(app, /arrow-counter-clockwise/);
assert.match(app, /makeWordBank/);
assert.match(app, /missingVisibleOptions/);
assert.match(app, /gold dashed outline/);
assert.doesNotMatch(app, /notes-grid/);
assert.doesNotMatch(app, /datalist/);
assert.doesNotMatch(app, /openSheet/);
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
assert.match(plan, /Einstein/);
assert.match(plan, /types the exact word/);
assert.match(plan, /How to play/);
assert.match(plan, /plain bold/);
assert.match(plan, /Wordle/);
assert.match(plan, /ghost/);
assert.match(plan, /word bank/i);
assert.match(plan, /scratchpad/);
assert.match(plan, /solves immediately/);
assert.doesNotMatch(plan, /swipeable/);
assert.doesNotMatch(plan, /share-card|share card/i);
assert.doesNotMatch(plan, /tinted blob|soft grid background/);

assert.equal(
  progressFitsPuzzle(
    { grid: [{ person: "ada" }, { person: "bo" }, { person: "cam" }] },
    { houseCount: 5, attributes: [{ id: "color" }, { id: "nationality" }] },
  ),
  false,
);
assert.equal(
  progressFitsPuzzle(
    {
      grid: [
        { color: "", nationality: "" },
        { color: "", nationality: "" },
      ],
    },
    { houseCount: 2, attributes: [{ id: "color" }, { id: "nationality" }] },
  ),
  true,
);

const einstein = einsteinPuzzle("2026-10-13");
assert.equal(einstein.houseCount, 5);
assert.equal(einstein.clues.length, 15);
assert.equal(einstein.question.text, "Who owns the fish?");
assert.equal(einstein.question.answerItem, "german");
assert.equal(einstein.setup, EINSTEIN_SETUP);
assert.equal(einstein.clues[3].immediate, true);
assert.equal(einstein.clues[3].text, "The green house is on the left of the white house");
for (const clue of einstein.clues) {
  assert.equal(clueHolds(clue, EINSTEIN_SOLUTION), true, clue.text);
}
const einsteinCount = countSolutions(
  5,
  einstein.attributes.map((attr) => attr.id),
  Object.fromEntries(einstein.attributes.map((attr) => [attr.id, einstein.items[attr.id].map((item) => item.id)])),
  einstein.clues,
  2,
);
assert.equal(einsteinCount.count, 1, "Einstein riddle must be unique");
assert.equal(einsteinCount.solution.find((house) => house.pet === "fish").nationality, "german");

assert.equal(matchTypedItem(einstein.items.cigar, " blend ").status, "match");
assert.equal(matchTypedItem(einstein.items.cigar, "blend").item.id, "blends");
assert.equal(matchTypedItem(einstein.items.cigar, "Blends").item.id, "blends");
assert.equal(matchTypedItem(einstein.items.cigar, "pall mall").item.id, "pall-mall");
assert.equal(matchTypedItem(einstein.items.cigar, "Pall Mall").item.id, "pall-mall");
assert.equal(matchTypedItem(einstein.items.cigar, "PALLMALL").item.id, "pall-mall");
assert.equal(matchTypedItem(einstein.items.cigar, "BlueMaster").item.id, "bluemaster");
assert.equal(matchTypedItem(einstein.items.cigar, "blue master").item.id, "bluemaster");
assert.equal(matchTypedItem(einstein.items.cigar, "Blue-Master").item.id, "bluemaster");
assert.equal(matchTypedItem(einstein.items.nationality, "GERMAN").item.id, "german");
assert.equal(matchTypedItem(einstein.items.color, "purple").status, "unknown");
assert.equal(matchTypedItem(einstein.items.color, "Norwegian").status, "unknown");
const nor = bestTypedCompletion(einstein.items.nationality, "Nor");
assert.equal(nor.status, "partial");
assert.equal(nor.item.id, "norwegian");
assert.equal(nor.rest, "wegian");
assert.equal(bestTypedCompletion(einstein.items.nationality, "Norwegian").status, "match");
assert.equal(bestTypedCompletion(einstein.items.nationality, "xyz").status, "unknown");
assert.equal(bestTypedCompletion(einstein.items.cigar, "Pall").rest, " Mall");
assert.equal(bestTypedCompletion(einstein.items.cigar, "Blue").item.id, "bluemaster");
assert.match(
  highlightItemWordsHtml("The man who smokes blend has a neighbor who drinks water", flattenItems(einstein.items)),
  /<strong>blend<\/strong>/,
);
assert.match(
  highlightItemWordsHtml("The person who smokes Pall Mall rears birds", flattenItems(einstein.items)),
  /<strong>Pall Mall<\/strong>/,
);

const catalog = {
  person: [
    { id: "bo", label: "Bo" },
    { id: "hana", label: "Hana" },
  ],
  pet: [
    { id: "horse", label: "horse" },
    { id: "cat", label: "cat" },
    { id: "fish", label: "fish" },
  ],
  prize: [
    { id: "balloon", label: "balloon" },
    { id: "trophy", label: "trophy" },
  ],
};
assert.equal(
  clueText({ type: "next_to", left: { attr: "prize", item: "balloon" }, right: { attr: "pet", item: "fish" } }, catalog, "pet-show"),
  "The balloon winner lives next door to the fish owner.",
);
assert.equal(
  clueText({ type: "same", left: { attr: "person", item: "bo" }, right: { attr: "pet", item: "horse" } }, catalog, "pet-show"),
  "Bo owns the horse.",
);
assert.equal(
  clueText({ type: "at", attr: "prize", item: "trophy", house: 0 }, catalog, "pet-show"),
  "The trophy winner lives in house 1.",
);
assert.equal(
  clueText(
    { type: "left_of", immediate: true, left: { attr: "pet", item: "cat" }, right: { attr: "person", item: "hana" } },
    catalog,
    "pet-show",
  ),
  "The cat owner lives immediately left of Hana.",
);
assert.equal(
  livesSubjectIsBareObject("The balloon winner lives next door to the fish owner.", catalog),
  false,
);
assert.equal(livesSubjectIsBareObject("balloon lives next door to fish", catalog), true);

const dailyPath = path.join(root, "data/plotted/2026-10-13.json");
assert.ok(fs.existsSync(dailyPath), "launch-day puzzle JSON");
const daily = JSON.parse(fs.readFileSync(dailyPath, "utf8"));
assert.equal(daily.date, "2026-10-13");
assert.equal(daily.theme.id, "einstein");
assert.equal(daily.houseCount, 5);
assert.equal(daily.clues.length, 15);
assert.equal(daily.clues[0].text, "The Brit lives in the red house");
assert.equal(daily.clues[14].text, "The man who smokes blend has a neighbor who drinks water");
assert.deepEqual(labelsMissingFromCopy(daily), [], "Einstein names every option in the clues");
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
assert.equal(daily.solution.find((house) => house.pet === "fish").nationality, "german");
const later = JSON.parse(fs.readFileSync(path.join(root, "data/plotted/2026-10-14.json"), "utf8"));
assert.notEqual(later.theme.id, "einstein");
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
for (const item of flattenItems(einstein.items)) {
  assert.ok(ICONS[item.icon], `Einstein missing Phosphor icon ${item.icon}`);
}

const practiceIds = PRACTICE_PUZZLES.map((entry) => entry.id);
const practiceIndex = JSON.parse(fs.readFileSync(path.join(root, "data/practice/index.json"), "utf8"));
assert.deepEqual(practiceIndex.puzzles.map((entry) => entry.id), practiceIds);
const keptPractice = new Set(["easy", "easy-medium", "medium", "medium-hard", "hard"]);
const newHard = ["five-copies", "parcel-row", "four-plates"];
for (const id of practiceIds) {
  const practice = JSON.parse(fs.readFileSync(path.join(root, `data/practice/${id}.json`), "utf8"));
  const catalog = PRACTICE_PUZZLES.find((entry) => entry.id === id);
  assert.equal(practice.practice, true);
  assert.equal(practice.practiceId, id);
  assert.equal(practice.difficulty.solvedByHuman, true);
  assert.ok(!practice.date, `${id} must not sit on the daily calendar`);
  assert.equal(practice.theme.title, catalog.title, `${id} needs a fun title`);
  const attrs = practice.attributes.map((attr) => attr.id);
  const ids = Object.fromEntries(attrs.map((attr) => [attr, practice.items[attr].map((item) => item.id)]));
  const unique = countSolutions(practice.houseCount, attrs, ids, practice.clues, 2);
  assert.equal(unique.count, 1, `${id} must be unique`);
  const human = solvePuzzleByHuman(practice);
  assert.equal(human.solvedByHuman, true, `${id} must solve by human techniques`);
  assert.ok(practice.clues.length >= 4);
  for (const item of flattenItems(practice.items)) {
    assert.ok(ICONS[item.icon], `${id} missing Phosphor icon ${item.icon}`);
  }
  if (id === "easy") {
    const copyGaps = labelsMissingFromCopy(practice);
    assert.ok(
      copyGaps.some((entry) => entry.id === "butterfly" || entry.id === "beer"),
      "easy practice still omits some pets/drinks from clue text; the word bank must cover them",
    );
  } else if (!keptPractice.has(id)) {
    assert.ok(practice.houseCount >= 3);
    assert.match(practice.source, /^daily-2027-1[12]-/, `${id} should copy a late-2027 daily`);
    assert.ok(!practice.date, `${id} must not keep the daily date`);
    if (id === "five-copies") {
      assert.equal(practice.houseCount, 5, `${id} should be a 5-house hard puzzle`);
    } else if (newHard.includes(id)) {
      assert.ok(practice.houseCount >= 4, `${id} should prefer a larger hard grid`);
    }
  }
}

const einsteinHuman = solvePuzzleByHuman(einstein);
assert.equal(einsteinHuman.solvedByHuman, true, "Einstein must solve by human techniques");
assert.ok(einsteinHuman.steps.length >= 10, `Einstein should take several deductions, got ${einsteinHuman.steps.length}`);
assert.equal(einsteinHuman.solution.find((house) => house.pet === "fish").nationality, "german");
assert.ok(einsteinHuman.hardestTier >= 1);
assert.ok(einsteinHuman.hardest);

const guessItems = {
  person: ["ada", "bo", "cam"],
  pet: ["cat", "dog", "bird"],
  drink: ["tea", "coffee", "wine"],
};
const guessClues = [{ id: "c1", type: "same", left: { attr: "person", item: "ada" }, right: { attr: "pet", item: "cat" } }];
const guessUnique = countSolutions(3, ["person", "pet", "drink"], guessItems, guessClues, 3);
assert.ok(guessUnique.count > 1, "underconstrained puzzle must still have more than one solution");
const guessHuman = solveByHuman(3, ["person", "pet", "drink"], guessItems, guessClues);
assert.equal(guessHuman.solvedByHuman, false, "a guess-requiring puzzle must not count as human-solved");
const plottedDir = path.join(root, "data/plotted");
const jsonFiles = fs.readdirSync(plottedDir).filter((name) => name.endsWith(".json"));
assert.ok(jsonFiles.length >= 365, `expected a year of puzzles, got ${jsonFiles.length}`);
let datedHumanFail = 0;
let datedNeededSearch = 0;
let datedCopyGaps = 0;
for (const name of jsonFiles) {
  const puzzle = JSON.parse(fs.readFileSync(path.join(plottedDir, name), "utf8"));
  for (const clue of puzzle.clues) {
    assert.equal(
      livesSubjectIsBareObject(clue.text, puzzle.items),
      false,
      `${name} object-subject lives: ${clue.text}`,
    );
  }
  const attrs = puzzle.attributes.map((attr) => attr.id);
  const ids = Object.fromEntries(attrs.map((attr) => [attr, puzzle.items[attr].map((item) => item.id)]));
  const unique = countSolutions(puzzle.houseCount, attrs, ids, puzzle.clues, 2);
  assert.equal(unique.count, 1, `${name} must stay unique`);
  if (unique.neededSearch) datedNeededSearch += 1;
  const human = solvePuzzleByHuman(puzzle);
  if (!human.solvedByHuman) datedHumanFail += 1;
  if (labelsMissingFromCopy(puzzle).length) datedCopyGaps += 1;
}
assert.equal(datedHumanFail, 0, `${datedHumanFail} dated puzzles failed the human-technique solver`);
console.log(
  `dated audit: ${jsonFiles.length} unique, ${datedNeededSearch} neededSearch, ${datedHumanFail} humanFail, ${datedCopyGaps} missing options from clue text`,
);

console.log("plotted tests ok");
