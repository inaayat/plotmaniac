import {
  activeRegulationBanners,
  checklistStatusClass,
  checklistStatusLabel,
  filterRegulationBeats,
  regulationToneClass,
  resolveChecklistAtYear,
  statsReadoutAtYear,
} from "./gun-regulation-model.js";
import { relationRideAt, relationRideLayoutForViewport } from "./engine.js";
import { paintRelationRideFrame } from "./relation-ride-frame.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function rideLabel(tone) {
  if (tone >= 1.25) return "Tight";
  if (tone >= 0.4) return "Tighter";
  if (tone > -0.4) return "Mixed";
  if (tone > -1.25) return "Looser";
  return "Loose";
}

function formatStat(value) {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : String(number);
}

export function renderRegulationBoard({
  plot,
  board,
  state,
  isCompact,
  onKindFilter,
  onToggleChecklist,
  onCloseChecklist,
  onYearChange,
  onSelectBeat,
}) {
  const section = document.createElement("section");
  section.className = "regulation-board relation-ride";

  const beats = filterRegulationBeats(board.timeline, { kind: state.regKind || "" })
    .slice()
    .sort((a, b) => Number(a.year) - Number(b.year) || a.id.localeCompare(b.id));
  const rideOptions = { step: 260, pathHeight: 176, padX: 160 };
  let layout = relationRideLayoutForViewport(beats, window.innerWidth, rideOptions);

  section.appendChild(renderKindFilters(state.regKind, onKindFilter));

  const readout = document.createElement("div");
  readout.className = "relation-ride-readout regulation-ride-readout";
  const yearEl = document.createElement("p");
  yearEl.className = "relation-ride-year";
  const moodEl = document.createElement("p");
  moodEl.className = "relation-ride-mood";
  const eventEl = document.createElement("p");
  eventEl.className = "relation-ride-event";
  const linksEl = document.createElement("div");
  linksEl.className = "relation-ride-links relation-links beat-links";
  const changeEl = document.createElement("p");
  changeEl.className = "regulation-change";
  const nav = document.createElement("div");
  nav.className = "regulation-case-nav";
  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "regulation-case-step";
  prev.textContent = "Previous case";
  const counter = document.createElement("span");
  counter.className = "regulation-case-count";
  const next = document.createElement("button");
  next.type = "button";
  next.className = "regulation-case-step";
  next.textContent = "Next case";
  nav.append(prev, counter, next);
  const hint = document.createElement("p");
  hint.className = "relation-ride-hint";
  hint.textContent = "Step case by case. The line rises when regulation tightens and falls when it loosens.";
  const tools = document.createElement("div");
  tools.className = "regulation-ride-tools";
  tools.appendChild(renderRegulationStats(board, state.year));
  const criteria = document.createElement("button");
  criteria.type = "button";
  criteria.className = "regulation-checklist-open";
  criteria.textContent = "Criteria";
  criteria.addEventListener("click", onToggleChecklist);
  tools.appendChild(criteria);
  readout.append(yearEl, moodEl, eventEl, changeEl, linksEl, nav, tools, hint);
  section.appendChild(readout);

  const stage = document.createElement("div");
  stage.className = "relation-ride-stage";
  const scroller = document.createElement("div");
  scroller.className = "relation-ride-scroll";
  scroller.tabIndex = 0;
  scroller.setAttribute("aria-label", "Gun regulation timeline. Scroll sideways.");
  const track = document.createElement("div");
  const cardTop = layout.pathHeight + 8;
  const cardBand = 124;
  track.className = "relation-ride-track";
  track.style.background = `linear-gradient(180deg, rgba(74, 127, 212, 0.18), rgba(212, 160, 23, 0.16) ${layout.pathHeight}px, transparent ${layout.pathHeight}px)`;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "relation-ride-svg");
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.pathHeight}`);
  svg.setAttribute("width", String(layout.width));
  svg.setAttribute("height", String(layout.pathHeight));
  const sky = document.createElementNS(SVG_NS, "rect");
  sky.setAttribute("class", "relation-ride-sky");
  sky.setAttribute("width", String(layout.width));
  sky.setAttribute("height", String(layout.pathHeight));
  const zero = document.createElementNS(SVG_NS, "line");
  zero.setAttribute("class", "relation-ride-zero");
  zero.setAttribute("x1", "0");
  zero.setAttribute("x2", String(layout.width));
  zero.setAttribute("y1", String(layout.zeroY));
  zero.setAttribute("y2", String(layout.zeroY));
  const trail = document.createElementNS(SVG_NS, "path");
  trail.setAttribute("class", "relation-ride-path");
  trail.setAttribute("d", layout.path);
  svg.append(sky, zero, trail);
  layout.points.forEach((point) => {
    const mark = document.createElementNS(SVG_NS, "circle");
    mark.setAttribute("class", "relation-ride-mark");
    mark.setAttribute("cx", String(point.x));
    mark.setAttribute("cy", String(point.y));
    mark.setAttribute("r", "4");
    svg.appendChild(mark);
  });
  track.appendChild(svg);

  const marker = document.createElement("div");
  marker.className = "regulation-ride-marker";
  marker.setAttribute("aria-hidden", "true");
  stage.appendChild(marker);

  const cards = layout.points.map((point, index) => {
    const beat = beats[point.index];
    const card = document.createElement("button");
    card.type = "button";
    card.className = `relation-ride-card ${regulationToneClass(point.tone)}`;
    const year = document.createElement("span");
    year.textContent = String(beat?.year || point.year);
    const text = document.createElement("p");
    text.textContent = beat?.event || point.event;
    card.append(year, text);
    card.addEventListener("click", () => {
      show(index, { scroll: true });
    });
    track.appendChild(card);
    return card;
  });
  const marks = [...svg.querySelectorAll(".relation-ride-mark")];
  const frame = { track, svg, sky, zero, trail, marks, cards, cardTop, cardBand };
  paintRelationRideFrame({ ...frame, layout });

  scroller.appendChild(track);
  stage.appendChild(scroller);
  section.appendChild(stage);

  let active = 0;
  let stepping = false;
  let paintedYear = null;
  let paintedId = "";

  function show(index, { scroll = false } = {}) {
    if (!layout.points.length) return;
    const nextIndex = Math.max(0, Math.min(layout.points.length - 1, index));
    const point = layout.points[nextIndex];
    const beat = beats[point.index];
    active = nextIndex;
    const hereTone = typeof beat?.tone === "number" ? beat.tone : point.tone;
    marker.style.top = `${point.y}px`;
    marker.className = `regulation-ride-marker ${regulationToneClass(hereTone)}`;
    yearEl.textContent = String(beat?.year || point.year);
    moodEl.textContent = rideLabel(hereTone);
    moodEl.dataset.mood = regulationToneClass(hereTone);
    eventEl.textContent = beat?.event || point.event;
    changeEl.replaceChildren();
    const label = document.createElement("em");
    label.textContent = "What changed";
    changeEl.append(label, document.createTextNode(` ${beat?.changed || beat?.plainEnglish || ""}`));
    linksEl.replaceChildren();
    (beat?.links || []).forEach((link) => {
      const anchor = document.createElement("a");
      anchor.href = link.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = link.label;
      linksEl.appendChild(anchor);
    });
    counter.textContent = `Case ${nextIndex + 1} of ${layout.points.length}`;
    prev.disabled = nextIndex === 0;
    next.disabled = nextIndex === layout.points.length - 1;
    cards.forEach((card, cardIndex) => card.classList.toggle("is-now", cardIndex === nextIndex));
    if (scroll) {
      stepping = true;
      scroller.scrollTo({ left: Math.max(0, point.x - scroller.clientWidth / 2), behavior: "smooth" });
      window.setTimeout(() => {
        stepping = false;
      }, 450);
    }
    const year = Number(beat?.year || point.year);
    if (Number.isFinite(year) && year !== paintedYear) {
      paintedYear = year;
      onYearChange?.(year);
    }
    if (beat?.id && beat.id !== paintedId) {
      paintedId = beat.id;
      onSelectBeat?.(beat.id);
    }
  }

  prev.addEventListener("click", () => show(active - 1, { scroll: true }));
  next.addEventListener("click", () => show(active + 1, { scroll: true }));

  const paint = () => {
    const x = scroller.scrollLeft + scroller.clientWidth / 2;
    const here = relationRideAt(layout, x);
    marker.style.top = `${here.y}px`;
    marker.className = `regulation-ride-marker ${regulationToneClass(here.tone)}`;
    if (stepping) return;
    let nearestIndex = 0;
    layout.points.forEach((point, index) => {
      if (Math.abs(point.x - x) < Math.abs(layout.points[nearestIndex].x - x)) nearestIndex = index;
    });
    if (nearestIndex !== active) show(nearestIndex);
    else {
      moodEl.textContent = rideLabel(here.tone);
      moodEl.dataset.mood = regulationToneClass(here.tone);
    }
  };

  scroller.addEventListener("scroll", paint, { passive: true });
  scroller.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    event.preventDefault();
    scroller.scrollLeft += event.deltaY;
  }, { passive: false });
  scroller.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      show(active + 1, { scroll: true });
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      show(active - 1, { scroll: true });
    }
  });

  const fromId = layout.points.findIndex((point) => beats[point.index]?.id === state.eventId);
  const fromYear = layout.points.findIndex((point) => Number(beats[point.index]?.year) >= Number(state.year));
  const start = fromId >= 0 ? fromId : (fromYear >= 0 ? fromYear : Math.max(0, layout.points.length - 1));

  function refit() {
    if (!scroller.isConnected) return;
    const clientWidth = scroller.clientWidth || window.innerWidth;
    const tallest = cards.reduce((max, card) => Math.max(max, card.offsetHeight), 0);
    const available = scroller.clientHeight;
    const pathHeight = available && tallest
      ? Math.max(120, Math.min(rideOptions.pathHeight, available - tallest - 16))
      : rideOptions.pathHeight;
    const next = relationRideLayoutForViewport(beats, clientWidth, { ...rideOptions, pathHeight });
    frame.cardTop = next.pathHeight + 8;
    if (next.padX === layout.padX && next.width === layout.width && next.pathHeight === layout.pathHeight) return;
    layout = next;
    track.style.background = `linear-gradient(180deg, rgba(74, 127, 212, 0.18), rgba(212, 160, 23, 0.16) ${layout.pathHeight}px, transparent ${layout.pathHeight}px)`;
    paintRelationRideFrame({ ...frame, layout });
    const point = layout.points[active];
    if (!point) return;
    stepping = true;
    scroller.scrollLeft = Math.max(0, point.x - clientWidth / 2);
    window.setTimeout(() => {
      stepping = false;
    }, 60);
  }

  const onResize = () => {
    if (!scroller.isConnected) {
      window.removeEventListener("resize", onResize);
      return;
    }
    refit();
  };
  window.addEventListener("resize", onResize);
  requestAnimationFrame(() => {
    refit();
    show(start, { scroll: true });
  });

  const panel = renderChecklistPanel(board, state, onCloseChecklist);
  section.appendChild(panel);
  if (state.checklistOpen) {
    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "drawer-scrim";
    scrim.setAttribute("aria-label", "Close checklist");
    scrim.addEventListener("click", onCloseChecklist);
    panel.before(scrim);
  }

  return section;
}

function renderKindFilters(activeKind, onKindFilter) {
  const bar = document.createElement("div");
  bar.className = "region-bar regulation-kind-bar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Filter timeline beats");
  const all = document.createElement("button");
  all.type = "button";
  all.className = "region-toggle";
  all.textContent = "All";
  all.classList.toggle("is-open", !activeKind);
  all.setAttribute("aria-pressed", String(!activeKind));
  all.addEventListener("click", () => onKindFilter(""));
  bar.appendChild(all);
  ["scotus", "statute", "agency", "state"].forEach((kind) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "region-toggle";
    button.textContent = kind === "scotus" ? "SCOTUS" : kind[0].toUpperCase() + kind.slice(1);
    button.classList.toggle("is-open", activeKind === kind);
    button.setAttribute("aria-pressed", String(activeKind === kind));
    button.addEventListener("click", () => onKindFilter(kind));
    bar.appendChild(button);
  });
  return bar;
}

export function renderRegulationStats(board, year) {
  const wrap = document.createElement("div");
  wrap.className = "regulation-stats-grid";
  const readouts = statsReadoutAtYear(board.stats, year);
  readouts.forEach(({ series, point, measures, missing }) => {
    if (measures) {
      measures.forEach(({ measure, point: pt }) => {
        wrap.appendChild(statFigure(
          missing || !pt ? null : pt.value,
          measure.id === "homicide" ? "hom" : "sui",
          `${measure.label} per 100,000`,
        ));
      });
      return;
    }
    const caption = series.id === "guns-per-capita" ? "/100" : "guns";
    wrap.appendChild(statFigure(missing || !point ? null : point.value, caption, series.label));
  });
  return wrap;
}

function statFigure(value, caption, title) {
  const figure = document.createElement("p");
  figure.className = "regulation-stat-figure";
  figure.classList.toggle("is-empty", value == null);
  figure.title = title;
  const number = document.createElement("span");
  number.textContent = formatStat(value);
  const label = document.createElement("em");
  label.textContent = caption;
  figure.append(number, label);
  return figure;
}

function renderChecklistPanel(board, state, onCloseChecklist) {
  const panel = document.createElement("aside");
  panel.className = "relation-drawer regulation-checklist";
  panel.hidden = !state.checklistOpen;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Ownership criteria checklist");

  const close = document.createElement("button");
  close.type = "button";
  close.className = "drawer-close";
  close.textContent = "Close";
  close.addEventListener("click", onCloseChecklist);

  const head = document.createElement("div");
  head.className = "drawer-head";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `Federal baseline · ${state.year}`;
  const title = document.createElement("h2");
  title.textContent = "Ownership criteria";
  copy.append(eyebrow, title);
  head.appendChild(copy);
  panel.append(close, head);

  activeRegulationBanners(board.banners, state.year).forEach((banner) => {
    const box = document.createElement("div");
    box.className = "regulation-banner";
    const heading = document.createElement("h3");
    heading.textContent = banner.title;
    const text = document.createElement("p");
    text.textContent = banner.plainEnglish;
    box.append(heading, text);
    panel.appendChild(box);
  });

  const list = document.createElement("ol");
  list.className = "regulation-checklist-rows";
  resolveChecklistAtYear(board.checklistRows, board.federalKeyframes, null, state.year).forEach(({ row, cell }) => {
    const item = document.createElement("li");
    item.className = checklistStatusClass(cell.status);
    const label = document.createElement("strong");
    label.textContent = row.label;
    const status = document.createElement("span");
    status.className = "regulation-check-status";
    status.textContent = checklistStatusLabel(cell.status);
    const note = document.createElement("p");
    note.textContent = cell.plainEnglish;
    item.append(label, status, note);
    list.appendChild(item);
  });
  panel.appendChild(list);
  return panel;
}

export function syncRegulationBoardDom(board, state, root = document) {
  const stats = root.querySelector(".regulation-stats-grid");
  if (stats) stats.replaceWith(renderRegulationStats(board, state.year));
  const panel = root.querySelector(".regulation-checklist");
  if (!panel) return;
  const list = panel.querySelector(".regulation-checklist-rows");
  if (list) {
    list.replaceChildren();
    resolveChecklistAtYear(board.checklistRows, board.federalKeyframes, null, state.year).forEach(({ row, cell }) => {
      const item = document.createElement("li");
      item.className = checklistStatusClass(cell.status);
      const label = document.createElement("strong");
      label.textContent = row.label;
      const status = document.createElement("span");
      status.className = "regulation-check-status";
      status.textContent = checklistStatusLabel(cell.status);
      const note = document.createElement("p");
      note.textContent = cell.plainEnglish;
      item.append(label, status, note);
      list.appendChild(item);
    });
  }
  const eyebrow = panel.querySelector(".eyebrow");
  if (eyebrow) eyebrow.textContent = `Federal baseline · ${state.year}`;
  panel.querySelectorAll(".regulation-banner").forEach((node) => node.remove());
  const anchor = panel.querySelector(".regulation-checklist-rows");
  activeRegulationBanners(board.banners, state.year).forEach((banner) => {
    const box = document.createElement("div");
    box.className = "regulation-banner";
    const heading = document.createElement("h3");
    heading.textContent = banner.title;
    const text = document.createElement("p");
    text.textContent = banner.plainEnglish;
    box.append(heading, text);
    anchor?.before(box);
  });
}
