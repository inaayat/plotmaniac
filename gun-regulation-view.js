import {
  activeRegulationBanners,
  checklistStatusClass,
  checklistStatusLabel,
  filterRegulationBeats,
  regulationToneClass,
  resolveChecklistAtYear,
  statsReadoutAtYear,
} from "./gun-regulation-model.js";
import { relationRideAt, relationRideLayout } from "./engine.js";

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
}) {
  const section = document.createElement("section");
  section.className = "regulation-board relation-ride";

  const beats = filterRegulationBeats(board.timeline, { kind: state.regKind || "" })
    .slice()
    .sort((a, b) => Number(a.year) - Number(b.year) || a.id.localeCompare(b.id));
  const layout = relationRideLayout(beats, { step: 260, pathHeight: 280, padX: 160 });

  section.appendChild(renderKindFilters(state.regKind, onKindFilter));

  const readout = document.createElement("div");
  readout.className = "relation-ride-readout regulation-ride-readout";
  const yearEl = document.createElement("p");
  yearEl.className = "relation-ride-year";
  const moodEl = document.createElement("p");
  moodEl.className = "relation-ride-mood";
  const eventEl = document.createElement("p");
  eventEl.className = "relation-ride-event";
  const summaryEl = document.createElement("p");
  summaryEl.className = "regulation-ride-summary";
  const linksEl = document.createElement("div");
  linksEl.className = "relation-ride-links";
  const hint = document.createElement("p");
  hint.className = "relation-ride-hint";
  hint.textContent = "Scroll sideways. The line rises when regulation tightens and falls when it loosens.";
  const tools = document.createElement("div");
  tools.className = "regulation-ride-tools";
  tools.appendChild(renderRegulationStats(board, state.year));
  const criteria = document.createElement("button");
  criteria.type = "button";
  criteria.className = "regulation-checklist-open";
  criteria.textContent = "Criteria";
  criteria.addEventListener("click", onToggleChecklist);
  tools.appendChild(criteria);
  readout.append(yearEl, moodEl, eventEl, summaryEl, linksEl, tools, hint);
  section.appendChild(readout);

  const stage = document.createElement("div");
  stage.className = "relation-ride-stage";
  const scroller = document.createElement("div");
  scroller.className = "relation-ride-scroll";
  scroller.tabIndex = 0;
  scroller.setAttribute("aria-label", "Gun regulation timeline. Scroll sideways.");
  const track = document.createElement("div");
  const cardTop = layout.pathHeight + 16;
  track.className = "relation-ride-track";
  track.style.width = `${Math.max(layout.width, 640)}px`;
  track.style.height = `${cardTop + 132}px`;
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

  const cards = layout.points.map((point) => {
    const beat = beats[point.index];
    const card = document.createElement("button");
    card.type = "button";
    card.className = `relation-ride-card ${regulationToneClass(point.tone)}`;
    card.style.left = `${point.x}px`;
    card.style.top = `${cardTop}px`;
    card.style.setProperty("--stem", `${Math.max(18, cardTop - point.y)}px`);
    const year = document.createElement("span");
    year.textContent = String(beat?.year || point.year);
    const text = document.createElement("p");
    text.textContent = beat?.event || point.event;
    card.append(year, text);
    card.addEventListener("click", () => {
      scroller.scrollTo({ left: point.x - scroller.clientWidth / 2, behavior: "smooth" });
    });
    track.appendChild(card);
    return card;
  });

  scroller.appendChild(track);
  stage.appendChild(scroller);
  section.appendChild(stage);

  let paintedYear = null;
  const paint = () => {
    const x = scroller.scrollLeft + scroller.clientWidth / 2;
    const here = relationRideAt(layout, x);
    marker.style.top = `${here.y}px`;
    marker.className = `regulation-ride-marker ${regulationToneClass(here.tone)}`;
    let nearest = layout.points[0];
    layout.points.forEach((point) => {
      if (!nearest || Math.abs(point.x - x) < Math.abs(nearest.x - x)) nearest = point;
    });
    if (!nearest) return;
    const beat = beats[nearest.index];
    yearEl.textContent = String(beat?.year || nearest.year);
    moodEl.textContent = rideLabel(here.tone);
    moodEl.dataset.mood = regulationToneClass(here.tone);
    eventEl.textContent = beat?.event || nearest.event;
    summaryEl.textContent = beat?.plainEnglish || "";
    linksEl.replaceChildren();
    if (beat?.links?.length) {
      const chips = document.createElement("div");
      chips.className = "relation-links beat-links";
      beat.links.forEach((link) => {
        const anchor = document.createElement("a");
        anchor.href = link.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = link.label;
        chips.appendChild(anchor);
      });
      linksEl.appendChild(chips);
    }
    cards.forEach((card, index) => {
      card.classList.toggle("is-now", layout.points[index] === nearest);
    });
    const year = Number(beat?.year || nearest.year);
    if (Number.isFinite(year) && year !== paintedYear) {
      paintedYear = year;
      onYearChange?.(year);
    }
  };

  scroller.addEventListener("scroll", paint, { passive: true });
  scroller.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    event.preventDefault();
    scroller.scrollLeft += event.deltaY;
  }, { passive: false });

  const anchor = layout.points.find((point) => Number(beats[point.index]?.year) >= Number(state.year))
    || layout.points.at(-1);
  requestAnimationFrame(() => {
    if (anchor) scroller.scrollLeft = Math.max(0, anchor.x - scroller.clientWidth / 2);
    paint();
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
