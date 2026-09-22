import {
  ALL,
  COMPACT_MAX_WIDTH,
  campOf,
  countriesByRegion,
  coversYear,
  eraLabel,
  eventTease,
  filterEvents,
  firstLoadCountries,
  groupCountriesByStatus,
  initials,
  neighborhood,
  outlineFor,
  parseState,
  parseYear,
  relationsFieldEdges,
  relationsFieldLayout,
  stateUrl,
  tiesWith,
  visibleRelationCountries,
  webLayout,
} from "./engine.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const peopleById = new Map();
let plots = [];
let plot = null;
let people = [];
let events = [];
let relations = [];
let countries = [];
let countryBySlug = new Map();
let openRegions = new Set();
let state = { view: "pick", person: ALL, era: ALL, query: "", eventId: "", year: null, country: "" };
let toastTimer = null;
let loadToken = 0;
const ZOOM_MIN = 0.08;
const ZOOM_MAX = 2.5;
const COMPACT_MQ = `(max-width: ${COMPACT_MAX_WIDTH}px)`;
let laneZoom = 1;
let pendingLaneScroll = null;
let pendingLaneFocus = "";

function isCompact() {
  return window.matchMedia(COMPACT_MQ).matches;
}

function syncLayoutMode() {
  const next = isCompact() ? "compact" : "wide";
  const prev = document.body.dataset.layout || "";
  document.body.dataset.layout = next;
  return prev !== next;
}

const $ = (id) => document.getElementById(id);

async function load() {
  const manifest = await fetchJson("data/plots.json");
  plots = manifest.plots || [];
  if (!plots.length) throw new Error("No plots registered");
  bindChrome();
  const requested = new URL(location.href).searchParams.get("plot");
  if (requested && plots.some((item) => item.id === requested)) {
    await showPlot(requested, { history: "none", fromUrl: true });
  } else if (plots.length === 1) {
    await showPlot(plots[0].id, { history: "none", fromUrl: true });
  } else {
    showPicker({ history: "none" });
  }
  syncLayoutMode();
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const crossed = syncLayoutMode();
      if (crossed && plot) {
        render({ replace: true, focusEvent: Boolean(state.eventId) });
        return;
      }
      if (state.view === "web") {
        const field = document.querySelector(".relations-stage");
        if (field) paintRelationsField(field);
        const stage = document.querySelector(".web-stage");
        if (stage) paintWeb(stage);
        return;
      }
      const lane = document.querySelector(".lane-view");
      if (lane) layoutLane(lane);
    }, 80);
  });
  window.addEventListener("popstate", onPop);
}

function onPop() {
  const requested = new URL(location.href).searchParams.get("plot");
  if (!requested || !plots.some((item) => item.id === requested)) {
    if (plots.length === 1) showPlot(plots[0].id, { history: "none", fromUrl: true });
    else showPicker({ history: "none" });
    return;
  }
  if (!plot || plot.id !== requested) {
    showPlot(requested, { history: "none", fromUrl: true });
    return;
  }
  const eras = new Set(events.map((event) => event.era));
  const parsed = parseState(location.href, {
    people: new Set(peopleById.keys()),
    eras,
    countries: countryBySlug,
  });
  state = { ...parsed, year: readYear(), country: parsed.country || "" };
  rememberCountryRegion();
  render({ focusEvent: Boolean(state.eventId) });
}

function readYear(url = location.href) {
  if (!plot?.year) return null;
  return parseYear(new URL(url).searchParams.get("year"), plot.year);
}

async function showPlot(id, { history = "push", fromUrl = false } = {}) {
  const next = plots.find((item) => item.id === id);
  if (!next) {
    showPicker({ history });
    return;
  }
  const token = ++loadToken;
  plot = next;
  $("plot-title").textContent = plot.title;
  $("plot-lede").textContent = plot.lede;
  $("home-link").textContent = "Plotmaniac";
  document.title = `Plotmaniac — ${plot.title}`;
  $("plot-select").value = plot.id;
  document.body.dataset.images = plot.images || "";
  document.body.dataset.board = plot.disclosure || "";
  const app = $("app");
  app.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "loading";
  loading.textContent = "Drawing the web…";
  app.appendChild(loading);
  try {
    const requests = [
      fetchJson(plot.paths.people),
      fetchJson(plot.paths.events),
      fetchJson(plot.paths.relations),
    ];
    if (plot.paths.countries) requests.push(fetchJson(plot.paths.countries));
    const [peopleData, eventData, relationData, countryData] = await Promise.all(requests);
    if (token !== loadToken) return;
    peopleById.clear();
    people = peopleData;
    events = eventData.slice().sort((a, b) => a.date.localeCompare(b.date));
    relations = relationData;
    countries = countryData || [];
    countryBySlug = new Map(countries.map((country) => [country.slug, country]));
    openRegions = new Set();
    people.forEach((person) => peopleById.set(person.id, person));
    laneZoom = 1;
    const eras = new Set(events.map((event) => event.era));
    if (fromUrl) {
      const parsed = parseState(location.href, {
        people: new Set(peopleById.keys()),
        eras,
        countries: countryBySlug,
      });
      state = { ...parsed, year: readYear(), country: parsed.country || "" };
      rememberCountryRegion();
    } else {
      state = {
        view: "web",
        person: ALL,
        era: ALL,
        query: "",
        eventId: "",
        year: plot.year ? parseYear(plot.year.initial, plot.year) : null,
        country: "",
      };
    }
    renderCredits();
    render({
      push: history === "push",
      replace: history === "replace",
      focusEvent: Boolean(state.eventId),
    });
  } catch (error) {
    if (token !== loadToken) return;
    console.error(error);
    app.replaceChildren();
    app.appendChild(emptyState("The plot couldn’t load. Refresh to try again."));
  }
}

function showPicker({ history = "push" } = {}) {
  loadToken += 1;
  plot = null;
  people = [];
  events = [];
  relations = [];
  countries = [];
  countryBySlug = new Map();
  openRegions = new Set();
  peopleById.clear();
  state = { view: "pick", person: ALL, era: ALL, query: "", eventId: "", year: null, country: "" };
  document.title = "Plotmaniac";
  $("plot-title").textContent = "Plotmaniac";
  $("plot-lede").textContent = "Pick a person or a country. Then read the web of friends and foes, or the timeline under it.";
  $("home-link").textContent = "Field guide";
  $("footer-note").textContent = "Plotmaniac";
  $("credit-list").replaceChildren();
  $("credits").hidden = true;
  document.body.dataset.view = "pick";
  document.body.dataset.images = "";
  document.body.dataset.board = "";
  $("plot-select").value = "";
  $("view-web").classList.remove("is-active");
  $("view-timeline").classList.remove("is-active");
  renderChooser();
  if (history === "push") writeUrl(false);
  if (history === "replace") writeUrl(true);
}

function renderChooser() {
  const app = $("app");
  app.replaceChildren();
  const list = document.createElement("ul");
  list.className = "plot-cards";
  plots.forEach((item) => {
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = `plot-card${item.images === "flags" ? "" : " is-person"}`;
    const kicker = document.createElement("span");
    kicker.className = "kicker";
    kicker.textContent = item.kicker || "Plot";
    button.appendChild(kicker);
    if (item.cardImage) {
      const image = document.createElement("img");
      image.src = item.cardImage;
      image.alt = "";
      button.appendChild(image);
    }
    const title = document.createElement("strong");
    title.textContent = item.title;
    const copy = document.createElement("p");
    copy.textContent = item.lede;
    button.append(title, copy);
    button.addEventListener("click", () => showPlot(item.id, { history: "push" }));
    li.appendChild(button);
    list.appendChild(li);
  });
  app.appendChild(list);
}

function bindChrome() {
  const select = $("plot-select");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose";
  select.appendChild(placeholder);
  plots.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.title;
    select.appendChild(option);
  });
  select.addEventListener("change", () => {
    const id = select.value;
    if (!id || id === plot?.id) return;
    showPlot(id, { history: "push" });
  });
  $("home-link").addEventListener("click", () => {
    if (!plot || plots.length < 2) return;
    showPicker({ history: "push" });
  });
  document.querySelectorAll(".views button").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view === "timeline" ? "timeline" : "web";
      state.person = ALL;
      state.eventId = "";
      render({ push: true });
    });
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.country && plot?.disclosure === "regions" && state.view === "web") {
      state.country = "";
      paintRelationSelection();
      writeUrl(true);
      return;
    }
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
  syncLayoutMode();
  document.body.dataset.view = state.view;
  $("view-web").classList.toggle("is-active", state.view === "web");
  $("view-timeline").classList.toggle("is-active", state.view === "timeline");
  $("view-web").setAttribute("aria-pressed", String(state.view === "web"));
  $("view-timeline").setAttribute("aria-pressed", String(state.view === "timeline"));
  const app = $("app");
  app.replaceChildren();
  if (state.view === "timeline") app.appendChild(renderTimeline());
  else if (state.view === "person") app.appendChild(renderPerson());
  else if (plot?.disclosure === "regions") app.appendChild(renderRelations());
  else app.appendChild(renderWeb());
  if (push || replace) writeUrl(replace);
  if (pendingLaneFocus && isCompact()) {
    const beatId = pendingLaneFocus;
    pendingLaneFocus = "";
    requestAnimationFrame(() => {
      document.getElementById(`beat-${beatId}`)?.scrollIntoView({ block: "center", inline: "nearest" });
    });
  }
}

function renderWeb() {
  const section = document.createElement("section");
  section.className = "web";
  const key = document.createElement("ul");
  key.className = "web-key";
  const keyItems = [
    ["friend", plot.friendLabelPlural || plot.friendLabel || "Friends"],
    ["enemy", plot.enemyLabelPlural || plot.enemyLabel || "Foes"],
  ];
  if (plot.arrangement !== "camps") keyItems.push(["near", "Closer · more beats"]);
  keyItems.forEach(([camp, label]) => {
    const item = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.className = `swatch camp-${camp}`;
    item.append(swatch, document.createTextNode(label));
    key.appendChild(item);
  });
  const scroller = document.createElement("div");
  scroller.className = `web-scroll${plot.arrangement === "camps" ? " is-camps" : ""}`;
  const stage = document.createElement("div");
  stage.className = "web-stage";
  scroller.appendChild(stage);
  section.append(key);
  if (plot.year) section.appendChild(renderYearBar());
  if (isCompact()) {
    const hint = document.createElement("p");
    hint.className = "web-hint";
    hint.textContent = plot.arrangement === "camps"
      ? `${plot.yearHint || "Foes sit on the left, friends on the right."} Scroll to see everyone.`
      : "Scroll to look around. People with more beats sit closer to the center.";
    section.appendChild(hint);
  }
  section.append(scroller);
  requestAnimationFrame(() => paintWeb(stage));
  return section;
}

function renderRelations() {
  const section = document.createElement("section");
  section.className = `relations${isCompact() ? " is-list" : ""}`;
  if (isCompact()) {
    section.append(renderRelationLegend(), renderRelationHint(), renderRelationsLists(), renderRegionBar());
  } else {
    const stage = document.createElement("div");
    stage.className = "relations-stage";
    section.append(renderRelationLegend(), renderRelationHint(), stage, renderRegionBar());
    requestAnimationFrame(() => paintRelationsField(stage));
  }
  const drawer = document.createElement("aside");
  drawer.className = "relation-drawer";
  drawer.hidden = true;
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-label", "Relationship timeline");
  section.appendChild(drawer);
  paintRelationSelection(section);
  return section;
}

function renderRelationLegend() {
  const key = document.createElement("ul");
  key.className = "web-key";
  [
    ["friend", "Friend"],
    ["enemy", "Foe"],
    ["neutral", "Neutral · no outline"],
    ["bloc", "Shared alliance"],
  ].forEach(([camp, label]) => {
    const item = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.className = `swatch camp-${camp}`;
    swatch.setAttribute("aria-hidden", "true");
    item.append(swatch, document.createTextNode(label));
    key.appendChild(item);
  });
  return key;
}

function renderRelationHint() {
  const hint = document.createElement("p");
  hint.className = "relations-hint";
  const majors = firstLoadCountries(countries);
  const friendCount = majors.filter((country) => country.status === "friend").length;
  const foeCount = majors.filter((country) => country.status === "foe").length;
  if (isCompact()) {
    hint.append(
      document.createTextNode(
        `${friendCount} major allies and ${foeCount} major foes. Open a region for every other country, including neutrals. `,
      ),
    );
  } else {
    hint.append(
      document.createTextNode(
        `${friendCount} major allies and ${foeCount} major foes sit close to the center, with a line back to the United States. Open a region and the wider set spreads across the page, including every neutral. `,
      ),
    );
  }
  const source = document.createElement("a");
  source.href = "https://en.wikipedia.org/wiki/Foreign_relations_of_the_United_States";
  source.textContent = "English Wikipedia";
  hint.append(document.createTextNode("Snapshot from "), source, document.createTextNode("."));
  return hint;
}

function renderRegionBar() {
  const bar = document.createElement("div");
  bar.className = "region-bar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Show one region");
  countriesByRegion(countries).forEach((group) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "region-toggle";
    button.dataset.region = group.region;
    const open = openRegions.has(group.region);
    button.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-pressed", String(open));
    const neutralCount = group.countries.filter((country) => country.status === "neutral").length;
    button.textContent = `${group.region} · ${group.countries.length}`;
    button.title = `${group.countries.length} countries, ${neutralCount} neutral`;
    button.addEventListener("click", () => toggleRegion(group.region));
    bar.appendChild(button);
  });
  return bar;
}

function renderRelationsLists() {
  const lists = document.createElement("div");
  lists.className = "relations-lists";
  paintRelationsLists(lists);
  return lists;
}

function paintRelationsLists(root) {
  const visible = visibleRelationCountries(countries, [...openRegions]);
  const grouped = groupCountriesByStatus(visible);
  const selectedRegion = [...openRegions][0] || "";
  root.replaceChildren();
  const intro = document.createElement("p");
  intro.className = "region-intro";
  intro.textContent = selectedRegion
    ? `${selectedRegion}: every friend, foe, and neutral.`
    : "Major allies and major foes. Choose a region for the rest.";
  root.appendChild(intro);
  const sections = [
    ["friend", "Friends", grouped.friend],
    ["foe", "Foes", grouped.foe],
  ];
  if (selectedRegion) sections.push(["neutral", "Neutrals", grouped.neutral]);
  sections.forEach(([status, label, list]) => {
    const block = document.createElement("section");
    block.className = `relations-group camp-${status === "foe" ? "enemy" : status}`;
    const heading = document.createElement("h3");
    heading.textContent = `${label} · ${list.length}`;
    const chips = document.createElement("ul");
    chips.className = "chip-list";
    list
      .slice()
      .sort((a, b) => String(a.country).localeCompare(String(b.country)))
      .forEach((country) => {
        const item = document.createElement("li");
        item.appendChild(countryChip(country));
        chips.appendChild(item);
      });
    block.append(heading, chips);
    root.appendChild(block);
  });
  paintRelationSelection(document);
}

function toggleRegion(region) {
  const hadSelection = Boolean(state.country);
  openRegions = openRegions.has(region) ? new Set() : new Set([region]);
  state.country = "";
  paintRegionButtons();
  const stage = document.querySelector(".relations-stage");
  if (stage) paintRelationsField(stage);
  const lists = document.querySelector(".relations-lists");
  if (lists) paintRelationsLists(lists);
  if (hadSelection) writeUrl(true);
}

function paintRegionButtons() {
  document.querySelectorAll(".region-toggle").forEach((button) => {
    const open = openRegions.has(button.dataset.region);
    button.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-pressed", String(open));
  });
}

function paintRelationsField(stage) {
  if (!stage?.isConnected) return;
  const bounds = stage.getBoundingClientRect();
  if (bounds.width < 2 || bounds.height < 2) {
    requestAnimationFrame(() => paintRelationsField(stage));
    return;
  }
  const layout = relationsFieldLayout(countries, {
    width: Math.floor(bounds.width),
    height: Math.floor(bounds.height),
    openRegions: [...openRegions],
    centerId: plot.centerId,
  });
  stage.style.setProperty("--node", `${layout.nodeSize}px`);
  stage.style.setProperty("--center", `${layout.centerSize}px`);
  stage.classList.toggle("has-region", Boolean(layout.selectedRegion));
  stage.replaceChildren();
  stage.appendChild(renderRelationLines(layout));
  const centerPerson = peopleById.get(plot.centerId);
  const center = document.createElement("button");
  center.type = "button";
  center.className = "country-chip outline-none is-center-chip is-field";
  center.dataset.id = plot.centerId;
  center.style.left = `${layout.center.x}px`;
  center.style.top = `${layout.center.y}px`;
  center.setAttribute("aria-label", "United States, the center of this plot");
  center.append(avatar(centerPerson || { name: "United States" }, "lg"));
  const centerName = document.createElement("span");
  centerName.className = "chip-name";
  centerName.textContent = centerPerson?.name || "United States";
  center.appendChild(centerName);
  center.addEventListener("click", () => selectCountry(plot.centerId));
  center.addEventListener("pointerenter", () => lightRelation(stage, plot.centerId));
  center.addEventListener("pointerleave", () => clearRelation(stage));
  center.addEventListener("focus", () => lightRelation(stage, plot.centerId));
  center.addEventListener("blur", () => clearRelation(stage));
  stage.appendChild(center);
  layout.nodes.forEach((node, index) => {
    const country = countryBySlug.get(node.slug);
    if (!country) return;
    const button = countryChip(country);
    button.classList.add("is-field");
    if (!country.first_load) button.classList.add("is-broad");
    button.style.left = `${node.x}px`;
    button.style.top = `${node.y}px`;
    button.style.setProperty("--i", String(index));
    button.addEventListener("pointerenter", () => lightRelation(stage, country.slug));
    button.addEventListener("pointerleave", () => clearRelation(stage));
    button.addEventListener("focus", () => lightRelation(stage, country.slug));
    button.addEventListener("blur", () => clearRelation(stage));
    stage.appendChild(button);
  });
  paintRelationSelection(document);
}

function renderRelationLines(layout) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "web-lines");
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("aria-hidden", "true");
  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  byId.set(layout.center.id, layout.center);
  relationsFieldEdges(layout).forEach((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return;
    const path = document.createElementNS(SVG_NS, "path");
    const line = trimmedLine(from, to, edge.from === layout.center.id ? layout.centerSize * 0.42 : layout.nodeSize * 0.42, layout.nodeSize * 0.46);
    path.setAttribute("d", `M ${line.x1} ${line.y1} L ${line.x2} ${line.y2}`);
    path.dataset.from = edge.from;
    path.dataset.to = edge.to;
    path.dataset.kind = edge.kind;
    path.dataset.camp = edge.camp;
    path.dataset.scope = edge.scope;
    if (edge.bloc) path.dataset.bloc = edge.bloc;
    svg.appendChild(path);
  });
  return svg;
}

function trimmedLine(from, to, trimStart, trimEnd) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x1: from.x + (dx / length) * trimStart,
    y1: from.y + (dy / length) * trimStart,
    x2: to.x - (dx / length) * trimEnd,
    y2: to.y - (dy / length) * trimEnd,
  };
}

function lightRelation(stage, id) {
  stage.classList.add("is-hot");
  const hub = id === plot.centerId;
  const lit = new Set([id]);
  stage.querySelectorAll(".web-lines path").forEach((path) => {
    const on = hub
      ? path.dataset.kind === "spoke" && path.dataset.scope === "major"
      : path.dataset.from === id || path.dataset.to === id;
    path.classList.toggle("is-lit", on);
    if (on) {
      lit.add(path.dataset.from);
      lit.add(path.dataset.to);
    }
  });
  stage.querySelectorAll(".country-chip").forEach((chip) => {
    chip.classList.toggle("is-lit", lit.has(chip.dataset.id));
  });
}

function clearRelation(stage) {
  stage.classList.remove("is-hot");
  stage.querySelectorAll(".is-lit").forEach((element) => element.classList.remove("is-lit"));
}

function countryChip(country) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `country-chip ${outlineClass(country)}`;
  button.dataset.id = country.slug;
  const person = peopleById.get(country.slug) || { name: country.country };
  const name = document.createElement("span");
  name.className = "chip-name";
  name.textContent = country.country;
  button.append(avatar(person, "sm"), name);
  button.setAttribute("aria-label", `${country.country}, ${statusLabel(country.status)}`);
  button.addEventListener("click", () => selectCountry(country.slug));
  return button;
}

function selectCountry(slug) {
  const known = slug === plot?.centerId || countryBySlug.has(slug);
  if (!known) return;
  state.country = state.country === slug ? "" : slug;
  const record = countryBySlug.get(state.country);
  if (record && !record.first_load && record.region && !openRegions.has(record.region)) {
    openRegions = new Set([record.region]);
    paintRegionButtons();
    const stage = document.querySelector(".relations-stage");
    if (stage) paintRelationsField(stage);
    const lists = document.querySelector(".relations-lists");
    if (lists) paintRelationsLists(lists);
  }
  paintRelationSelection(document);
  writeUrl(false);
}

function paintRelationSelection(root = document) {
  const selected = state.country || "";
  root.querySelectorAll(".country-chip").forEach((chip) => {
    const on = chip.dataset.id === selected;
    chip.classList.toggle("is-selected", on);
    chip.setAttribute("aria-pressed", String(on));
  });
  const drawer = root.querySelector(".relation-drawer");
  if (!drawer) return;
  root.querySelectorAll(".drawer-scrim").forEach((scrim) => scrim.remove());
  drawer.replaceChildren();
  if (!selected) {
    drawer.hidden = true;
    return;
  }
  drawer.hidden = false;
  if (isCompact()) {
    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "drawer-scrim";
    scrim.setAttribute("aria-label", "Close relationship");
    scrim.addEventListener("click", () => {
      state.country = "";
      paintRelationSelection();
      writeUrl(true);
    });
    drawer.before(scrim);
  }
  const record = countryBySlug.get(selected);
  const person = peopleById.get(selected);
  drawer.classList.remove("outline-green", "outline-red", "outline-none");
  drawer.classList.add(record ? outlineClass(record) : "outline-none");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "drawer-close";
  close.textContent = "Close";
  close.addEventListener("click", () => {
    state.country = "";
    paintRelationSelection();
    writeUrl(true);
  });
  const head = document.createElement("div");
  head.className = "drawer-head";
  head.appendChild(avatar(person || { name: record?.country || "United States" }, "lg"));
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = record ? statusLabel(record.status) : "The center of this plot";
  const title = document.createElement("h2");
  title.id = "relation-title";
  title.textContent = record?.country || person?.name || "United States";
  drawer.setAttribute("aria-labelledby", "relation-title");
  copy.append(eyebrow, title);
  if (record && !record.formal_relations) {
    const formal = document.createElement("p");
    formal.className = "drawer-note";
    formal.textContent = "No formal diplomatic relations.";
    copy.appendChild(formal);
  }
  const notes = document.createElement("p");
  notes.className = "drawer-notes";
  notes.textContent = record?.notes_summary || person?.role || "";
  copy.appendChild(notes);
  head.appendChild(copy);
  drawer.append(close, head);
  if (record) drawer.appendChild(renderCountryHistory(record));
  else {
    const note = document.createElement("p");
    note.className = "drawer-notes";
    note.textContent = "Choose a country to read that relationship. Neutrals are in the regional lists and have no colored outline.";
    drawer.appendChild(note);
  }
}

function renderCountryHistory(record) {
  const block = document.createElement("div");
  block.className = "country-history";
  const list = document.createElement("ol");
  list.className = "relation-timeline";
  (record.timeline || []).forEach((beat) => {
    const item = document.createElement("li");
    const year = document.createElement("span");
    year.className = "relation-year";
    year.textContent = String(beat.year);
    const text = document.createElement("p");
    text.textContent = beat.event;
    item.append(year, text);
    list.appendChild(item);
  });
  const more = document.createElement("a");
  more.className = "drawer-more";
  more.href = record.wiki_bilateral;
  more.target = "_blank";
  more.rel = "noreferrer";
  more.textContent = "Read more on Wikipedia";
  block.append(list, more);
  return block;
}

function rememberCountryRegion() {
  const record = countryBySlug.get(state.country);
  if (record && !record.first_load && record.region) openRegions = new Set([record.region]);
}

function outlineClass(country) {
  const outline = outlineFor(country);
  if (outline === "green") return "outline-green";
  if (outline === "red") return "outline-red";
  return "outline-none";
}

function statusLabel(status) {
  if (status === "friend") return "Friend";
  if (status === "foe") return "Foe";
  if (status === "neutral") return "Neutral";
  return "";
}

function renderYearBar() {
  const bar = document.createElement("div");
  bar.className = "year-bar";
  const readout = document.createElement("p");
  readout.className = "year-readout";
  readout.textContent = String(state.year);
  const hint = document.createElement("p");
  hint.className = "year-hint";
  hint.textContent = plot.yearHint || "Drag the year. Foes sit on the left, friends on the right.";
  const input = document.createElement("input");
  input.type = "range";
  input.className = "year-drag";
  input.min = String(plot.year.min);
  input.max = String(plot.year.max);
  input.step = "1";
  input.value = String(state.year);
  input.setAttribute("aria-label", plot.yearHint || "Year. Drag to see who was a friend or a foe.");
  input.setAttribute("aria-valuetext", String(state.year));
  input.addEventListener("input", () => setYear(input.value));
  const marks = document.createElement("div");
  marks.className = "year-marks";
  (plot.year.marks || []).forEach((year) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.year = String(year);
    button.textContent = year === plot.year.max ? "Now" : String(year);
    button.classList.toggle("is-active", year === state.year);
    button.addEventListener("click", () => setYear(year));
    marks.appendChild(button);
  });
  const counts = document.createElement("p");
  counts.className = "year-counts";
  counts.id = "year-counts";
  bar.append(readout, hint, input, marks, counts);
  return bar;
}

function setYear(year) {
  if (!plot?.year) return;
  state.year = parseYear(year, plot.year);
  const readout = document.querySelector(".year-readout");
  const input = document.querySelector(".year-drag");
  if (readout) readout.textContent = String(state.year);
  if (input) {
    input.value = String(state.year);
    input.setAttribute("aria-valuetext", String(state.year));
  }
  document.querySelectorAll(".year-marks button").forEach((button) => {
    button.classList.toggle("is-active", Number(button.dataset.year) === state.year);
  });
  const stage = document.querySelector(".web-stage");
  if (stage) paintWeb(stage, { animate: false });
  writeUrl(true);
}

function paintWeb(stage, { animate = true } = {}) {
  if (!stage.isConnected) return;
  const bounds = stage.getBoundingClientRect();
  const scroller = stage.parentElement;
  const compact = isCompact();
  const camps = plot.arrangement === "camps";
  let width;
  let height;
  if (compact && !camps) {
    const size = Math.max(680, Math.floor(Math.max(bounds.width, bounds.height, scroller?.clientWidth || 0)));
    width = size;
    height = size;
    stage.style.width = `${size}px`;
    stage.style.height = `${size}px`;
  } else {
    if (bounds.width < 2 || bounds.height < 2) {
      requestAnimationFrame(() => paintWeb(stage, { animate }));
      return;
    }
    width = Math.max(320, Math.floor(bounds.width));
    height = Math.max(260, Math.floor(bounds.height));
    stage.style.width = "";
  }
  const layout = webLayout(people, relations, {
    centerId: plot.centerId,
    friendKinds: plot.friendKinds,
    enemyKinds: plot.enemyKinds,
    arrangement: plot.arrangement,
    year: plot.year ? state.year : undefined,
    events,
    width,
    height,
  });
  stage.classList.toggle("is-quiet", !animate);
  if (camps && layout.height > height + 2) stage.style.height = `${layout.height}px`;
  else if (!(compact && !camps)) stage.style.height = "";
  stage.style.setProperty("--node", `${layout.nodeSize}px`);
  stage.style.setProperty("--center", `${layout.centerSize}px`);
  stage.replaceChildren();

  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "web-lines");
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("aria-hidden", "true");
  layout.edges.forEach((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) return;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", `M ${from.x} ${from.y} L ${to.x} ${to.y}`);
    path.dataset.from = edge.from;
    path.dataset.to = edge.to;
    const camp = from.camp === "center" ? to.camp : to.camp === "center" ? from.camp : "";
    if (camp) path.dataset.camp = camp;
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
    button.className = `node camp-${node.camp}${node.camp === "center" ? " is-center" : ""}${node.side ? ` node-${node.side}` : ""}`;
    button.dataset.id = node.id;
    button.style.left = `${node.x}px`;
    button.style.top = `${node.y}px`;
    button.style.setProperty("--i", String(index));
    button.append(avatar(node, node.camp === "center" ? "lg" : "md"), nameEl(node.name));
    const camp = campLabel(node.camp);
    const beats = node.beats ? `, ${node.beats} timeline ${node.beats === 1 ? "beat" : "beats"}` : "";
    button.setAttribute("aria-label", `${node.name}${camp ? `, ${camp}` : ""}${beats}`);
    button.title = node.beats ? `${node.name} · ${node.beats} beats` : node.name;
    button.addEventListener("pointerenter", () => light(node.id));
    button.addEventListener("pointerleave", clear);
    button.addEventListener("focus", () => light(node.id));
    button.addEventListener("blur", clear);
    button.addEventListener("click", () => openPerson(node.id));
    stage.appendChild(button);
  });
  const counts = document.getElementById("year-counts");
  if (counts) {
    const friendCount = layout.nodes.filter((node) => node.camp === "friend").length;
    const foeCount = layout.nodes.filter((node) => node.camp === "enemy").length;
    counts.textContent = `${friendCount} ${countWord("friend", friendCount)} · ${foeCount} ${countWord("enemy", foeCount)}`;
  }
  if (compact && !camps && scroller) {
    scroller.scrollLeft = Math.max(0, (stage.offsetWidth - scroller.clientWidth) / 2);
    scroller.scrollTop = Math.max(0, (stage.offsetHeight - scroller.clientHeight) / 2);
  }
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

  const record = countryBySlug.get(person.id);
  const head = document.createElement("div");
  head.className = "focus-head";
  const face = avatar(person, "lg");
  if (record) face.classList.add(outlineClass(record));
  head.appendChild(face);
  const copy = document.createElement("div");
  const camp = campOf(
    person.id,
    relations,
    plot.centerId,
    plot.friendKinds,
    plot.enemyKinds,
    plot.year ? state.year : undefined,
  );
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = person.id === plot.centerId
    ? "The center of this plot"
    : plot.year
      ? `${campLabel(camp)} in ${state.year}`
      : campLabel(camp);
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
      const span = tieSpan(tie);
      item.textContent = span
        ? `${eraLabel(tie.kind)} · ${tie.label} · ${span}`
        : `${eraLabel(tie.kind)} · ${tie.label}`;
      if (plot.year && coversYear(tie, state.year)) item.classList.add("is-now");
      list.appendChild(item);
    });
    copy.appendChild(list);
  }
  head.appendChild(copy);

  if (record) {
    section.append(back, head, renderCountryHistory(record));
    return section;
  }
  const theirs = events.filter((event) => event.people.includes(person.id));
  section.classList.add("lane-page");
  section.append(back, head, renderRail(theirs, {
    focusId: person.id,
    note: person.id === plot.centerId
      ? (isCompact() ? "Every sourced beat, oldest at the top." : "Every sourced beat, oldest on the left.")
      : (isCompact()
        ? `Beats with ${person.name}, oldest at the top.`
        : `Beats with ${person.name}, oldest on the left.`),
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
  input.placeholder = plot.searchPlaceholder || "Search the record…";
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
    note: isCompact()
      ? "The whole public record, oldest at the top. Open a beat for the sources."
      : "The whole public record, oldest on the left. Open a beat for the sources.",
  }));
  if (!shown.length) section.appendChild(emptyState("Nothing in this plot matches that search."));
  return section;
}

function renderRail(list, { focusId = "", note = "" } = {}) {
  if (isCompact()) return renderSpine(list, { focusId, note });
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

function renderSpine(list, { focusId = "", note = "" } = {}) {
  const view = document.createElement("div");
  view.className = "spine-view";
  if (note) {
    const hint = document.createElement("p");
    hint.className = "rail-note";
    hint.textContent = note;
    view.appendChild(hint);
  }
  const rail = document.createElement("ol");
  rail.className = "spine";
  rail.setAttribute("aria-label", "Timeline, oldest at the top.");
  let year = "";
  list.forEach((event) => {
    const nextYear = event.date.slice(0, 4);
    if (nextYear !== year) {
      year = nextYear;
      const stone = document.createElement("li");
      stone.className = "spine-year";
      const text = document.createElement("span");
      text.textContent = year;
      stone.appendChild(text);
      rail.appendChild(stone);
    }
    rail.appendChild(renderSpineEvent(event, focusId));
  });
  view.appendChild(rail);
  return view;
}

function renderSpineEvent(event, focusId) {
  const item = document.createElement("li");
  item.className = "spine-event";
  item.classList.toggle("is-selected", state.eventId === event.id);
  item.id = `beat-${event.id}`;

  const toggle = () => {
    state.eventId = state.eventId === event.id ? "" : event.id;
    render({ replace: true, focusEvent: Boolean(state.eventId) });
  };

  const mark = document.createElement("button");
  mark.type = "button";
  mark.className = "spine-mark";
  const featured = featuredPerson(event, focusId);
  mark.appendChild(avatar(featured, "md"));
  mark.setAttribute("aria-label", `${formatDate(event.date)}. ${event.title}`);
  mark.addEventListener("click", toggle);

  const copy = document.createElement("div");
  copy.className = "spine-copy";
  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "spine-hit";
  const when = document.createElement("time");
  when.dateTime = event.date;
  when.textContent = formatDate(event.date);
  const heading = document.createElement("strong");
  heading.textContent = event.title;
  const tease = document.createElement("span");
  tease.className = "beat-tease";
  tease.textContent = eventTease(event, 140);
  const era = document.createElement("em");
  era.textContent = eraLabel(event.era);
  hit.append(when, heading, tease, era);
  hit.addEventListener("click", toggle);
  copy.appendChild(hit);

  if (state.eventId === event.id) {
    const more = document.createElement("div");
    more.className = "spine-more";
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
    copy.appendChild(more);
  }

  item.append(mark, copy);
  return item;
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
  if (plot?.images === "flags") {
    const item = document.createElement("li");
    item.append(
      document.createTextNode("National flags are public domain via Wikimedia Commons. Relationship notes follow "),
    );
    const source = document.createElement("a");
    source.href = "https://en.wikipedia.org/wiki/Foreign_relations_of_the_United_States";
    source.textContent = "Foreign relations of the United States";
    const license = document.createElement("a");
    license.href = "https://creativecommons.org/publicdomain/mark/1.0/";
    license.textContent = "Public domain";
    item.append(source, document.createTextNode(". "), license, document.createTextNode("."));
    list.appendChild(item);
    $("footer-note").textContent = plot.sourceNote || `${plot.title} on Plotmaniac · publicly reported events`;
    $("credits").hidden = false;
    return;
  }
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
  $("footer-note").textContent = plot.sourceNote || `${plot.title} on Plotmaniac · publicly reported events`;
  $("credits").hidden = list.childElementCount === 0;
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
  if (portrait?.frame === "flag") wrap.classList.add("is-flag");
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

function tieSpan(tie) {
  if (tie.start == null && tie.end == null) return "";
  const start = String(tie.start).slice(0, 4);
  const end = tie.end ? String(tie.end).slice(0, 4) : "now";
  return `${start}–${end}`;
}

function campLabel(camp) {
  if (camp === "friend") return plot?.friendLabel || "Friend";
  if (camp === "enemy") return plot?.enemyLabel || "Foe";
  if (camp === "orbit") return plot?.orbitLabel || "Around the show";
  return "";
}

function countWord(camp, count) {
  const one = count === 1;
  if (camp === "friend") {
    if (one) return plot?.friendCountOne || "friend";
    return plot?.friendCountMany || "friends";
  }
  if (one) return plot?.enemyCountOne || "foe";
  return plot?.enemyCountMany || "foes";
}

function formatDate(iso) {
  const date = new Date(`${iso}T12:00:00`);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function writeUrl(replace) {
  const urlState = {
    ...state,
    plot: state.view === "pick" || !plot ? "" : plot.id,
  };
  const next = stateUrl(location.href, urlState, state.eventId);
  history[replace ? "replaceState" : "pushState"]({}, "", next);
}

async function copyLink() {
  const href = new URL(stateUrl(location.href, { ...state, plot: plot?.id || "" }, state.eventId), location.origin).href;
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
