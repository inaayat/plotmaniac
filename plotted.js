import {
  ARCHIVE_HREF,
  GAME_NAME,
  GAME_TAGLINE,
  NOTES_STORAGE_KEY,
  PRACTICE_NOTES_KEY,
  PRACTICE_PROGRESS_KEY,
  PRACTICE_GROUPS,
  PRACTICE_PUZZLES,
  practiceGroupLabel,
  PROGRESS_STORAGE_KEY,
  STREAK_STORAGE_KEY,
  THEME_STORAGE_KEY,
} from "./plotted-config.js";
import { iconSvg } from "./plotted-icons.js";
import { ATTRIBUTES } from "./plotted-themes.js";
import {
  bestTypedCompletion,
  clueSatisfiedByGrid,
  displayClueText,
  firstHintCell,
  puzzleSetup,
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
  puzzleOptionRows,
  scoreFor,
} from "./plotted-engine.js";
const LIGHT_THEME_COLOR = "#fff6eb";
const DARK_THEME_COLOR = "#1a1230";
const $ = (id) => document.getElementById(id);

let puzzle = null;
let grid = [];
let notes = "";
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
let streakAwarded = false;
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

function isPractice() {
  return Boolean(puzzle?.practice || puzzle?.practiceId);
}

function puzzleProgressId() {
  if (isPractice()) return puzzle.practiceId || puzzle.id;
  return puzzle.date;
}

function storageKey() {
  const id = puzzleProgressId();
  return isPractice() ? `${PRACTICE_PROGRESS_KEY}:${id}` : `${PROGRESS_STORAGE_KEY}:${id}`;
}

function notesStorageKey() {
  const id = puzzleProgressId();
  return isPractice() ? `${PRACTICE_NOTES_KEY}:${id}` : `${NOTES_STORAGE_KEY}:${id}`;
}

function isWidePlay() {
  return (window.innerWidth || 390) >= 640;
}

const CLUE_SIZE_PHONE = 13;
const CLUE_SIZE_DESKTOP = 15;
const CLUE_PAD_PHONE = 3;
const CLUE_PAD_DESKTOP = 4;
const CLUE_SIZE_FLOOR = 11;
const CLUE_SIZE_TYPING = 11;
const CLUE_SIZE_TYPING_FLOOR = 9;
const CELL_H_PHONE = 42;
const CELL_H_PHONE_TYPING_MIN = 32;
const CELL_H_PHONE_TYPING_MAX = 36;

const SLOT_FIT_GLYPH = 0.64;

export function slotFitPlan(text, boxWidth, boxHeight = 36, opts = {}) {
  const minSize = opts.minSize ?? 9;
  const maxSize = opts.maxSize ?? 16;
  const glyph = opts.glyph ?? SLOT_FIT_GLYPH;
  const lineHeight = opts.lineHeight ?? 1.05;
  const padding = opts.padding ?? 6;
  const value = String(text || "").trim();
  const innerW = Math.max(8, boxWidth - padding);
  const innerH = Math.max(8, boxHeight - 4);
  if (!value) return { fontSize: maxSize, lines: 1, display: "" };
  const upper = value.toUpperCase();
  const widthOf = (s, size) => s.length * glyph * size;
  const fitsNowrap = (size) => widthOf(upper, size) <= innerW && size * lineHeight <= innerH + 0.5;
  for (let size = maxSize; size >= minSize - 0.001; size -= 0.25) {
    if (fitsNowrap(size)) return { fontSize: Number(size.toFixed(2)), lines: 1, display: upper };
  }
  const parts = upper.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    for (let size = maxSize; size >= minSize - 0.001; size -= 0.25) {
      if (size * lineHeight * 2 > innerH + 0.5) continue;
      for (let i = 1; i < parts.length; i += 1) {
        const a = parts.slice(0, i).join(" ");
        const b = parts.slice(i).join(" ");
        if (Math.max(widthOf(a, size), widthOf(b, size)) <= innerW) {
          return { fontSize: Number(size.toFixed(2)), lines: 2, display: `${a}\n${b}` };
        }
      }
    }
  }
  return { fontSize: minSize, lines: 1, display: upper };
}

function applySlotFit(slot) {
  const fit = slot.querySelector(".slot-fit");
  const input = slot.querySelector(".slot-input");
  if (!fit) return;
  if (slot.classList.contains("is-editing") || isWidePlay()) {
    fit.textContent = "";
    fit.style.fontSize = "";
    return;
  }
  const plan = slotFitPlan(input?.value || "", slot.clientWidth || 75, slot.clientHeight || 36, {
    maxSize: isWidePlay() ? 16 : 13,
    minSize: isWidePlay() ? 9 : 11,
  });
  fit.textContent = plan.display;
  fit.style.fontSize = `${plan.fontSize}px`;
  fit.style.whiteSpace = plan.lines > 1 ? "pre-line" : "nowrap";
}

function fitAllSlots() {
  document.querySelectorAll(".slot[data-slot]").forEach(applySlotFit);
}

function sizeEditingSlot(slot) {
  const input = slot.querySelector(".slot-input");
  if (!input || isWidePlay() || document.querySelector(".board.is-typing-compact")) {
    slot.style.removeProperty("--edit-w");
    return;
  }
  const attr = slot.dataset.attr;
  const typed = input.value || "";
  const completion = bestTypedCompletion(puzzle.items[attr], typed);
  const shown = `${typed}${completion.status === "partial" && completion.rest ? completion.rest : ""}` || "MMMMMMMM";
  const width = Math.ceil(shown.toUpperCase().length * SLOT_FIT_GLYPH * 16 + 32);
  const cap = Math.min((window.innerWidth || 390) - 16, Math.max(slot.clientWidth || 0, width, 72));
  slot.style.setProperty("--edit-w", `${cap}px`);
}

function clearEditingSlot(slot) {
  if (!slot) return;
  slot.classList.remove("is-editing");
  slot.style.removeProperty("--edit-w");
  applySlotFit(slot);
}

export function normalizeNotes(value) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((entry) => (entry == null ? "" : String(entry))).join("\n");
  return "";
}

function readStoredNotes(progressNotes) {
  try {
    const raw = localStorage.getItem(notesStorageKey());
    if (raw != null) return raw;
  } catch {
    /* private mode */
  }
  return normalizeNotes(progressNotes);
}

function persistNotes() {
  try {
    localStorage.setItem(notesStorageKey(), notes);
  } catch {
    /* private mode */
  }
}

export function progressFitsPuzzle(data, puz = puzzle) {
  if (!data || !Array.isArray(data.grid) || data.grid.length !== puz.houseCount) return false;
  const attrs = puz.attributes.map((entry) => entry.id);
  return data.grid.every(
    (row) => row && typeof row === "object" && attrs.every((attr) => typeof row[attr] === "string"),
  );
}

function persist() {
  persistNotes();
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
        streakAwarded,
      }),
    );
  } catch {
    /* private mode */
  }
}

function resetPlayState() {
  if (timerId) {
    clearInterval(timerId);
    timerId = 0;
  }
  grid = emptyGrid();
  notes = "";
  ruledOut = emptyRuled();
  crossed = new Set();
  startedAt = 0;
  elapsedMs = 0;
  mistakes = 0;
  hints = 0;
  completionOrder = Array(puzzle.houseCount).fill(0);
  nextCompleteRank = 1;
  solved = false;
  streakAwarded = false;
  focused = null;
}

export function stopGameTimers() {
  if (timerId) {
    clearInterval(timerId);
    timerId = 0;
  }
}

function restore() {
  let progressNotes;
  try {
    const raw = localStorage.getItem(storageKey());
    if (raw) {
      const data = JSON.parse(raw);
      if (progressFitsPuzzle(data)) {
        grid = data.grid;
        progressNotes = data.notes;
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
        streakAwarded = Boolean(data.streakAwarded || data.solved);
      }
    }
  } catch {
    resetPlayState();
  }
  notes = readStoredNotes(progressNotes);
  persistNotes();
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
  if (isPractice()) {
    return formatShare({
      heading: `${GAME_NAME} practice · ${puzzle.label || puzzle.theme?.title || "Practice"}`,
      houseCount: puzzle.houseCount,
      completionOrder: completionOrder.map((rank) => rank || 0),
      elapsedMs,
    });
  }
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
  if (dateEl) {
    dateEl.textContent = isPractice()
      ? `Practice · ${puzzle.label || practiceGroupLabel(puzzle.difficulty?.label) || "Practice"}${
          puzzle.theme?.title ? ` · ${puzzle.theme.title}` : ""
        }`
      : puzzle.date;
  }
  if (timerEl) timerEl.textContent = formatTime(solved ? elapsedMs : startedAt ? Date.now() - startedAt : elapsedMs);
  if (streakEl) {
    const streak = readStreak();
    streakEl.textContent = `${streak.count || 0} streak`;
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
      "Each house has one owner. Type the bold words into the matching slots. The list above the grid is every word in that row. Next to means a neighboring house, left or right. A gold dashed outline means that word isn’t in this row.";
  }
  if (setup) {
    const setupLine = puzzleSetup(puzzle);
    setup.textContent = setupLine;
    setup.hidden = !setupLine;
  }
  const archive = $("archive-link");
  if (archive) archive.href = ARCHIVE_HREF;
  const winTitle = $("win-title");
  if (winTitle) winTitle.textContent = "Solved";
  const help = $("btn-help");
  const check = $("btn-check");
  const startOverBtn = $("btn-start-over");
  const share = $("btn-share");
  if (help) help.innerHTML = iconSvg("chat-teardrop-text", { label: "How to play" });
  if (check) check.innerHTML = iconSvg("check", { label: "Check the grid" });
  if (startOverBtn) startOverBtn.innerHTML = iconSvg("arrow-counter-clockwise", { label: "Start over" });
  if (share) share.innerHTML = iconSvg("share", { label: "Share result" });
  const winShare = $("win-share");
  if (winShare) winShare.textContent = "Share";
  paintPracticeNav();
  paintThemeToggle();
  paintMeta();
}

function paintPracticeNav() {
  const nav = $("practice-nav");
  if (!nav) return;
  const current = isPractice() ? puzzleProgressId() : "";
  const picker = document.createElement("label");
  picker.className = "practice-picker";
  const caption = document.createElement("span");
  caption.className = "practice-picker-label";
  caption.textContent = "Puzzle";
  const wrap = document.createElement("span");
  wrap.className = "practice-select-wrap";
  const select = document.createElement("select");
  select.id = "practice-select";
  select.setAttribute("aria-label", "Practice puzzles");
  const today = document.createElement("option");
  today.value = "";
  today.textContent = "Today";
  select.appendChild(today);
  for (const group of PRACTICE_GROUPS) {
    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    for (const entry of PRACTICE_PUZZLES.filter((puzzleEntry) => puzzleEntry.group === group.id)) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = entry.title;
      optgroup.appendChild(option);
    }
    select.appendChild(optgroup);
  }
  select.value = current;
  const caret = document.createElement("span");
  caret.className = "practice-select-caret";
  caret.setAttribute("aria-hidden", "true");
  caret.innerHTML = iconSvg("caret-down");
  wrap.append(select, caret);
  picker.append(caption, wrap);
  nav.replaceChildren(picker);
}

function showStartOverConfirm() {
  if (!puzzle) return;
  const win = $("win");
  if (win) win.hidden = true;
  const dialog = $("start-over");
  if (dialog) dialog.hidden = false;
}

function hideStartOverConfirm() {
  const dialog = $("start-over");
  if (dialog) dialog.hidden = true;
}

export function startOver({ clearNotes = false } = {}) {
  if (!puzzle) return;
  const awarded = streakAwarded || solved;
  const keptNotes = clearNotes ? "" : notes;
  hideStartOverConfirm();
  const share = $("btn-share");
  if (share) share.hidden = true;
  const win = $("win");
  if (win) win.hidden = true;
  resetPlayState();
  notes = keptNotes;
  streakAwarded = awarded;
  persist();
  paintChrome();
  paintBoard();
}

function slotKey(house, attr) {
  return `${house}-${attr}`;
}

function prefersReducedMotion() {
  try {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

let notesCloseTimer = 0;

function notesSheetOpen() {
  const panel = document.querySelector(".notes-panel");
  return Boolean(panel?.open && !isWidePlay());
}

function isTypingInGrid() {
  return Boolean(document.activeElement?.classList?.contains("slot-input"));
}

function visualViewportBox() {
  const vv = window.visualViewport;
  const innerH = window.innerHeight || 720;
  const innerW = window.innerWidth || 390;
  return {
    width: Math.round(vv?.width || innerW),
    height: Math.round(vv?.height || innerH),
    offsetTop: Math.round(vv?.offsetTop || 0),
    offsetLeft: Math.round(vv?.offsetLeft || 0),
  };
}

function keyboardInsetPx() {
  const innerH = window.innerHeight || 720;
  const box = visualViewportBox();
  return Math.max(0, Math.round(innerH - box.height - box.offsetTop));
}

function keyboardIsOpen() {
  return keyboardInsetPx() > 80;
}

function shouldRefitLayout() {
  return !isTypingInGrid() && !keyboardIsOpen();
}

const TYPING_RESIZE_DELTA = 40;
const TYPING_RESIZE_DEBOUNCE_MS = 100;
const TYPING_BLUR_DELAY_MS = 150;

const typingLayoutStats = {
  layoutPasses: 0,
  scrollCalls: 0,
};

let typingLayoutBusy = false;
let typingCompactOn = false;
let lastTypingHeight = 0;
let focusedScrollToken = "";
let leaveTypingTimer = 0;
let typingResizeTimer = 0;
let typingResizeRaf = 0;

export function getTypingLayoutStats() {
  return { layoutPasses: typingLayoutStats.layoutPasses, scrollCalls: typingLayoutStats.scrollCalls };
}

export function resetTypingLayoutStats() {
  typingLayoutStats.layoutPasses = 0;
  typingLayoutStats.scrollCalls = 0;
}

function isSlotInput(el) {
  return Boolean(el?.classList?.contains("slot-input"));
}

function safeHandler(fn) {
  return (...args) => {
    try {
      fn(...args);
    } catch (error) {
      console.error(error);
    }
  };
}

function resetTypingLayoutState() {
  typingCompactOn = false;
  lastTypingHeight = 0;
  focusedScrollToken = "";
  if (leaveTypingTimer) {
    window.clearTimeout(leaveTypingTimer);
    leaveTypingTimer = 0;
  }
}

function applyTypingVar(el, name, value) {
  if (!el) return;
  el.style.setProperty(name, value);
}

function applyPhoneTiles(cellH, gap = 6, tableGap = 3) {
  const px = (n) => `${Number(n.toFixed(2))}px`;
  const targets = [document.documentElement, document.querySelector(".board")];
  for (const el of targets) {
    applyTypingVar(el, "--cell-h", px(cellH));
    applyTypingVar(el, "--play-gap", px(gap));
    applyTypingVar(el, "--table-gap", px(tableGap));
    applyTypingVar(el, "--input-size", "16px");
  }
}

function applyClueMetrics(size, pad) {
  const targets = [document.documentElement, document.querySelector(".board")];
  for (const el of targets) {
    applyTypingVar(el, "--clue-size", `${Number(size.toFixed(2))}px`);
    applyTypingVar(el, "--clue-pad", `${Number(pad.toFixed(2))}px`);
  }
}

function clearBoardTypingMetrics() {
  const board = document.querySelector(".board");
  if (!board) return;
  for (const name of ["--cell-h", "--play-gap", "--table-gap", "--input-size", "--clue-size", "--clue-pad"]) {
    board.style.removeProperty(name);
  }
}

function puzzleColHeight() {
  const col = document.querySelector(".puzzle-col");
  if (!col) return 0;
  return Math.ceil(col.scrollHeight || col.getBoundingClientRect().height);
}

function typingLayoutFits(availH) {
  return puzzleColHeight() <= availH + 1;
}

/** Compact clues, word bank, and tiles so the playfield fits in visualViewport.height. */
export function fitTypingPlayfield({ force = false } = {}) {
  if (typingLayoutBusy) return typingCompactOn;
  if (isWidePlay() || !isTypingInGrid()) return false;
  const board = document.querySelector(".board");
  const play = document.querySelector(".play");
  const col = document.querySelector(".puzzle-col");
  if (!board || !play || !col || !puzzle) return false;
  const box = visualViewportBox();
  if (!force && typingCompactOn && Math.abs(box.height - lastTypingHeight) <= TYPING_RESIZE_DELTA) {
    return true;
  }
  typingLayoutBusy = true;
  try {
    typingLayoutStats.layoutPasses += 1;
    const root = document.documentElement;
    root.style.setProperty("--vv-height", `${box.height}px`);
    board.classList.add("is-typing-compact");
    play.style.height = "auto";
    play.style.paddingBlock = "0px";
    applyClueMetrics(CLUE_SIZE_TYPING, 0);
    let bestCell = CELL_H_PHONE_TYPING_MIN;
    let fitted = false;
    for (let cellH = CELL_H_PHONE_TYPING_MAX; cellH >= CELL_H_PHONE_TYPING_MIN - 0.001; cellH -= 1) {
      applyPhoneTiles(cellH, 2, 2);
      if (typingLayoutFits(box.height)) {
        bestCell = cellH;
        fitted = true;
        break;
      }
    }
    applyPhoneTiles(fitted ? bestCell : CELL_H_PHONE_TYPING_MIN, 2, 2);
    if (!typingLayoutFits(box.height)) {
      let lo = CLUE_SIZE_TYPING_FLOOR;
      let hi = CLUE_SIZE_TYPING;
      let bestSize = CLUE_SIZE_TYPING_FLOOR;
      for (let i = 0; i < 10; i += 1) {
        const mid = (lo + hi) / 2;
        applyClueMetrics(mid, 0);
        if (typingLayoutFits(box.height)) {
          bestSize = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
      applyClueMetrics(bestSize, 0);
    }
    lastTypingHeight = box.height;
    typingCompactOn = true;
    fitAllSlots();
    return typingLayoutFits(box.height);
  } catch (error) {
    console.error(error);
    board.classList.add("is-typing-compact");
    applyPhoneTiles(CELL_H_PHONE_TYPING_MIN, 2, 2);
    applyClueMetrics(CLUE_SIZE_TYPING_FLOOR, 0);
    typingCompactOn = true;
    lastTypingHeight = box.height;
    return false;
  } finally {
    typingLayoutBusy = false;
  }
}

function enterTypingCompact() {
  if (typingLayoutBusy || isWidePlay() || !isTypingInGrid()) return;
  if (leaveTypingTimer) {
    window.clearTimeout(leaveTypingTimer);
    leaveTypingTimer = 0;
  }
  const already = typingCompactOn;
  fitTypingPlayfield({ force: !already });
  scrollFocusedTileOnce();
}

function leaveTypingCompactSoon(relatedTarget) {
  if (isSlotInput(relatedTarget)) return;
  if (leaveTypingTimer) window.clearTimeout(leaveTypingTimer);
  leaveTypingTimer = window.setTimeout(() => {
    leaveTypingTimer = 0;
    if (isTypingInGrid() || isSlotInput(document.activeElement)) return;
    if (typingLayoutBusy) return;
    typingLayoutBusy = true;
    try {
      const board = document.querySelector(".board");
      board?.classList.remove("is-typing-compact");
      clearBoardTypingMetrics();
      typingCompactOn = false;
      lastTypingHeight = 0;
      focusedScrollToken = "";
      const root = document.documentElement;
      if (!notesSheetOpen()) root.style.removeProperty("--vv-height");
      if (puzzle) fitPlayfield();
    } catch (error) {
      console.error(error);
    } finally {
      typingLayoutBusy = false;
    }
  }, TYPING_BLUR_DELAY_MS);
}

function syncTypingCompact(event) {
  if (event?.type === "focusout") {
    leaveTypingCompactSoon(event.relatedTarget);
    return;
  }
  enterTypingCompact();
}

function scheduleTypingResize() {
  if (isWidePlay() || (!isTypingInGrid() && !typingCompactOn)) return;
  const height = visualViewportBox().height;
  if (typingCompactOn && Math.abs(height - lastTypingHeight) <= TYPING_RESIZE_DELTA) return;
  if (typingResizeTimer) window.clearTimeout(typingResizeTimer);
  typingResizeTimer = window.setTimeout(() => {
    typingResizeTimer = 0;
    if (typingResizeRaf) return;
    typingResizeRaf = window.requestAnimationFrame(() => {
      typingResizeRaf = 0;
      try {
        if (!isTypingInGrid()) return;
        const next = visualViewportBox().height;
        if (typingCompactOn && Math.abs(next - lastTypingHeight) <= TYPING_RESIZE_DELTA) return;
        fitTypingPlayfield();
      } catch (error) {
        console.error(error);
      }
    });
  }, TYPING_RESIZE_DEBOUNCE_MS);
}

function onTypingViewportResize() {
  if (notesSheetOpen()) {
    syncNotesViewport();
    return;
  }
  if (isTypingInGrid() || typingCompactOn) {
    scheduleTypingResize();
    return;
  }
  if (shouldRefitLayout()) fitPlayfield();
}

function onVisualViewportScroll() {
  if (notesSheetOpen()) syncNotesViewport();
}

function scrollFocusedTileOnce() {
  if (isWidePlay() || !isTypingInGrid()) return;
  const input = document.activeElement;
  if (!isSlotInput(input)) return;
  const token = input.dataset?.slot || "";
  if (token && token === focusedScrollToken) return;
  focusedScrollToken = token;
  typingLayoutStats.scrollCalls += 1;
  const slot = input.closest?.(".slot") || document.querySelector(".slot.is-editing");
  if (!slot || typeof slot.scrollIntoView !== "function") return;
  try {
    slot.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  } catch {
    try {
      slot.scrollIntoView();
    } catch {
      /* ignore */
    }
  }
}

function scrollFocusedTileIntoView() {
  if (!isWidePlay() && isTypingInGrid()) {
    scrollFocusedTileOnce();
    return;
  }
  const slot =
    document.querySelector(".slot.is-editing") || document.activeElement?.closest?.(".slot");
  if (!slot || typeof slot.scrollIntoView !== "function") return;
  try {
    slot.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  } catch {
    try {
      slot.scrollIntoView();
    } catch {
      /* ignore */
    }
  }
}

export function syncNotesViewport() {
  const root = document.documentElement;
  if (!notesSheetOpen()) {
    root.style.setProperty("--keyboard-inset", "0px");
    root.style.removeProperty("--vv-height");
    return;
  }
  const innerH = window.innerHeight || 720;
  const vv = window.visualViewport;
  const vvH = vv?.height || innerH;
  const vvTop = vv?.offsetTop || 0;
  const keyboard = Math.max(0, Math.round(innerH - vvH - vvTop));
  root.style.setProperty("--vv-height", `${Math.round(vvH)}px`);
  root.style.setProperty("--keyboard-inset", `${keyboard}px`);
}

export function closeMobileNotes(panel = document.querySelector(".notes-panel")) {
  if (!panel || isWidePlay() || !panel.open) return;
  const finish = () => {
    panel.open = false;
    panel.classList.remove("is-closing");
    const sheet = panel.querySelector(".notes-sheet");
    if (sheet) sheet.setAttribute("aria-hidden", "true");
    const toggle = panel.querySelector(".notes-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    panel.querySelector("textarea.notes")?.blur();
    fitPlayfield();
  };
  if (prefersReducedMotion()) {
    finish();
    return;
  }
  panel.classList.add("is-closing");
  clearTimeout(notesCloseTimer);
  notesCloseTimer = setTimeout(finish, 400);
}

function bindNotesHandle(handle, panel) {
  let startY = 0;
  let dragging = false;
  handle.addEventListener("pointerdown", (event) => {
    if (isWidePlay() || !panel.open) return;
    dragging = true;
    startY = event.clientY;
    handle.setPointerCapture?.(event.pointerId);
  });
  handle.addEventListener("pointerup", (event) => {
    if (!dragging) return;
    dragging = false;
    if (event.clientY - startY >= 36) closeMobileNotes(panel);
    else closeMobileNotes(panel);
  });
}

function popSlot(slot) {
  if (!slot) return;
  slot.classList.remove("is-pop");
  void slot.offsetWidth;
  slot.classList.add("is-pop");
}

function shakeSlot(slot) {
  if (!slot) return;
  slot.classList.remove("is-shake");
  void slot.offsetWidth;
  slot.classList.add("is-shake");
}

function setSlotVisual(slot, house, attr, typed, status) {
  const value = grid[house]?.[attr];
  const item = value ? itemById(attr, value) : null;
  slot.classList.toggle("is-empty", !item);
  slot.classList.toggle("is-filled", Boolean(item));
  const unknown = status === "unknown" && Boolean(String(typed || "").trim());
  slot.classList.toggle("is-unknown", unknown);
  const input = slot.querySelector(".slot-input");
  if (input) {
    if (unknown) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
  const editing = !isWidePlay() && focused?.house === house && focused?.attr === attr;
  slot.classList.toggle("is-editing", editing);
  if (editing) sizeEditingSlot(slot);
  else slot.style.removeProperty("--edit-w");
  if (status !== "match") slot.classList.remove("is-correct", "is-wrong", "is-flip", "is-win");
  paintGhost(slot, typed, status);
  applySlotFit(slot);
}

function paintGhost(slot, typed, status) {
  const ghost = slot.querySelector(".slot-ghost");
  const input = slot.querySelector(".slot-input");
  if (!ghost) return;
  const house = Number(slot.dataset.house);
  const attr = slot.dataset.attr;
  const focusedHere = focused?.house === house && focused?.attr === attr;
  const completion = bestTypedCompletion(puzzle.items[attr], typed);
  const show = focusedHere && status !== "match" && completion.status === "partial" && completion.rest;
  ghost.textContent = show ? completion.rest : "";
  ghost.style.paddingLeft = "";
  if (show && input) {
    const typedWidth = typedPrefixWidth(input);
    const width = input.clientWidth || slot.clientWidth || 0;
    ghost.style.paddingLeft = `${Math.max(0, (width + typedWidth) / 2)}px`;
  }
  slot.dataset.ghostItem = show ? completion.item.id : "";
}

function typedPrefixWidth(input) {
  try {
    const style = window.getComputedStyle(input);
    const canvas = typedPrefixWidth.canvas || (typedPrefixWidth.canvas = document.createElement("canvas"));
    const ctx = canvas.getContext("2d");
    if (!ctx) return (input.value || "").length * 8;
    ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return ctx.measureText(input.value).width;
  } catch {
    return (input.value || "").length * 8;
  }
}

function acceptCompletion(house, attr, item, input) {
  if (!item) return;
  placeItem(house, attr, item.id, { silent: true });
  if (input) input.value = item.label;
  const slot = input?.closest(".slot") || document.querySelector(`[data-slot="${slotKey(house, attr)}"]`);
  if (slot) {
    setSlotVisual(slot, house, attr, item.label, "match");
    popSlot(slot);
  }
  syncOtherInputs(attr, house);
  refreshCluesAndHouses();
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
  maybeFinishIfSolved();
  return previous;
}

function clearItem(house, attr) {
  if (solved || !grid[house]?.[attr]) return;
  grid[house][attr] = "";
  persist();
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
    if (result.status === "unknown" && String(typed || "").trim()) shakeSlot(slot);
  }
  if (slot) setSlotVisual(slot, house, attr, typed, result.status);
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

function itemIsPlaced(attr, itemId) {
  return grid.some((row) => row?.[attr] === itemId);
}

function syncWordBank(root = document) {
  root.querySelectorAll(".word-bank-word").forEach((word) => {
    word.classList.toggle("is-placed", itemIsPlaced(word.dataset.attr, word.dataset.item));
  });
}

function makeWordBank() {
  const bank = document.createElement("section");
  bank.className = "word-bank";
  bank.setAttribute("aria-label", "Words you can type");
  for (const row of puzzleOptionRows(puzzle)) {
    const line = document.createElement("div");
    line.className = "word-bank-row";
    line.dataset.attr = row.attr;
    const cat = document.createElement("span");
    cat.className = "word-bank-cat";
    cat.textContent = row.label;
    const list = document.createElement("span");
    list.className = "word-bank-list";
    for (const item of row.items) {
      const word = document.createElement("span");
      word.className = "word-bank-word";
      word.dataset.attr = row.attr;
      word.dataset.item = item.id;
      word.textContent = item.label;
      if (itemIsPlaced(row.attr, item.id)) word.classList.add("is-placed");
      list.appendChild(word);
    }
    line.append(cat, list);
    bank.appendChild(line);
  }
  return bank;
}

/** Options that are not shown in the on-screen word bank. */
export function missingVisibleOptions(root = document, puz = puzzle) {
  if (!puz) return [{ error: "no puzzle" }];
  const bank = root.querySelector(".word-bank");
  if (!bank) {
    return puzzleOptionRows(puz).flatMap((row) =>
      row.items.map((item) => ({ attr: row.attr, id: item.id, label: item.label })),
    );
  }
  const shown = [...bank.querySelectorAll(".word-bank-word")].map((node) => ({
    attr: node.dataset.attr,
    id: node.dataset.item,
    text: node.textContent.trim(),
  }));
  const missing = [];
  for (const row of puzzleOptionRows(puz)) {
    for (const item of row.items) {
      const hit = shown.find((entry) => entry.attr === row.attr && entry.id === item.id);
      if (!hit || hit.text !== item.label) {
        missing.push({ attr: row.attr, id: item.id, label: item.label });
      }
    }
  }
  return missing;
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
  syncWordBank();
}

function tryAcceptGhost(house, attr, input) {
  const completion = bestTypedCompletion(puzzle.items[attr], input.value);
  if (completion.status !== "partial" || !completion.item) return false;
  acceptCompletion(house, attr, completion.item, input);
  return true;
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
  if (solved && item && puzzle.solution[house]?.[attr] === item.id) slot.classList.add("is-correct");
  const fit = document.createElement("span");
  fit.className = "slot-fit";
  fit.setAttribute("aria-hidden", "true");
  const ghost = document.createElement("span");
  ghost.className = "slot-ghost";
  ghost.setAttribute("aria-hidden", "true");
  const input = document.createElement("input");
  input.className = "slot-input";
  input.type = "text";
  input.value = item ? item.label : "";
  input.placeholder = "";
  input.dataset.slot = slotKey(house, attr);
  input.dataset.house = String(house);
  input.dataset.attr = attr;
  input.setAttribute("aria-label", `House ${house + 1} ${meta.label}`);
  input.setAttribute("autocapitalize", "none");
  input.setAttribute("autocorrect", "off");
  input.setAttribute("spellcheck", "false");
  input.setAttribute("autocomplete", "off");
  input.setAttribute("inputmode", "text");
  input.setAttribute("enterkeyhint", "enter");
  input.setAttribute("data-1p-ignore", "true");
  input.setAttribute("data-lpignore", "true");
  if (solved) input.readOnly = true;
  input.addEventListener("focus", () => {
    document.querySelectorAll(".slot.is-editing").forEach((node) => {
      if (node !== slot) clearEditingSlot(node);
    });
    focused = { house, attr };
    setSlotVisual(slot, house, attr, input.value, matchTypedItem(puzzle.items[attr], input.value).status);
    window.requestAnimationFrame(() => {
      sizeEditingSlot(slot);
      paintGhost(slot, input.value, matchTypedItem(puzzle.items[attr], input.value).status);
    });
  });
  input.addEventListener("blur", () => {
    window.setTimeout(() => {
      if (focused?.house === house && focused?.attr === attr) {
        focused = null;
        clearEditingSlot(slot);
        setSlotVisual(slot, house, attr, input.value, matchTypedItem(puzzle.items[attr], input.value).status);
      }
    }, 120);
  });
  input.addEventListener("input", () => handleTyped(house, attr, input.value, input));
  input.addEventListener("pointerup", (event) => {
    const completion = bestTypedCompletion(puzzle.items[attr], input.value);
    if (completion.status !== "partial") return;
    const typedWidth = typedPrefixWidth(input);
    const restStart = (input.clientWidth + typedWidth) / 2;
    if (event.offsetX > restStart) {
      event.preventDefault();
      tryAcceptGhost(house, attr, input);
    }
  });
  input.addEventListener("keydown", (event) => {
    const atEnd = input.selectionStart === input.value.length && input.selectionEnd === input.value.length;
    const acceptKey =
      event.key === "Tab" ||
      event.key === "Enter" ||
      (event.key === "ArrowRight" && atEnd);
    if (acceptKey && tryAcceptGhost(house, attr, input)) {
      event.preventDefault();
      if (event.key === "Enter") {
        const next = nextEmptySlot(house, attr);
        if (next) document.querySelector(`input[data-slot="${slotKey(next.house, next.attr)}"]`)?.focus();
      }
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    const next = nextEmptySlot(house, attr);
    if (!next) return;
    document.querySelector(`input[data-slot="${slotKey(next.house, next.attr)}"]`)?.focus();
  });
  slot.append(fit, ghost, input);
  applySlotFit(slot);
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
  resetTypingLayoutState();
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
    th.textContent = String(house + 1);
    th.setAttribute("aria-label", `House ${house + 1}`);
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
  table.appendChild(tbody);
  gridWrap.appendChild(table);

  const notesPanel = document.createElement("details");
  notesPanel.className = "notes-panel";
  notesPanel.open = isWidePlay();
  const notesToggle = document.createElement("summary");
  notesToggle.className = "notes-toggle";
  notesToggle.textContent = "Notes";
  notesToggle.setAttribute("aria-expanded", notesPanel.open ? "true" : "false");
  const sheet = document.createElement("div");
  sheet.className = "notes-sheet";
  sheet.setAttribute("aria-hidden", notesPanel.open ? "false" : "true");
  const sheetBar = document.createElement("div");
  sheetBar.className = "notes-sheet-bar";
  const handle = document.createElement("button");
  handle.type = "button";
  handle.className = "notes-sheet-handle";
  handle.setAttribute("aria-label", "Close notes");
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "icon-btn notes-sheet-close";
  closeBtn.setAttribute("aria-label", "Close notes");
  closeBtn.innerHTML = iconSvg("x", { label: "Close notes" });
  sheetBar.append(handle, closeBtn);
  const note = document.createElement("textarea");
  note.className = "notes";
  note.placeholder = "Jot your deductions here...";
  note.rows = 16;
  note.setAttribute("aria-label", "Notes");
  note.autocomplete = "off";
  note.spellcheck = true;
  note.value = notes;
  note.addEventListener("input", () => {
    notes = note.value;
    persist();
  });
  sheet.append(sheetBar, note);
  notesPanel.append(notesToggle, sheet);
  notesPanel.addEventListener("toggle", () => {
    if (isWidePlay()) notesPanel.open = true;
    notesToggle.setAttribute("aria-expanded", notesPanel.open ? "true" : "false");
    sheet.setAttribute("aria-hidden", notesPanel.open || isWidePlay() ? "false" : "true");
    if (notesPanel.open) notesPanel.classList.remove("is-closing");
    syncNotesViewport();
    fitPlayfield();
  });
  notesToggle.addEventListener("click", (event) => {
    if (isWidePlay() || !notesPanel.open) return;
    event.preventDefault();
    closeMobileNotes(notesPanel);
  });
  closeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMobileNotes(notesPanel);
  });
  bindNotesHandle(handle, notesPanel);

  const hintBlock = document.createElement("section");
  hintBlock.className = "hint-block";
  const hintHeading = document.createElement("div");
  hintHeading.className = "hint-heading";
  const hintLabel = document.createElement("p");
  hintLabel.className = "hint-label";
  hintLabel.textContent = "Hints";
  const hintBtn = document.createElement("button");
  hintBtn.type = "button";
  hintBtn.id = "btn-hint";
  hintBtn.className = "icon-btn hint-reveal";
  hintBtn.setAttribute("aria-label", "Reveal a cell");
  hintBtn.innerHTML = iconSvg("lightbulb", { label: "Reveal a cell" });
  hintHeading.append(hintLabel, hintBtn);
  hintBlock.appendChild(hintHeading);
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
    text.innerHTML = highlightItemWordsHtml(displayClueText(puzzle, clue), allItems());
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
  const puzzleCol = document.createElement("div");
  puzzleCol.className = "puzzle-col";
  puzzleCol.append(hintBlock, makeWordBank(), gridWrap);
  play.append(notesPanel, puzzleCol);
  board.appendChild(play);
  fitPlayfield();

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
      const slot = input.closest(".slot");
      if (slot) {
        setSlotVisual(slot, keep.house, keep.attr, input.value, matchTypedItem(puzzle.items[keep.attr], input.value).status);
      }
    }
  }
}

export function fitPlayfield() {
  if (!isWidePlay() && (isTypingInGrid() || typingCompactOn)) {
    return;
  }
  const play = document.querySelector(".play");
  if (!play || !puzzle) return;
  const root = document.documentElement;
  const mast = document.querySelector(".mast");
  const footer = document.querySelector(".site-footer");
  const notesPanel = play.querySelector(".notes-panel");
  const puzzleCol = play.querySelector(".puzzle-col");
  const mastH = Math.round(mast?.getBoundingClientRect().height || 96);
  const footerH = Math.round(footer?.getBoundingClientRect().height || 28);
  root.style.setProperty("--mast-h", `${mastH}px`);
  root.style.setProperty("--footer-h", `${footerH}px`);
  if (notesSheetOpen()) syncNotesViewport();
  else {
    root.style.setProperty("--keyboard-inset", "0px");
    root.style.removeProperty("--vv-height");
  }
  let availH = Math.max(220, (window.innerHeight || 720) - mastH - footerH - 16);
  const wide = isWidePlay();
  if (notesPanel) {
    if (wide) {
      notesPanel.open = true;
      notesPanel.dataset.desktop = "1";
    } else if (notesPanel.dataset.desktop === "1") {
      notesPanel.open = false;
      notesPanel.dataset.desktop = "";
    }
  }
  if (!wide && notesPanel?.open) {
    const sheet = notesPanel.querySelector(".notes-sheet");
    const sheetH = Math.round(sheet?.getBoundingClientRect().height || (window.innerHeight || 720) * 0.5);
    availH = Math.max(160, availH - sheetH - 8);
  }
  root.style.setProperty("--clue-cols", wide && puzzle.clues.length >= 6 ? "2" : "1");
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const standardClueSize = wide ? CLUE_SIZE_DESKTOP : CLUE_SIZE_PHONE;
  const standardCluePad = wide ? CLUE_PAD_DESKTOP : CLUE_PAD_PHONE;
  const px = (n) => `${Number(n.toFixed(2))}px`;
  const applyTiles = (t) => {
    const cellH = wide ? 30 + t * 28 : CELL_H_PHONE;
    const gap = wide ? 4 + t * 12 : 6;
    const inputSize = !wide || isIOS ? 16 : Math.max(16, 13 + t * 7);
    const notesSize = isIOS ? 16 : Math.max(16, 13 + t * 4);
    root.style.setProperty("--cell-h", px(cellH));
    root.style.setProperty("--play-gap", px(gap));
    root.style.setProperty("--input-size", px(inputSize));
    root.style.setProperty("--notes-size", px(notesSize));
    root.style.setProperty("--table-gap", px(wide ? 2 + t * 4 : 3));
  };
  const applyClues = (size, pad) => {
    root.style.setProperty("--clue-size", px(size));
    root.style.setProperty("--clue-pad", px(pad));
  };
  play.style.height = "auto";
  play.style.paddingBlock = "0px";
  applyClues(standardClueSize, standardCluePad);
  applyTiles(1);
  let lo = 0;
  let hi = 1;
  let best = 0;
  const measureEl = puzzleCol || play;
  const measureHeight = () => measureEl.scrollHeight || measureEl.getBoundingClientRect().height;
  for (let i = 0; i < 14; i += 1) {
    const mid = (lo + hi) / 2;
    applyTiles(mid);
    if (measureHeight() <= availH) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  applyTiles(best);
  if (best < 0.02 && measureHeight() > availH) {
    let loSize = CLUE_SIZE_FLOOR;
    let hiSize = standardClueSize;
    let bestSize = CLUE_SIZE_FLOOR;
    for (let i = 0; i < 12; i += 1) {
      const mid = (loSize + hiSize) / 2;
      applyClues(mid, standardCluePad * (mid / standardClueSize));
      if (measureHeight() <= availH) {
        bestSize = mid;
        loSize = mid;
      } else {
        hiSize = mid;
      }
    }
    applyClues(bestSize, standardCluePad * (bestSize / standardClueSize));
  }
  play.style.paddingBlock = "0px";
  if (wide) play.style.height = `${availH}px`;
  else play.style.height = "auto";
  fitAllSlots();
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
  if (!solved) showToast("One cell filled. Hint cost applied.");
}

function revealCheck() {
  const slots = [...document.querySelectorAll(".slot[data-slot]")];
  const reduced = prefersReducedMotion();
  slots.forEach((slot, index) => {
    const house = Number(slot.dataset.house);
    const attr = slot.dataset.attr;
    const ok = Boolean(grid[house]?.[attr] && grid[house][attr] === puzzle.solution[house]?.[attr]);
    const apply = () => {
      slot.classList.remove("is-correct", "is-wrong", "is-flip", "is-win");
      void slot.offsetWidth;
      slot.classList.add(ok ? "is-correct" : "is-wrong");
      if (!reduced) slot.classList.add("is-flip");
    };
    if (reduced) apply();
    else window.setTimeout(apply, index * 45);
  });
  return reduced ? 0 : slots.length * 45 + 420;
}

function bounceWinTiles() {
  document.querySelectorAll(".slot.is-correct").forEach((slot, index) => {
    slot.classList.remove("is-win");
    void slot.offsetWidth;
    slot.style.animationDelay = prefersReducedMotion() ? "0ms" : `${index * 40}ms`;
    slot.classList.add("is-win");
  });
}

function awardStreakIfNeeded() {
  if (isPractice() || streakAwarded) {
    const prev = readStreak();
    return prev.count || 0;
  }
  streakAwarded = true;
  persist();
  return writeStreak();
}

function showWinModal() {
  const streak = awardStreakIfNeeded();
  const share = $("btn-share");
  if (share) share.hidden = false;
  const shareText = $("share-text");
  if (shareText) shareText.textContent = shareBody();
  const winLede = $("win-lede");
  if (winLede) winLede.textContent = puzzle.question?.text || "";
  const time = $("win-time");
  const streakEl = $("win-streak");
  const hintsEl = $("win-hints");
  const scoreEl = $("win-score");
  if (time) time.textContent = formatTime(elapsedMs);
  if (streakEl) streakEl.textContent = String(streak);
  if (hintsEl) hintsEl.textContent = String(hints);
  if (scoreEl) scoreEl.textContent = String(scoreFor({ elapsedMs, mistakes, hints }));
  const win = $("win");
  if (win) win.hidden = false;
  paintMeta();
}

function maybeFinishIfSolved() {
  if (solved || !puzzle) return false;
  if (!placementComplete(grid, puzzle.houseCount, attributes())) return false;
  if (!gridMatchesSolution(grid, puzzle.solution)) return false;
  finish();
  return true;
}

function checkGrid() {
  if (solved) return;
  ensureTimer();
  if (!placementComplete(grid, puzzle.houseCount, attributes())) {
    document.querySelectorAll(".slot.is-empty").forEach(shakeSlot);
    showToast("Fill every slot first.");
    return;
  }
  const ok = gridMatchesSolution(grid, puzzle.solution);
  const delay = revealCheck();
  window.setTimeout(() => {
    if (!ok) {
      mistakes += 1;
      persist();
      haptic(30);
      document.querySelectorAll(".slot.is-wrong").forEach(shakeSlot);
      showToast("Not yet. That combination is off.");
      return;
    }
    finish({ revealed: true });
  }, delay);
}

function finish({ revealed = false } = {}) {
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
    persist();
  }
  focused = null;
  const afterReveal = () => {
    bounceWinTiles();
    showWinModal();
  };
  if (revealed) {
    afterReveal();
    return;
  }
  const delay = revealCheck();
  window.setTimeout(afterReveal, delay);
}

export async function loadPuzzle({ date, puzzle: given, practiceId } = {}) {
  if (given) {
    puzzle = given;
  } else if (practiceId) {
    const response = await fetch(`data/practice/${practiceId}.json`);
    if (!response.ok) throw new Error(`No practice puzzle ${practiceId}`);
    puzzle = await response.json();
  } else {
    const iso = date || localIsoDate();
    const response = await fetch(`data/plotted/${iso}.json`);
    if (!response.ok) throw new Error(`No puzzle for ${iso}`);
    puzzle = await response.json();
  }
  resetPlayState();
  restore();
  hideStartOverConfirm();
  const win = $("win");
  if (win) win.hidden = true;
  paintChrome();
  try {
    paintBoard();
  } catch (error) {
    console.error(error);
    showBoardError("Couldn’t draw today’s grid.");
    throw error;
  }
  const share = $("btn-share");
  if (share) share.hidden = !solved;
  if (!solved) maybeFinishIfSolved();
}

function bind() {
  if (bound) return;
  bound = true;
  window.addEventListener("resize", safeHandler(() => {
    if (notesSheetOpen()) {
      syncNotesViewport();
      return;
    }
    if (isTypingInGrid() || typingCompactOn) {
      scheduleTypingResize();
      return;
    }
    if (!shouldRefitLayout()) return;
    fitPlayfield();
  }));
  window.visualViewport?.addEventListener("resize", safeHandler(onTypingViewportResize));
  window.visualViewport?.addEventListener("scroll", safeHandler(onVisualViewportScroll));
  document.addEventListener("focusin", safeHandler((event) => {
    if (!isSlotInput(event.target)) return;
    syncTypingCompact(event);
  }));
  document.addEventListener("focusout", safeHandler((event) => {
    if (!isSlotInput(event.target)) return;
    syncTypingCompact(event);
  }));
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMobileNotes();
  });
  $("btn-help")?.addEventListener("click", () => {
    const howto = $("howto");
    if (howto) howto.open = !howto.open;
  });
  $("theme-toggle")?.addEventListener("click", () => {
    applyTheme(currentTheme() === "light" ? "dark" : "light");
  });
  document.addEventListener("click", (event) => {
    if (event.target.closest("#btn-hint")) useHint();
  });
  $("btn-check")?.addEventListener("click", checkGrid);
  $("btn-start-over")?.addEventListener("click", showStartOverConfirm);
  $("start-over-grid")?.addEventListener("click", () => startOver({ clearNotes: false }));
  $("start-over-all")?.addEventListener("click", () => startOver({ clearNotes: true }));
  $("start-over-cancel")?.addEventListener("click", hideStartOverConfirm);
  $("start-over")?.addEventListener("click", (event) => {
    if (event.target === $("start-over")) hideStartOverConfirm();
  });
  $("btn-share")?.addEventListener("click", copyShare);
  $("win-share")?.addEventListener("click", copyShare);
  $("win-close")?.addEventListener("click", () => {
    const win = $("win");
    if (win) win.hidden = true;
  });
  $("practice-nav")?.addEventListener("change", (event) => {
    const select = event.target.closest("#practice-select");
    if (!select) return;
    const id = select.value || "";
    const url = id ? `./?puzzle=${encodeURIComponent(id)}` : "./";
    history.pushState({ practiceId: id }, "", url);
    loadPuzzle(id ? { practiceId: id } : {}).catch((error) => {
      console.error(error);
      showBoardError(id ? "That practice puzzle isn’t on this build yet." : "Today’s puzzle isn’t on this build yet.");
    });
  });
  window.addEventListener("popstate", () => {
    const id = new URLSearchParams(window.location.search).get("puzzle");
    loadPuzzle(id ? { practiceId: id } : {}).catch((error) => {
      console.error(error);
      showBoardError("Couldn’t load that puzzle.");
    });
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

export async function boot(options = {}) {
  bind();
  const params = new URLSearchParams(window.location.search);
  const practiceId = options.practiceId || params.get("puzzle");
  try {
    if (options.puzzle) await loadPuzzle(options);
    else if (practiceId) await loadPuzzle({ practiceId });
    else await loadPuzzle(options);
  } catch (error) {
    console.error(error);
    showBoardError("Today’s puzzle isn’t on this build yet.");
  }
}
