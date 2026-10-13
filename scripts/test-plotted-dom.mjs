import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { NOTES_STORAGE_KEY, PROGRESS_STORAGE_KEY } from "../plotted-config.js";
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

const { boot, fitPlayfield, loadPuzzle, stopGameTimers } = await import("../plotted.js");

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
assert.ok(play.querySelector(".puzzle-col .hint-block + .grid-wrap"), "grid follows clues");
assert.equal(document.querySelectorAll("datalist").length, 0, "no native datalist");
assert.equal(document.querySelectorAll(".slot-suggest").length, 0, "no suggestion dropdown");
assert.equal(document.querySelectorAll("textarea.notes").length, 1, "one scratchpad");
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

stopGameTimers();
console.error = origError;
console.warn = origWarn;
window.close();
console.log("plotted DOM tests ok");
