import {
  ARCHIVE_HREF,
  GAME_NAME,
  GAME_TAGLINE,
  PROGRESS_STORAGE_KEY,
  STREAK_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "./plotted-config.js";
import { iconSvg } from "./plotted-icons.js";
import { ATTRIBUTES } from "./plotted-themes.js";
import {
  clueSatisfiedByGrid,
  firstHintCell,
  formatShare,
  formatTime,
  gridMatchesSolution,
  houseIsCompleteAndCorrect,
  localIsoDate,
  placementComplete,
  puzzleNumber,
  scoreFor,
} from "./plotted-engine.js";

const LONG_PRESS_MS = 500;
const $ = (id) => document.getElementById(id);

let puzzle = null;
let grid = [];
let notes = [];
let ruledOut = [];
let selected = null;
let crossed = new Set();
let startedAt = 0;
let elapsedMs = 0;
let timerId = 0;
let mistakes = 0;
let hints = 0;
let completionOrder = [];
let nextCompleteRank = 1;
let solved = false;
let toastTimer = 0;

function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 1800);
}

function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "light" ? "#f4efe6" : "#0c0b09");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
  paintThemeToggle();
}

function paintThemeToggle() {
  const btn = $("theme-toggle");
  const light = currentTheme() === "light";
  btn.innerHTML = iconSvg(light ? "moon" : "sun", { label: light ? "Switch to dark" : "Switch to light" });
}

function attributes() {
  return puzzle.attributes.map((attr) => attr.id);
}

function attrMeta(attr) {
  return ATTRIBUTES[attr] || puzzle.attributes.find((entry) => entry.id === attr) || { id: attr, label: attr, icon: "house" };
}

function itemById(attr, id) {
  return puzzle.items[attr].find((item) => item.id === id);
}

function emptyGrid() {
  return Array.from({ length: puzzle.houseCount }, () => {
    const row = {};
    for (const attr of attributes()) row[attr] = "";
    return row;
  });
}

function emptyRuled() {
  return Array.from({ length: puzzle.houseCount }, () => {
    const row = {};
    for (const attr of attributes()) row[attr] = [];
    return row;
  });
}

function storageKey() {
  return `${PROGRESS_STORAGE_KEY}:${puzzle.date}`;
}

function persist() {
  try {
    localStorage.setItem(
      storageKey(),
      JSON.stringify({
        grid,
        notes,
        ruledOut,
        crossed: [...crossed],
        startedAt,
        elapsedMs,
        mistakes,
        hints,
        completionOrder,
        nextCompleteRank,
        solved,
      }),
    );
  } catch {
    /* private mode */
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return;
    const data = JSON.parse(raw);
    grid = data.grid || emptyGrid();
    notes = data.notes || Array.from({ length: puzzle.houseCount }, () => "");
    ruledOut = data.ruledOut || emptyRuled();
    crossed = new Set(data.crossed || []);
    startedAt = data.startedAt || 0;
    elapsedMs = data.elapsedMs || 0;
    mistakes = data.mistakes || 0;
    hints = data.hints || 0;
    completionOrder = data.completionOrder || Array(puzzle.houseCount).fill(0);
    nextCompleteRank = data.nextCompleteRank || 1;
    solved = Boolean(data.solved);
  } catch {
    /* ignore */
  }
}

function readStreak() {
  try {
    return JSON.parse(localStorage.getItem(STREAK_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStreak() {
  const prev = readStreak();
  const days = { ...(prev.days || {}) };
  days[puzzle.date] = { time: elapsedMs, hints, mistakes };
  let count = 1;
  if (prev.lastDate && prev.lastDate !== puzzle.date) {
    const prevDay = new Date(`${prev.lastDate}T12:00:00`);
    const cur = new Date(`${puzzle.date}T12:00:00`);
    const gap = Math.round((cur - prevDay) / 86400000);
    count = gap === 1 ? (prev.count || 1) + 1 : 1;
  } else if (prev.lastDate === puzzle.date) {
    count = prev.count || 1;
  }
  try {
    localStorage.setItem(
      STREAK_STORAGE_KEY,
      JSON.stringify({ lastDate: puzzle.date, count, days }),
    );
  } catch {
    /* private mode */
  }
  return count;
}

function ensureTimer() {
  if (solved) return;
  if (!startedAt) startedAt = Date.now() - elapsedMs;
  persist();
  if (timerId) return;
  timerId = setInterval(() => {
    elapsedMs = Date.now() - startedAt;
    paintMeta();
  }, 250);
}

function markHouseCompletion() {
  for (let house = 0; house < puzzle.houseCount; house += 1) {
    if (completionOrder[house]) continue;
    if (houseIsCompleteAndCorrect(grid, puzzle.solution, house)) {
      completionOrder[house] = nextCompleteRank;
      nextCompleteRank += 1;
    }
  }
}

function shareBody() {
  return formatShare({
    number: puzzle.number || puzzleNumber(puzzle.date),
    houseCount: puzzle.houseCount,
    completionOrder: completionOrder.map((rank) => rank || 0),
    elapsedMs,
  });
}

async function copyShare() {
  const text = shareBody();
  try {
    if (navigator.share) {
      await navigator.share({ title: GAME_NAME, text });
      return;
    }
  } catch {
    /* fall through to clipboard */
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("Result copied.");
  } catch {
    showToast("Copy the result from the card.");
  }
}

function paintMeta() {
  $("meta-date").textContent = puzzle.date;
  $("meta-timer").innerHTML = `${iconSvg("clock")} ${formatTime(solved ? elapsedMs : startedAt ? Date.now() - startedAt : elapsedMs)}`;
  const streak = readStreak();
  $("meta-streak").innerHTML = `${iconSvg("calendar-check")} ${streak.count || 0}`;
}

function paintChrome() {
  document.title = GAME_NAME;
  $("game-title").textContent = GAME_NAME;
  $("game-eyebrow").textContent = puzzle.theme.title;
  $("game-lede").textContent = puzzle.theme.story || GAME_TAGLINE;
  $("game-question").textContent = puzzle.question.text;
  $("archive-link").href = ARCHIVE_HREF;
  $("win-title").textContent = GAME_NAME;
  $("btn-hint").innerHTML = iconSvg("lightbulb", { label: "Reveal a cell" });
  $("btn-check").innerHTML = iconSvg("check", { label: "Check the grid" });
  $("btn-share").innerHTML = iconSvg("share", { label: "Share result" });
  $("sheet-close").innerHTML = iconSvg("x", { label: "Close picker" });
  $("win-share").innerHTML = `${iconSvg("share")} Copy result`;
  paintThemeToggle();
  paintMeta();
}

function closeSheet() {
  selected = null;
  $("sheet").hidden = true;
  document.body.classList.remove("is-sheet-open");
  paintBoard();
}

function openSheet() {
  const sheet = $("sheet");
  const itemsEl = $("sheet-items");
  if (!selected) {
    sheet.hidden = true;
    document.body.classList.remove("is-sheet-open");
    return;
  }
  const attr = selected.attr;
  const meta = attrMeta(attr);
  $("sheet-label").textContent = `House ${selected.house + 1} · ${meta.label} · long-press to rule out`;
  itemsEl.replaceChildren();
  for (const item of puzzle.items[attr]) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tray-item";
    if (ruledOut[selected.house][attr].includes(item.id)) btn.classList.add("is-out");
    btn.innerHTML = `${iconSvg(item.icon)}<span>${item.label}</span>`;
    bindTrayItem(btn, item);
    itemsEl.appendChild(btn);
  }
  sheet.hidden = false;
  document.body.classList.add("is-sheet-open");
}

function paintBoard() {
  const board = $("board");
  board.replaceChildren();
  const houses = document.createElement("section");
  houses.className = "houses";
  houses.dataset.count = String(puzzle.houseCount);
  houses.setAttribute("aria-label", "Houses");
  for (let house = 0; house < puzzle.houseCount; house += 1) {
    const card = document.createElement("article");
    card.className = "house";
    if (completionOrder[house]) card.classList.add("is-complete");
    const head = document.createElement("div");
    head.className = "house-head";
    head.innerHTML = `${iconSvg("house")} ${house + 1}`;
    card.appendChild(head);
    for (const attr of attributes()) {
      const slot = document.createElement("button");
      slot.type = "button";
      slot.className = "slot";
      slot.dataset.house = String(house);
      slot.dataset.attr = attr;
      const meta = attrMeta(attr);
      slot.setAttribute("aria-label", `House ${house + 1} ${meta.label}`);
      if (selected && selected.house === house && selected.attr === attr) slot.classList.add("is-selected");
      const value = grid[house][attr];
      const item = value ? itemById(attr, value) : null;
      if (item) {
        slot.innerHTML = `${iconSvg(item.icon)}<span class="slot-label">${item.label}</span>`;
      } else {
        slot.classList.add("is-empty");
        slot.innerHTML = `${iconSvg(meta.icon)}<span class="slot-label">${meta.label}</span>`;
      }
      slot.addEventListener("click", () => {
        haptic();
        ensureTimer();
        if (selected && selected.house === house && selected.attr === attr) {
          closeSheet();
          return;
        }
        selected = { house, attr };
        paintBoard();
        openSheet();
      });
      card.appendChild(slot);
    }
    const note = document.createElement("textarea");
    note.className = "notes";
    note.rows = 1;
    note.placeholder = "notes";
    note.value = notes[house] || "";
    note.setAttribute("aria-label", `Notes for house ${house + 1}`);
    note.addEventListener("input", () => {
      notes[house] = note.value;
      persist();
    });
    card.appendChild(note);
    houses.appendChild(card);
  }
  board.appendChild(houses);

  const hintBlock = document.createElement("section");
  hintBlock.className = "hint-block";
  const hintLabel = document.createElement("p");
  hintLabel.className = "hint-label";
  hintLabel.textContent = "Hints";
  hintBlock.appendChild(hintLabel);
  const clues = document.createElement("div");
  clues.className = "clues";
  clues.setAttribute("role", "list");
  clues.setAttribute("aria-label", "Hints");
  puzzle.clues.forEach((clue, index) => {
    const auto = clueSatisfiedByGrid(clue, grid, puzzle.houseCount, attributes());
    if (auto) crossed.add(clue.id);
    const row = document.createElement("button");
    row.type = "button";
    row.className = "clue";
    row.setAttribute("role", "listitem");
    if (crossed.has(clue.id)) row.classList.add("is-used");
    const num = document.createElement("span");
    num.className = "clue-num";
    num.textContent = String(index + 1).padStart(2, "0");
    const text = document.createElement("span");
    text.className = "clue-text";
    text.textContent = clue.text;
    row.append(num, text);
    row.addEventListener("click", () => {
      haptic();
      if (crossed.has(clue.id) && !auto) crossed.delete(clue.id);
      else crossed.add(clue.id);
      persist();
      paintBoard();
      if (selected) openSheet();
    });
    clues.appendChild(row);
  });
  hintBlock.appendChild(clues);
  board.appendChild(hintBlock);
  if (selected) openSheet();
  else {
    $("sheet").hidden = true;
    document.body.classList.remove("is-sheet-open");
  }
}

function bindTrayItem(btn, item) {
  let timer = 0;
  let long = false;
  const start = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    long = false;
    timer = window.setTimeout(() => {
      long = true;
      haptic(20);
      toggleRuledOut(item.id);
    }, LONG_PRESS_MS);
  };
  const end = (event) => {
    window.clearTimeout(timer);
    if (long) {
      event.preventDefault();
      return;
    }
    if (event.type === "pointerup") placeItem(item.id);
  };
  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", end);
  btn.addEventListener("pointerleave", () => window.clearTimeout(timer));
  btn.addEventListener("pointercancel", () => window.clearTimeout(timer));
  btn.addEventListener("contextmenu", (event) => event.preventDefault());
}

function toggleRuledOut(itemId) {
  if (!selected) return;
  const list = ruledOut[selected.house][selected.attr];
  const index = list.indexOf(itemId);
  if (index >= 0) list.splice(index, 1);
  else list.push(itemId);
  persist();
  openSheet();
}

function placeItem(itemId) {
  if (!selected || solved) return;
  haptic();
  ensureTimer();
  const { house, attr } = selected;
  for (let other = 0; other < puzzle.houseCount; other += 1) {
    if (other !== house && grid[other][attr] === itemId) grid[other][attr] = "";
  }
  grid[house][attr] = grid[house][attr] === itemId ? "" : itemId;
  markHouseCompletion();
  persist();
  paintBoard();
}

function useHint() {
  if (solved) return;
  const cell = firstHintCell(grid, puzzle.solution, attributes());
  if (!cell) {
    showToast("Nothing left to hint.");
    return;
  }
  ensureTimer();
  hints += 1;
  selected = { house: cell.house, attr: cell.attr };
  grid[cell.house][cell.attr] = cell.item;
  markHouseCompletion();
  persist();
  paintBoard();
  showToast("One cell filled. Hint cost applied.");
}

function checkGrid() {
  ensureTimer();
  if (!placementComplete(grid, puzzle.houseCount, attributes())) {
    showToast("Fill every slot first.");
    return;
  }
  if (!gridMatchesSolution(grid, puzzle.solution)) {
    mistakes += 1;
    persist();
    haptic(30);
    showToast("Not yet. That combination is off.");
    return;
  }
  finish();
}

function finish() {
  if (!solved) {
    solved = true;
    elapsedMs = startedAt ? Date.now() - startedAt : elapsedMs;
    if (timerId) {
      clearInterval(timerId);
      timerId = 0;
    }
    markHouseCompletion();
    for (let house = 0; house < puzzle.houseCount; house += 1) {
      if (!completionOrder[house]) {
        completionOrder[house] = nextCompleteRank;
        nextCompleteRank += 1;
      }
    }
    writeStreak();
    persist();
  }
  selected = null;
  $("sheet").hidden = true;
  document.body.classList.remove("is-sheet-open");
  $("btn-share").hidden = false;
  $("share-text").textContent = shareBody();
  $("win-lede").textContent = `Solved in ${formatTime(elapsedMs)} · ${hints} hint${hints === 1 ? "" : "s"} · ${scoreFor({ elapsedMs, mistakes, hints })} pts`;
  $("win").hidden = false;
  paintMeta();
}

async function loadPuzzle() {
  const date = localIsoDate();
  const response = await fetch(`data/plotted/${date}.json`);
  if (!response.ok) throw new Error(`No puzzle for ${date}`);
  puzzle = await response.json();
  grid = emptyGrid();
  notes = Array.from({ length: puzzle.houseCount }, () => "");
  ruledOut = emptyRuled();
  completionOrder = Array(puzzle.houseCount).fill(0);
  restore();
  paintChrome();
  paintBoard();
  if (solved) {
    $("btn-share").hidden = false;
  }
}

function bind() {
  $("theme-toggle").addEventListener("click", () => {
    applyTheme(currentTheme() === "light" ? "dark" : "light");
  });
  $("btn-hint").addEventListener("click", useHint);
  $("btn-check").addEventListener("click", checkGrid);
  $("btn-share").addEventListener("click", copyShare);
  $("win-share").addEventListener("click", copyShare);
  $("win-close").addEventListener("click", () => {
    $("win").hidden = true;
  });
  $("sheet-close").addEventListener("click", closeSheet);
  $("sheet-dismiss").addEventListener("click", closeSheet);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

bind();
loadPuzzle().catch((error) => {
  console.error(error);
  $("boot").textContent = "Today’s puzzle isn’t on this build yet.";
});
