import {
  COMPACT_MAX_WIDTH,
  chronologyById,
  chronologyFilterLabel,
  chronologyPosterUrl,
  chronologyRailPosterSize,
  chronologyWatchBefore,
  chronologyWatchNext,
  movieWebLayout,
} from "./engine.js";
import { buildLaneChrome, laneYear, layoutLane, queueLaneFocus } from "./lane.js";

function posterAcronym(title) {
  const words = String(title || "").replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function swapFocusPane(root, render) {
  const pane = root.querySelector(".chrono-focus-layout");
  if (!pane || prefersReducedMotion() || !document.startViewTransition) {
    render();
    return;
  }
  document.startViewTransition(() => render());
}

export function renderMarvelChronology({
  chronology,
  peopleById,
  focusId,
  onFocus,
  onOpenPerson,
  avatar,
}) {
  const section = document.createElement("section");
  section.className = "focus marvel-chronology";
  const index = chronologyById(chronology);
  const titles = chronology.titles || [];
  let activeId = focusId || titles[0]?.id;
  if (!activeId) {
    section.appendChild(emptyBlock("No chronology titles loaded."));
    return section;
  }

  const focusHost = document.createElement("div");
  focusHost.className = "chrono-focus-host";
  section.appendChild(focusHost);

  const paintFocus = () => {
    const entry = index.get(activeId) || titles[0];
    if (!entry) return;
    focusHost.replaceChildren(buildFocusLayout({
      entry,
      chronology,
      index,
      peopleById,
      onFocus: setFocus,
      onOpenPerson,
      avatar,
    }));
    requestAnimationFrame(() => {
      fitChronoRails(focusHost.querySelector(".chrono-focus-layout"));
    });
  };

  const setFocus = (id, { pushState = true } = {}) => {
    const next = index.get(id);
    if (!next) return;
    activeId = id;
    swapFocusPane(focusHost, paintFocus);
    if (pushState) onFocus(id);
  };

  const ro = new ResizeObserver(() => {
    fitChronoRails(focusHost.querySelector(".chrono-focus-layout"));
  });
  ro.observe(focusHost);

  paintFocus();
  return section;
}

export function renderMarvelChronologyIndex({
  chronology,
  peopleById,
  focusId,
  onFocus,
  onOpenPerson,
  avatar,
}) {
  const titles = chronology?.titles || [];
  const compact = Boolean(window.matchMedia?.(`(max-width: ${COMPACT_MAX_WIDTH}px)`)?.matches);
  if (compact) {
    return renderChronologySpine({ titles, peopleById, focusId, onFocus, onOpenPerson, avatar });
  }
  return renderChronologyLane({ titles, peopleById, focusId, onFocus, onOpenPerson, avatar });
}

export function renderMarvelMovieWeb({
  chronology,
  focusId,
  onFocus,
}) {
  const section = document.createElement("section");
  section.className = "movie-web";
  const titles = chronology?.titles || [];
  if (!titles.length) {
    section.appendChild(emptyBlock("No chronology titles loaded."));
    return section;
  }
  const narrow = Boolean(window.matchMedia?.("(max-width: 720px)")?.matches);
  const medium = Boolean(window.matchMedia?.("(max-width: 1100px)")?.matches);
  const columns = narrow ? 2 : medium ? 3 : 5;
  const layout = movieWebLayout(titles, {
    columns,
    posterW: narrow ? 168 : 188,
    posterH: narrow ? 252 : 282,
  });
  const byId = new Map(layout.nodes.filter((node) => node.type === "title").map((node) => [node.id, node]));
  const note = document.createElement("p");
  note.className = "movie-web-note";
  note.textContent = "How the films tie together. A line means the earlier title sets up the later one. Click a poster to open it in Watch Order.";
  const scroller = document.createElement("div");
  scroller.className = "movie-web-scroll";
  const stage = document.createElement("div");
  stage.className = "movie-web-stage";
  stage.style.width = `${layout.width}px`;
  stage.style.height = `${layout.height}px`;
  stage.style.setProperty("--movie-web-poster-h", `${layout.posterH}px`);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "movie-web-edges");
  svg.setAttribute("width", String(layout.width));
  svg.setAttribute("height", String(layout.height));
  svg.setAttribute("aria-hidden", "true");
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "movie-web-arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("refX", "8");
  marker.setAttribute("refY", "5");
  marker.setAttribute("orient", "auto");
  const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
  head.setAttribute("d", "M0 0 L10 5 L0 10 Z");
  head.setAttribute("fill", "rgba(232, 196, 122, 0.92)");
  marker.appendChild(head);
  defs.appendChild(marker);
  svg.appendChild(defs);
  layout.edges.forEach((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("class", "movie-web-edge");
    const x1 = from.x + from.w / 2;
    const y1 = from.y + from.h;
    const x2 = to.x + to.w / 2;
    const y2 = to.y;
    const bend = Math.max(36, Math.abs(y2 - y1) * 0.35);
    path.setAttribute("marker-end", "url(#movie-web-arrow)");
    path.setAttribute("d", `M${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`);
    svg.appendChild(path);
  });
  stage.appendChild(svg);

  layout.nodes.forEach((node) => {
    if (node.type === "era") {
      const label = document.createElement("p");
      label.className = "movie-web-era";
      label.textContent = node.era;
      label.style.left = `${node.x}px`;
      label.style.top = `${node.y}px`;
      stage.appendChild(label);
      return;
    }
    const entry = titles.find((item) => item.id === node.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `movie-web-card${node.id === focusId ? " is-active" : ""}`;
    button.style.left = `${node.x}px`;
    button.style.top = `${node.y}px`;
    button.style.width = `${node.w}px`;
    button.setAttribute("aria-label", `Open ${node.title} in Watch Order`);
    if (entry) button.appendChild(posterTile(entry, { size: "web" }));
    const caption = document.createElement("span");
    caption.className = "movie-web-title";
    caption.textContent = node.title;
    button.appendChild(caption);
    button.addEventListener("click", () => onFocus(node.id));
    stage.appendChild(button);
  });

  scroller.appendChild(stage);
  section.append(note, scroller);
  return section;
}

function renderChronologyLane({ titles, peopleById, focusId, onFocus, onOpenPerson, avatar }) {
  const section = document.createElement("section");
  section.className = "focus marvel-chronology marvel-chronology-lane lane-page";
  if (!titles.length) {
    section.appendChild(emptyBlock("No chronology titles loaded."));
    return section;
  }
  const { view, rail } = buildLaneChrome(
    "MCU + Mutant Legacy, oldest on the left. Scroll or drag. Pick a title to open it in Watch Order.",
    { ariaLabel: "Chronological timeline, oldest on the left. Drag to move. Hold Control and scroll to zoom." },
  );
  let era = "";
  let step = 0;
  titles.forEach((entry, order) => {
    if (entry.era && entry.era !== era) {
      era = entry.era;
      rail.appendChild(laneYear(entry.era));
    }
    const side = step % 2 === 0 ? "above" : "below";
    step += 1;
    rail.appendChild(chronologyLaneEvent(entry, {
      order: order + 1,
      side,
      active: entry.id === focusId,
      peopleById,
      onFocus,
      onOpenPerson,
      avatar,
    }));
  });
  section.appendChild(view);
  if (focusId) queueLaneFocus(focusId);
  requestAnimationFrame(() => layoutLane(view));
  return section;
}

function chronologyLaneEvent(entry, { order, side, active, peopleById, onFocus, onOpenPerson, avatar }) {
  const item = document.createElement("li");
  item.className = `lane-event side-${side} chrono-lane-event${active ? " is-selected" : ""}`;
  item.id = `beat-${entry.id}`;
  item.dataset.id = entry.id;

  const card = document.createElement("div");
  card.className = "lane-card";

  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "lane-hit chrono-lane-hit";
  hit.setAttribute("aria-label", `Focus ${chronologyFilterLabel(entry)} in Watch Order`);
  if (active) hit.setAttribute("aria-current", "true");
  const num = document.createElement("em");
  num.textContent = String(order);
  const rule = document.createElement("span");
  rule.className = "lane-rule";
  const heading = document.createElement("strong");
  heading.textContent = chronologyFilterLabel(entry);
  hit.append(posterTile(entry, { size: "lane" }), num, rule, heading);
  if (entry.era) {
    const era = document.createElement("em");
    era.textContent = entry.era;
    hit.appendChild(era);
  }
  hit.addEventListener("click", () => onFocus(entry.id));
  card.appendChild(hit);
  card.appendChild(castRow(entry, { peopleById, onOpenPerson, avatar, compact: true }));

  const dot = document.createElement("span");
  dot.className = "lane-dot";
  dot.setAttribute("aria-hidden", "true");
  item.append(card, dot);
  return item;
}

function renderChronologySpine({ titles, peopleById, focusId, onFocus, onOpenPerson, avatar }) {
  const section = document.createElement("section");
  section.className = "focus marvel-chronology marvel-chronology-lane";
  const view = document.createElement("div");
  view.className = "spine-view";
  const hint = document.createElement("p");
  hint.className = "rail-note";
  hint.textContent = "MCU + Mutant Legacy, oldest at the top. Pick a title to open it in Watch Order.";
  const rail = document.createElement("ol");
  rail.className = "spine chrono-story";
  rail.setAttribute("aria-label", "Chronological timeline, oldest at the top.");
  let era = "";
  titles.forEach((entry, order) => {
    if (entry.era && entry.era !== era) {
      era = entry.era;
      const stone = document.createElement("li");
      stone.className = "spine-year";
      const text = document.createElement("span");
      text.textContent = entry.era;
      stone.appendChild(text);
      rail.appendChild(stone);
    }
    rail.appendChild(chronologySpineEvent(entry, {
      order: order + 1,
      active: entry.id === focusId,
      peopleById,
      onFocus,
      onOpenPerson,
      avatar,
    }));
  });
  view.append(hint, rail);
  section.appendChild(view);
  return section;
}

function chronologySpineEvent(entry, { order, active, peopleById, onFocus, onOpenPerson, avatar }) {
  const item = document.createElement("li");
  item.className = `chrono-story-card${active ? " is-active" : ""}`;
  item.dataset.id = entry.id;
  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "chrono-story-hit";
  hit.setAttribute("aria-label", `Focus ${chronologyFilterLabel(entry)} in Watch Order`);
  if (active) hit.setAttribute("aria-current", "true");
  const copy = document.createElement("span");
  copy.className = "chrono-spine-copy";
  const num = document.createElement("span");
  num.className = "chrono-spine-num";
  num.textContent = String(order);
  const name = document.createElement("span");
  name.className = "chrono-spine-title";
  name.textContent = chronologyFilterLabel(entry);
  copy.append(num, name);
  hit.append(posterTile(entry, { size: "md" }), copy);
  hit.addEventListener("click", () => onFocus(entry.id));
  item.append(hit, castRow(entry, { peopleById, onOpenPerson, avatar, compact: true }));
  return item;
}

function buildFocusLayout({ entry, chronology, index, peopleById, onFocus, onOpenPerson, avatar }) {
  const layout = document.createElement("div");
  layout.className = "chrono-focus-layout";
  layout.style.viewTransitionName = "chrono-focus";

  const before = chronologyWatchBefore(entry, index);
  const next = chronologyWatchNext(chronology, entry.id);
  const railCount = Math.max(before.length, next.length, 1);
  layout.dataset.railCount = String(railCount);
  layout.style.setProperty("--chrono-rail-count", String(railCount));

  const inbound = document.createElement("aside");
  inbound.className = "chrono-rail chrono-rail--in";
  inbound.appendChild(railHeading("Watch Before"));
  inbound.appendChild(watchRail({
    items: before,
    empty: "Nothing required before this title.",
    onFocus,
    side: "in",
  }));

  const center = document.createElement("main");
  center.className = "chrono-center";
  center.appendChild(centerDetail(entry, { peopleById, onOpenPerson, avatar }));

  const outbound = document.createElement("aside");
  outbound.className = "chrono-rail chrono-rail--out";
  outbound.appendChild(railHeading("Watch Next"));
  outbound.appendChild(watchRail({
    items: next,
    empty: "This is a resting point — nothing follows directly.",
    onFocus,
    side: "out",
  }));

  layout.append(inbound, center, outbound);
  return layout;
}

function fitChronoRails(layout) {
  if (!layout) return;
  const stacks = [...layout.querySelectorAll(".chrono-poster-stack")];
  const count = Math.max(1, ...stacks.map((stack) => stack.children.length), Number(layout.dataset.railCount) || 1);
  const host = layout.closest(".chrono-focus-host") || layout.parentElement || layout;
  const heading = layout.querySelector(".chrono-rail-heading");
  const headingH = heading ? heading.getBoundingClientRect().height + 10 : 28;
  const hostH = host.getBoundingClientRect().height || 0;
  const reserve = Math.round(hostH * 0.22);
  const size = chronologyRailPosterSize({
    count,
    availableHeight: Math.max(160, hostH - headingH - reserve),
  });
  layout.dataset.railCount = String(count);
  layout.style.setProperty("--chrono-rail-count", String(count));
  layout.style.setProperty("--chrono-md-h", `${size.height}px`);
  layout.style.setProperty("--chrono-md-w", `${size.width}px`);
  layout.style.setProperty("--chrono-rail-gap", `${size.gap}px`);
}

function centerDetail(entry, { peopleById, onOpenPerson, avatar }) {
  const wrap = document.createElement("article");
  wrap.className = "chrono-center-card";
  wrap.appendChild(railHeading("Selected Movie"));

  const hero = document.createElement("div");
  hero.className = "chrono-selected";
  hero.append(posterTile(entry, { size: "xl" }), centerTitles(entry));
  wrap.appendChild(hero);

  if (entry.note) {
    const note = document.createElement("p");
    note.className = "chrono-note";
    note.textContent = entry.note;
    wrap.appendChild(note);
  }
  if (entry.essential) {
    const badge = document.createElement("p");
    badge.className = "chrono-essential";
    badge.textContent = "Avengers: Doomsday essential";
    wrap.appendChild(badge);
  }

  const castBlock = document.createElement("div");
  castBlock.className = "chrono-characters";
  castBlock.appendChild(railHeading("Characters"));
  castBlock.appendChild(castRow(entry, { peopleById, onOpenPerson, avatar }));
  wrap.appendChild(castBlock);
  return wrap;
}

function centerTitles(entry) {
  const copy = document.createElement("div");
  copy.className = "chrono-center-copy";
  const h = document.createElement("h2");
  h.textContent = entry.title;
  copy.appendChild(h);
  if (entry.filterLabel && entry.filterLabel !== entry.title) {
    const sub = document.createElement("p");
    sub.className = "chrono-center-sub";
    sub.textContent = entry.filterLabel;
    copy.appendChild(sub);
  }
  if (entry.era) {
    const era = document.createElement("p");
    era.className = "chrono-era";
    era.textContent = entry.era;
    copy.appendChild(era);
  }
  return copy;
}

function watchRail({ items, empty, onFocus, side }) {
  const root = document.createElement("div");
  root.className = "chrono-rail-body";
  if (!items.length) {
    root.appendChild(emptyBlock(empty));
    return root;
  }
  const list = document.createElement("ul");
  list.className = "chrono-poster-stack";
  items.forEach((item) => {
    list.appendChild(posterCard(item, onFocus, side));
  });
  root.appendChild(list);
  return root;
}

function posterCard(entry, onFocus, side) {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = `chrono-poster-card chrono-poster-card--${side}`;
  button.setAttribute("aria-label", `Focus ${chronologyFilterLabel(entry)}`);
  const bundle = document.createElement("span");
  bundle.className = "chrono-poster-bundle";
  bundle.append(posterTile(entry, { size: "md" }), posterCaption(entry));
  const arrow = blockArrow(side);
  if (side === "out") button.append(arrow, bundle);
  else button.append(bundle, arrow);
  button.addEventListener("click", () => onFocus(entry.id));
  li.appendChild(button);
  return li;
}

function castRow(entry, { peopleById, onOpenPerson, avatar, compact = false }) {
  const cast = document.createElement("ul");
  cast.className = `chrono-cast-row${compact ? " chrono-lane-cast" : ""}`;
  (entry.characters || []).forEach((id) => {
    const person = peopleById?.get(id);
    if (!person) return;
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chrono-cast-avatar";
    button.title = person.name;
    button.setAttribute("aria-label", `${person.name}. Open their timeline.`);
    if (typeof avatar === "function") button.appendChild(avatar(person, "sm"));
    const name = document.createElement("span");
    name.className = "chrono-cast-name";
    name.textContent = person.name;
    button.appendChild(name);
    if (typeof onOpenPerson === "function") {
      button.addEventListener("click", () => onOpenPerson(person.id));
    }
    li.appendChild(button);
    cast.appendChild(li);
  });
  if (!cast.childElementCount) return emptyBlock("No principal cast listed.");
  return cast;
}

function blockArrow(side) {
  const arrow = document.createElement("span");
  arrow.className = `chrono-arrow chrono-arrow--${side}`;
  arrow.setAttribute("aria-hidden", "true");
  const shaft = document.createElement("span");
  shaft.className = "chrono-arrow-shaft";
  const head = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  head.setAttribute("class", "chrono-arrow-head");
  head.setAttribute("viewBox", "0 0 18 16");
  head.setAttribute("focusable", "false");
  const shape = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shape.setAttribute("class", "chrono-arrow-shape");
  // Chubby block head, tip on the right. Both rails use this direction:
  // Watch Before points at the selected movie, Watch Next points at its poster.
  shape.setAttribute("d", "M0 1.5 L16 8 L0 14.5 Z");
  head.appendChild(shape);
  arrow.append(shaft, head);
  return arrow;
}

function posterTile(entry, { size = "md" } = {}) {
  const tile = document.createElement("span");
  tile.className = `chrono-poster chrono-poster--${size}`;
  tile.setAttribute("aria-hidden", "true");
  const imageSize = size === "xl" ? "w500" : (size === "lg" || size === "web" || size === "lane") ? "w342" : "w154";
  const url = chronologyPosterUrl(entry, imageSize);

  const showAcronym = () => {
    tile.replaceChildren();
    const mark = document.createElement("span");
    mark.className = "chrono-poster-acronym";
    mark.textContent = posterAcronym(entry.title);
    tile.appendChild(mark);
  };

  if (url) {
    const img = document.createElement("img");
    img.className = "chrono-poster-img";
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", showAcronym, { once: true });
    tile.appendChild(img);
  } else {
    showAcronym();
  }
  return tile;
}

function posterCaption(entry) {
  const cap = document.createElement("span");
  cap.className = "chrono-poster-caption";
  cap.textContent = chronologyFilterLabel(entry);
  return cap;
}

function railHeading(text) {
  const h = document.createElement("h3");
  h.className = "chrono-rail-heading";
  h.textContent = text;
  return h;
}

function emptyBlock(message) {
  const p = document.createElement("p");
  p.className = "chrono-empty";
  p.textContent = message;
  return p;
}
