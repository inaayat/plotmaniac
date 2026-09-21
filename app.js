import {
  ALL,
  campOf,
  eraLabel,
  eventTease,
  filterEvents,
  initials,
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
  render();
  window.addEventListener("popstate", () => {
    state = parseState(location.href, { people: new Set(peopleById.keys()), eras });
    render();
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
}

function render({ push = false, replace = false } = {}) {
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
  const selected = app.querySelector(".beat.is-selected");
  if (selected) {
    requestAnimationFrame(() => selected.scrollIntoView({ inline: "center", block: "nearest" }));
  }
}

function renderWeb() {
  const section = document.createElement("section");
  section.className = "web";
  const note = document.createElement("p");
  note.className = "web-note";
  note.textContent = "Choose a person. Their public story with Ethan and H3 opens across the years.";
  const hint = document.createElement("p");
  hint.className = "web-hint";
  hint.textContent = "Slide sideways if someone sits past the edge.";
  const scroller = document.createElement("div");
  scroller.className = "web-scroll";
  const layout = webLayout(people, relations, {
    centerId: plot.centerId,
    friendKinds: plot.friendKinds,
    enemyKinds: plot.enemyKinds,
  });
  const stage = document.createElement("div");
  stage.className = "web-stage";
  stage.style.width = `${layout.width}px`;
  stage.style.height = `${layout.height}px`;

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "web-lines");
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("aria-hidden", "true");
  const center = layout.nodes.find((node) => node.camp === "center");
  layout.nodes.forEach((node, index) => {
    if (!center || node.camp === "center") return;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", `M ${center.x} ${center.y} Q ${center.x} ${node.y} ${node.x} ${node.y}`);
    path.setAttribute("pathLength", "1");
    path.dataset.camp = node.camp;
    path.style.setProperty("--i", String(index));
    svg.appendChild(path);
  });
  stage.appendChild(svg);

  layout.labels.forEach((label) => {
    if (!layout.nodes.some((node) => node.camp === label.id)) return;
    const el = document.createElement("p");
    el.className = `camp-label camp-${label.id}`;
    el.textContent = label.text;
    el.style.left = `${label.x}px`;
    el.style.top = `${label.y}px`;
    stage.appendChild(el);
  });

  layout.nodes.forEach((node, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `node camp-${node.camp}${node.camp === "center" ? " is-center" : ""}`;
    button.style.left = `${node.x}px`;
    button.style.top = `${node.y}px`;
    button.style.setProperty("--i", String(index));
    button.append(avatar(node, node.camp === "center" ? "lg" : "md"), nameEl(node.name));
    const camp = campLabel(node.camp);
    button.setAttribute("aria-label", camp ? `${node.name}, ${camp}` : node.name);
    button.title = node.name;
    button.addEventListener("click", () => openPerson(node.id));
    stage.appendChild(button);
  });

  scroller.appendChild(stage);
  section.append(note, hint, scroller);
  return section;
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
  const intro = document.createElement("p");
  intro.className = "rail-note";
  intro.textContent = person.id === plot.centerId
    ? "Every sourced beat in this plot, from the first to the latest."
    : `Public beats that include ${person.name} and ${center?.name || "the show"}. Scroll across.`;

  section.append(back, head, intro, renderRail(theirs), renderDetail(theirs));
  return section;
}

function renderTimeline() {
  const section = document.createElement("section");
  section.className = "focus timeline-focus";
  const head = document.createElement("div");
  head.className = "timeline-head";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Full timeline";
  const title = document.createElement("h2");
  title.textContent = "Left to right";
  const note = document.createElement("p");
  note.className = "rail-note";
  note.textContent = "The whole public record for this plot, oldest first. Scroll sideways.";
  copy.append(eyebrow, title, note);

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
  section.append(head, renderRail(shown), renderDetail(shown));
  if (!shown.length) section.appendChild(emptyState("Nothing in this plot matches that search."));
  return section;
}

function renderRail(list) {
  const scroller = document.createElement("div");
  scroller.className = "rail-scroll";
  scroller.tabIndex = 0;
  scroller.setAttribute("aria-label", "Timeline");
  const rail = document.createElement("ol");
  rail.className = "rail";
  let year = "";
  list.forEach((event) => {
    const nextYear = event.date.slice(0, 4);
    if (nextYear !== year) {
      year = nextYear;
      const stone = document.createElement("li");
      stone.className = "year-stone";
      const text = document.createElement("span");
      text.textContent = year;
      stone.appendChild(text);
      rail.appendChild(stone);
    }
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "beat";
    button.classList.toggle("is-selected", state.eventId === event.id);
    button.id = `beat-${event.id}`;
    const when = document.createElement("time");
    when.dateTime = event.date;
    when.textContent = formatDate(event.date);
    const heading = document.createElement("strong");
    heading.textContent = event.title;
    const tease = document.createElement("span");
    tease.className = "beat-tease";
    tease.textContent = eventTease(event, 110);
    const era = document.createElement("em");
    era.textContent = eraLabel(event.era);
    button.append(miniArc(), when, heading, tease, era, faceRow(event.people));
    button.addEventListener("click", () => {
      state.eventId = state.eventId === event.id ? "" : event.id;
      render({ replace: true });
    });
    item.appendChild(button);
    rail.appendChild(item);
  });
  scroller.appendChild(rail);
  return scroller;
}

function renderDetail(list) {
  const event = list.find((item) => item.id === state.eventId);
  const detail = document.createElement("article");
  detail.className = "beat-detail";
  if (!event) {
    detail.hidden = true;
    return detail;
  }
  const title = document.createElement("h3");
  title.textContent = event.title;
  const summary = document.createElement("p");
  summary.textContent = event.summary;
  const names = document.createElement("p");
  names.className = "detail-names";
  names.textContent = event.people.map((id) => peopleById.get(id)?.name || id).join(" · ");
  detail.append(title, summary, names);
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
    detail.appendChild(links);
  }
  return detail;
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

function miniArc() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "beat-arc");
  svg.setAttribute("viewBox", "0 0 120 28");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M2 22 C 28 22, 40 16, 58 10 S 92 2, 118 16");
  svg.appendChild(path);
  return svg;
}

function emptyState(message) {
  const p = document.createElement("p");
  p.className = "empty";
  p.textContent = message;
  return p;
}

function campLabel(camp) {
  if (camp === "friend") return "Friend";
  if (camp === "enemy") return "Enemy";
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
