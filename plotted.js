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
  flattenPuzzleItems,
  formatShare,
  formatTime,
  gridMatchesSolution,
  highlightItemWordsHtml,
  houseIsCompleteAndCorrect,
  localIsoDate,
  matchTypedItem,
  placementComplete,
  puzzleNumber,
  scoreFor,
} from "./plotted-engine.js";

const LONG_PRESS_MS = 500;
const LIGHT_THEME_COLOR = "#fff6eb";
const DARK_THEME_COLOR = "#1a1230";
const CONFETTI_COLORS = ["#ff6b6b", "#12b5a8", "#f4c430", "#8b5cf6", "#34d399", "#ff8a7a", "#2ee6d0"];
const $ = (id) => document.getElementById(id);

let puzzle = null;
let grid = [];
let notes = [];
let ruledOut = [];
let focused = null;
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
let bound = false;

function haptic(ms = 10) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
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
  if (meta) meta.setAttribute("content", theme === "light" ? LIGHT_THEME_COLOR : DARK_THEME_COLOR);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
  paintThemeToggle();
}

function paintThemeToggle() {
  const btn = $("theme-toggle");
  if (!btn) return;
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
  return puzzle.items[attr]?.find((item) => item.id === id) || null;
}

function allItems() {
  return flattenPuzzleItems(puzzle.items);
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

export function progressFitsPuzzle(data, puz = puzzle) {
  if (!data || !Array.isArray(data.grid) || data.grid.length !== puz.houseCount) return false;
  const attrs = puz.attributes.map((entry) => entry.id);
  return data.grid.every(
    (row) => row && typeof row === "object" && attrs.every((attr) => typeof row[attr] === "string"),
  );
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

function resetPlayState() {
  grid = emptyGrid();
  notes = Array.from({ length: puzzle.houseCount }, () => "");
  ruledOut = emptyRuled();
  crossed = new Set();
  startedAt = 0;
  elapsedMs = 0;
  mistakes = 0;
  hints = 0;
  completionOrder = Array(puzzle.houseCount).fill(0);
  nextCompleteRank = 1;
  solved = false;
  focused = null;
}

function restore() {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return;
    const data = JSON.parse(raw);
    if (!progressFitsPuzzle(data)) return;
    grid = data.grid;
    notes = Array.isArray(data.notes) && data.notes.length === puzzle.houseCount
      ? data.notes
      : Array.from({ length: puzzle.houseCount }, () => "");
    ruledOut = Array.isArray(data.ruledOut) && data.ruledOut.length === puzzle.houseCount
      ? data.ruledOut
      : emptyRuled();
    crossed = new Set(data.crossed || []);
    startedAt = data.startedAt || 0;
    elapsedMs = data.elapsedMs || 0;
    mistakes = data.mistakes || 0;
    hints = data.hints || 0;
    completionOrder = Array.isArray(data.completionOrder) && data.completionOrder.length === puzzle.houseCount
      ? data.completionOrder
      : Array(puzzle.houseCount).fill(0);
    nextCompleteRank = data.nextCompleteRank || 1;
    solved = Boolean(data.solved);
  } catch {
    resetPlayState();
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
  const dateEl = $("meta-date");
  const timerEl = $("meta-timer");
  const streakEl = $("meta-streak");
  if (dateEl) dateEl.textContent = puzzle.date;
  if (timerEl) {
    timerEl.innerHTML = `${iconSvg("clock")} ${formatTime(solved ? elapsedMs : startedAt ? Date.now() - startedAt : elapsedMs)}`;
  }
  if (streakEl) {
    const streak = readStreak();
    streakEl.innerHTML = `${iconSvg("calendar-check")} ${streak.count || 0}`;
  }
}

function paintChrome() {
  document.title = GAME_NAME;
  const title = $("game-title");
  const eyebrow = $("game-eyebrow");
  const lede = $("game-lede");
  const question = $("game-question");
  const howTo = $("how-to");
  const setup = $("setup");
  if (title) title.textContent = GAME_NAME;
  if (eyebrow) eyebrow.textContent = puzzle.theme.title;
  if (lede) lede.textContent = puzzle.theme.story || GAME_TAGLINE;
  if (question) question.innerHTML = highlightItemWordsHtml(puzzle.question.text, allItems());
  if (howTo) {
    howTo.textContent =
      "Each house has one owner. Type the bold words into the matching slots. Next door means a neighboring house, left or right.";
  }
  if (setup) {
    if (puzzle.setup) {
      setup.textContent = puzzle.setup;
      setup.hidden = false;
    } else {
      setup.textContent = "";
      setup.hidden = true;
    }
  }
  const archive = $("archive-link");
  if (archive) archive.href = ARCHIVE_HREF;
  const winTitle = $("win-title");
  if (winTitle) winTitle.textContent = GAME_NAME;
  const hint = $("btn-hint");
  const check = $("btn-check");
  const share = $("btn-share");
  if (hint) hint.innerHTML = iconSvg("lightbulb", { label: "Reveal a cell" });
  if (check) check.innerHTML = iconSvg("check", { label: "Check the grid" });
  if (share) share.innerHTML = iconSvg("share", { label: "Share result" });
  const winShare = $("win-share");
  if (winShare) winShare.innerHTML = `${iconSvg("share")} Copy result`;
  paintThemeToggle();
  paintMeta();
}

function slotKey(house, attr) {
  return `${house}-${attr}`;
}

function popSlot(slot) {
  if (!slot) return;
  slot.classList.remove("is-pop");
  void slot.offsetWidth;
  slot.classList.add("is-pop");
}

function setSlotVisual(slot, house, attr, typed, status) {
  const value = grid[house]?.[attr];
  const item = value ? itemById(attr, value) : null;
  const meta = attrMeta(attr);
  const mark = slot.querySelector(".slot-mark");
  if (mark) mark.innerHTML = iconSvg(item?.icon || meta.icon);
  slot.classList.toggle("is-empty", !item);
  slot.classList.toggle("is-filled", Boolean(item));
  slot.classList.toggle("is-unknown", status === "unknown" && Boolean(String(typed || "").trim()));
}

function nextEmptySlot(house, attr) {
  const attrs = attributes();
  let startHouse = house;
  let startAttr = attrs.indexOf(attr) + 1;
  for (let h = startHouse; h < puzzle.houseCount; h += 1) {
    for (let i = h === startHouse ? startAttr : 0; i < attrs.length; i += 1) {
      if (!grid[h]?.[attrs[i]]) return { house: h, attr: attrs[i] };
    }
  }
  return null;
}

function placeItem(house, attr, itemId, { bounce = true, silent = false } = {}) {
  if (solved) return;
  ensureTimer();
  const previous = grid[house]?.[attr];
  for (let other = 0; other < puzzle.houseCount; other += 1) {
    if (other !== house && grid[other]?.[attr] === itemId) grid[other][attr] = "";
  }
  if (!grid[house]) return previous;
  grid[house][attr] = itemId;
  markHouseCompletion();
  persist();
  if (!silent) {
    paintBoard({ focus: { house, attr }, typed: itemById(attr, itemId)?.label || "" });
    if (bounce) {
      const slot = document.querySelector(`[data-slot="${slotKey(house, attr)}"]`);
      if (slot) popSlot(slot);
    }
  }
  return previous;
}

function clearItem(house, attr) {
  if (solved || !grid[house]?.[attr]) return;
  grid[house][attr] = "";
  persist();
}

function suggestBox() {
  return document.querySelector(".slot-suggest");
}

function paintSuggestions(house, attr, typed) {
  const box = suggestBox();
  if (!box) return;
  const items = matchTypedItem(puzzle.items[attr], typed).suggestions;
  box.replaceChildren();
  if (focused?.house !== house || focused?.attr !== attr) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  for (const item of items) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "suggest-chip";
    btn.textContent = item.label;
    if (ruledOut[house]?.[attr]?.includes(item.id)) btn.classList.add("is-out");
    if (grid.some((row, other) => other !== house && row?.[attr] === item.id)) btn.classList.add("is-used");
    bindSuggest(btn, house, attr, item);
    box.appendChild(btn);
  }
}

function bindSuggest(btn, house, attr, item) {
  let timer = 0;
  let long = false;
  const start = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    long = false;
    timer = window.setTimeout(() => {
      long = true;
      haptic(20);
      toggleRuledOut(house, attr, item.id);
    }, LONG_PRESS_MS);
  };
  const end = (event) => {
    window.clearTimeout(timer);
    if (long) {
      event.preventDefault();
      return;
    }
    if (event.type === "pointerup") {
      haptic();
      placeItem(house, attr, item.id);
      const input = document.querySelector(`input[data-slot="${slotKey(house, attr)}"]`);
      if (input) {
        input.value = item.label;
        input.focus();
      }
    }
  };
  btn.addEventListener("pointerdown", start);
  btn.addEventListener("pointerup", end);
  btn.addEventListener("pointerleave", () => window.clearTimeout(timer));
  btn.addEventListener("pointercancel", () => window.clearTimeout(timer));
  btn.addEventListener("contextmenu", (event) => event.preventDefault());
}

function toggleRuledOut(house, attr, itemId) {
  const list = ruledOut[house]?.[attr];
  if (!list) return;
  const index = list.indexOf(itemId);
  if (index >= 0) list.splice(index, 1);
  else list.push(itemId);
  persist();
  const input = document.querySelector(`input[data-slot="${slotKey(house, attr)}"]`);
  paintSuggestions(house, attr, input?.value || "");
}

function handleTyped(house, attr, typed, input) {
  if (solved) return;
  ensureTimer();
  const result = matchTypedItem(puzzle.items[attr], typed);
  const slot = input.closest(".slot");
  if (result.status === "match") {
    if (grid[house]?.[attr] !== result.item.id) {
      placeItem(house, attr, result.item.id, { silent: true });
      if (slot) popSlot(slot);
      syncOtherInputs(attr, house);
      refreshCluesAndHouses();
    }
    input.value = result.item.label;
  } else {
    if (grid[house]?.[attr]) {
      clearItem(house, attr);
      refreshCluesAndHouses();
    }
  }
  if (slot) setSlotVisual(slot, house, attr, typed, result.status);
  paintSuggestions(house, attr, typed);
}

function syncOtherInputs(attr, exceptHouse) {
  for (let house = 0; house < puzzle.houseCount; house += 1) {
    if (house === exceptHouse) continue;
    const input = document.querySelector(`input[data-slot="${slotKey(house, attr)}"]`);
    const slot = input?.closest(".slot");
    if (!input || document.activeElement === input) continue;
    const value = grid[house]?.[attr];
    const item = value ? itemById(attr, value) : null;
    input.value = item ? item.label : "";
    if (slot) setSlotVisual(slot, house, attr, input.value, item ? "match" : "empty");
  }
}

function refreshCluesAndHouses() {
  puzzle.clues.forEach((clue) => {
    const auto = clueSatisfiedByGrid(clue, grid, puzzle.houseCount, attributes());
    if (auto) crossed.add(clue.id);
    const row = document.querySelector(`[data-clue="${clue.id}"]`);
    if (row) row.classList.toggle("is-used", crossed.has(clue.id));
  });
  for (let house = 0; house < puzzle.houseCount; house += 1) {
    document.querySelectorAll(`[data-house="${house}"]`).forEach((node) => {
      node.classList.toggle("is-complete", Boolean(solved && completionOrder[house]));
    });
  }
}

function makeSlot(house, attr) {
  const meta = attrMeta(attr);
  const value = grid[house]?.[attr] || "";
  const item = value ? itemById(attr, value) : null;
  const slot = document.createElement("label");
  slot.className = "slot";
  slot.dataset.slot = slotKey(house, attr);
  slot.dataset.house = String(house);
  slot.dataset.attr = attr;
  if (!item) slot.classList.add("is-empty");
  if (item) slot.classList.add("is-filled");
  const mark = document.createElement("span");
  mark.className = "slot-mark";
  mark.innerHTML = iconSvg(item?.icon || meta.icon);
  slot.appendChild(mark);
  const input = document.createElement("input");
  input.className = "slot-input";
  input.type = "text";
  input.value = item ? item.label : "";
  input.placeholder = meta.label;
  input.dataset.slot = slotKey(house, attr);
  input.dataset.house = String(house);
  input.dataset.attr = attr;
  input.setAttribute("aria-label", `House ${house + 1} ${meta.label}`);
  input.setAttribute("autocapitalize", "none");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("inputmode", "text");
  input.setAttribute("enterkeyhint", "next");
  input.setAttribute("list", `list-${attr}`);
  if (solved) input.readOnly = true;
  input.addEventListener("focus", () => {
    focused = { house, attr };
    paintSuggestions(house, attr, input.value);
  });
  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (focused?.house === house && focused?.attr === attr) {
        const box = suggestBox();
        if (box && !box.contains(document.activeElement)) {
          focused = null;
          box.hidden = true;
        }
      }
    }, 120);
  });
  input.addEventListener("input", () => handleTyped(house, attr, input.value, input));
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = nextEmptySlot(house, attr);
    if (!next) return;
    document.querySelector(`input[data-slot="${slotKey(next.house, next.attr)}"]`)?.focus();
  });
  slot.appendChild(input);
  return slot;
}

function showBoardError(message) {
  const board = $("board");
  if (!board) return;
  const p = document.createElement("p");
  p.className = "empty";
  p.id = "boot";
  p.textContent = message;
  board.replaceChildren(p);
}

function paintBoard(opts = {}) {
  const board = $("board");
  const keep = opts.focus || focused;
  const typedByFocus = opts.typed;
  board.replaceChildren();

  const play = document.createElement("div");
  play.className = "play";

  const gridWrap = document.createElement("section");
  gridWrap.className = "grid-wrap";
  gridWrap.setAttribute("aria-label", "Houses");

  const table = document.createElement("table");
  table.className = "grid-table";
  table.dataset.count = String(puzzle.houseCount);

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.scope = "col";
  corner.className = "attr-head";
  corner.textContent = "";
  headRow.appendChild(corner);
  for (let house = 0; house < puzzle.houseCount; house += 1) {
    const th = document.createElement("th");
    th.scope = "col";
    th.className = "house-head";
    th.dataset.house = String(house);
    th.dataset.tone = String((house % 5) + 1);
    if (solved && completionOrder[house]) th.classList.add("is-complete");
    th.innerHTML = `${iconSvg("house")} <span>House ${house + 1}</span>`;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const attr of attributes()) {
    const tr = document.createElement("tr");
    tr.dataset.attr = attr;
    const th = document.createElement("th");
    th.scope = "row";
    th.className = "attr-head";
    const meta = attrMeta(attr);
    th.innerHTML = `${iconSvg(meta.icon)} <span>${meta.label}</span>`;
    tr.appendChild(th);
    for (let house = 0; house < puzzle.houseCount; house += 1) {
      const td = document.createElement("td");
      td.dataset.house = String(house);
      td.dataset.tone = String((house % 5) + 1);
      if (solved && completionOrder[house]) td.classList.add("is-complete");
      td.appendChild(makeSlot(house, attr));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  const notesRow = document.createElement("tr");
  notesRow.className = "notes-row";
  const notesHead = document.createElement("th");
  notesHead.scope = "row";
  notesHead.className = "attr-head";
  notesHead.textContent = "Notes";
  notesRow.appendChild(notesHead);
  for (let house = 0; house < puzzle.houseCount; house += 1) {
    const td = document.createElement("td");
    td.dataset.house = String(house);
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
    td.appendChild(note);
    notesRow.appendChild(td);
  }
  tbody.appendChild(notesRow);
  table.appendChild(tbody);

  const lists = document.createElement("div");
  lists.hidden = true;
  for (const attr of attributes()) {
    const list = document.createElement("datalist");
    list.id = `list-${attr}`;
    for (const item of puzzle.items[attr] || []) {
      const option = document.createElement("option");
      option.value = item.label;
      list.appendChild(option);
    }
    lists.appendChild(list);
  }

  const suggest = document.createElement("div");
  suggest.className = "slot-suggest";
  suggest.hidden = true;

  gridWrap.append(table, lists, suggest);
  play.appendChild(gridWrap);

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
    row.dataset.clue = clue.id;
    row.setAttribute("role", "listitem");
    if (crossed.has(clue.id)) row.classList.add("is-used");
    const num = document.createElement("span");
    num.className = "clue-num";
    num.textContent = String(index + 1).padStart(2, "0");
    const text = document.createElement("span");
    text.className = "clue-text";
    text.innerHTML = highlightItemWordsHtml(clue.text, allItems());
    row.append(num, text);
    row.addEventListener("click", () => {
      haptic();
      if (crossed.has(clue.id) && !auto) crossed.delete(clue.id);
      else crossed.add(clue.id);
      persist();
      row.classList.toggle("is-used", crossed.has(clue.id));
    });
    clues.appendChild(row);
  });
  hintBlock.appendChild(clues);
  play.appendChild(hintBlock);
  board.appendChild(play);

  if (keep) {
    const input = document.querySelector(`input[data-slot="${slotKey(keep.house, keep.attr)}"]`);
    if (input) {
      if (typeof typedByFocus === "string") input.value = typedByFocus;
      input.focus();
      const end = input.value.length;
      try {
        input.setSelectionRange(end, end);
      } catch {
        /* some input types */
      }
      focused = keep;
      paintSuggestions(keep.house, keep.attr, input.value);
    }
  }
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
  focused = { house: cell.house, attr: cell.attr };
  placeItem(cell.house, cell.attr, cell.item);
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

function burstConfetti() {
  const root = $("confetti");
  if (!root) return;
  root.hidden = false;
  root.replaceChildren();
  for (let i = 0; i < 56; i += 1) {
    const bit = document.createElement("i");
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    bit.style.animationDelay = `${Math.random() * 0.45}s`;
    bit.style.animationDuration = `${1.4 + Math.random() * 0.9}s`;
    bit.style.transform = `rotate(${Math.random() * 180}deg)`;
    root.appendChild(bit);
  }
  window.setTimeout(() => {
    root.hidden = true;
    root.replaceChildren();
  }, 2600);
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
    burstConfetti();
  }
  focused = null;
  const share = $("btn-share");
  if (share) share.hidden = false;
  const shareText = $("share-text");
  if (shareText) shareText.textContent = shareBody();
  const winLede = $("win-lede");
  if (winLede) {
    winLede.textContent = `Solved in ${formatTime(elapsedMs)} · ${hints} hint${hints === 1 ? "" : "s"} · ${scoreFor({ elapsedMs, mistakes, hints })} pts`;
  }
  const win = $("win");
  if (win) win.hidden = false;
  paintMeta();
  paintBoard();
}

export async function loadPuzzle({ date, puzzle: given } = {}) {
  if (given) {
    puzzle = given;
  } else {
    const iso = date || localIsoDate();
    const response = await fetch(`data/plotted/${iso}.json`);
    if (!response.ok) throw new Error(`No puzzle for ${iso}`);
    puzzle = await response.json();
  }
  resetPlayState();
  restore();
  paintChrome();
  try {
    paintBoard();
  } catch (error) {
    console.error(error);
    showBoardError("Couldn’t draw today’s grid.");
    throw error;
  }
  if (solved) {
    const share = $("btn-share");
    if (share) share.hidden = false;
  }
}

function bind() {
  if (bound) return;
  bound = true;
  $("theme-toggle")?.addEventListener("click", () => {
    applyTheme(currentTheme() === "light" ? "dark" : "light");
  });
  $("btn-hint")?.addEventListener("click", useHint);
  $("btn-check")?.addEventListener("click", checkGrid);
  $("btn-share")?.addEventListener("click", copyShare);
  $("win-share")?.addEventListener("click", copyShare);
  $("win-close")?.addEventListener("click", () => {
    const win = $("win");
    if (win) win.hidden = true;
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

export async function boot(options = {}) {
  bind();
  try {
    await loadPuzzle(options);
  } catch (error) {
    console.error(error);
    showBoardError("Today’s puzzle isn’t on this build yet.");
  }
}
