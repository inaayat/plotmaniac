import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { LAUNCH_DATE, NOTES_STORAGE_KEY, PRACTICE_NOTES_KEY, PRACTICE_PROGRESS_KEY, SITE_URL, STREAK_STORAGE_KEY, PROGRESS_STORAGE_KEY } from "../plotted-config.js";
import { displayClueText, EINSTEIN_SETUP, puzzleSetup } from "../plotted-engine.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));

const indexHtml = read("index.html").replace(/<script[\s\S]*?<\/script>/gi, "");
const cssText = read("plotted.css");

const errors = [];
const origError = console.error;
const origWarn = console.warn;
console.error = (...args) => {
  errors.push(args.map(String).join(" "));
  origError.apply(console, args);
};
console.warn = (...args) => {
  errors.push(args.map(String).join(" "));
  origWarn.apply(console, args);
};

const window = new Window({
  url: "https://plotmaniac.com/",
  width: 1280,
  height: 720,
});
const { document } = window;
document.write(indexHtml);
const style = document.createElement("style");
style.textContent = cssText;
document.head.appendChild(style);

window.fetch = async (url) => {
  const href = String(url);
  const plotted = href.match(/data\/plotted\/(\d{4}-\d{2}-\d{2})\.json/);
  if (plotted) {
    const file = path.join(root, "data/plotted", `${plotted[1]}.json`);
    if (!fs.existsSync(file)) return { ok: false };
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(file, "utf8")) };
  }
  const practice = href.match(/data\/practice\/([^/?]+)\.json/);
  if (practice) {
    const file = path.join(root, "data/practice", `${practice[1]}.json`);
    if (!fs.existsSync(file)) return { ok: false };
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(file, "utf8")) };
  }
  return { ok: false };
};
globalThis.fetch = window.fetch;

globalThis.window = window;
globalThis.document = document;
globalThis.localStorage = window.localStorage;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
for (const key of [
  "HTMLElement",
  "Element",
  "Node",
  "Document",
  "HTMLInputElement",
  "HTMLButtonElement",
  "customElements",
]) {
  try {
    globalThis[key] = window[key];
  } catch {
    /* host getter */
  }
}

assert.ok(document.getElementById("board"), "index.html must include #board");
assert.ok(document.getElementById("howto"), "index.html must include How to play");
assert.ok(document.getElementById("setup"), "index.html must include #setup");

window.localStorage.setItem(
  `${PROGRESS_STORAGE_KEY}:2026-10-13`,
  JSON.stringify({
    grid: [
      { person: "ada", pet: "cat", drink: "tea" },
      { person: "bo", pet: "dog", drink: "coffee" },
      { person: "cam", pet: "bird", drink: "wine" },
    ],
    notes: ["", "", ""],
    ruledOut: [{}, {}, {}],
    crossed: [],
    startedAt: Date.now() - 33 * 60 * 1000,
    elapsedMs: 33 * 60 * 1000,
    mistakes: 0,
    hints: 0,
    completionOrder: [0, 0, 0],
    nextCompleteRank: 1,
    solved: false,
  }),
);

const vvState = { width: 1280, height: 720, offsetTop: 0 };
const vvListeners = { resize: new Set(), scroll: new Set() };
window.visualViewport = {
  get width() {
    return vvState.width;
  },
  get height() {
    return vvState.height;
  },
  get offsetTop() {
    return vvState.offsetTop;
  },
  offsetLeft: 0,
  scale: 1,
  addEventListener(type, fn) {
    vvListeners[type]?.add(fn);
  },
  removeEventListener(type, fn) {
    vvListeners[type]?.delete(fn);
  },
  dispatchEvent(event) {
    for (const fn of vvListeners[event.type] || []) fn(event);
    return true;
  },
};

let pointerKind = "fine";
let reducedMotion = false;
window.matchMedia = (query) => {
  const q = String(query);
  return {
    matches: q.includes("pointer: coarse")
      ? pointerKind === "coarse"
      : q.includes("pointer: fine")
        ? pointerKind === "fine"
        : q.includes("prefers-reduced-motion")
          ? reducedMotion
          : false,
    media: q,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  };
};

const {
  boot,
  fitPlayfield,
  loadPuzzle,
  missingVisibleOptions,
  startOver,
  stopGameTimers,
  typeOnScreenKey,
  useOnScreenKeyboard,
} = await import("../plotted.js");

function assertNoConsoleErrors(label) {
  assert.equal(errors.length, 0, `${label}: ${errors.join(" | ")}`);
}

function assertPuzzlePainted(puzzle, { expectSetup = true } = {}) {
  const houseCount = puzzle.houseCount;
  const attrCount = puzzle.attributes.length;
  const inputs = [...document.querySelectorAll("input.slot-input")];
  assert.equal(inputs.length, houseCount * attrCount, `${puzzle.date} slot count`);
  assert.ok(
    document.querySelector(".grid-table"),
    `${puzzle.date} must render a compact house table`,
  );
  assert.equal(
    document.querySelectorAll(".house-head").length,
    houseCount,
    `${puzzle.date} house headers`,
  );
  const clues = [...document.querySelectorAll(".clue")];
  assert.equal(clues.length, puzzle.clues.length, `${puzzle.date} clue count`);
  for (const [index, clue] of puzzle.clues.entries()) {
    assert.equal(clues[index].querySelector(".clue-text")?.textContent, displayClueText(puzzle, clue));
  }
  const setup = document.getElementById("setup");
  if (expectSetup) {
    assert.equal(setup?.textContent, puzzleSetup(puzzle));
    assert.equal(setup?.hidden, false);
    assert.ok(document.getElementById("howto")?.contains(setup));
  } else {
    assert.equal(setup?.textContent, "");
    assert.equal(setup?.hidden, true);
  }
  for (const strong of document.querySelectorAll(".clue-text strong")) {
    assert.equal(strong.className, "", "clue bold must have no class");
    assert.equal(strong.getAttribute("style"), null, "clue bold must have no inline style");
    assert.equal(strong.getAttribute("data-house"), null);
    assert.equal(strong.getAttribute("data-item"), null);
    assert.equal(strong.getAttribute("data-attr"), null);
    const color = window.getComputedStyle(strong).color;
    const parentColor = window.getComputedStyle(strong.parentElement).color;
    if (color && parentColor) {
      assert.equal(color, parentColor, `clue bold color must match ink, got ${color}`);
    }
  }
  assert.equal(document.querySelectorAll(".slot.is-match").length, 0);
  assert.equal(document.querySelectorAll(".house-head.is-complete").length, 0);
  const bank = document.querySelector(".word-bank");
  assert.ok(bank, `${puzzle.date || puzzle.id} word bank`);
  assert.equal(bank.getAttribute("aria-label"), "Words you can type");
  assert.equal(
    missingVisibleOptions(document, puzzle).length,
    0,
    `${puzzle.date || puzzle.id} every option must be visible in the word bank`,
  );
}

const einstein = readJson("data/plotted/2026-10-13.json");
assert.equal(einstein.setup, EINSTEIN_SETUP);

await boot({ puzzle: einstein });
assertNoConsoleErrors("einstein boot");
assertPuzzlePainted(einstein, { expectSetup: true });
assert.equal(document.querySelectorAll("input.slot-input").length, 25);
assert.equal(document.querySelectorAll(".clue").length, 15);
assert.match(document.getElementById("setup").textContent, /five houses/i);
assert.equal(document.getElementById("game-question").textContent, "Who owns the fish?");
const play = document.querySelector(".play");
assert.ok(play, "play layout");
assert.equal(play.firstElementChild?.className, "notes-panel", "notes sit on the left");
assert.ok(play.querySelector(".puzzle-col"), "puzzle column on the right");
assert.equal(play.querySelector(".puzzle-col")?.firstElementChild?.className, "hint-block", "clues must sit above the grid");
assert.ok(play.querySelector(".puzzle-col .hint-block + .word-bank"), "word bank follows clues");
assert.ok(play.querySelector(".puzzle-col .word-bank + .grid-wrap"), "grid follows word bank");
const bankRow = document.querySelector(".word-bank-row");
const bankCat = document.querySelector(".word-bank-cat");
const bankList = document.querySelector(".word-bank-list");
assert.ok(bankRow && bankCat && bankList, "word bank has label + words");
const bankRowStyle = window.getComputedStyle(bankRow);
const bankCatStyle = window.getComputedStyle(bankCat);
const bankListStyle = window.getComputedStyle(bankList);
assert.equal(bankRowStyle.display, "grid", "label column uses a two-column grid");
assert.match(
  bankRowStyle.gridTemplateColumns || "",
  /max-content|1fr|\d+(\.\d+)?px\s+\d+(\.\d+)?px/,
  `label column is auto-width, got ${bankRowStyle.gridTemplateColumns}`,
);
assert.match(
  bankRowStyle.columnGap || bankRowStyle.gap || "",
  /0\.75em|\d+(\.\d+)?px/,
  `word-bank gap should be ~0.75em, got ${bankRowStyle.columnGap || bankRowStyle.gap}`,
);
assert.equal(bankCatStyle.whiteSpace, "nowrap");
assert.notEqual(bankCatStyle.flexBasis, "4.6rem");
assert.equal(bankListStyle.flexWrap, "wrap");
assert.equal(bankListStyle.justifyContent, "flex-start");
assert.equal(document.querySelectorAll("datalist").length, 0, "no native datalist");
assert.equal(document.querySelectorAll(".slot-suggest").length, 0, "no suggestion dropdown");
assert.equal(document.querySelectorAll("textarea.notes").length, 1, "one scratchpad");
assert.doesNotMatch(cssText, /repeating-linear-gradient/);
assert.doesNotMatch(cssText, /--notes-rule/);
const notesStyle = window.getComputedStyle(document.querySelector("textarea.notes"));
assert.doesNotMatch(notesStyle?.backgroundImage || "", /gradient/i, "notes must be a flat surface");
assert.equal(document.querySelectorAll(".notes-grid").length, 0, "no per-house notes");
assert.equal(document.querySelector(".notes-panel")?.open, true, "notes open on desktop");

const pad = document.querySelector("textarea.notes");
assert.ok(pad, "scratchpad");
assert.equal(pad.placeholder, "Jot your deductions here...");
for (const head of document.querySelectorAll("tbody .attr-head")) {
  const style = window.getComputedStyle(head);
  if (style?.whiteSpace) {
    assert.equal(style.whiteSpace, "nowrap", `${head.textContent} must stay on one line`);
  }
  assert.ok(head.querySelector("svg"), "row header has icon");
  assert.ok(head.querySelector("span")?.textContent.trim(), "row header has label");
}
pad.value = "brit left of green";
pad.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal(window.localStorage.getItem(`${NOTES_STORAGE_KEY}:2026-10-13`), "brit left of green");
await loadPuzzle({ puzzle: einstein });
assert.equal(document.querySelector("textarea.notes")?.value, "brit left of green", "notes persist per date");

if (typeof window.happyDOM?.setViewport === "function") {
  window.happyDOM.setViewport({ width: 390, height: 844 });
  fitPlayfield();
  assert.equal(document.querySelector(".notes-panel")?.open, false, "notes collapsed on mobile");
  const notesBtn = document.getElementById("btn-notes");
  assert.ok(notesBtn, "mobile notes live on a header icon");
  assert.equal(notesBtn.hidden, false, "notes header button shows on a phone");
  assert.equal(notesBtn.getAttribute("aria-expanded"), "false");
  const notesBtnStyle = window.getComputedStyle(notesBtn);
  if (notesBtnStyle?.minHeight) {
    assert.ok(Number.parseFloat(notesBtnStyle.minHeight) >= 36, "notes header button is tappable");
  }
  assert.ok(document.querySelector(".notes-sheet"), "mobile notes live in a bottom sheet");
  assert.ok(document.querySelector(".notes-sheet-handle"), "sheet has a grab handle");
  assert.ok(document.querySelector(".notes-sheet-close"), "sheet has a close button");
  notesBtn.click();
  assert.equal(document.querySelector(".notes-panel")?.open, true, "header Notes opens the sheet");
  const sheetNote = document.querySelector("textarea.notes");
  const sheetNoteStyle = window.getComputedStyle(sheetNote);
  if (sheetNoteStyle?.fontSize) {
    assert.equal(sheetNoteStyle.fontSize, "16px", "sheet textarea stays 16px to avoid iOS zoom");
  }
  if (sheetNoteStyle?.paddingTop) {
    assert.ok(Number.parseFloat(sheetNoteStyle.paddingTop) <= 10, "sheet padding is tighter than the desktop pad");
  }
  reducedMotion = true;
  document.querySelector(".notes-sheet-close").click();
  assert.equal(document.querySelector(".notes-panel")?.open, false, "close returns the sheet");
  document.getElementById("btn-notes").click();
  assert.equal(document.querySelector(".notes-panel")?.open, true);
  window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(document.querySelector(".notes-panel")?.open, false, "Escape closes the sheet");
  reducedMotion = false;
  const nor = document.querySelector('input[data-attr="nationality"]');
  nor.value = "Norwegian";
  nor.dispatchEvent(new window.Event("input", { bubbles: true }));
  const norSlot = nor.closest(".slot");
  assert.match(norSlot?.querySelector(".slot-fit")?.textContent || "", /NORWEGIAN/);
  const inputSize = window.getComputedStyle(nor).fontSize;
  if (inputSize) assert.equal(inputSize, "16px", "focused-ready input stays 16px on mobile");
  nor.focus();
  assert.equal(norSlot?.classList.contains("is-editing"), true, "focused tile expands on mobile");
  nor.blur();
  window.happyDOM.setViewport({ width: 1280, height: 720 });
  fitPlayfield();
  assert.equal(document.querySelector(".notes-panel")?.open, true, "notes reopen on desktop");
}

const nat = document.querySelector('input[data-attr="nationality"]');
assert.ok(nat, "nationality input");
nat.focus();
nat.value = "Nor";
nat.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.match(nat.closest(".slot")?.querySelector(".slot-ghost")?.textContent || "", /wegian/i);
nat.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
assert.equal(nat.value, "Norwegian");
assertNoConsoleErrors("ghost completion");

const generatedDates = ["2026-10-14", "2026-10-18", "2026-10-25"];
for (const date of generatedDates) {
  const puzzle = readJson(`data/plotted/${date}.json`);
  await loadPuzzle({ puzzle });
  assertNoConsoleErrors(date);
  assertPuzzlePainted(puzzle);
}

window.localStorage.removeItem(`${PROGRESS_STORAGE_KEY}:2026-10-13`);
window.localStorage.removeItem(STREAK_STORAGE_KEY);
reducedMotion = true;
pointerKind = "fine";
await loadPuzzle({ puzzle: einstein });
assert.equal(document.getElementById("win")?.hidden, true);

const colorHouse1 = document.querySelector('input[data-slot="0-color"]');
assert.ok(colorHouse1, "house 1 color slot");
colorHouse1.value = "Norwegian";
colorHouse1.dispatchEvent(new window.Event("input", { bubbles: true }));
const unknownSlot = colorHouse1.closest(".slot");
assert.equal(unknownSlot?.classList.contains("is-unknown"), true, "Norwegian in COLOR is an invalid-row mark");
assert.equal(unknownSlot?.classList.contains("is-wrong"), false, "invalid-row must not use Check-wrong");
assert.equal(colorHouse1.getAttribute("aria-invalid"), "true");
assert.match(cssText, /\.slot\.is-unknown \{[^}]*border-style: dashed/);
assert.match(cssText, /--unknown: #e0b43a/);
assert.doesNotMatch(cssText, /--unknown: #c94c4c/);
colorHouse1.value = "";
colorHouse1.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal(unknownSlot?.classList.contains("is-unknown"), false);

function typeSolution(puzzle) {
  for (let house = 0; house < puzzle.houseCount; house += 1) {
    for (const attr of puzzle.attributes.map((entry) => entry.id)) {
      const input = document.querySelector(`input[data-slot="${house}-${attr}"]`);
      const item = puzzle.items[attr].find((entry) => entry.id === puzzle.solution[house][attr]);
      assert.ok(input && item, `${puzzle.date} ${house} ${attr}`);
      input.value = item.label;
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    }
  }
}

typeSolution(einstein);
await new Promise((resolve) => setTimeout(resolve, 30));
assert.equal(document.getElementById("win")?.hidden, false, "auto-solve must open the results modal");
assert.equal(document.getElementById("win-streak")?.textContent, "1");
assert.match(document.getElementById("meta-timer")?.textContent || "", /\d:\d\d/);
assert.equal(document.querySelectorAll(".slot.is-correct").length, 25);
const saved = JSON.parse(window.localStorage.getItem(`${PROGRESS_STORAGE_KEY}:2026-10-13`) || "{}");
assert.equal(saved.solved, true);
assert.equal(saved.streakAwarded, true);
const shareText = document.getElementById("share-text")?.textContent || "";
assert.equal(shareText.split("\n").at(-1), SITE_URL, "share text ends with the site link");
assert.match(shareText, /^Plotted #1\n/);
const sharePayloads = [];
navigator.share = async (payload) => {
  sharePayloads.push(payload);
};
document.getElementById("win-share")?.click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(sharePayloads.length, 1, "Web Share is used when navigator.share exists");
assert.equal(sharePayloads[0].url, SITE_URL);
assert.equal(sharePayloads[0].text.split("\n").at(-1), SITE_URL);
delete navigator.share;
const clipboardWrites = [];
navigator.clipboard = {
  writeText: async (text) => {
    clipboardWrites.push(text);
  },
};
document.getElementById("btn-share")?.click();
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(clipboardWrites[0]?.split("\n").at(-1), SITE_URL, "clipboard share ends with the site link");

const startBtn = document.getElementById("btn-start-over");
assert.ok(startBtn, "start over control");
assert.ok(startBtn.closest(".mast-tools")?.querySelector("#btn-check"), "start over sits with Check");
assert.equal(startBtn.closest(".mast-tools")?.querySelector("#btn-hint"), null, "hint bulb leaves the header");
const hintBtn = document.getElementById("btn-hint");
assert.ok(hintBtn, "hint control");
assert.equal(hintBtn.getAttribute("aria-label"), "Reveal a cell");
assert.ok(hintBtn.closest(".hint-heading")?.querySelector(".hint-label"), "hint bulb sits beside HINTS");
assert.equal(hintBtn.closest(".hint-heading")?.querySelector(".hint-label")?.tagName, "SPAN", "HINTS label is inline");
assert.match(hintBtn.innerHTML, /lightbulb|Reveal a cell/);
const hintStyle = window.getComputedStyle(hintBtn);
if (hintStyle?.minHeight) {
  assert.ok(Number.parseFloat(hintStyle.minHeight) <= 28, "hint bulb stays compact beside HINTS");
}
assert.ok(startBtn.querySelector("svg"), "start over uses a Phosphor icon");
assert.match(startBtn.innerHTML, /arrow-counter-clockwise|Start over/);
const startStyle = window.getComputedStyle(startBtn);
if (startStyle?.minHeight) {
  assert.ok(Number.parseFloat(startStyle.minHeight) >= 36, "start over is tappable on mobile");
}

document.querySelector("textarea.notes").value = "keep these notes";
document.querySelector("textarea.notes").dispatchEvent(new window.Event("input", { bubbles: true }));
startBtn.click();
assert.equal(document.getElementById("start-over")?.hidden, false, "start over asks for confirmation");
assert.equal(document.getElementById("win")?.hidden, true, "confirm replaces the results card");
document.getElementById("start-over-cancel").click();
assert.equal(document.getElementById("start-over")?.hidden, true, "cancel closes the confirm");
assert.equal(
  document.querySelector('input[data-slot="0-color"]')?.value,
  "yellow",
  "cancel must keep the solved grid",
);

document.getElementById("btn-start-over").click();
document.getElementById("start-over-grid").click();
assert.equal(document.getElementById("start-over")?.hidden, true);
assert.equal(document.getElementById("win")?.hidden, true);
assert.equal(document.getElementById("btn-share")?.hidden, true);
assert.equal(document.getElementById("meta-timer")?.textContent, "0:00");
assert.equal(document.querySelector("textarea.notes")?.value, "keep these notes", "reset grid keeps notes");
assert.equal(document.querySelector('input[data-slot="0-color"]')?.value, "", "reset grid clears entries");
assert.equal(document.querySelectorAll("input.slot-input").length, 25);
const resetSaved = JSON.parse(window.localStorage.getItem(`${PROGRESS_STORAGE_KEY}:2026-10-13`) || "{}");
assert.equal(resetSaved.solved, false);
assert.equal(resetSaved.hints, 0);
assert.equal(resetSaved.elapsedMs, 0);
assert.equal(resetSaved.streakAwarded, true);
assert.equal(JSON.parse(window.localStorage.getItem(STREAK_STORAGE_KEY) || "{}").count, 1);

document.getElementById("btn-hint").click();
assert.ok(document.querySelector("input.slot-input")?.value, "hint fills a cell after restart");
const hinted = JSON.parse(window.localStorage.getItem(`${PROGRESS_STORAGE_KEY}:2026-10-13`) || "{}");
assert.equal(hinted.hints, 1);

startOver({ clearNotes: true });
assert.equal(document.querySelector("textarea.notes")?.value, "", "reset grid and notes clears the pad");
assert.equal(window.localStorage.getItem(`${NOTES_STORAGE_KEY}:2026-10-13`), "");
assert.equal(document.getElementById("meta-timer")?.textContent, "0:00");
const cleared = JSON.parse(window.localStorage.getItem(`${PROGRESS_STORAGE_KEY}:2026-10-13`) || "{}");
assert.equal(cleared.hints, 0);
assert.equal(cleared.streakAwarded, true);

if (typeof window.happyDOM?.setViewport === "function") {
  window.happyDOM.setViewport({ width: 390, height: 844 });
  fitPlayfield();
  const mobileStart = document.getElementById("btn-start-over");
  assert.ok(mobileStart, "start over stays in the header on mobile");
  const mobileStyle = window.getComputedStyle(mobileStart);
  if (mobileStyle?.minHeight) {
    assert.ok(Number.parseFloat(mobileStyle.minHeight) >= 36, "start over stays tappable on a phone");
  }
  window.happyDOM.setViewport({ width: 1280, height: 720 });
  fitPlayfield();
}

typeSolution(einstein);
await new Promise((resolve) => setTimeout(resolve, 30));
assert.equal(document.getElementById("win")?.hidden, false, "restarted puzzle can be solved again");
assert.equal(document.getElementById("win-streak")?.textContent, "1", "solving again must not change the streak");
assert.equal(JSON.parse(window.localStorage.getItem(STREAK_STORAGE_KEY) || "{}").count, 1);

const easy = readJson("data/practice/easy.json");
await loadPuzzle({ puzzle: easy });
assert.equal(document.getElementById("win")?.hidden, true);
assert.match(document.getElementById("meta-date")?.textContent || "", /Practice · Easy/);
assert.equal(missingVisibleOptions(document, easy).length, 0, "easy practice must show every option in the word bank");
const samplePet = easy.items.pet[0];
const sampleDrink = easy.items.drink[0];
assert.equal(
  document.querySelector(`.word-bank-word[data-item="${samplePet.id}"]`)?.textContent,
  samplePet.label,
);
assert.equal(document.querySelector(`.word-bank-word[data-item="${sampleDrink.id}"]`)?.textContent, sampleDrink.label);
const petSlot = document.querySelector('input[data-attr="pet"]');
petSlot.value = samplePet.label;
petSlot.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal(
  document.querySelector(`.word-bank-word[data-item="${samplePet.id}"]`)?.classList.contains("is-placed"),
  true,
  "placed words are marked in the bank",
);
petSlot.value = "";
petSlot.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal(
  document.querySelector(`.word-bank-word[data-item="${samplePet.id}"]`)?.classList.contains("is-placed"),
  false,
);
const petAlias = (samplePet.aliases || []).find((alias) => alias !== samplePet.label);
assert.ok(petAlias, "practice pets keep plural aliases for saved progress");
petSlot.value = petAlias;
petSlot.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal(petSlot.value, samplePet.label, "plural pet alias snaps to the singular word-bank form");
assert.equal(
  document.querySelector(`.word-bank-word[data-item="${samplePet.id}"]`)?.classList.contains("is-placed"),
  true,
  "plural alias still places the pet",
);
petSlot.value = "";
petSlot.dispatchEvent(new window.Event("input", { bubbles: true }));
const practiceSelect = document.getElementById("practice-select");
assert.ok(practiceSelect, "practice picker is a compact select");
assert.equal(practiceSelect.value, "easy");
assert.equal(practiceSelect.querySelectorAll("option").length, 23, "Today plus 22 practice puzzles");
assert.equal(practiceSelect.querySelectorAll("optgroup").length, 6, "practice puzzles are grouped by difficulty");
assert.equal(practiceSelect.querySelectorAll("optgroup")[0].label, "Easy");
assert.equal(practiceSelect.querySelectorAll("optgroup")[5].label, "Expert");
assert.equal(document.querySelectorAll("input.slot-input").length, easy.houseCount * easy.attributes.length);
assert.equal(easy.clues.length, 5, "practice Easy is the 5-clue fixture");
assert.equal(einstein.clues.length, 15, "Einstein is the 15-clue fixture");

if (typeof window.happyDOM?.setViewport === "function") {
  const readClueSize = () => document.documentElement.style.getPropertyValue("--clue-size").trim();
  const readCluePad = () => document.documentElement.style.getPropertyValue("--clue-pad").trim();
  for (const viewport of [
    { width: 390, height: 844, size: 13 },
    { width: 1280, height: 720, size: 15 },
  ]) {
    window.happyDOM.setViewport({ width: viewport.width, height: viewport.height });
    await loadPuzzle({ puzzle: easy });
    fitPlayfield();
    const easySize = readClueSize();
    const easyPad = readCluePad();
    await loadPuzzle({ puzzle: einstein });
    fitPlayfield();
    assert.equal(
      readClueSize(),
      easySize,
      `clue font-size must match for 5-clue Easy and 15-clue Einstein at ${viewport.width}px (${easySize} vs ${readClueSize()})`,
    );
    assert.equal(
      readCluePad(),
      easyPad,
      `clue padding must match for Easy and Einstein at ${viewport.width}px`,
    );
    assert.ok(
      Math.abs(parseFloat(easySize) - viewport.size) < 0.05,
      `standard clue size is ${viewport.size}px at ${viewport.width}px (got ${easySize})`,
    );
  }
  window.happyDOM.setViewport({ width: 1280, height: 720 });
  await loadPuzzle({ puzzle: easy });
  fitPlayfield();
}

document.querySelector("textarea.notes").value = "practice scratch";
document.querySelector("textarea.notes").dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal(window.localStorage.getItem(`${PRACTICE_NOTES_KEY}:easy`), "practice scratch");
assert.equal(window.localStorage.getItem(`${PROGRESS_STORAGE_KEY}:2026-10-13`) != null, true, "daily progress stays put");

typeSolution(easy);
await new Promise((resolve) => setTimeout(resolve, 30));
assert.equal(document.getElementById("win")?.hidden, false, "practice puzzle can be solved");
assert.equal(document.getElementById("win-streak")?.textContent, "1", "practice must not change the daily streak");
assert.equal(JSON.parse(window.localStorage.getItem(STREAK_STORAGE_KEY) || "{}").count, 1);
assert.match(document.getElementById("share-text")?.textContent || "", /Plotted practice · Easy/);
assert.doesNotMatch(document.getElementById("share-text")?.textContent || "", /Plotted #\d/);
assert.equal(
  (document.getElementById("share-text")?.textContent || "").split("\n").at(-1),
  SITE_URL,
  "practice share still ends with the site link",
);
await loadPuzzle();
assert.equal(document.getElementById("game-question")?.textContent, "Who owns the fish?", "Today stays pinned to Einstein");
assert.equal(document.querySelectorAll(".clue").length, 15);
assert.equal(document.getElementById("meta-date")?.textContent, LAUNCH_DATE);
assert.equal(document.getElementById("practice-select")?.value, "", "Today option is selected");
assert.equal(
  JSON.parse(window.localStorage.getItem(`${PROGRESS_STORAGE_KEY}:${LAUNCH_DATE}`) || "{}").solved,
  true,
  "pinned Einstein progress must not reset when returning to Today",
);
const practiceSaved = JSON.parse(window.localStorage.getItem(`${PRACTICE_PROGRESS_KEY}:easy`) || "{}");
assert.equal(practiceSaved.solved, true);
assert.equal(JSON.parse(window.localStorage.getItem(`${PROGRESS_STORAGE_KEY}:2026-10-13`) || "{}").solved, true);

const fiveCopies = readJson("data/practice/five-copies.json");
await loadPuzzle({ puzzle: fiveCopies });
assert.equal(document.getElementById("win")?.hidden, true, "practice switch hides the win card");
assert.equal(fiveCopies.houseCount, 5);
assert.equal(missingVisibleOptions(document, fiveCopies).length, 0, "5-house practice still lists every option");
assert.equal(document.getElementById("practice-select")?.value, "five-copies");
assert.match(document.getElementById("meta-date")?.textContent || "", /Practice · Hard/);
assert.equal(JSON.parse(window.localStorage.getItem(STREAK_STORAGE_KEY) || "{}").count, 1);

const longStreet = readJson("data/practice/long-street.json");
await loadPuzzle({ puzzle: longStreet });
assert.equal(document.getElementById("win")?.hidden, true, "expert switch hides the win card");
assert.equal(longStreet.houseCount, 5);
assert.ok(longStreet.attributes.length >= 4);
assert.equal(missingVisibleOptions(document, longStreet).length, 0, "expert practice still lists every option");
assert.equal(document.getElementById("practice-select")?.value, "long-street");
assert.match(document.getElementById("meta-date")?.textContent || "", /Practice · Expert/);
assert.equal(JSON.parse(window.localStorage.getItem(STREAK_STORAGE_KEY) || "{}").count, 1);

if (typeof window.happyDOM?.setViewport === "function") {
  window.happyDOM.setViewport({ width: 390, height: 844 });
  fitPlayfield();
  const nav = document.querySelector(".practice-nav");
  const navStyle = window.getComputedStyle(nav);
  if (navStyle?.overflowX) {
    assert.equal(navStyle.overflowX, "hidden", "practice picker must not overflow on a phone");
  }
  const pickerSelect = document.getElementById("practice-select");
  const selectStyle = window.getComputedStyle(pickerSelect);
  if (selectStyle?.fontSize) {
    assert.equal(selectStyle.fontSize, "16px", "picker stays 16px so iOS does not zoom");
  }
  if (selectStyle?.minHeight) {
    assert.equal(Number.parseFloat(selectStyle.minHeight), 32, "picker is a compact 32px control");
  }
  if (selectStyle?.borderRadius) {
    assert.ok(Number.parseFloat(selectStyle.borderRadius) >= 10, "picker corners are rounded");
  }
  assert.ok(document.querySelector(".practice-select-caret svg"), "native select uses a Phosphor caret");
  const play = document.querySelector(".play");
  assert.ok(!play?.style.paddingBlock || play.style.paddingBlock === "0px", "no leftover padding above hints");
  const boardStyle = window.getComputedStyle(document.querySelector(".board"));
  if (boardStyle?.justifyContent) {
    assert.equal(boardStyle.justifyContent, "flex-start", "mobile leftover space sits below the grid");
  }
  const cellH = document.documentElement.style.getPropertyValue("--cell-h");
  const cellHpx = Number.parseFloat(cellH);
  assert.ok(cellHpx >= 40 && cellHpx <= 44, `mobile tile height is wordle-ish 40–44px, got ${cellH}`);
  const firstSlot = document.querySelector("input.slot-input");
  const overlay = document.querySelector(".slot-fit");
  if (overlay) {
    const overlaySize = Number.parseFloat(window.getComputedStyle(overlay).fontSize);
    if (overlaySize) assert.ok(overlaySize <= 13, `visible tile label stays compact, got ${overlaySize}px`);
  }
  firstSlot.focus();
  assert.equal(document.querySelector(".board")?.classList.contains("is-typing-compact"), false, "fine pointer does not use typing-compact");
  assert.equal(useOnScreenKeyboard(), false, "fine pointer keeps the physical keyboard");
  assert.equal(document.querySelector(".osk")?.hidden, true, "on-screen keyboard is hidden on fine pointers");
  const focusedSize = window.getComputedStyle(firstSlot).fontSize;
  if (focusedSize) assert.ok(Number.parseFloat(focusedSize) >= 16, `focused input stays ≥16px to avoid iOS zoom, got ${focusedSize}`);
  firstSlot.blur();
  window.happyDOM.setViewport({ width: 1280, height: 720 });
  fitPlayfield();
  const desk = document.querySelector("input.slot-input");
  desk.focus();
  assert.equal(document.documentElement.classList.contains("is-osk"), false, "desktop does not pin an on-screen keyboard");
  desk.blur();
  window.happyDOM.setViewport({ width: 390, height: 844 });
}

function pressOsk(key) {
  const btn = document.querySelector(`.osk-key[data-key="${key}"]`);
  assert.ok(btn, `on-screen key ${key}`);
  btn.dispatchEvent(new window.Event("pointerdown", { bubbles: true, cancelable: true }));
}

function tapSlot(slot) {
  assert.ok(slot, "slot to tap");
  slot.dispatchEvent(new window.Event("pointerdown", { bubbles: true, cancelable: true }));
  slot.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
}

if (typeof window.happyDOM?.setViewport === "function") {
  pointerKind = "coarse";
  window.localStorage.removeItem(`${PROGRESS_STORAGE_KEY}:${LAUNCH_DATE}`);
  window.localStorage.removeItem(`${PROGRESS_STORAGE_KEY}:2026-10-13`);
  window.happyDOM.setViewport({ width: 390, height: 844 });
  window.innerWidth = 390;
  window.innerHeight = 844;
  await loadPuzzle({ puzzle: einstein });
  startOver({ clearNotes: false });
  fitPlayfield();
  assert.equal(document.getElementById("win")?.hidden, true, "OSK tests run on an unsolved grid");
  assert.ok(document.querySelector(".slot.is-empty"), "fresh Einstein grid has empty tiles");
  assert.equal(useOnScreenKeyboard(), true, "coarse phone uses the on-screen keyboard");
  assert.equal(document.documentElement.classList.contains("is-osk"), true, "html.is-osk on a coarse phone");
  const osk = document.querySelector(".osk");
  assert.ok(osk, "Wordle-style keyboard is in the DOM");
  assert.equal(osk.hidden, false, "on-screen keyboard is visible on coarse pointers");
  assert.equal(document.querySelectorAll(".osk-key").length, 28, "QWERTY has 26 letters plus ENTER and backspace");
  assert.equal(document.querySelector(".osk-key[data-key='ENTER']")?.textContent, "ENTER");
  assert.ok(document.querySelector(".osk-key[data-key='BACKSPACE'] svg"), "backspace uses a Phosphor icon");
  assert.equal(document.querySelector(".osk-row:first-child .osk-key[data-key='q']")?.textContent, "Q");
  const nat = document.querySelector('input[data-slot="0-nationality"]');
  const natSlot = nat.closest(".slot");
  assert.equal(nat.getAttribute("inputmode"), "none", "coarse tiles do not request a native keyboard");
  assert.equal(nat.readOnly, true, "coarse tiles are readonly so iOS will not focus a real input");
  tapSlot(natSlot);
  assert.notEqual(document.activeElement, nat, "tapping a coarse tile must not focus the native input");
  assert.equal(natSlot.classList.contains("is-selected"), true, "tapped tile is highlighted");
  assert.equal(natSlot.classList.contains("is-editing"), false, "coarse tiles do not expand a native editor");
  const selectedStyle = window.getComputedStyle(natSlot);
  const selectedTransform = selectedStyle?.transform || "";
  assert.ok(
    selectedTransform.includes("scale(1.06)") || /matrix\(1\.06/.test(selectedTransform),
    `selected tile scales up, got transform ${selectedTransform || "(empty)"}`,
  );
  if (selectedStyle?.zIndex && selectedStyle.zIndex !== "auto") {
    assert.ok(Number.parseFloat(selectedStyle.zIndex) >= 5, `selected tile sits above neighbors, z-index ${selectedStyle.zIndex}`);
  }

  pressOsk("n");
  assert.equal(nat.value, "n", "letter key fills the selected tile");
  pressOsk("BACKSPACE");
  assert.equal(nat.value, "", "backspace deletes");
  pressOsk("n");
  pressOsk("o");
  pressOsk("r");
  assert.equal(nat.value, "nor");
  assert.match(natSlot.querySelector(".slot-ghost")?.textContent || "", /wegian/i, "unique prefix shows a ghost completion");
  pressOsk("ENTER");
  assert.equal(nat.value, "Norwegian", "ENTER accepts the ghost");
  const beverage = document.querySelector('input[data-slot="0-beverage"]');
  assert.equal(beverage?.closest(".slot")?.classList.contains("is-selected"), true, "ENTER moves to the next empty tile");

  const color = document.querySelector('input[data-slot="0-color"]');
  tapSlot(color.closest(".slot"));
  pressOsk("y");
  pressOsk("e");
  pressOsk("l");
  assert.match(color.closest(".slot")?.querySelector(".slot-ghost")?.textContent || "", /low/i);
  tapSlot(color.closest(".slot"));
  assert.equal(color.value, "yellow", "a second tap accepts the ghost");

  typeOnScreenKey("BACKSPACE");
  typeOnScreenKey("BACKSPACE");
  assert.ok(color.value.length < "Yellow".length, "backspace still works after autocomplete");

  const col = document.querySelector(".puzzle-col");
  const mast = document.querySelector(".mast");
  const footer = document.querySelector(".site-footer");
  const colH = Math.ceil(col.scrollHeight || col.getBoundingClientRect().height);
  const kbdH = Math.max(
    Math.round(osk.getBoundingClientRect().height || 0),
    Number.parseFloat(document.documentElement.style.getPropertyValue("--kbd-h")) || 0,
    168,
  );
  const mastH = Math.round(mast?.getBoundingClientRect().height || 0);
  const footerH = Math.round(footer?.getBoundingClientRect().height || 0);
  const used = mastH + colH + kbdH + footerH;
  assert.ok(used <= 844, `clues, word bank, grid, and keyboard must fit in 390x844, used ${used}px (mast ${mastH} col ${colH} kbd ${kbdH} footer ${footerH})`);
  assert.ok(document.querySelector(".hint-block") && document.querySelector(".word-bank") && document.querySelector(".grid-wrap"), "playfield still has clues, word bank, and grid");
  const cellH = Number.parseFloat(document.documentElement.style.getPropertyValue("--cell-h"));
  assert.ok(cellH >= 32 && cellH <= 42, `phone tiles stay between the standard 32–42px sizes, got ${cellH}`);
  const clueSize = Number.parseFloat(document.documentElement.style.getPropertyValue("--clue-size"));
  assert.ok(clueSize >= 11 && clueSize <= 13, `phone clues stay between the standard 11–13px sizes, got ${clueSize}`);
  assert.equal(document.querySelector(".board")?.classList.contains("is-typing-compact"), false);

  pointerKind = "fine";
  window.happyDOM.setViewport({ width: 1280, height: 720 });
  window.innerWidth = 1280;
  window.innerHeight = 720;
  await loadPuzzle({ puzzle: einstein });
  assert.equal(useOnScreenKeyboard(), false, "desktop hides the on-screen keyboard");
  assert.equal(document.querySelector(".osk")?.hidden, true);
  const deskInput = document.querySelector("input.slot-input");
  assert.equal(deskInput.getAttribute("inputmode"), "text");
  assert.equal(deskInput.readOnly, false);
  deskInput.focus();
  const deskSlot = deskInput.closest(".slot");
  assert.equal(deskSlot?.classList.contains("is-selected"), true, "desktop focus marks the tile selected");
  const deskTransform = window.getComputedStyle(deskSlot)?.transform || "";
  assert.ok(
    deskTransform.includes("scale(1.06)") || /matrix\(1\.06/.test(deskTransform),
    `desktop focused tile scales up, got transform ${deskTransform || "(empty)"}`,
  );
  deskInput.blur();
}

stopGameTimers();
console.error = origError;
console.warn = origWarn;
window.close();
console.log("plotted DOM tests ok");
