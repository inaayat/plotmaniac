import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { NOTES_STORAGE_KEY, PRACTICE_NOTES_KEY, PRACTICE_PROGRESS_KEY, STREAK_STORAGE_KEY, PROGRESS_STORAGE_KEY } from "../plotted-config.js";
import { EINSTEIN_SETUP } from "../plotted-engine.js";

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

const { boot, fitPlayfield, loadPuzzle, missingVisibleOptions, startOver, stopGameTimers } = await import("../plotted.js");

function assertNoConsoleErrors(label) {
  assert.equal(errors.length, 0, `${label}: ${errors.join(" | ")}`);
}

function assertPuzzlePainted(puzzle, { expectSetup = false } = {}) {
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
    assert.equal(clues[index].querySelector(".clue-text")?.textContent, clue.text);
  }
  const setup = document.getElementById("setup");
  if (expectSetup) {
    assert.equal(setup?.textContent, puzzle.setup);
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
  const toggle = document.querySelector(".notes-toggle");
  assert.ok(toggle, "mobile notes toggle");
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  const toggleStyle = window.getComputedStyle(toggle);
  if (toggleStyle?.minHeight) {
    assert.ok(Number.parseFloat(toggleStyle.minHeight) >= 36, "notes toggle is tappable");
  }
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
  assertPuzzlePainted(puzzle, { expectSetup: Boolean(puzzle.setup) });
}

window.localStorage.removeItem(`${PROGRESS_STORAGE_KEY}:2026-10-13`);
window.localStorage.removeItem(STREAK_STORAGE_KEY);
window.matchMedia = (query) => ({
  matches: String(query).includes("prefers-reduced-motion"),
  media: String(query),
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
});
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

const startBtn = document.getElementById("btn-start-over");
assert.ok(startBtn, "start over control");
assert.ok(startBtn.closest(".mast-tools")?.querySelector("#btn-check"), "start over sits with Check/hint");
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
assert.equal(missingVisibleOptions(document, easy).length, 0, "easy practice must show butterfly, beer, and every other option");
assert.equal(
  document.querySelector('.word-bank-word[data-item="butterfly"]')?.textContent,
  "butterfly",
);
assert.equal(document.querySelector('.word-bank-word[data-item="beer"]')?.textContent, "beer");
const petSlot = document.querySelector('input[data-attr="pet"]');
petSlot.value = "butterfly";
petSlot.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal(
  document.querySelector('.word-bank-word[data-item="butterfly"]')?.classList.contains("is-placed"),
  true,
  "placed words are marked in the bank",
);
petSlot.value = "";
petSlot.dispatchEvent(new window.Event("input", { bubbles: true }));
assert.equal(
  document.querySelector('.word-bank-word[data-item="butterfly"]')?.classList.contains("is-placed"),
  false,
);
assert.equal(document.querySelector('.practice-nav a[data-practice="easy"]')?.getAttribute("aria-current"), "page");
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
const practiceSaved = JSON.parse(window.localStorage.getItem(`${PRACTICE_PROGRESS_KEY}:easy`) || "{}");
assert.equal(practiceSaved.solved, true);
assert.equal(JSON.parse(window.localStorage.getItem(`${PROGRESS_STORAGE_KEY}:2026-10-13`) || "{}").solved, true);

stopGameTimers();
console.error = origError;
console.warn = origWarn;
window.close();
console.log("plotted DOM tests ok");
