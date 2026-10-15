import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GAME_NAME, KEYCAP_DIGITS, LAUNCH_DATE, NOTES_STORAGE_KEY, PRACTICE_GROUPS, PRACTICE_NOTES_KEY, PRACTICE_PROGRESS_KEY, PRACTICE_PUZZLES, SITE_URL, TODAY_OVERRIDE, dailyPuzzleDate } from "../plotted-config.js";
import { normalizeNotes, progressFitsPuzzle, slotFitPlan } from "../plotted.js";
import { ICONS, iconSvg } from "../plotted-icons.js";
import { ATTRIBUTES, PRACTICE_THEMES, THEMES } from "../plotted-themes.js";
import {
  clueHolds,
  clueText,
  displayClueText,
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
  housePlaceName,
  labelsMissingFromCopy,
  livesSubjectIsBareObject,
  bestTypedCompletion,
  matchTypedItem,
  puzzleNumber,
  puzzleSetup,
  specForDate,
  pruneClues,
  EINSTEIN_BANNED_VOCAB,
  GENERIC_HAS_ATTRS,
  validateClueStyle,
  validateEinsteinStyle,
  CLUE_STYLE_BANS,
  CLUE_STYLE_TEMPLATES,
} from "../plotted-engine.js";
import { solveByHuman, solvePuzzleByHuman } from "../plotted-human-solver.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const flattenItems = (items) => Object.values(items).flat();

assert.equal(GAME_NAME, "Plotted");
assert.equal(LAUNCH_DATE, "2026-10-13");
assert.equal(TODAY_OVERRIDE, "einstein");
assert.equal(dailyPuzzleDate(new Date("2026-11-01T15:00:00")), LAUNCH_DATE);
assert.equal(dailyPuzzleDate(new Date("2027-04-22T08:00:00")), LAUNCH_DATE);
assert.equal(SITE_URL, "https://plotmaniac.com");
assert.equal(NOTES_STORAGE_KEY, "plotted-notes");
assert.equal(PRACTICE_PROGRESS_KEY, "plotted-practice");
assert.equal(PRACTICE_NOTES_KEY, "plotted-practice-notes");
assert.equal(PRACTICE_PUZZLES.length, 33);
assert.deepEqual(
  PRACTICE_GROUPS.map((entry) => entry.id),
  ["easy", "easy-medium", "medium", "medium-hard", "hard", "expert"],
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
    "five-plots",
    "late-set",
    "desk-row",
    "quiet-shelf",
    "painted-pets",
    "city-plates",
    "long-street",
    "five-trades",
    "five-cities",
    "hobby-houses",
    "five-plates",
    "sail-lane",
    "five-doors",
    "house-band",
    "parked-books",
    "camp-cities",
  ],
);
assert.equal(PRACTICE_PUZZLES.filter((entry) => entry.group === "easy").length, 4);
assert.equal(PRACTICE_PUZZLES.filter((entry) => entry.group === "medium").length, 4);
assert.equal(PRACTICE_PUZZLES.filter((entry) => entry.group === "medium-hard").length, 4);
assert.equal(PRACTICE_PUZZLES.filter((entry) => entry.group === "hard").length, 10);
assert.equal(PRACTICE_PUZZLES.filter((entry) => entry.group === "expert").length, 10);
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
assert.match(generated.setup, /^There are /);
assert.equal(validateEinsteinStyle(generated).ok, true, JSON.stringify(validateEinsteinStyle(generated).failures));

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
assert.equal(validateEinsteinStyle(sundayPuzzle).ok, true, JSON.stringify(validateEinsteinStyle(sundayPuzzle).failures));

assert.ok(houseIsCompleteAndCorrect(solution, solution, 0));
assert.equal(houseIsCompleteAndCorrect([{ person: "ada" }, {}, {}], solution, 0), false);
assert.ok(gridMatchesSolution(solution, solution));

const share = formatShare({
  date: "2026-10-13",
  houseCount: 5,
  completionOrder: [2, 3, 1, 5, 4],
  elapsedMs: 165000,
});
assert.equal(
  share,
  [
    `${GAME_NAME} 2026-10-13`,
    "🏠🏠🏠🏠🏠",
    `${KEYCAP_DIGITS[1]}${KEYCAP_DIGITS[2]}${KEYCAP_DIGITS[0]}${KEYCAP_DIGITS[4]}${KEYCAP_DIGITS[3]}`,
    "Solved in 2:45",
    SITE_URL,
  ].join("\n"),
);
assert.match(share, /^Plotted 2026-10-13\n/);
assert.equal(share.split("\n")[1], "🏠".repeat(5));
assert.match(share, /Solved in 2:45/);
assert.equal(share.split("\n").at(-1), SITE_URL);
assert.doesNotMatch(share, /hint/i);

const hintedShare = formatShare({
  date: "2026-10-13",
  houseCount: 5,
  completionOrder: [2, 3, 1, 5, 4],
  elapsedMs: 222000,
  hints: 1,
});
assert.equal(
  hintedShare,
  [
    `${GAME_NAME} 2026-10-13`,
    "🏠🏠🏠🏠🏠",
    `${KEYCAP_DIGITS[1]}${KEYCAP_DIGITS[2]}${KEYCAP_DIGITS[0]}${KEYCAP_DIGITS[4]}${KEYCAP_DIGITS[3]}`,
    "Solved in 3:42",
    "1 hint",
    SITE_URL,
  ].join("\n"),
);

const practiceShare = formatShare({
  heading: `${GAME_NAME} practice · Easy`,
  houseCount: 3,
  completionOrder: [1, 2, 3],
  elapsedMs: 61000,
});
assert.match(practiceShare, /^Plotted practice · Easy\n/);
assert.doesNotMatch(practiceShare.split("\n")[0], /#\d/);
assert.match(practiceShare, /Solved in 1:01/);
assert.equal(practiceShare.split("\n").at(-1), SITE_URL);

const threeShare = formatShare({
  date: LAUNCH_DATE,
  houseCount: 3,
  completionOrder: [1, 2, 3],
  elapsedMs: 61000,
});
assert.equal(threeShare.split("\n")[1], "🏠".repeat(3));
assert.equal(threeShare.split("\n").at(-1), SITE_URL);

for (const theme of [...THEMES, ...PRACTICE_THEMES]) {
  assert.ok(
    !theme.attributes.some((id) => GENERIC_HAS_ATTRS.has(id)),
    `${theme.id} must not use a generic-has category`,
  );
  for (const attr of theme.attributes) {
    assert.ok(theme.items[attr].length >= 5, `${theme.id} ${attr} needs enough icons`);
    const labels = new Set();
    for (const item of theme.items[attr]) {
      assert.ok(ICONS[item.icon], `${theme.id} missing Phosphor icon ${item.icon}`);
      assert.equal(labels.has(item.label), false, `${theme.id} duplicate label ${item.label}`);
      labels.add(item.label);
      for (const [re, name] of EINSTEIN_BANNED_VOCAB) {
        assert.equal(re.test(item.label), false, `${theme.id} ${item.label} is banned (${name})`);
      }
    }
  }
}
const dinnerPets = THEMES.find((theme) => theme.id === "dinner-party").items.pet;
assert.deepEqual(
  dinnerPets.map((item) => item.label).sort(),
  ["bird", "cat", "dog", "fish", "horse", "rabbit"],
);
assert.equal(matchTypedItem(dinnerPets, "dogs").item.id, "dog");
assert.equal(matchTypedItem(dinnerPets, "cats").item.id, "cat");
assert.equal(matchTypedItem(dinnerPets, "horses").item.id, "horse");
assert.equal(matchTypedItem(dinnerPets, "birds").item.id, "bird");
assert.equal(matchTypedItem(dinnerPets, "rabbits").item.id, "rabbit");
assert.equal(matchTypedItem(dinnerPets, "dog").item.id, "dog");
for (const [id, def] of Object.entries(ATTRIBUTES)) {
  if (id === "person" || id === "nationality") {
    assert.equal(def.verb, null, `${id} is an actor and has no verb`);
    continue;
  }
  assert.ok(def.verb, `${id} needs a curated verb`);
  if (id === "pet") {
    assert.equal(def.verb, "has", "pets use has, never keeps");
    continue;
  }
  assert.notEqual(def.verb, "has", `${id} must not use generic has`);
  assert.notEqual(def.verb, "keeps", `${id} must not use keeps`);
}
assert.equal(ATTRIBUTES.pet.occupant("dog"), "the dog owner");
assert.equal(ATTRIBUTES.pet.occupant("dogs"), "the dog owner");
assert.equal(ATTRIBUTES.pet.personSame("Drew", "dog"), "Drew has a dog");
assert.equal(ATTRIBUTES.pet.personSame("Gus", "horse"), "Gus has a horse");
assert.equal(ATTRIBUTES.pet.personSame("Ada", "fish"), "Ada has a fish");

assert.match(iconSvg("cat"), /viewBox="0 0 256 256"/);
assert.match(iconSvg("house"), /opacity="0.2"/);
assert.match(iconSvg("arrow-counter-clockwise"), /opacity="0.2"/);
assert.ok(ICONS["arrow-counter-clockwise"]);
assert.ok(ICONS["caret-down"]);
assert.ok(ICONS.backspace);
assert.ok(ICONS["squares-four"]);
assert.ok(ICONS["note-pencil"]);
assert.match(iconSvg("backspace", { label: "Backspace" }), /Backspace/);

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
assert.doesNotMatch(html, /id="btn-notes"/);
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
assert.match(sw, /plotted-v35/);
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
assert.match(css, /\.hint-heading \{[^}]*flex-direction: row/);
assert.match(css, /\.hint-heading \{[^}]*justify-content: center/);
assert.match(css, /\.icon-btn\.hint-reveal \{[^}]*min-height: 28px/);
assert.match(css, /\.hint-reveal svg \{[^}]*width: 16px/);
assert.match(css, /\.clue \{[^}]*border-bottom: 0/);
assert.match(css, /\.practice-nav \{[^}]*margin: 0 0 2px/);
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
assert.match(css, /\.slot\.is-selected/);
assert.match(css, /\.slot\.is-selected,\s*\n\.slot:focus-within \{[^}]*transform:\s*scale\(1\.06\)/);
assert.match(css, /\.slot \{[^}]*transition:\s*transform 140ms ease/);
assert.match(css, /prefers-reduced-motion: reduce[\s\S]*\.slot\.is-selected[\s\S]*transform:\s*none/);
assert.match(css, /\.osk/);
assert.match(css, /\.osk-key/);
assert.match(css, /\.osk-key \{[^}]*border-radius:\s*8px/);
assert.match(css, /\.osk-key \{[^}]*background:\s*var\(--key\)/);
assert.doesNotMatch(css, /\.osk-key[^{]*\{[^}]*gradient/);
assert.match(css, /html\.is-osk \.osk \{[^}]*display:\s*flex/);
assert.match(css, /@media \(pointer: fine\)[\s\S]*\.osk \{[^}]*display:\s*none/);
assert.match(css, /--key:/);
assert.match(css, /--kbd-h:/);
assert.doesNotMatch(css, /\.board\.is-typing-compact/);
assert.doesNotMatch(css, /scale\(0\.72\)/);
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
assert.match(css, /\.practice-nav select \{[^}]*font-size: 16px/);
assert.match(css, /\.practice-nav select \{[^}]*border-radius: 10px/);
assert.match(css, /\.practice-nav select \{[^}]*appearance: none/);
assert.match(css, /\.practice-nav select \{[^}]*min-height: 32px/);
assert.match(css, /\.practice-select-caret \{[^}]*width: 16px/);
assert.match(css, /\.practice-nav select option/);
assert.match(css, /\.board \{[^}]*justify-content: flex-start/);
assert.doesNotMatch(css, /\.practice-nav[^{]*\{[^}]*gradient/);
assert.doesNotMatch(css, /\.practice-nav select[^{]*\{[^}]*gradient/);
assert.match(css, /\.word-bank-word\.is-placed \{[^}]*line-through/);
assert.doesNotMatch(css, /\.word-bank[^{]*\{[^}]*gradient/);
assert.match(css, /\.word-bank-row \{[^}]*grid-template-columns:\s*max-content 1fr/);
assert.match(css, /\.word-bank-row \{[^}]*column-gap:\s*0\.75em/);
assert.match(css, /\.word-bank-cat \{[^}]*white-space:\s*nowrap/);
assert.match(css, /\.word-bank-list \{[^}]*flex-wrap:\s*wrap/);
assert.match(css, /\.word-bank-list \{[^}]*justify-content:\s*flex-start/);
assert.doesNotMatch(css, /\.word-bank-cat \{[^}]*flex:\s*0 0 4\.6rem/);
assert.doesNotMatch(css, /flex: 0 0 4\.6rem/);
assert.match(css, /border-radius: 18px/);
assert.match(css, /--notes-border/);
assert.match(css, /\.notes::placeholder/);
assert.doesNotMatch(css, /repeating-linear-gradient/);
assert.doesNotMatch(css, /--notes-rule/);
assert.match(css, /\.grid-table \.attr-head \{[^}]*white-space: nowrap/);
assert.match(css, /min-width: 7rem/);
assert.match(css, /--notes-size/);
assert.match(css, /@media \(min-width: 640px\)/);
assert.match(css, /\.notes-swap/);
assert.match(css, /\.notes-pad/);
assert.match(css, /\.notes-back/);
assert.match(css, /\.icon-btn\.hint-notes/);
assert.match(css, /@media \(max-width: 639px\)[\s\S]*\.notes-panel \{[^}]*display:\s*none/);
assert.doesNotMatch(css, /\.notes-sheet-handle/);
assert.doesNotMatch(css, /inset: calc\(8px \+ var\(--safe-top\)\)/);
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
assert.match(app, /useOnScreenKeyboard/);
assert.match(app, /typeOnScreenKey/);
assert.match(app, /makeOnScreenKeyboard/);
assert.match(app, /pointer: coarse/);
assert.match(app, /inputmode", osk \? "none"/);
assert.match(app, /displayClueText/);
assert.match(app, /practice-select-caret/);
assert.doesNotMatch(app, /leftover \/ 3/);
assert.match(app, /CLUE_SIZE_PHONE = 13/);
assert.match(app, /CLUE_SIZE_DESKTOP = 15/);
assert.match(app, /CELL_H_PHONE = 42/);
assert.match(app, /CELL_H_PHONE_FLOOR = 32/);
assert.match(app, /CLUE_PAD_PHONE = 1/);
assert.match(app, /createElement\("span"\);\s*hintLabel\.className = "hint-label"/);
assert.match(app, /OSK_ROWS/);
assert.match(app, /btn-notes/);
assert.match(app, /note-pencil/);
assert.match(app, /notes-swap/);
assert.match(app, /typeIntoNotes/);
assert.match(app, /SPACE/);
assert.match(app, /squares-four/);
assert.match(app, /inputmode", "none"/);
assert.doesNotMatch(app, /is-typing-compact/);
assert.doesNotMatch(app, /fitTypingPlayfield/);
assert.doesNotMatch(app, /CELL_H_PHONE_TYPING/);
assert.doesNotMatch(app, /scrollTypingPlayfieldIntoView/);
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
assert.match(app, /navigator\.share\(\{\s*text\s*\}\)/);
assert.doesNotMatch(app, /navigator\.share\(\{[^}]*url/);
assert.match(app, /shareElapsedMs/);
assert.match(app, /dailyPuzzleDate/);
assert.match(app, /TODAY_OVERRIDE/);
assert.match(app, /serviceWorker/);
assert.match(app, /Hints/);
assert.match(app, /hint-heading/);
assert.match(app, /hint-reveal/);
assert.match(app, /aria-label", "Reveal a cell"/);
assert.match(app, /puzzleSetup/);
assert.match(app, /progressFitsPuzzle/);
assert.match(app, /grid-table/);
assert.match(app, /NOTES_STORAGE_KEY/);
assert.match(app, /notes-panel/);
assert.match(app, /closeMobileNotes/);
assert.match(app, /notesEditorOpen/);
assert.match(app, /visualViewport/);
assert.match(app, /keyboard-inset/);
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
assert.match(plan, /validateEinsteinStyle/);
assert.match(plan, /validateClueStyle/);
assert.match(plan, /TODAY_OVERRIDE/);
assert.match(plan, /CLUE_STYLE_TEMPLATES/);
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
assert.match(einstein.setup, /have a certain pet/);
assert.doesNotMatch(einstein.setup, /\bkeeps\b/);
assert.equal(einstein.clues[1].text, "The Swede has a dog");
assert.equal(einstein.clues[5].text, "The person who smokes Pall Mall has a bird");
assert.equal(einstein.clues[9].text, "The man who smokes blends lives next to the cat owner");
assert.equal(einstein.clues[10].text, "The horse owner lives next to the man who smokes Dunhill");
assert.equal(einstein.items.pet.find((item) => item.id === "dogs")?.label, "dog");
assert.equal(matchTypedItem(einstein.items.pet, "dog").item.id, "dogs");
assert.equal(matchTypedItem(einstein.items.pet, "dogs").item.id, "dogs");
assert.equal(matchTypedItem(einstein.items.pet, "cats").item.id, "cats");
assert.equal(matchTypedItem(einstein.items.pet, "horse").item.id, "horses");
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
  highlightItemWordsHtml("The person who smokes Pall Mall has a bird", flattenItems(einstein.items)),
  /<strong>Pall Mall<\/strong>/,
);
assert.match(
  highlightItemWordsHtml("The person who smokes Pall Mall has a bird", flattenItems(einstein.items)),
  /<strong>bird<\/strong>/,
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
  "The person who holds a balloon lives next to the fish owner.",
);
assert.equal(
  clueText({ type: "same", left: { attr: "person", item: "bo" }, right: { attr: "pet", item: "horse" } }, catalog, "pet-show"),
  "Bo has a horse.",
);
assert.equal(
  clueText({ type: "at", attr: "prize", item: "trophy", house: 0 }, catalog, "pet-show"),
  "The person who holds a trophy lives in the first house.",
);
assert.equal(
  clueText({ type: "at", attr: "prize", item: "trophy", house: 0 }, catalog, "pet-show", 3),
  "The person who holds a trophy lives in the first house.",
);
assert.equal(
  clueText({ type: "at", attr: "prize", item: "trophy", house: 1 }, catalog, "pet-show", 3),
  "The person who holds a trophy lives in the center house.",
);
assert.equal(
  clueText({ type: "at", attr: "prize", item: "trophy", house: 2 }, catalog, "pet-show", 3),
  "The person who holds a trophy lives in the last house.",
);
assert.equal(
  clueText(
    { type: "left_of", immediate: true, left: { attr: "pet", item: "cat" }, right: { attr: "person", item: "hana" } },
    catalog,
    "pet-show",
  ),
  "The cat owner lives directly left of Hana.",
);
assert.equal(
  clueText({ type: "either_house", attr: "prize", item: "trophy", houses: [0, 2] }, catalog, "pet-show"),
  "The person who holds a trophy lives in either the first house or the third house.",
);
const pouringCatalog = {
  person: [
    { id: "jules", label: "Jules" },
    { id: "eden", label: "Eden" },
  ],
  pet: [
    { id: "dog", label: "dog" },
    { id: "horse", label: "horse" },
  ],
  drink: [
    { id: "wine", label: "wine" },
    { id: "martini", label: "martini" },
  ],
};
assert.equal(
  clueText({ type: "same", left: { attr: "pet", item: "dog" }, right: { attr: "drink", item: "wine" } }, pouringCatalog, "dinner-party"),
  "The dog owner drinks wine.",
);
assert.equal(
  clueText(
    { type: "next_to", left: { attr: "drink", item: "martini" }, right: { attr: "pet", item: "dog" } },
    pouringCatalog,
    "dinner-party",
  ),
  "The martini drinker lives next to the dog owner.",
);
assert.equal(
  clueText(
    { type: "next_to", left: { attr: "drink", item: "martini" }, right: { attr: "person", item: "jules" } },
    pouringCatalog,
    "dinner-party",
  ),
  "The martini drinker lives next to Jules.",
);
assert.equal(
  clueText({ type: "at", attr: "drink", item: "wine", house: 0 }, pouringCatalog, "dinner-party"),
  "The wine drinker lives in the first house.",
);
assert.equal(
  clueText({ type: "same", left: { attr: "person", item: "eden" }, right: { attr: "drink", item: "wine" } }, pouringCatalog, "dinner-party"),
  "Eden drinks wine.",
);
assert.equal(
  clueText({ type: "same", left: { attr: "person", item: "eden" }, right: { attr: "drink", item: "martini" } }, pouringCatalog, "dinner-party"),
  "Eden drinks a martini.",
);
assert.equal(
  clueText(
    { type: "same", left: { attr: "person", item: "bo" }, right: { attr: "instrument", item: "piano" } },
    {
      person: [{ id: "bo", label: "Bo" }],
      instrument: [{ id: "piano", label: "piano" }],
    },
    "music-night",
  ),
  "Bo plays the piano.",
);
assert.equal(
  clueText(
    { type: "at", attr: "instrument", item: "piano", house: 0 },
    { instrument: [{ id: "piano", label: "piano" }] },
    "music-night",
  ),
  "The pianist lives in the first house.",
);
assert.equal(
  clueText(
    { type: "same", left: { attr: "person", item: "bo" }, right: { attr: "food", item: "pizza" } },
    {
      person: [{ id: "bo", label: "Bo" }],
      food: [
        { id: "pizza", label: "pizza" },
        { id: "cake", label: "cake" },
      ],
    },
    "brunch",
  ),
  "Bo eats pizza.",
);
assert.equal(
  clueText(
    { type: "same", left: { attr: "person", item: "bo" }, right: { attr: "food", item: "cake" } },
    {
      person: [{ id: "bo", label: "Bo" }],
      food: [{ id: "cake", label: "cake" }],
    },
    "brunch",
  ),
  "Bo loves cake.",
);
assert.equal(
  clueText(
    { type: "at", attr: "food", item: "pizza", house: 0 },
    { food: [{ id: "pizza", label: "pizza" }] },
    "brunch",
  ),
  "The pizza lover lives in the first house.",
);
assert.equal(
  clueText(
    { type: "same", left: { attr: "person", item: "bo" }, right: { attr: "plant", item: "roses" } },
    {
      person: [{ id: "bo", label: "Bo" }],
      plant: [{ id: "roses", label: "roses" }],
    },
    "garden",
  ),
  "Bo grows roses.",
);
assert.equal(
  clueText(
    { type: "same", left: { attr: "person", item: "bo" }, right: { attr: "pet", item: "dog" } },
    {
      person: [{ id: "bo", label: "Bo" }],
      pet: [{ id: "dog", label: "dogs", aliases: ["dog"] }],
    },
    "dinner-party",
  ),
  "Bo has a dog.",
);
assert.equal(
  clueText(
    { type: "same", left: { attr: "person", item: "bo" }, right: { attr: "book", item: "mystery" } },
    {
      person: [{ id: "bo", label: "Bo" }],
      book: [{ id: "mystery", label: "mysteries" }],
    },
    "book-club",
  ),
  "Bo reads mysteries.",
);
for (const sample of [
  clueText({ type: "same", left: { attr: "pet", item: "dog" }, right: { attr: "drink", item: "wine" } }, pouringCatalog, "dinner-party"),
  clueText(
    { type: "next_to", left: { attr: "drink", item: "martini" }, right: { attr: "person", item: "jules" } },
    pouringCatalog,
    "dinner-party",
  ),
  clueText({ type: "at", attr: "drink", item: "wine", house: 0 }, pouringCatalog, "dinner-party"),
]) {
  assert.match(sample, /^[A-Z]/);
  assert.doesNotMatch(sample, /\bthe Jules\b/i);
}
assert.equal(
  livesSubjectIsBareObject("The person who holds a balloon lives next to the fish owner.", catalog),
  false,
);
assert.equal(livesSubjectIsBareObject("balloon lives next to fish", catalog), true);
assert.equal(housePlaceName(0, 5), "the first house");
assert.equal(housePlaceName(1, 5), "the second house");
assert.equal(housePlaceName(2, 5), "the center house");
assert.equal(housePlaceName(3, 5), "the fourth house");
assert.equal(housePlaceName(4, 5), "the last house");
assert.equal(housePlaceName(1, 4), "the second house");
assert.equal(housePlaceName(2, 4), "the third house");
assert.doesNotMatch(housePlaceName(1, 4), /house \d+/);
assert.equal(
  clueText(
    { type: "left_of", immediate: true, left: { attr: "color", item: "green" }, right: { attr: "color", item: "white" } },
    { color: [{ id: "green", label: "green" }, { id: "white", label: "white" }] },
    "expert-street",
  ),
  "The green house is directly left of the white house.",
);
assert.equal(
  clueText(
    { type: "same", left: { attr: "person", item: "bo" }, right: { attr: "vehicle", item: "truck" } },
    {
      person: [{ id: "bo", label: "Bo" }],
      vehicle: [{ id: "truck", label: "truck" }],
    },
    "neighborhood",
  ),
  "Bo drives a truck.",
);
assert.equal(
  clueText(
    { type: "at", attr: "food", item: "tacos", house: 0 },
    { food: [{ id: "tacos", label: "tacos" }] },
    "brunch",
    3,
  ),
  "The taco lover lives in the first house.",
);
assert.equal(
  clueText(
    { type: "at", attr: "color", item: "blue", house: 0 },
    { color: [{ id: "blue", label: "blue" }] },
    "pet-show",
    3,
  ),
  "The blue house is the first house.",
);
assert.equal(
  clueText(
    { type: "either_house", attr: "drink", item: "tea", houses: [1, 4] },
    { drink: [{ id: "tea", label: "tea" }] },
    "dinner-party",
    5,
  ),
  "The tea drinker lives in either the second house or the last house.",
);
assert.equal(Object.keys(CLUE_STYLE_TEMPLATES).sort().join(","), "at,either_house,left_of,next_to,not_at,not_next_to,not_same,same");
assert.ok(CLUE_STYLE_BANS.some(([re]) => re.test("tacos lover")));
assert.ok(CLUE_STYLE_BANS.some(([re]) => re.test("novels")));
assert.ok(CLUE_STYLE_BANS.some(([re]) => re.test("keeps")));
assert.ok(CLUE_STYLE_BANS.some(([re]) => re.test("the person who keeps")));
assert.ok(CLUE_STYLE_BANS.some(([re]) => re.test("Drew keeps a dog")));
assert.equal(CLUE_STYLE_BANS.some(([re]) => re.test("Drew has a dog")), false);
assert.equal(
  validateClueStyle({
    theme: { id: "neighborhood" },
    houseCount: 3,
    attributes: [{ id: "person" }, { id: "vehicle" }, { id: "pet" }],
    items: {
      person: [{ id: "ada", label: "Ada" }],
      vehicle: [{ id: "car", label: "car" }],
      pet: [{ id: "dog", label: "dogs" }],
    },
    clues: [],
  }).ok,
  false,
);
assert.doesNotMatch(
  clueText(
    { type: "same", left: { attr: "food", item: "tacos" }, right: { attr: "drink", item: "wine" } },
    {
      food: [{ id: "tacos", label: "tacos" }],
      drink: [{ id: "wine", label: "wine" }],
    },
    "brunch",
  ),
  /tacos lover/,
);
assert.equal(validateEinsteinStyle(einsteinPuzzle()).ok, true, JSON.stringify(validateEinsteinStyle(einsteinPuzzle()).failures));
assert.equal(
  validateEinsteinStyle({
    ...einsteinPuzzle(),
    clues: [{ id: "c1", type: "same", text: "dog is with the wine" }],
  }).ok,
  false,
);
assert.equal(validateEinsteinStyle({ ...einsteinPuzzle(), setup: "Neighbors packed a bag." }).ok, false);
assert.equal(
  validateEinsteinStyle({
    setup: "There are three houses in a row. Each house has a different owner and a different instrument.",
    theme: { id: "music-night" },
    attributes: [
      { id: "person", label: "Who" },
      { id: "instrument", label: "Music" },
    ],
    items: {
      person: [{ id: "ada", label: "Ada" }],
      instrument: [{ id: "charts", label: "charts" }],
    },
    clues: [],
  }).ok,
  false,
);
assert.ok(ATTRIBUTES.food.verb);
assert.ok(ATTRIBUTES.plant.verb);
assert.ok(ATTRIBUTES.instrument.verb);

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
const hardFiveIds = new Set(["five-plots", "late-set", "desk-row", "quiet-shelf", "painted-pets", "city-plates"]);
const expertIds = new Set([
  "long-street",
  "five-trades",
  "five-cities",
  "hobby-houses",
  "five-plates",
  "five-doors",
  "house-band",
  "parked-books",
  "camp-cities",
]);
const fiveCategoryIds = new Set(["five-doors", "house-band"]);
const dailyCopyIds = new Map([["sail-lane", "2027-08-29"]]);
function personItemGiveaways(practice) {
  return practice.clues.filter((clue) => {
    if (clue.type !== "same") return false;
    return clue.left?.attr === "person" || clue.right?.attr === "person";
  });
}
function questionAnsweredBySameClue(practice) {
  const q = practice.question;
  if (!q?.givenItem || !q?.answerItem) return false;
  return practice.clues.some((clue) => {
    if (clue.type !== "same") return false;
    const left = clue.left;
    const right = clue.right;
    return (
      (left.attr === q.givenAttr && left.item === q.givenItem && right.attr === q.answerAttr && right.item === q.answerItem) ||
      (right.attr === q.givenAttr && right.item === q.givenItem && left.attr === q.answerAttr && left.item === q.answerItem)
    );
  });
}
for (const id of practiceIds) {
  const practice = JSON.parse(fs.readFileSync(path.join(root, `data/practice/${id}.json`), "utf8"));
  const catalog = PRACTICE_PUZZLES.find((entry) => entry.id === id);
  assert.equal(practice.practice, true);
  assert.equal(practice.practiceId, id);
  assert.equal(practice.difficulty.solvedByHuman, true);
  assert.ok(!practice.date, `${id} must not sit on the daily calendar`);
  assert.equal(practice.theme.title, catalog.title, `${id} needs a fun title`);
  const attrs = practice.attributes.map((attr) => attr.id);
  assert.ok(
    !attrs.some((attr) => GENERIC_HAS_ATTRS.has(attr)),
    `${id} must not use a generic-has category`,
  );
  const ids = Object.fromEntries(attrs.map((attr) => [attr, practice.items[attr].map((item) => item.id)]));
  const unique = countSolutions(practice.houseCount, attrs, ids, practice.clues, 2);
  assert.equal(unique.count, 1, `${id} must be unique`);
  const human = solvePuzzleByHuman(practice);
  assert.equal(human.solvedByHuman, true, `${id} must solve by human techniques`);
  const style = validateEinsteinStyle(practice);
  assert.equal(style.ok, true, `${id} Einstein-style: ${JSON.stringify(style.failures)}`);
  assert.match(puzzleSetup(practice), /^There are /);
  assert.doesNotMatch(puzzleSetup(practice), /\bkeeps\b/);
  assert.doesNotMatch(practice.question?.text || "", /\bkeeps\b/);
  for (const pet of practice.items.pet || []) {
    assert.doesNotMatch(pet.label, /^(cats|dogs|horses|birds|rabbits)$/, `${id} pet ${pet.id} must be singular`);
  }
  assert.ok(practice.clues.length >= 4);
  console.log(`\npractice clues (${id}):`);
  for (const clue of practice.clues) {
    console.log(`  ${clue.id}  ${displayClueText(practice, clue)}`);
  }
  for (const item of flattenItems(practice.items)) {
    assert.ok(ICONS[item.icon], `${id} missing Phosphor icon ${item.icon}`);
  }
  for (const clue of practice.clues) {
    const copy = displayClueText(practice, clue);
    assert.match(copy, /^[A-Z]/, `${id} clue must start with a capital: ${copy}`);
    assert.equal(
      livesSubjectIsBareObject(copy, practice.items),
      false,
      `${id} object-subject lives: ${copy}`,
    );
    for (const person of practice.items.person || []) {
      assert.doesNotMatch(copy, new RegExp(`\\bthe ${person.label}\\b`, "i"), `${id} must not say the ${person.label}`);
    }
  }
  if (id === "easy") {
    assert.ok(Array.isArray(labelsMissingFromCopy(practice)));
  } else if (expertIds.has(id)) {
    assert.equal(practice.source, "expert-generated", `${id} should be an Expert-generated puzzle`);
    assert.equal(practice.houseCount, 5, `${id} must be 5 houses`);
    assert.ok(practice.attributes.length >= 4, `${id} needs at least 4 categories`);
    if (fiveCategoryIds.has(id)) {
      assert.equal(practice.attributes.length, 5, `${id} should be a 5-category Einstein-style grid`);
      assert.ok(practice.clues.length <= 15, `${id} should stay at Einstein length or leaner`);
      assert.ok(practice.clues.filter((clue) => clue.type === "at").length <= 2, `${id} may have at most two house clues`);
    } else {
      assert.ok(practice.clues.length <= 13, `${id} should stay leaner than Einstein`);
      assert.ok(practice.clues.filter((clue) => clue.type === "at").length <= 1, `${id} may have at most one house-N clue`);
    }
    assert.ok(human.hardestTier >= 8, `${id} hardest step must be contradiction (got ${human.hardest} t${human.hardestTier})`);
    assert.ok(
      practice.clues.some((clue) => clue.type === "not_next_to") ||
        practice.clues.some((clue) => clue.type === "either_house") ||
        practice.clues.some((clue) => clue.type === "left_of" && !clue.immediate),
      `${id} should use a harder clue type`,
    );
    if (fiveCategoryIds.has(id) || id === "parked-books" || id === "camp-cities") {
      assert.ok(personItemGiveaways(practice).length <= 2, `${id} may have at most 2 name-verb-item clues`);
      assert.equal(questionAnsweredBySameClue(practice), false, `${id} question must need deduction`);
    }
  } else if (hardFiveIds.has(id)) {
    assert.equal(practice.source, "practice-generated", `${id} should be a generated Hard puzzle`);
    assert.equal(practice.houseCount, 5, `${id} must be 5 houses`);
    assert.equal(practice.attributes.length, 4, `${id} must have 4 categories`);
    assert.ok(human.hardestTier >= 6 && human.hardestTier <= 7, `${id} hardest step must be tier 6–7 (got ${human.hardest} t${human.hardestTier})`);
    assert.ok(personItemGiveaways(practice).length <= 2, `${id} may have at most 2 name-verb-item clues`);
    assert.equal(questionAnsweredBySameClue(practice), false, `${id} question must need deduction`);
    assert.ok(!practice.date, `${id} must not keep the daily date`);
  } else if (dailyCopyIds.has(id)) {
    assert.equal(practice.source, "practice-generated", `${id} should be copied from a daily`);
    assert.equal(practice.houseCount, 5, `${id} must be 5 houses`);
    assert.ok(human.hardestTier >= 6, `${id} hardest step must be tier 6+ (got ${human.hardest} t${human.hardestTier})`);
    assert.ok(personItemGiveaways(practice).length <= 2, `${id} may have at most 2 name-verb-item clues`);
    assert.equal(questionAnsweredBySameClue(practice), false, `${id} question must need deduction`);
    assert.equal(practice.difficulty.sourceDate, dailyCopyIds.get(id), `${id} should remember its daily source`);
    assert.ok(!practice.date, `${id} must not keep the daily date`);
  } else if (!keptPractice.has(id)) {
    assert.ok(practice.houseCount >= 3);
    assert.match(practice.source, /^(practice-generated|expert-generated|original-generated)/, `${id} should be a generated practice puzzle`);
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
let datedStyleFail = 0;
for (const name of jsonFiles) {
  const puzzle = JSON.parse(fs.readFileSync(path.join(plottedDir, name), "utf8"));
  const style = validateEinsteinStyle(puzzle);
  if (!style.ok) {
    datedStyleFail += 1;
    assert.equal(style.ok, true, `${name} Einstein-style: ${JSON.stringify(style.failures)}`);
  }
  for (const clue of puzzle.clues) {
    const copy = displayClueText(puzzle, clue);
    assert.match(copy, /^[A-Z]/, `${name} clue must start with a capital: ${copy}`);
    assert.equal(
      livesSubjectIsBareObject(copy, puzzle.items),
      false,
      `${name} object-subject lives: ${copy}`,
    );
    for (const person of puzzle.items.person || []) {
      assert.doesNotMatch(copy, new RegExp(`\\bthe ${person.label}\\b`, "i"), `${name} must not say the ${person.label}`);
    }
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
assert.equal(datedStyleFail, 0, `${datedStyleFail} dated puzzles failed Einstein-style copy`);
console.log(
  `dated audit: ${jsonFiles.length} unique, ${datedNeededSearch} neededSearch, ${datedHumanFail} humanFail, ${datedCopyGaps} missing options from clue text, ${jsonFiles.length - datedStyleFail} einstein-style, ${datedStyleFail} styleFail`,
);

console.log("plotted tests ok");
