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
  $("game-question").innerHTML = highlightItemWordsHtml(puzzle.question.text, allItems());
  $("how-to").textContent =
    "Each house has one owner. Type the bold words into the matching slots. Next door means a neighboring house, left or right.";
  $("archive-link").href = ARCHIVE_HREF;
  $("win-title").textContent = GAME_NAME;
  $("btn-hint").innerHTML = iconSvg("lightbulb", { label: "Reveal a cell" });
  $("btn-check").innerHTML = iconSvg("check", { label: "Check the grid" });
  $("btn-share").innerHTML = iconSvg("share", { label: "Share result" });
  $("win-share").innerHTML = `${iconSvg("share")} Copy result`;
  paintThemeToggle();
  paintMeta();
}

function slotKey(house, attr) {
  return `${house}-${attr}`;
}

function popSlot(slot) {
  slot.classList.remove("is-pop");
  void slot.offsetWidth;
  slot.classList.add("is-pop");
}

function setSlotVisual(slot, house, attr, typed, status) {
  const value = grid[house][attr];
  const item = value ? itemById(attr, value) : null;
  const meta = attrMeta(attr);
  const mark = slot.querySelector(".slot-mark");
  mark.innerHTML = iconSvg(item?.icon || meta.icon);
  slot.classList.toggle("is-empty", !item);
  slot.classList.toggle("is-match", Boolean(item));
  slot.classList.toggle("is-unknown", status === "unknown" && Boolean(typed.trim()));
}

function nextEmptySlot(house, attr) {
  const attrs = attributes();
  let startHouse = house;
  let startAttr = attrs.indexOf(attr) + 1;
  for (let h = startHouse; h < puzzle.houseCount; h += 1) {
    for (let i = h === startHouse ? startAttr : 0; i < attrs.length; i += 1) {
      if (!grid[h][attrs[i]]) return { house: h, attr: attrs[i] };
    }
  }
  return null;
}

function placeItem(house, attr, itemId, { bounce = true, silent = false } = {}) {
  if (solved) return;
  ensureTimer();
  const previous = grid[house][attr];
  for (let other = 0; other < puzzle.houseCount; other += 1) {
    if (other !== house && grid[other][attr] === itemId) grid[other][attr] = "";
  }
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
  if (solved || !grid[house][attr]) return;
  grid[house][attr] = "";
  persist();
}

function paintSuggestions(house, attr, typed) {
  const box = document.querySelector(`[data-suggest="${house}"]`);
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
    if (ruledOut[house][attr].includes(item.id)) btn.classList.add("is-out");
    if (grid.some((row, other) => other !== house && row[attr] === item.id)) btn.classList.add("is-used");
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
  const list = ruledOut[house][attr];
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
    if (grid[house][attr] !== result.item.id) {
      placeItem(house, attr, result.item.id, { silent: true });
      popSlot(slot);
      syncOtherInputs(attr, house);
      refreshCluesAndHouses();
    }
    input.value = result.item.label;
  } else {
    if (grid[house][attr]) {
      clearItem(house, attr);
      refreshCluesAndHouses();
    }
  }
  setSlotVisual(slot, house, attr, typed, result.status);
  paintSuggestions(house, attr, typed);
}

function syncOtherInputs(attr, exceptHouse) {
  for (let house = 0; house < puzzle.houseCount; house += 1) {
    if (house === exceptHouse) continue;
    const input = document.querySelector(`input[data-slot="${slotKey(house, attr)}"]`);
    const slot = input?.closest(".slot");
    if (!input || document.activeElement === input) continue;
    const value = grid[house][attr];
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
    document.querySelector(`[data-house="${house}"]`)?.classList.toggle("is-complete", Boolean(completionOrder[house]));
  }
}

function paintBoard(opts = {}) {
  const board = $("board");
  const keep = opts.focus || focused;
  const typedByFocus = opts.typed;
  board.replaceChildren();
  const houses = document.createElement("section");
  houses.className = "houses";
  houses.dataset.count = String(puzzle.houseCount);
  houses.setAttribute("aria-label", "Houses");
  const stacked = puzzle.houseCount >= 5 || attributes().length >= 5;
  for (let house = 0; house < puzzle.houseCount; house += 1) {
    const card = document.createElement("article");
    card.className = "house";
    card.dataset.tone = String((house % 5) + 1);
    card.dataset.house = String(house);
    if (completionOrder[house]) card.classList.add("is-complete");
    const head = document.createElement("div");
    head.className = "house-head";
    head.innerHTML = `${iconSvg("house")} House ${house + 1}`;
    card.appendChild(head);
    for (const attr of attributes()) {
      const meta = attrMeta(attr);
      const value = grid[house][attr];
      const item = value ? itemById(attr, value) : null;
      const slot = document.createElement("label");
      slot.className = "slot";
      slot.dataset.slot = slotKey(house, attr);
      if (stacked) slot.classList.add("is-wide");
      if (!item) slot.classList.add("is-empty");
      if (item) slot.classList.add("is-match");
      const mark = document.createElement("span");
      mark.className = "slot-mark";
      mark.innerHTML = iconSvg(item?.icon || meta.icon);
      slot.appendChild(mark);
      if (stacked) {
        const name = document.createElement("span");
        name.className = "slot-attr";
        name.textContent = meta.label;
        slot.appendChild(name);
      }
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
            const box = document.querySelector(`[data-suggest="${house}"]`);
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
      card.appendChild(slot);
    }
    const suggest = document.createElement("div");
    suggest.className = "slot-suggest";
    suggest.dataset.suggest = String(house);
    suggest.hidden = true;
    card.appendChild(suggest);
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
  const lists = document.createElement("div");
  lists.hidden = true;
  for (const attr of attributes()) {
    const list = document.createElement("datalist");
    list.id = `list-${attr}`;
    for (const item of puzzle.items[attr]) {
      const option = document.createElement("option");
      option.value = item.label;
      list.appendChild(option);
    }
    lists.appendChild(list);
  }
  houses.appendChild(lists);
  board.appendChild(houses);

  const hintBlock = document.createElement("section");
  hintBlock.className = "hint-block";
  const hintLabel = document.createElement("p");
  hintLabel.className = "hint-label";
  hintLabel.textContent = "Hints";
  hintBlock.appendChild(hintLabel);
  if (puzzle.setup) {
    const setup = document.createElement("p");
    setup.className = "setup";
    setup.textContent = puzzle.setup;
    hintBlock.appendChild(setup);
  }
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
  board.appendChild(hintBlock);

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
  $("btn-share").hidden = false;
  $("share-text").textContent = shareBody();
  $("win-lede").textContent = `Solved in ${formatTime(elapsedMs)} · ${hints} hint${hints === 1 ? "" : "s"} · ${scoreFor({ elapsedMs, mistakes, hints })} pts`;
  $("win").hidden = false;
  paintMeta();
  paintBoard();
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
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

bind();
loadPuzzle().catch((error) => {
  console.error(error);
  $("boot").textContent = "Today’s puzzle isn’t on this build yet.";
});
