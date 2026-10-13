import { laneBands } from "./engine.js";

const ZOOM_MIN = 0.08;
const ZOOM_MAX = 2.5;
const LANE_AXIS_PAD = 28;

let laneZoom = 1;
let pendingLaneScroll = null;
let pendingLaneFocus = "";

export function getLaneZoom() {
  return laneZoom;
}

export function setLaneZoom(value) {
  laneZoom = clampZoom(value);
  return laneZoom;
}

export function queueLaneScroll(value) {
  pendingLaneScroll = value;
}

export function queueLaneFocus(id) {
  pendingLaneFocus = id || "";
}

export function takeLaneFocus() {
  const id = pendingLaneFocus;
  pendingLaneFocus = "";
  return id;
}

export function buildLaneChrome(note, {
  ariaLabel = "Timeline, oldest on the left. Drag to move. Hold Control and scroll to zoom.",
} = {}) {
  const view = document.createElement("div");
  view.className = "lane-view";

  const tools = document.createElement("div");
  tools.className = "lane-tools";
  const hint = document.createElement("p");
  hint.className = "rail-note";
  hint.textContent = note;
  const controls = document.createElement("div");
  controls.className = "lane-controls";
  controls.append(
    laneButton("Zoom out", "−", () => changeLaneZoom(view, getLaneZoom() / 1.2)),
    laneSlider(view),
    laneReadout(),
    laneButton("Zoom in", "+", () => changeLaneZoom(view, getLaneZoom() * 1.2)),
    laneButton("Fit the timeline to the width", "Fit", () => fitLaneWidth(view)),
  );
  tools.append(hint, controls);

  const scroller = document.createElement("div");
  scroller.className = "lane-scroll";
  scroller.tabIndex = 0;
  scroller.setAttribute("aria-label", ariaLabel);

  const sizer = document.createElement("div");
  sizer.className = "lane-sizer";
  const rail = document.createElement("ol");
  rail.className = "lane";
  sizer.appendChild(rail);
  scroller.appendChild(sizer);
  view.append(tools, scroller);
  bindLaneGestures(view);
  return { view, rail, scroller };
}

export function laneYear(year) {
  const stone = document.createElement("li");
  stone.className = "lane-year";
  const text = document.createElement("span");
  text.textContent = year;
  stone.appendChild(text);
  return stone;
}

function laneButton(label, text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lane-button";
  button.textContent = text;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function laneReadout() {
  const readout = document.createElement("span");
  readout.className = "lane-readout";
  readout.textContent = `${Math.round(laneZoom * 100)}%`;
  return readout;
}

function laneSlider(view) {
  const input = document.createElement("input");
  input.type = "range";
  input.className = "lane-zoom";
  input.min = String(Math.round(ZOOM_MIN * 100));
  input.max = String(Math.round(ZOOM_MAX * 100));
  input.value = String(Math.round(laneZoom * 100));
  input.setAttribute("aria-label", "Timeline zoom");
  input.addEventListener("input", () => {
    const scroller = view.querySelector(".lane-scroll");
    const rect = scroller.getBoundingClientRect();
    applyLaneZoom(view, Number(input.value) / 100, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  });
  return input;
}

function clampZoom(value) {
  const next = Math.round(Number(value) * 100) / 100;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
}

export function changeLaneZoom(view, zoom) {
  const scroller = view.querySelector(".lane-scroll");
  const rect = scroller.getBoundingClientRect();
  applyLaneZoom(view, zoom, {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  });
}

export function fitLaneWidth(view) {
  const scroller = view.querySelector(".lane-scroll");
  const rail = view.querySelector(".lane");
  rail.style.minWidth = "0px";
  const base = rail.scrollWidth;
  if (!base || !scroller.clientWidth) return;
  const rect = scroller.getBoundingClientRect();
  applyLaneZoom(view, scroller.clientWidth / base, {
    x: rect.left,
    y: rect.top + rect.height / 2,
  });
  scroller.scrollLeft = 0;
}

export function layoutLane(view) {
  if (!view.isConnected) return;
  const scroller = view.querySelector(".lane-scroll");
  const rail = view.querySelector(".lane");
  const height = scroller.clientHeight;
  if (height < 80) {
    requestAnimationFrame(() => layoutLane(view));
    return;
  }
  // Chronology posters stay at their authored size. A long cast list scrolls
  // inside the card instead of shrinking the artwork to fit the half-axis.
  if (rail.querySelector(".chrono-lane-event")) {
    layoutChronologyLane(view, scroller, rail, height);
    return;
  }
  // Keep the rail inside the visible scroller. Opening a beat moves the axis
  // and scales every card, including the open one, so the summary and sources
  // stay on screen instead of scrolling inside the beat.
  rail.style.setProperty("--lane-h", `${height}px`);
  rail.querySelectorAll(".lane-card").forEach(resetCardFit);

  const selected = rail.querySelector(".lane-event.is-selected");
  const selectedAbove = Boolean(selected?.classList.contains("side-above"));

  let aboveRoom = height / 2 - LANE_AXIS_PAD;
  let belowRoom = height / 2 - LANE_AXIS_PAD;
  if (!selected) {
    rail.style.setProperty("--lane-axis", "50%");
  } else {
    const selectedNeed = cardExtent(selected.querySelector(".lane-card"));
    const quietSide = selectedAbove ? ".side-below" : ".side-above";
    const quietNeed = tallestExtent(rail, quietSide);
    const { selectedBand, quietBand } = laneBands(height, selectedNeed, quietNeed);
    const axis = selectedAbove ? selectedBand : height - selectedBand;
    rail.style.setProperty("--lane-axis", `${axis}px`);
    aboveRoom = (selectedAbove ? selectedBand : quietBand) - LANE_AXIS_PAD;
    belowRoom = (selectedAbove ? quietBand : selectedBand) - LANE_AXIS_PAD;
  }

  let restScale = 1;
  rail.querySelectorAll(".lane-event:not(.is-selected)").forEach((event) => {
    const natural = event.querySelector(".lane-card")?.scrollHeight || 0;
    const room = event.classList.contains("side-above") ? aboveRoom : belowRoom;
    restScale = Math.min(restScale, fitScale(room, natural));
  });
  rail.querySelectorAll(".lane-event").forEach((event) => {
    const card = event.querySelector(".lane-card");
    if (!card) return;
    const above = event.classList.contains("side-above");
    const room = Math.max(0, above ? aboveRoom : belowRoom);
    if (event.classList.contains("is-selected")) {
      applyCardScale(card, fitScale(room, naturalHeight(card)), above);
      return;
    }
    applyCardScale(card, restScale, above);
  });

  applyLaneZoom(view, laneZoom);
  if (pendingLaneScroll) {
    scroller.scrollLeft = pendingLaneScroll.left;
    scroller.scrollTop = pendingLaneScroll.top;
    pendingLaneScroll = null;
  }
  if (pendingLaneFocus) {
    const focus = view.querySelector(".lane-event.is-selected");
    pendingLaneFocus = "";
    if (focus) focus.scrollIntoView({ inline: "center", block: "nearest" });
  }
}

function layoutChronologyLane(view, scroller, rail, height) {
  rail.style.setProperty("--lane-h", `${height}px`);
  rail.style.setProperty("--lane-axis", "50%");
  rail.querySelectorAll(".lane-card").forEach(resetCardFit);
  applyLaneZoom(view, laneZoom);
  if (pendingLaneScroll) {
    scroller.scrollLeft = pendingLaneScroll.left;
    scroller.scrollTop = pendingLaneScroll.top;
    pendingLaneScroll = null;
  }
  if (pendingLaneFocus) {
    const focus = view.querySelector(".lane-event.is-selected");
    pendingLaneFocus = "";
    if (focus) focus.scrollIntoView({ inline: "center", block: "nearest" });
  }
}

function naturalHeight(card) {
  if (!card) return 0;
  card.style.maxHeight = "none";
  card.style.overflow = "visible";
  card.style.transform = "none";
  return card.scrollHeight;
}

function cardExtent(card) {
  return naturalHeight(card) + LANE_AXIS_PAD;
}

function tallestExtent(rail, selector) {
  let tallest = 0;
  rail.querySelectorAll(`${selector} .lane-card`).forEach((card) => {
    tallest = Math.max(tallest, card.scrollHeight);
  });
  return tallest + LANE_AXIS_PAD;
}

function fitScale(room, natural) {
  if (!(natural > 0) || natural <= room) return 1;
  return Math.max(0.01, (room - 1) / natural);
}

function resetCardFit(card) {
  card.style.transform = "";
  card.style.transformOrigin = "";
  card.style.maxHeight = "";
  card.style.overflow = "";
}

function applyCardScale(card, scale, above) {
  card.style.maxHeight = "none";
  card.style.overflow = "visible";
  if (scale < 0.999) {
    card.style.transformOrigin = above ? "bottom center" : "top center";
    card.style.transform = `scale(${scale.toFixed(4)})`;
  }
}

export function applyLaneZoom(view, zoom, anchor) {
  const scroller = view.querySelector(".lane-scroll");
  const rail = view.querySelector(".lane");
  const sizer = view.querySelector(".lane-sizer");
  if (!scroller || !rail || !sizer) return;
  const prev = Number(view.dataset.zoom || laneZoom || 1) || 1;
  laneZoom = clampZoom(zoom);
  rail.style.minWidth = "0px";
  const contentW = rail.scrollWidth;
  const minW = Math.max(contentW, scroller.clientWidth / laneZoom);
  rail.style.minWidth = `${minW}px`;
  const baseW = rail.offsetWidth;
  const baseH = rail.offsetHeight;
  const rect = scroller.getBoundingClientRect();
  const originX = anchor ? anchor.x - rect.left : rect.width / 2;
  const originY = anchor ? anchor.y - rect.top : rect.height / 2;
  const contentX = (scroller.scrollLeft + originX) / prev;
  const contentY = (scroller.scrollTop + originY) / prev;
  sizer.style.width = `${Math.ceil(baseW * laneZoom)}px`;
  sizer.style.height = `${Math.ceil(baseH * laneZoom)}px`;
  rail.style.transform = `scale(${laneZoom})`;
  view.dataset.zoom = String(laneZoom);
  scroller.scrollLeft = contentX * laneZoom - originX;
  scroller.scrollTop = contentY * laneZoom - originY;
  const slider = view.querySelector(".lane-zoom");
  const readout = view.querySelector(".lane-readout");
  const percent = String(Math.round(laneZoom * 100));
  if (slider && document.activeElement !== slider) slider.value = percent;
  if (readout) readout.textContent = `${percent}%`;
}

function laneCardCanScroll(event) {
  const card = event.target?.closest?.(".lane-card");
  if (!card || event.shiftKey) return false;
  return card.scrollHeight > card.clientHeight + 4 && Math.abs(event.deltaY) >= Math.abs(event.deltaX);
}

export function bindLaneGestures(view) {
  const scroller = view.querySelector(".lane-scroll");
  let suppressClick = false;
  scroller.addEventListener("wheel", (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0016);
      applyLaneZoom(view, laneZoom * factor, { x: event.clientX, y: event.clientY });
      return;
    }
    if (laneCardCanScroll(event)) return;
    if (scroller.scrollWidth <= scroller.clientWidth + 1) return;
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const delta = horizontal ? event.deltaX : event.deltaY;
    if (!delta) return;
    event.preventDefault();
    scroller.scrollLeft += delta;
  }, { passive: false });

  let pan = null;
  scroller.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.pointerType !== "mouse") return;
    if (event.target.closest("input, a, .lane-controls")) return;
    pan = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
      armed: false,
    };
  });
  scroller.addEventListener("pointermove", (event) => {
    if (!pan || event.pointerId !== pan.id) return;
    const dx = event.clientX - pan.x;
    const dy = event.clientY - pan.y;
    if (!pan.armed) {
      if (Math.hypot(dx, dy) < 6) return;
      pan.armed = true;
      scroller.setPointerCapture(event.pointerId);
      scroller.classList.add("is-panning");
    }
    scroller.scrollLeft = pan.left - dx;
    scroller.scrollTop = pan.top - dy;
  });
  const endPan = (event) => {
    if (!pan || event.pointerId !== pan.id) return;
    if (pan.armed) suppressClick = true;
    pan = null;
    scroller.classList.remove("is-panning");
  };
  scroller.addEventListener("pointerup", endPan);
  scroller.addEventListener("pointercancel", endPan);
  scroller.addEventListener("click", (event) => {
    if (!suppressClick) return;
    suppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
}
