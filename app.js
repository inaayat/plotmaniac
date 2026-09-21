import {
  ALL,
  campOf,
  eraLabel,
  eventTease,
  filterEvents,
  initials,
  neighborhood,
  parseState,
  stateUrl,
  tiesWith,
  webLayout,
} from "./engine.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const peopleById = new Map();
let plots = [];
let plot = null;
let people = [];
let events = [];
let relations = [];
let state = { view: "web", person: ALL, era: ALL, query: "", eventId: "" };
let toastTimer = null;
const ZOOM_MIN = 0.08;
const ZOOM_MAX = 2.5;
let laneZoom = 1;
let pendingLaneScroll = null;
let pendingLaneFocus = "";

const $ = (id) => document.getElementById(id);

async function load() {
  const manifest = await fetchJson("data/plots.json");
  plots = manifest.plots || [];
  if (!plots.length) throw new Error("No plots registered");
  const requested = new URL(location.href).searchParams.get("plot");
  plot = plots.find((item) => item.id === requested) || plots[0];
  const [peopleData, eventData, relationData] = await Promise.all([
    fetchJson(plot.paths.people),
    fetchJson(plot.paths.events),
    fetchJson(plot.paths.relations),
  ]);
  people = peopleData;
  events = eventData.slice().sort((a, b) => a.date.localeCompare(b.date));
  relations = relationData;
  people.forEach((person) => peopleById.set(person.id, person));
  const eras = new Set(events.map((event) => event.era));
  state = parseState(location.href, { people: new Set(peopleById.keys()), eras });
  $("plot-title").textContent = plot.title;
  $("plot-lede").textContent = plot.lede;
  document.title = `Plotmaniac — ${plot.title}`;
  bindChrome();
  renderCredits();
  render({ focusEvent: Boolean(state.eventId) });
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (state.view === "web") {
        const stage = document.querySelector(".web-stage");
        if (stage) paintWeb(stage);
        return;
      }
      const lane = document.querySelector(".lane-view");
      if (lane) layoutLane(lane);
    }, 80);
  });
  window.addEventListener("popstate", () => {
    state = parseState(location.href, { people: new Set(peopleById.keys()), eras });
    render({ focusEvent: Boolean(state.eventId) });
  });
}

function bindChrome() {
  document.querySelectorAll(".views button").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view === "timeline" ? "timeline" : "web";
      state.person = ALL;
      state.eventId = "";
      render({ push: true });
    });
  });
  window.addEventListener("keydown", (event) => {
    if (state.view === "web") return;
    if (event.target.closest("input, textarea")) return;
    const lane = document.querySelector(".lane-view");
    if (!lane) return;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeLaneZoom(lane, laneZoom * 1.2);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      changeLaneZoom(lane, laneZoom / 1.2);
    } else if (event.key === "0" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      changeLaneZoom(lane, 1);
    }
  });
}

function render({ push = false, replace = false, focusEvent = false } = {}) {
  const scroller = document.querySelector(".lane-scroll");
  pendingLaneScroll = replace && scroller
    ? { left: scroller.scrollLeft, top: scroller.scrollTop }
    : null;
  pendingLaneFocus = focusEvent && state.eventId ? state.eventId : "";
  document.body.dataset.view = state.view;
  $("view-web").classList.toggle("is-active", state.view === "web");
  $("view-timeline").classList.toggle("is-active", state.view === "timeline");
  $("view-web").setAttribute("aria-pressed", String(state.view === "web"));
  $("view-timeline").setAttribute("aria-pressed", String(state.view === "timeline"));
  const app = $("app");
  app.replaceChildren();
  if (state.view === "timeline") app.appendChild(renderTimeline());
  else if (state.view === "person") app.appendChild(renderPerson());
  else app.appendChild(renderWeb());
  if (push || replace) writeUrl(replace);
}

function renderWeb() {
  const section = document.createElement("section");
  section.className = "web";
  const key = document.createElement("ul");
  key.className = "web-key";
  [["friend", "Friends"], ["enemy", "Foes"]].forEach(([camp, label]) => {
    const item = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.className = `swatch camp-${camp}`;
    item.append(swatch, document.createTextNode(label));
    key.appendChild(item);
  });
  const scroller = document.createElement("div");
  scroller.className = "web-scroll";
  const stage = document.createElement("div");
  stage.className = "web-stage";
  scroller.appendChild(stage);
  section.append(key, scroller);
  requestAnimationFrame(() => paintWeb(stage));
  return section;
}

function paintWeb(stage) {
  if (!stage.isConnected) return;
  const bounds = stage.getBoundingClientRect();
  if (bounds.width < 2 || bounds.height < 2) {
    requestAnimationFrame(() => paintWeb(stage));
    return;
  }
  const width = Math.max(320, Math.floor(bounds.width));
  const height = Math.max(260, Math.floor(bounds.height));
  const layout = webLayout(people, relations, {
    centerId: plot.centerId,
    friendKinds: plot.friendKinds,
    enemyKinds: plot.enemyKinds,
    width,
    height,
  });
  stage.style.setProperty("--node", `${layout.nodeSize}px`);
  stage.style.setProperty("--center", `${layout.centerSize}px`);
  stage.replaceChildren();

  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "web-lines");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("aria-hidden", "true");
  layout.edges.forEach((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", `M ${from.x} ${from.y} L ${to.x} ${to.y}`);
    path.dataset.from = edge.from;
    path.dataset.to = edge.to;
    svg.appendChild(path);
  });
  stage.appendChild(svg);

  const light = (personId) => {
    const near = neighborhood(personId, relations);
    stage.classList.add("is-hot");
    stage.querySelectorAll(".node").forEach((node) => {
      node.classList.toggle("is-lit", near.has(node.dataset.id));
    });
    stage.querySelectorAll(".web-lines path").forEach((path) => {
      const on = near.has(path.dataset.from) && near.has(path.dataset.to);
      path.classList.toggle("is-lit", on);
    });
  };
  const clear = () => {
    stage.classList.remove("is-hot");
    stage.querySelectorAll(".is-lit").forEach((element) => element.classList.remove("is-lit"));
  };

  layout.nodes.forEach((node, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `node camp-${node.camp}${node.camp === "center" ? " is-center" : ""}`;
    button.dataset.id = node.id;
    button.style.left = `${node.x}px`;
    button.style.top = `${node.y}px`;
    button.style.setProperty("--i", String(index));
    button.append(avatar(node, node.camp === "center" ? "lg" : "md"), nameEl(node.name));
    const camp = campLabel(node.camp);
    button.setAttribute("aria-label", camp ? `${node.name}, ${camp}` : node.name);
    button.title = node.name;
    button.addEventListener("pointerenter", () => light(node.id));
    button.addEventListener("pointerleave", clear);
    button.addEventListener("focus", () => light(node.id));
    button.addEventListener("blur", clear);
    button.addEventListener("click", () => openPerson(node.id));
    stage.appendChild(button);
  });
}

function renderPerson() {
  const person = peopleById.get(state.person);
  const section = document.createElement("section");
  section.className = "focus";
  if (!person) {
    section.appendChild(emptyState("That person isn’t in this plot."));
    return section;
  }
  const back = document.createElement("button");
  back.type = "button";
  back.className = "back";
  back.textContent = "← The web";
  back.addEventListener("click", () => {
    state.view = "web";
    state.person = ALL;
    state.eventId = "";
    render({ push: true });
  });

  const head = document.createElement("div");
  head.className = "focus-head";
  head.appendChild(avatar(person, "lg"));
  const copy = document.createElement("div");
  const camp = campOf(person.id, relations, plot.centerId, plot.friendKinds, plot.enemyKinds);
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = person.id === plot.centerId ? "The center of this plot" : campLabel(camp);
  const title = document.createElement("h2");
  title.id = "person-title";
  title.textContent = person.name;
  const role = document.createElement("p");
  role.className = "role";
  role.textContent = person.role || "";
  copy.append(eyebrow, title, role);

  const center = peopleById.get(plot.centerId);
  const ties = tiesWith(person.id, relations, plot.centerId);
  if (ties.length && center && person.id !== center.id) {
    const list = document.createElement("ul");
    list.className = "ties";
    ties.forEach((tie) => {
      const item = document.createElement("li");
      item.textContent = `${eraLabel(tie.kind)} · ${tie.label}`;
      list.appendChild(item);
    });
    copy.appendChild(list);
  }
  head.appendChild(copy);

  const theirs = events.filter((event) => event.people.includes(person.id));
  section.classList.add("lane-page");
  section.append(back, head, renderRail(theirs, {
    focusId: person.id,
    note: person.id === plot.centerId
      ? "Every sourced beat, oldest on the left."
      : `Beats with ${person.name}, oldest on the left.`,
  }));
  return section;
}

function renderTimeline() {
  const section = document.createElement("section");
  section.className = "focus timeline-focus lane-page";
  const head = document.createElement("div");
  head.className = "timeline-head";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Full timeline";
  const title = document.createElement("h2");
  title.textContent = "Across the years";
  copy.append(eyebrow, title);

  const search = document.createElement("label");
  search.className = "search";
  const searchLabel = document.createElement("span");
  searchLabel.textContent = "Search";
  const input = document.createElement("input");
  input.type = "search";
  input.value = state.query;
  input.placeholder = "Lawsuit, Frenemies, a name…";
  input.addEventListener("input", () => {
    state.query = input.value;
    state.eventId = "";
    render({ replace: true });
    const next = $("app").querySelector("input[type=search]");
    if (next) {
      next.focus();
      const end = next.value.length;
      next.setSelectionRange(end, end);
    }
  });
  search.append(searchLabel, input);
  head.append(copy, search);

  const shown = filterEvents(events, { query: state.query }, peopleById);
  section.append(head, renderRail(shown, {
    note: "The whole public record, oldest on the left. Open a beat for the sources.",
  }));
  if (!shown.length) section.appendChild(emptyState("Nothing in this plot matches that search."));
  return section;
}

function renderRail(list, { focusId = "", note = "" } = {}) {
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
    laneButton("Zoom out", "−", () => changeLaneZoom(view, laneZoom / 1.2)),
    laneSlider(view),
    laneReadout(),
    laneButton("Zoom in", "+", () => changeLaneZoom(view, laneZoom * 1.2)),
    laneButton("Fit the timeline to the width", "Fit", () => fitLaneWidth(view)),
  );
  tools.append(hint, controls);

  const scroller = document.createElement("div");
  scroller.className = "lane-scroll";
  scroller.tabIndex = 0;
  scroller.setAttribute(
    "aria-label",
    "Timeline, oldest on the left. Drag to move. Hold Control and scroll to zoom.",
  );

  const sizer = document.createElement("div");
  sizer.className = "lane-sizer";
  const rail = document.createElement("ol");
  rail.className = "lane";
  let year = "";
  let step = 0;
  list.forEach((event) => {
    const nextYear = event.date.slice(0, 4);
    if (nextYear !== year) {
      year = nextYear;
      const stone = document.createElement("li");
      stone.className = "lane-year";
      const text = document.createElement("span");
      text.textContent = year;
      stone.appendChild(text);
      rail.appendChild(stone);
    }
    const side = step % 2 === 0 ? "above" : "below";
    step += 1;
    rail.appendChild(renderLaneEvent(event, side, focusId));
  });
  sizer.appendChild(rail);
  scroller.appendChild(sizer);
  view.append(tools, scroller);
  bindLaneGestures(view);
  requestAnimationFrame(() => layoutLane(view));
  return view;
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

function changeLaneZoom(view, zoom) {
  const scroller = view.querySelector(".lane-scroll");
  const rect = scroller.getBoundingClientRect();
  applyLaneZoom(view, zoom, {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  });
}

function fitLaneWidth(view) {
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

function layoutLane(view) {
  if (!view.isConnected) return;
  const scroller = view.querySelector(".lane-scroll");
  const rail = view.querySelector(".lane");
  const height = scroller.clientHeight;
  if (height < 80) {
    requestAnimationFrame(() => layoutLane(view));
    return;
  }
  let needed = height;
  rail.querySelectorAll(".lane-card").forEach((card) => {
    needed = Math.max(needed, card.scrollHeight * 2 + 80);
  });
  rail.style.setProperty("--lane-h", `${needed}px`);
  applyLaneZoom(view, laneZoom);
  if (pendingLaneScroll) {
    scroller.scrollLeft = pendingLaneScroll.left;
    scroller.scrollTop = pendingLaneScroll.top;
    pendingLaneScroll = null;
  } else if (needed > height + 8) {
    scroller.scrollTop = Math.max(0, (needed * laneZoom) / 2 - scroller.clientHeight / 2);
  }
  if (pendingLaneFocus) {
    const selected = view.querySelector(".lane-event.is-selected");
    pendingLaneFocus = "";
    if (selected) selected.scrollIntoView({ inline: "center", block: "nearest" });
  }
}

function applyLaneZoom(view, zoom, anchor) {
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

function bindLaneGestures(view) {
  const scroller = view.querySelector(".lane-scroll");
  scroller.addEventListener("wheel", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0016);
    applyLaneZoom(view, laneZoom * factor, { x: event.clientX, y: event.clientY });
  }, { passive: false });

  let pan = null;
  scroller.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.pointerType !== "mouse") return;
    if (event.target.closest("button, a, input")) return;
    pan = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: scroller.scrollLeft,
      top: scroller.scrollTop,
    };
    scroller.setPointerCapture(event.pointerId);
    scroller.classList.add("is-panning");
  });
  scroller.addEventListener("pointermove", (event) => {
    if (!pan || event.pointerId !== pan.id) return;
    scroller.scrollLeft = pan.left - (event.clientX - pan.x);
    scroller.scrollTop = pan.top - (event.clientY - pan.y);
  });
  const endPan = (event) => {
    if (!pan || event.pointerId !== pan.id) return;
    pan = null;
    scroller.classList.remove("is-panning");
  };
  scroller.addEventListener("pointerup", endPan);
  scroller.addEventListener("pointercancel", endPan);
}

function renderLaneEvent(event, side, focusId) {
  const item = document.createElement("li");
  item.className = `lane-event side-${side}`;
  item.classList.toggle("is-selected", state.eventId === event.id);
  item.id = `beat-${event.id}`;

  const toggle = () => {
    state.eventId = state.eventId === event.id ? "" : event.id;
    render({ replace: true });
  };

  const card = document.createElement("div");
  card.className = "lane-card";

  const mark = document.createElement("button");
  mark.type = "button";
  mark.className = "lane-mark";
  const featured = featuredPerson(event, focusId);
  mark.appendChild(avatar(featured, "md"));
  mark.setAttribute("aria-label", `${formatDate(event.date)}. ${event.title}`);
  mark.addEventListener("click", toggle);

  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "lane-hit";
  const when = document.createElement("time");
  when.dateTime = event.date;
  when.textContent = formatDate(event.date);
  const rule = document.createElement("span");
  rule.className = "lane-rule";
  const heading = document.createElement("strong");
  heading.textContent = event.title;
  const tease = document.createElement("span");
  tease.className = "beat-tease";
  tease.textContent = eventTease(event, 140);
  const era = document.createElement("em");
  era.textContent = eraLabel(event.era);
  hit.append(when, rule, heading, tease, era);
  hit.addEventListener("click", toggle);
  card.append(mark, hit);

  if (state.eventId === event.id) {
    const more = document.createElement("div");
    more.className = "lane-more";
    const summary = document.createElement("p");
    summary.textContent = event.summary;
    const names = document.createElement("p");
    names.className = "detail-names";
    names.textContent = event.people.map((id) => peopleById.get(id)?.name || id).join(" · ");
    more.append(summary, names, faceRow(event.people));
    if (event.links?.length) {
      const links = document.createElement("div");
      links.className = "event-links";
      event.links.forEach((link) => {
        if (!/^https:\/\//.test(link.url || "")) return;
        const anchor = document.createElement("a");
        anchor.href = link.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = link.label || "Source";
        const type = document.createElement("span");
        type.className = "link-type";
        type.textContent = link.type || "link";
        anchor.appendChild(type);
        links.appendChild(anchor);
      });
      const share = document.createElement("button");
      share.type = "button";
      share.textContent = "Copy link";
      share.addEventListener("click", () => copyLink());
      links.appendChild(share);
      more.appendChild(links);
    }
    card.appendChild(more);
  }

  const dot = document.createElement("span");
  dot.className = "lane-dot";
  dot.setAttribute("aria-hidden", "true");
  item.append(card, dot);
  return item;
}

function featuredPerson(event, focusId) {
  const ids = event.people || [];
  const preferred = focusId && ids.includes(focusId)
    ? focusId
    : ids.find((id) => id !== plot.centerId) || ids[0];
  return peopleById.get(preferred) || { name: "?", id: preferred || "unknown" };
}

function renderCredits() {
  const list = $("credit-list");
  list.replaceChildren();
  people.filter((person) => person.portrait).forEach((person) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = `${person.name}: `;
    const author = document.createElement("span");
    author.textContent = person.portrait.author;
    const license = document.createElement("a");
    license.href = person.portrait.licenseUrl;
    license.textContent = person.portrait.license;
    const source = document.createElement("a");
    source.href = person.portrait.page;
    source.textContent = "Wikimedia Commons";
    item.append(name, author, document.createTextNode(" · "), license, document.createTextNode(" · "), source);
    list.appendChild(item);
  });
  $("footer-note").textContent = `${plot.title} on Plotmaniac · publicly reported events`;
}

function openPerson(id) {
  if (!peopleById.has(id)) return;
  state.view = "person";
  state.person = id;
  state.eventId = "";
  state.query = "";
  render({ push: true });
}

function avatar(person, size) {
  const wrap = document.createElement("span");
  wrap.className = `avatar avatar-${size}`;
  const portrait = person.portrait;
  if (portrait?.src) {
    const image = document.createElement("img");
    image.src = portrait.src;
    image.alt = "";
    image.width = size === "lg" ? 112 : size === "sm" ? 28 : 72;
    image.height = image.width;
    image.decoding = "async";
    if (size !== "lg") image.loading = "lazy";
    image.addEventListener("error", () => {
      image.remove();
      wrap.appendChild(monogram(person.name));
    }, { once: true });
    wrap.appendChild(image);
    return wrap;
  }
  wrap.appendChild(monogram(person.name));
  return wrap;
}

function monogram(name) {
  const mark = document.createElement("span");
  mark.className = "monogram";
  mark.textContent = initials(name);
  return mark;
}

function nameEl(name) {
  const el = document.createElement("span");
  el.className = "node-name";
  el.textContent = name;
  return el;
}

function faceRow(ids, size = "sm") {
  const row = document.createElement("span");
  row.className = "faces";
  ids.slice(0, 4).forEach((id) => {
    const person = peopleById.get(id);
    if (!person) return;
    const face = avatar(person, size);
    face.title = person.name;
    row.appendChild(face);
  });
  if (ids.length > 4) {
    const more = document.createElement("span");
    more.className = "more-faces";
    more.textContent = `+${ids.length - 4}`;
    row.appendChild(more);
  }
  return row;
}

function emptyState(message) {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = message;
  return p;
}

function campLabel(camp) {
  if (camp === "friend") return "Friend";
  if (camp === "enemy") return "Foe";
  if (camp === "orbit") return "Around the show";
  return "";
}

function formatDate(iso) {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function writeUrl(replace) {
  const urlState = {
    ...state,
    plot: plot.id === plots[0].id ? "" : plot.id,
  };
  const next = stateUrl(location.href, urlState, state.eventId);
  history[replace ? "replaceState" : "pushState"]({}, "", next);
}

async function copyLink() {
  const href = new URL(stateUrl(location.href, { ...state, plot: plot.id === plots[0].id ? "" : plot.id }, state.eventId), location.origin).href;
  try {
    await navigator.clipboard.writeText(href);
    showToast("Link copied.");
  } catch {
    showToast("Copy the address bar to share this beat.");
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  const toast = $("share-toast");
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 1800);
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return response.json();
}

load().catch((error) => {
  console.error(error);
  const app = $("app");
  app.replaceChildren();
  const heading = document.createElement("p");
  heading.className = "empty";
  heading.textContent = "The plot couldn’t load. Refresh to try again.";
  app.appendChild(heading);
});
