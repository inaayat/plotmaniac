import {
  ALL,
  COMPACT_MAX_WIDTH,
  campOf,
  countriesByRegion,
  coversYear,
  eraLabel,
  eventTease,
  expandedSummary,
  filterEvents,
  filterTitleLabels,
  peopleForTitleSearch,
  titleFilterLabels,
  usesPlotChronology,
  chronologyEntryForQuery,
  chronologyById,
  findPlot,
  plotCardFace,
  plotMatchesQuery,
  firstLoadCountries,
  groupCountriesByStatus,
  hubCenterId,
  hubFrame,
  hubOf,
  initials,
  neighborhood,
  outlineFor,
  parseState,
  parseYear,
  plotHubs,
  relationsFieldEdges,
  relationsFieldLayout,
  httpsSourceLinks,
  relationRiderFlags,
  relationMoodLabel,
  relationRideAt,
  relationRideLayoutForViewport,
  relationSentimentChart,
  relationTimelineHasTone,
  resolvePlotView,
  defaultPlotView,
  plotChooserHref,
  stateUrl,
  stanceHistory,
  tiesWith,
  usesPolicyPanel,
  usesRegulationBoard,
  usesScotusHub,
  usesHubWebPersonFocus,
  webCastForPersonFocus,
  usesGunStateLawsPlot,
  boardViewForPerson,
  visibleRelationCountries,
  webLayout,
  warOverlapsSpan,
  warsInSpan,
  warsForCountry,
  compareWarsByStart,
  warCountryNote,
  parseWarSpan,
  warPartyLine,
  warMatchesFocus,
  warMapSize,
  projectWarPoint,
  countryAnchors,
  geometryOutline,
  warArcPath,
  spreadWarDots,
} from "./engine.js";
import { buildFrames } from "./partition-model.js";
import { mountPartition } from "./partition-view.js";
import {
  buildLaneChrome,
  changeLaneZoom,
  getLaneZoom,
  laneYear,
  layoutLane,
  queueLaneFocus,
  queueLaneScroll,
  setLaneZoom,
  takeLaneFocus,
} from "./lane.js";
import { parseRegulationParams } from "./gun-regulation-model.js";
import { renderRegulationBoard, syncRegulationBoardDom } from "./gun-regulation-view.js";
import { paintRelationRideFrame } from "./relation-ride-frame.js";
import {
  renderScotusTopicHub,
  scotusTopicFromPlotAlias,
  scotusTopicIcon,
  SCOTUS_GUN_TOPIC_ID,
} from "./scotus-hub-view.js";
import {
  filterStatesByCriteria,
  parseGunStateLawFilters,
  parseGunType,
  serializeGunStateLawFilters,
} from "./gun-laws-by-state-model.js";
import { renderGunStateLawsBoard } from "./gun-laws-by-state-view.js";
import { renderMarvelChronology, renderMarvelChronologyIndex } from "./marvel-chronology-view.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const peopleById = new Map();
let plots = [];
let plot = null;
let people = [];
let events = [];
let chronology = null;
let relations = [];
let countries = [];
let countryBySlug = new Map();
let warsData = { countries: {}, conflicts: [] };
let worldMap = null;
let warFocus = "";
let warHover = "";
let openRegions = new Set();
let openTopic = "";
let gunBoard = null;
let gunStatePack = null;
let state = {
  view: "pick",
  person: ALL,
  era: ALL,
  query: "",
  eventId: "",
  year: null,
  country: "",
  hub: "",
  defaultHub: "",
  regKind: "",
  exemplarState: "",
  checklistOpen: false,
  topic: "",
  gunLawFilters: {},
  gunLawState: "",
  gunLawCriteria: "",
  gunLawGunType: "handgun",
  chronologyTitle: "",
};
let toastTimer = null;
let loadToken = 0;
let partitionReference = null;
let partitionPortraits = {};
let partitionMount = null;
const COMPACT_MQ = `(max-width: ${COMPACT_MAX_WIDTH}px)`;
const VIEW_PREF_KEY = "plotmaniac-view";
const PICK_LEDE = "Turn rabbit holes into clickable plots: maps, webs, lists, timelines.";
let hubCamera = null;
let webFitToken = "";
const WEB_ZOOM_MIN = 0.08;
const WEB_ZOOM_MAX = 2.8;

function isCompact() {
  return window.matchMedia(COMPACT_MQ).matches;
}

function scotusTopicSet() {
  return new Set((plot?.topics || []).map((item) => item.id));
}

function isGunBoardActive() {
  return usesRegulationBoard(plot, state.topic);
}

function resolveScotusTopic(href, plotParam = "") {
  const url = new URL(href, "https://plotmaniac.com/");
  const valid = scotusTopicSet();
  const fromQuery = url.searchParams.get("topic") || "";
  if (valid.has(fromQuery)) return fromQuery;
  const aliasTopic = scotusTopicFromPlotAlias(plotParam || url.searchParams.get("plot") || "");
  return valid.has(aliasTopic) ? aliasTopic : "";
}

function syncScotusChrome() {
  if (!usesScotusHub(plot)) return;
  const gunTopic = plot.topics?.find((item) => item.id === SCOTUS_GUN_TOPIC_ID);
  if (isGunBoardActive()) {
    $("plot-title").textContent = gunTopic?.boardTitle || "Gun regulation in the United States";
    $("plot-lede").textContent = gunTopic?.boardLede || plot.lede;
    document.title = `Plotmaniac — ${$("plot-title").textContent}`;
  } else {
    $("plot-title").textContent = plot.title;
    $("plot-lede").textContent = plot.lede;
    document.title = `Plotmaniac — ${plot.title}`;
  }
}

function clearPartition() {
  partitionMount?.destroy();
  partitionMount = null;
  partitionReference = null;
  partitionPortraits = {};
}

function partitionFrameId(frames) {
  let requested = "";
  try {
    requested = decodeURIComponent(new URL(location.href).hash.slice(1));
  } catch {
    requested = "";
  }
  return frames.includes(requested) ? requested : frames[0];
}

function labelViews() {
  const history = plot?.arrangement === "historical-map";
  const scotus = usesScotusHub(plot);
  const web = $("view-web");
  const timeline = $("view-timeline");
  const chronologyBtn = $("view-chronology");
  if (!web || !timeline) return;
  web.hidden = scotus;
  timeline.hidden = scotus;
  if (chronologyBtn) chronologyBtn.hidden = scotus || !usesPlotChronology(plot);
  if (scotus) return;
  if (usesPlotChronology(plot)) {
    timeline.hidden = false;
    timeline.textContent = "Watch order";
    if (chronologyBtn) {
      chronologyBtn.hidden = false;
      chronologyBtn.textContent = "Chronology";
    }
    if (state.view === "web") {
      web.hidden = false;
      web.textContent = "Character web (archived)";
    } else {
      web.hidden = true;
      web.textContent = "The web";
    }
    return;
  }
  web.hidden = false;
  timeline.hidden = false;
  web.textContent = history ? "Map + people" : "The web";
  timeline.textContent = "Full timeline";
}

function rememberView(view) {
  if (view !== "timeline" && view !== "web" && view !== "chronology") return;
  try {
    localStorage.setItem(VIEW_PREF_KEY, view);
  } catch {
    /* private mode */
  }
}

function viewForPlot(parsed, href = location.href) {
  return boardViewForPerson(plot, resolvePlotView(parsed, { href, plot }));
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
  const matched = findPlot(plots, requested);
  if (matched) {
    await showPlot(matched.id, { history: "none", fromUrl: true });
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
        if (isGunBoardActive()) return;
        if (plot?.arrangement === "wars") {
          paintWars();
          return;
        }
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
  const matched = findPlot(plots, requested);
  if (!matched) {
    if (plots.length === 1) showPlot(plots[0].id, { history: "none", fromUrl: true });
    else showPicker({ history: "none" });
    return;
  }
  if (!plot || plot.id !== matched.id) {
    showPlot(matched.id, { history: "none", fromUrl: true });
    return;
  }
  if (plot.arrangement === "historical-map" && partitionReference) {
    const playerIds = new Set(partitionReference.keyPlayers.map((player) => player.id));
    const parsed = parseState(location.href, { people: playerIds });
    state = {
      view: parsed.view === "timeline" || parsed.view === "person" ? parsed.view : "web",
      person: parsed.view === "person" ? parsed.person : ALL,
      era: ALL,
      query: "",
      eventId: partitionFrameId(buildFrames(partitionReference).map((frame) => frame.id)),
      year: null,
      country: "",
      hub: "",
      defaultHub: "",
    };
    render();
    return;
  }
  const eras = new Set(events.map((event) => event.era));
  const parsed = parseState(location.href, {
    people: new Set(peopleById.keys()),
    eras,
    countries: countryBySlug,
    hubs: new Set(plotHubs(plot).map((hub) => hub.id)),
    defaultHub: plot.defaultHub || "",
    topics: scotusTopicSet(),
  });
  const reg = parseRegulationParams(location.href, new Set(Object.keys(gunBoard?.states || {})));
  const popPlotParam = new URL(location.href).searchParams.get("plot") || plot.id;
  state = {
    ...parsed,
    view: viewForPlot(parsed),
    year: readYear(),
    country: parsed.country || "",
    hub: parsed.hub || plot.defaultHub || "",
    defaultHub: plot.defaultHub || "",
    regKind: reg.kind,
    exemplarState: reg.exemplarState,
    checklistOpen: false,
    topic: parsed.topic || resolveScotusTopic(location.href, popPlotParam),
    chronologyTitle: parsed.chronologyTitle || "",
  };
  state.chronologyTitle = resolveChronologyTitle(state.chronologyTitle);
  applyWarSpan(state);
  rememberCountryRegion();
  render({ focusEvent: Boolean(state.eventId) });
}

function readYear(url = location.href) {
  if (!plot?.year) return null;
  return parseYear(new URL(url).searchParams.get("year"), plot.year);
}

async function showPlot(id, { history = "push", fromUrl = false } = {}) {
  hubCamera = null;
  const next = findPlot(plots, id);
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
  $("plot-select").choicePaint?.();
  fillHubSelect();
  document.body.dataset.images = plot.images || "";
  const bootTopic = fromUrl ? resolveScotusTopic(location.href, id) : "";
  document.body.dataset.board = plot.arrangement === "historical-map"
    ? "history"
    : (plot.arrangement === "wars"
      ? "wars"
      : (usesGunStateLawsPlot(plot)
        ? "gun-state-laws"
        : (usesRegulationBoard(plot, bootTopic)
          ? "regulation"
          : (usesScotusHub(plot) ? "scotus" : (plot.disclosure || "")))));
  clearPartition();
  const app = $("app");
  app.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "loading";
  loading.textContent = plot.arrangement === "historical-map"
    ? "Drawing the map…"
    : (usesGunStateLawsPlot(plot)
      ? "Loading state tables…"
      : (usesScotusHub(plot)
        ? (usesRegulationBoard(plot, bootTopic) ? "Loading the board…" : "Loading topics…")
        : (usesPlotChronology(plot) ? "Laying out the watch order…" : "Drawing the web…")));
  app.appendChild(loading);
  try {
    if (plot.arrangement === "historical-map") {
      const requests = [fetchJson(plot.paths.reference)];
      if (plot.paths.portraits) requests.push(fetchJson(plot.paths.portraits));
      const [reference, portraits] = await Promise.all(requests);
      if (token !== loadToken) return;
      partitionReference = reference;
      partitionPortraits = portraits || {};
      const frames = buildFrames(reference).map((frame) => frame.id);
      const playerIds = new Set(reference.keyPlayers.map((player) => player.id));
      const parsed = fromUrl
        ? parseState(location.href, { people: playerIds })
        : { view: "web", person: ALL };
      state = {
        view: parsed.view === "timeline" || parsed.view === "person" ? parsed.view : "web",
        person: parsed.view === "person" ? parsed.person : ALL,
        era: ALL,
        query: "",
        eventId: partitionFrameId(frames),
        year: null,
        country: "",
        hub: "",
      };
      $("credit-list").replaceChildren();
      $("credits").hidden = true;
      $("footer-note").textContent = plot.sourceNote || "Plotmaniac";
      render({
        push: history === "push",
        replace: history === "replace",
      });
      return;
    }
    const requests = [
      fetchJson(plot.paths.people),
      fetchJson(plot.paths.events),
      fetchJson(plot.paths.relations),
    ];
    if (plot.paths.chronology) requests.push(fetchJson(plot.paths.chronology));
    if (plot.paths.countries) requests.push(fetchJson(plot.paths.countries));
    if (plot.paths.conflicts) requests.push(fetchJson(plot.paths.conflicts));
    if (plot.paths.world) requests.push(fetchJson(plot.paths.world));
    const loaded = await Promise.all(requests);
    if (token !== loadToken) return;
    const [peopleData, eventData, relationData, ...rest] = loaded;
    let chronologyData = null;
    let countryData = [];
    let conflictData = null;
    let worldData = null;
    rest.forEach((payload) => {
      if (payload?.titles && payload?.version) chronologyData = payload;
      else if (payload?.conflicts && payload?.countries) conflictData = payload;
      else if (payload?.type === "FeatureCollection") worldData = payload;
      else if (Array.isArray(payload)) countryData = payload;
    });
    chronology = chronologyData;
    peopleById.clear();
    people = peopleData;
    events = eventData.slice().sort((a, b) => a.date.localeCompare(b.date));
    relations = relationData;
    countries = countryData || [];
    warsData = conflictData || { countries: {}, conflicts: [] };
    worldMap = worldData;
    warFocus = "";
    warHover = "";
    countryBySlug = new Map(countries.map((country) => [country.slug, country]));
    openRegions = new Set();
    openTopic = "";
    people.forEach((person) => peopleById.set(person.id, person));
    gunBoard = null;
    gunStatePack = null;
    if (usesScotusHub(plot) && plot.paths.timeline) {
      const [timeline, checklist, statesEx, statsPack] = await Promise.all([
        fetchJson(plot.paths.timeline),
        fetchJson(plot.paths.checklist),
        fetchJson(plot.paths.statesExemplars),
        fetchJson(plot.paths.stats),
      ]);
      if (token !== loadToken) return;
      gunBoard = {
        timeline,
        checklistRows: checklist.rows,
        federalKeyframes: checklist.federalKeyframes,
        banners: checklist.banners,
        states: statesEx,
        stats: statsPack.series,
        statsMeta: statsPack,
      };
    }
    if (usesGunStateLawsPlot(plot) && plot.paths.statesSnapshot) {
      const [snapshot, filterConfig, mapPaths] = await Promise.all([
        fetchJson(plot.paths.statesSnapshot),
        fetchJson(plot.paths.filterCriteria),
        plot.paths.stateMap ? fetchJson(plot.paths.stateMap) : Promise.resolve(null),
      ]);
      if (token !== loadToken) return;
      gunStatePack = { snapshot, filterConfig, mapPaths };
    }
    setLaneZoom(1);
    hubCamera = null;
    webFitToken = "";
    const eras = new Set(events.map((event) => event.era));
    const hubs = plotHubs(plot);
    const exemplarStates = new Set(Object.keys(gunBoard?.states || {}));
    const requestedPlotParam = fromUrl
      ? new URL(location.href).searchParams.get("plot")
      : id;
    if (fromUrl) {
      const parsed = parseState(location.href, {
        people: new Set(peopleById.keys()),
        eras,
        countries: countryBySlug,
        hubs: new Set(hubs.map((hub) => hub.id)),
        defaultHub: plot.defaultHub || "",
        topics: scotusTopicSet(),
      });
      const topic = parsed.topic || resolveScotusTopic(location.href, requestedPlotParam);
      const reg = parseRegulationParams(location.href, exemplarStates);
      const criteriaIds = new Set([
        ...(gunStatePack?.filterConfig?.criteria?.map((row) => row.id) || []),
      ]);
      const gunLawFilters = parseGunStateLawFilters(location.href, criteriaIds);
      const gunLawGunType = parseGunType(location.href);
      const stateParam = new URL(location.href).searchParams.get("state") || "";
      const validGunStates = new Set(gunStatePack?.snapshot?.states?.map((row) => row.id) || []);
      state = {
        ...parsed,
        view: viewForPlot(parsed),
        year: readYear(),
        country: parsed.country || "",
        hub: parsed.hub || plot.defaultHub || "",
        defaultHub: plot.defaultHub || "",
        regKind: reg.kind,
        exemplarState: reg.exemplarState,
        checklistOpen: false,
        topic,
        gunLawFilters,
        gunLawState: validGunStates.has(stateParam) ? stateParam : "",
        gunLawCriteria: serializeGunStateLawFilters(gunLawFilters),
        gunLawGunType,
        chronologyTitle: parsed.chronologyTitle || "",
      };
      state.chronologyTitle = resolveChronologyTitle(state.chronologyTitle);
      applyWarSpan(state);
      rememberCountryRegion();
    } else {
      state = {
        view: defaultPlotView({ plot }),
        person: ALL,
        era: ALL,
        query: "",
        eventId: "",
        year: plot.year ? parseYear(plot.year.initial, plot.year) : null,
        country: "",
        hub: plot.defaultHub || "",
        defaultHub: plot.defaultHub || "",
        regKind: "",
        exemplarState: "",
        checklistOpen: false,
        topic: "",
        gunLawFilters: {},
        gunLawState: "",
        gunLawCriteria: "",
        gunLawGunType: "handgun",
        chronologyTitle: "",
      };
      state.chronologyTitle = resolveChronologyTitle("");
      applyWarSpan(state, "");
    }
    syncScotusChrome();
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
  hubCamera = null;
  loadToken += 1;
  clearPartition();
  plot = null;
  people = [];
  events = [];
  chronology = null;
  relations = [];
  countries = [];
  countryBySlug = new Map();
  warsData = { countries: {}, conflicts: [] };
  worldMap = null;
  warFocus = "";
  warHover = "";
  openRegions = new Set();
  openTopic = "";
  peopleById.clear();
  gunBoard = null;
  state = {
    view: "pick",
    person: ALL,
    era: ALL,
    query: "",
    eventId: "",
    year: null,
    country: "",
    hub: "",
    defaultHub: "",
    regKind: "",
    exemplarState: "",
    checklistOpen: false,
    topic: "",
  };
  document.title = "Plotmaniac";
  $("plot-title").textContent = "Plotmaniac";
  $("plot-lede").textContent = PICK_LEDE;
  $("home-link").textContent = "Field guide";
  const search = $("plot-search");
  if (search) search.value = "";
  $("footer-note").textContent = "Plotmaniac";
  $("credit-list").replaceChildren();
  $("credits").hidden = true;
  document.body.dataset.view = "pick";
  document.body.dataset.images = "";
  document.body.dataset.board = "";
  $("plot-select").value = "";
  $("plot-select").choicePaint?.();
  fillHubSelect();
  $("view-web").classList.remove("is-active");
  $("view-timeline").classList.remove("is-active");
  $("view-chronology")?.classList.remove("is-active");
  labelViews();
  renderChooser();
  if (history === "push") writeUrl(false);
  if (history === "replace") writeUrl(true);
}

function renderChooser() {
  const app = $("app");
  app.replaceChildren();
  const list = document.createElement("ul");
  list.className = "plot-cards";
  list.setAttribute("aria-label", "Plots");
  plots.forEach((item) => {
    const li = document.createElement("li");
    const face = plotCardFace(item);
    const card = document.createElement("a");
    card.className = `plot-card${face === "person" ? " is-person" : face === "map" ? " is-map" : ""}`;
    card.href = plotChooserHref(item);
    card.dataset.plot = item.id;
    card.title = item.lede;
    card.setAttribute("aria-label", `${item.kicker || "Plot"}: ${item.title}. ${item.cardLine || item.lede}`);
    const kicker = document.createElement("span");
    kicker.className = "kicker";
    kicker.textContent = item.kicker || "Plot";
    if (item.cardImage) {
      const image = document.createElement("img");
      image.src = item.cardImage;
      image.alt = "";
      card.appendChild(image);
    } else {
      const mono = document.createElement("span");
      mono.className = "mono";
      mono.setAttribute("aria-hidden", "true");
      mono.textContent = (item.title || "?").replace(/[^a-z0-9]/gi, "").slice(0, 1).toUpperCase() || "?";
      card.appendChild(mono);
    }
    const title = document.createElement("strong");
    title.textContent = item.title;
    const copy = document.createElement("p");
    copy.textContent = item.cardLine || item.lede;
    card.append(kicker, title, copy);
    card.addEventListener("click", (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
      event.preventDefault();
      showPlot(item.id, { history: "push" });
    });
    li.appendChild(card);
    list.appendChild(li);
  });
  const empty = document.createElement("li");
  empty.className = "gallery-empty";
  empty.id = "gallery-empty";
  empty.hidden = true;
  empty.textContent = "No plots match.";
  list.appendChild(empty);
  app.appendChild(list);
  filterGallery();
}

function filterGallery() {
  const input = $("plot-search");
  const empty = $("gallery-empty");
  const cards = [...document.querySelectorAll(".plot-card[data-plot]")];
  if (!input || !cards.length) return;
  let visible = 0;
  cards.forEach((card) => {
    const item = findPlot(plots, card.dataset.plot);
    const match = item ? plotMatchesQuery(item, input.value) : false;
    card.hidden = !match;
    if (card.parentElement) card.parentElement.hidden = !match;
    if (match) visible += 1;
  });
  if (empty) empty.hidden = visible !== 0;
}

const openChoices = new Set();
let choiceChromeBound = false;

function closeChoices(except) {
  openChoices.forEach((close) => {
    if (close !== except) close();
  });
}

function bindChoiceChrome() {
  if (choiceChromeBound) return;
  choiceChromeBound = true;
  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".choice, .title-filter")) return;
    closeChoices();
  });
}

let titleFilterReady = false;
let titleFilterOptions = [];

function initTitleFilter() {
  const input = $("title-filter");
  const menu = $("title-suggestions");
  const wrap = $("title-switch");
  if (!input || !menu || titleFilterReady) return;
  titleFilterReady = true;

  const closeMenu = () => {
    menu.hidden = true;
    input.setAttribute("aria-expanded", "false");
    wrap?.classList.remove("is-open");
    openChoices.delete(closeMenu);
  };

  const pickLabel = (label) => {
    input.value = label;
    if (!plot || !usesTitleFilter()) return;
    state.query = label;
    state.eventId = "";
    webFitToken = "";
    if (chronology) {
      const entry = chronologyEntryForQuery(chronology, label);
      state.chronologyTitle = entry?.id || "";
      if (usesPlotChronology(plot) && state.view !== "timeline") state.view = "timeline";
    }
    closeMenu();
    render({ push: true });
  };

  const paintMenu = () => {
    if (document.activeElement !== input || !usesTitleFilter()) {
      closeMenu();
      return;
    }
    const matches = filterTitleLabels(titleFilterOptions, input.value);
    menu.replaceChildren();
    if (!matches.length) {
      closeMenu();
      return;
    }
    matches.forEach((label) => {
      const row = document.createElement("li");
      const choice = document.createElement("button");
      choice.type = "button";
      choice.className = "title-suggestion";
      choice.setAttribute("role", "option");
      choice.textContent = label;
      choice.addEventListener("mousedown", (event) => event.preventDefault());
      choice.addEventListener("click", () => pickLabel(label));
      row.appendChild(choice);
      menu.appendChild(row);
    });
    menu.hidden = false;
    input.setAttribute("aria-expanded", "true");
    wrap?.classList.add("is-open");
    openChoices.add(closeMenu);
  };

  const syncQuery = ({ pushHistory = true } = {}) => {
    if (!plot || !usesTitleFilter()) return;
    state.query = input.value;
    state.eventId = "";
    webFitToken = "";
    if (chronology) {
      const entry = chronologyEntryForQuery(chronology, input.value);
      if (entry) {
        state.chronologyTitle = entry.id;
        if (usesPlotChronology(plot) && state.view !== "timeline") state.view = "timeline";
      }
    }
    webFitToken = "";
    paintMenu();
    render({ push: pushHistory });
  };

  input.addEventListener("input", () => syncQuery({ pushHistory: true }));
  input.addEventListener("focus", () => paintMenu());

  input.addEventListener("keydown", (event) => {
    const rows = [...menu.querySelectorAll(".title-suggestion")];
    if (event.key === "Escape") {
      if (!menu.hidden) {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
      }
      return;
    }
    if (event.key === "ArrowDown") {
      if (!rows.length) return;
      event.preventDefault();
      if (menu.hidden) paintMenu();
      menu.querySelector(".title-suggestion")?.focus();
    } else if (event.key === "Enter" && !menu.hidden) {
      const focused = document.activeElement;
      if (focused?.classList.contains("title-suggestion")) {
        event.preventDefault();
        pickLabel(focused.textContent);
      }
    }
  });

  menu.addEventListener("keydown", (event) => {
    const rows = [...menu.querySelectorAll(".title-suggestion")];
    const at = rows.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      input.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      rows[Math.min(rows.length - 1, at + 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (at <= 0) input.focus();
      else rows[at - 1]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      rows[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      rows.at(-1)?.focus();
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (document.activeElement?.classList.contains("title-suggestion")) {
        pickLabel(document.activeElement.textContent);
      }
    }
  });
}

function enhanceSelect(select) {
  if (!select || select.dataset.enhanced) return;
  select.dataset.enhanced = "true";
  bindChoiceChrome();
  const wrap = select.closest(".plot-switch") || select.parentElement;
  wrap.classList.add("choice");
  select.classList.add("choice-native");
  select.setAttribute("tabindex", "-1");
  select.setAttribute("aria-hidden", "true");
  const button = document.createElement("button");
  button.type = "button";
  button.id = `${select.id || "choice"}-button`;
  button.className = "choice-button";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  const menu = document.createElement("ul");
  menu.id = `${select.id || "choice"}-menu`;
  menu.className = "choice-menu";
  menu.setAttribute("role", "listbox");
  menu.hidden = true;
  button.setAttribute("aria-controls", menu.id);
  wrap.htmlFor = button.id;
  const frame = document.createElement("span");
  frame.className = "choice-frame";
  select.after(frame);
  frame.append(select, button, menu);

  const optionsOf = () => [...select.options].map((option) => ({
    value: option.value,
    label: option.textContent,
    disabled: option.disabled,
  }));

  const currentLabel = () => {
    const chosen = select.selectedOptions[0];
    return chosen?.textContent || optionsOf()[0]?.label || "Choose";
  };

  const paint = () => {
    const items = optionsOf();
    button.textContent = currentLabel();
    button.disabled = !items.length || wrap.hidden;
    menu.replaceChildren();
    items.forEach((item, index) => {
      const row = document.createElement("li");
      const choice = document.createElement("button");
      choice.type = "button";
      choice.className = "choice-option";
      choice.setAttribute("role", "option");
      choice.dataset.value = item.value;
      choice.setAttribute("aria-selected", String(item.value === select.value));
      choice.textContent = item.label;
      choice.disabled = item.disabled;
      choice.addEventListener("click", () => pick(item.value));
      row.appendChild(choice);
      menu.appendChild(row);
      if (item.value === select.value) menu.dataset.active = String(index);
    });
  };

  const close = () => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    wrap.classList.remove("is-open");
    openChoices.delete(close);
  };

  const open = () => {
    if (button.disabled) return;
    closeChoices(close);
    paint();
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    wrap.classList.add("is-open");
    openChoices.add(close);
    const current = menu.querySelector('[aria-selected="true"]');
    current?.focus();
  };

  const pick = (value) => {
    if (select.value !== value) {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    paint();
    close();
    button.focus();
  };

  button.addEventListener("click", () => {
    if (menu.hidden) open();
    else close();
  });
  button.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
  menu.addEventListener("keydown", (event) => {
    const rows = [...menu.querySelectorAll(".choice-option")];
    const at = rows.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      button.focus();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      rows[Math.min(rows.length - 1, at + 1)]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      rows[Math.max(0, at - 1)]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      rows[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      rows.at(-1)?.focus();
    }
  });
  select.addEventListener("change", paint);
  const watch = new MutationObserver(paint);
  watch.observe(select, { childList: true, subtree: true, characterData: true });
  watch.observe(wrap, { attributes: true, attributeFilter: ["hidden"] });
  select.choicePaint = paint;
  paint();
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
  const hubSelect = $("hub-select");
  enhanceSelect(select);
  enhanceSelect(hubSelect);
  hubSelect.addEventListener("change", () => {
    const id = hubSelect.value;
    if (!plot || id === state.hub) return;
    state.hub = id;
    state.eventId = "";
    webFitToken = "";
    if (usesHubWebPersonFocus()) state.person = ALL;
    if (state.view === "person") {
      state.view = "web";
      state.person = ALL;
    }
    render({ push: true });
  });
  initTitleFilter();
  $("home-link").addEventListener("click", () => {
    if (!plot || plots.length < 2) return;
    showPicker({ history: "push" });
  });
  const plotSearch = $("plot-search");
  if (plotSearch) plotSearch.addEventListener("input", filterGallery);
  document.querySelectorAll(".views > button[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextView = button.dataset.view === "timeline" || button.dataset.view === "chronology"
        ? button.dataset.view
        : "web";
      if (plot?.arrangement === "historical-map") {
        state.view = nextView === "chronology" ? "timeline" : nextView;
        state.person = ALL;
        rememberView(state.view);
        render({ push: true });
        return;
      }
      state.view = nextView;
      state.person = ALL;
      state.eventId = "";
      rememberView(state.view);
      render({ push: true });
    });
  });
  window.addEventListener("keydown", (event) => {
    if (state.view === "pick") {
      const input = $("plot-search");
      if (input && event.key === "/" && document.activeElement !== input && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        input.focus();
        return;
      }
      if (input && event.key === "Escape" && document.activeElement === input) {
        event.preventDefault();
        input.value = "";
        filterGallery();
        input.blur();
        return;
      }
    }
    if (event.key === "Escape" && openChoices.size) {
      closeChoices();
      event.preventDefault();
      return;
    }
    if (event.key === "Escape" && plot?.arrangement === "historical-map" && state.view === "person") {
      state.view = "web";
      state.person = ALL;
      render({ push: true });
      return;
    }
    if (event.key === "Escape" && state.view === "relation" && plot?.disclosure === "regions") {
      state.view = "web";
      render({ push: true });
      return;
    }
    if (event.key === "Escape" && state.country && plot?.disclosure === "regions" && state.view === "web") {
      state.country = "";
      paintRelationSelection();
      writeUrl(true);
      return;
    }
    if (event.key === "Escape" && usesPolicyPanel(plot) && state.view === "web" && state.person !== ALL) {
      closePolicyPanel();
      return;
    }
    if (event.key === "Escape" && isGunBoardActive() && state.checklistOpen) {
      state.checklistOpen = false;
      render({ replace: true });
      document.querySelector(".regulation-checklist-open")?.focus();
      return;
    }
    if (event.key === "Escape" && usesHubWebPersonFocus() && state.view === "web" && state.person !== ALL) {
      state.person = ALL;
      hubCamera = null;
      webFitToken = "";
      render({ push: true });
      return;
    }
    if (state.view === "web") {
      const stage = document.querySelector(".web-stage.is-hub-field");
      if (!stage || event.target.closest("input, textarea")) return;
      if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        changeWebZoom(stage, (hubCamera?.scale || 1) * 1.2);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        changeWebZoom(stage, (hubCamera?.scale || 1) / 1.2);
      } else if (event.key === "0" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        fitWebCamera(stage);
      }
      return;
    }
    if (event.target.closest("input, textarea")) return;
    const lane = document.querySelector(".lane-view");
    if (!lane) return;
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeLaneZoom(lane, getLaneZoom() * 1.2);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      changeLaneZoom(lane, getLaneZoom() / 1.2);
    } else if (event.key === "0" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      changeLaneZoom(lane, 1);
    }
  });
}

function usesTitleFilter(activePlot = plot) {
  return Boolean(activePlot?.titleFilter);
}

function resolveChronologyTitle(requested = "") {
  if (!chronology?.titles?.length) return "";
  const index = chronologyById(chronology);
  if (requested && index.has(requested)) return requested;
  const fromQuery = state.query ? chronologyEntryForQuery(chronology, state.query) : null;
  if (fromQuery) return fromQuery.id;
  return chronology.titles[0].id;
}

function fillTitleFilter() {
  const wrap = $("title-switch");
  const input = $("title-filter");
  if (!wrap || !input) return;
  if (!plot || !usesTitleFilter()) {
    wrap.hidden = true;
    titleFilterOptions = [];
    return;
  }
  wrap.hidden = false;
  input.placeholder = plot.searchPlaceholder || "Film or series…";
  titleFilterOptions = titleFilterLabels(events, chronology);
  if (document.activeElement !== input) input.value = state.query;
}

function fillHubSelect() {
  const wrap = $("hub-switch");
  const select = $("hub-select");
  if (!wrap || !select) return;
  const hubs = plotHubs(plot);
  select.replaceChildren();
  if (!hubs.length || (usesPlotChronology(plot) && state.view !== "web")) {
    wrap.hidden = true;
    select.choicePaint?.();
    return;
  }
  const none = document.createElement("option");
  none.value = "";
  none.textContent = plot.hubNoneLabel || "None";
  select.appendChild(none);
  const everyone = document.createElement("option");
  everyone.value = ALL;
  everyone.textContent = plot.hubAllLabel || "All";
  select.appendChild(everyone);
  hubs.forEach((hub) => {
    const option = document.createElement("option");
    option.value = hub.id;
    option.textContent = hub.label;
    select.appendChild(option);
  });
  select.value = state.hub === ALL || (state.hub && hubs.some((hub) => hub.id === state.hub)) ? state.hub : "";
  wrap.hidden = false;
  select.choicePaint?.();
}

function activeHub() {
  return hubOf(plot, state.hub);
}

function activeCenter() {
  if (plotHubs(plot).length) return hubCenterId(plot, state.hub);
  return plot?.centerId || "";
}

function hubEvents() {
  if (!plotHubs(plot).length || !state.hub) return events;
  return filterEvents(events, { hub: state.hub }, peopleById);
}

function render({ push = false, replace = false, focusEvent = false } = {}) {
  const scroller = document.querySelector(".lane-scroll");
  queueLaneScroll(replace && scroller
    ? { left: scroller.scrollLeft, top: scroller.scrollTop }
    : null);
  queueLaneFocus(focusEvent && state.eventId ? state.eventId : "");
  syncLayoutMode();
  labelViews();
  document.body.dataset.view = state.view;
  $("view-web").classList.toggle("is-active", state.view === "web");
  $("view-timeline").classList.toggle("is-active", state.view === "timeline");
  $("view-chronology")?.classList.toggle("is-active", state.view === "chronology");
  $("view-web").setAttribute("aria-pressed", String(state.view === "web"));
  $("view-timeline").setAttribute("aria-pressed", String(state.view === "timeline"));
  $("view-chronology")?.setAttribute("aria-pressed", String(state.view === "chronology"));
  fillHubSelect();
  fillTitleFilter();
  const plotSelect = $("plot-select");
  if (plotSelect && document.activeElement === plotSelect) plotSelect.blur();
  const hubSelect = $("hub-select");
  if (hubSelect && document.activeElement === hubSelect) hubSelect.blur();
  const app = $("app");
  if (plot?.arrangement === "historical-map" && partitionReference) {
    document.body.dataset.board = "history";
    labelViews();
    const modeKey = `${state.view}:${isCompact() ? "compact" : "wide"}`;
    if (!partitionMount || partitionMount.modeKey() !== modeKey) {
      app.replaceChildren();
      partitionMount = mountPartition(app, partitionReference, {
        frameId: state.eventId,
        view: state.view,
        personId: state.person,
        portraits: partitionPortraits,
        onFrame(id, { historyMode } = {}) {
          state.eventId = id;
          writeUrl(historyMode !== "push");
        },
        onOpenPlayer(id) {
          state.view = "person";
          state.person = id;
          render({ push: true });
        },
        onOpenTimeline(id) {
          state.view = "timeline";
          state.person = ALL;
          if (id) state.eventId = id;
          render({ push: true });
        },
        onShowMap(id) {
          state.view = "web";
          state.person = ALL;
          if (id) state.eventId = id;
          render({ push: true });
        },
      });
    } else if (state.view === "person") {
      partitionMount.showPerson?.(state.person);
    } else {
      partitionMount.goTo(state.eventId);
    }
    if (push || replace) writeUrl(replace);
    return;
  }
  if (partitionMount) clearPartition();
  app.replaceChildren();
  syncScotusChrome();
  document.body.dataset.board = plot?.arrangement === "historical-map"
    ? "history"
    : (plot?.arrangement === "wars"
      ? "wars"
      : (usesGunStateLawsPlot(plot)
        ? "gun-state-laws"
        : (isGunBoardActive()
          ? "regulation"
          : (usesScotusHub(plot) ? "scotus" : (plot?.disclosure || "")))));
  if (usesGunStateLawsPlot(plot)) app.appendChild(renderGunStateLawsSection());
  else if (usesScotusHub(plot)) {
    if (isGunBoardActive()) app.appendChild(renderRegulationSection());
    else app.appendChild(renderScotusHubSection());
  } else if (plot?.arrangement === "wars") app.appendChild(renderWars());
  else if (state.view === "timeline") app.appendChild(renderTimeline());
  else if (state.view === "chronology" && usesPlotChronology(plot)) app.appendChild(renderChronologyPage());
  else if (state.view === "person") app.appendChild(renderPerson());
  else if (state.view === "relation" && plot?.disclosure === "regions") app.appendChild(renderRelationPage());
  else if (plot?.disclosure === "regions") app.appendChild(renderRelations());
  else app.appendChild(renderMarvelWebOrDefault());
  if (push || replace) writeUrl(replace);
  if (isCompact()) {
    const beatId = takeLaneFocus();
    if (beatId) {
      requestAnimationFrame(() => {
        document.getElementById(`beat-${beatId}`)?.scrollIntoView({ block: "center", inline: "nearest" });
      });
    }
  }
}

function scrollGunStateDetailIntoView() {
  requestAnimationFrame(() => {
    const detail = document.getElementById("gun-state-laws-detail");
    if (!detail) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detail.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  });
}

function renderGunStateLawsSection() {
  if (!gunStatePack) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "State law data is loading…";
    return empty;
  }
  return renderGunStateLawsBoard({
    plot,
    snapshot: gunStatePack.snapshot,
    filterConfig: gunStatePack.filterConfig,
    mapPaths: gunStatePack.mapPaths,
    filters: state.gunLawFilters || {},
    gunType: state.gunLawGunType || "handgun",
    selectedStateId: state.gunLawState || "",
    onFilterChange: (criterionId, value) => {
      state.gunLawFilters = { ...state.gunLawFilters, [criterionId]: value };
      state.gunLawCriteria = serializeGunStateLawFilters(state.gunLawFilters);
      render({ replace: true });
    },
    onGunTypeChange: (gunType) => {
      state.gunLawGunType = gunType;
      render({ replace: true });
    },
    onSelectState: (id) => {
      state.gunLawState = state.gunLawState === id ? "" : id;
      render({ replace: true });
      if (state.gunLawState) scrollGunStateDetailIntoView();
    },
  });
}

function renderScotusHubSection() {
  return renderScotusTopicHub({
    plot,
    topics: plot.topics || [],
    activeTopicId: state.topic,
    onSelectTopic: (topicId) => {
      state.topic = topicId;
      state.eventId = "";
      state.checklistOpen = false;
      if (topicId === SCOTUS_GUN_TOPIC_ID && plot.year) {
        state.year = parseYear(plot.year.initial, plot.year);
      }
      render({ push: true });
    },
  });
}

function renderRegulationSection() {
  const shell = document.createElement("div");
  shell.className = "regulation-shell";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "back regulation-back";
  back.append(scotusTopicIcon("topics"), document.createTextNode("SCOTUS topics"));
  back.addEventListener("click", () => {
    state.topic = "";
    state.eventId = "";
    state.checklistOpen = false;
    render({ push: true });
  });
  shell.appendChild(back);
  const gunTopic = plot.topics?.find((item) => item.id === SCOTUS_GUN_TOPIC_ID);
  const boardPlot = {
    ...plot,
    title: gunTopic?.boardTitle || plot.title,
    lede: gunTopic?.boardLede || plot.lede,
  };
  shell.appendChild(renderRegulationBoard({
    plot: boardPlot,
    board: gunBoard,
    state,
    onKindFilter: (kind) => {
      state.regKind = kind;
      render({ replace: true });
    },
    onToggleChecklist: () => {
      state.checklistOpen = true;
      render({ replace: true });
    },
    onCloseChecklist: () => {
      state.checklistOpen = false;
      render({ replace: true });
      document.querySelector(".regulation-checklist-open")?.focus();
    },
    onYearChange: (year) => {
      if (state.year === year) return;
      state.year = year;
      syncRegulationBoardDom(gunBoard, state);
      writeUrl(true);
    },
    onSelectBeat: (id) => {
      if (state.eventId === id) return;
      state.eventId = id;
      writeUrl(true);
    },
  }));
  return shell;
}

function renderMarvelWebOrDefault() {
  if (!usesPlotChronology(plot)) return renderWeb();
  const wrap = document.createElement("div");
  wrap.className = "marvel-web-archive";
  const banner = document.createElement("p");
  banner.className = "marvel-web-archive-banner";
  const note = document.createElement("span");
  note.textContent = "Character web (archived). Watch order is the main Marvel view.";
  const back = document.createElement("button");
  back.type = "button";
  back.textContent = "Watch order";
  back.addEventListener("click", () => {
    state.view = "timeline";
    state.person = ALL;
    rememberView("timeline");
    render({ push: true });
  });
  banner.append(note, back);
  wrap.append(banner, renderWeb());
  return wrap;
}

function renderWeb() {
  const hubWeb = Boolean(plot.includeOrbit && plotHubs(plot).length >= 2);
  const compactMap = isCompact() && plot.arrangement !== "camps" && plot.arrangement !== "topics";
  const compactTopics = isCompact() && plot.arrangement === "topics";
  const section = document.createElement("section");
  section.className = `web${compactMap ? " is-compact-map" : ""}${compactTopics ? " is-compact-topics" : ""}${hubWeb ? " is-hub-field" : ""}`;
  const key = document.createElement("ul");
  key.className = "web-key";
  const keyItems = [
    ["friend", plot.friendLabelPlural || plot.friendLabel || "Friends"],
    ["enemy", plot.enemyLabelPlural || plot.enemyLabel || "Foes"],
  ];
  if (plot.arrangement === "topics") {
    keyItems.push(["orbit", plot.orbitLabel || "No stance yet"]);
    keyItems.push(["near", "Closer · more beats"]);
  } else if (plot.arrangement !== "camps") {
    if (plot.includeOrbit) keyItems.push(["orbit", plot.orbitLabel || "Around the show"]);
    keyItems.push(["near", "Closer · more beats"]);
  }
  keyItems.forEach(([camp, label]) => {
    const item = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.className = `swatch camp-${camp}`;
    item.append(swatch, document.createTextNode(label));
    key.appendChild(item);
  });
  const scroller = document.createElement("div");
  const scrollKind = plot.arrangement === "camps"
    ? " is-camps"
    : plot.arrangement === "topics"
      ? " is-topics"
        : compactMap ? " is-map" : "";
  scroller.className = `web-scroll${scrollKind}${hubWeb ? " is-hub-field" : ""}`;
  scroller.setAttribute(
    "aria-label",
    compactMap
      ? "Friends and foes map. Drag to look around. Names are listed below."
      : compactTopics
        ? "Policies for this year, grouped by topic. Tap one to read the stance."
      : hubWeb
        ? (plot.hubAriaLabel || "Hub web. Shared people sit in the center, hubs just outside. None shows that shared web. All shows every person on it. One hub shows only that hub's own people. Zoom and drag to read the field.")
        : "Friends and foes map",
  );
  const stage = document.createElement("div");
  stage.className = `web-stage${plot.images === "bubbles" ? " is-bubbles" : ""}`;
  scroller.appendChild(stage);
  if (hubWeb) {
    scroller.appendChild(buildWebTools(stage));
    bindWebGestures(scroller, stage);
  }
  section.append(key);
  if (plot.year) section.appendChild(renderYearBar());
  if (plot.arrangement === "topics" && plot.topics?.length) section.appendChild(renderTopicBar());
  if (isCompact() && !plot.year) {
    const hint = document.createElement("p");
    hint.className = "web-hint";
    hint.textContent = plot.arrangement === "camps"
      ? `${plot.yearHint || "Foes sit on the left, friends on the right."} Scroll to see everyone.`
      : "Drag the map to look around. Full names sit below — tap someone to open them.";
    section.appendChild(hint);
  }
  section.append(scroller);
  if (compactMap || compactTopics) {
    const roster = document.createElement("div");
    roster.className = "web-people";
    section.appendChild(roster);
  }
  if (usesPolicyPanel(plot)) {
    const drawer = document.createElement("aside");
    drawer.className = "relation-drawer policy-drawer";
    drawer.hidden = true;
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "Policy position");
    section.appendChild(drawer);
  }
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
  if (record) {
    if ((record.timeline || []).length >= 3) {
      const expand = document.createElement("button");
      expand.type = "button";
      expand.className = "drawer-expand";
      expand.textContent = "Expand full timeline";
      expand.addEventListener("click", () => {
        state.view = "relation";
        render({ push: true });
      });
      drawer.appendChild(expand);
    }
    drawer.appendChild(renderCountryHistory(record, { variant: "drawer" }));
  } else {
    const note = document.createElement("p");
    note.className = "drawer-notes";
    note.textContent = "Choose a country to read that relationship. Neutrals are in the regional lists and have no colored outline.";
    drawer.appendChild(note);
  }
}

function renderRelationPage() {
  const record = countryBySlug.get(state.country);
  const section = document.createElement("section");
  section.className = "focus relation-focus lane-page";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "back";
  back.textContent = "← Relations web";
  back.addEventListener("click", () => {
    state.view = "web";
    render({ push: true });
  });
  if (!record) {
    section.append(back, emptyState("Choose a country on the web to read its timeline."));
    return section;
  }
  const person = peopleById.get(record.slug);
  const head = document.createElement("div");
  head.className = "relation-ride-head";
  const identity = document.createElement("div");
  identity.className = "relation-ride-identity";
  identity.appendChild(avatar(person || { name: record.country }, "md"));
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `${statusLabel(record.status)} · scroll sideways`;
  const title = document.createElement("h2");
  title.id = "relation-page-title";
  title.textContent = `${plot.title} ↔ ${record.country}`;
  copy.append(eyebrow, title);
  identity.appendChild(copy);
  head.append(back, identity);
  section.append(head);
  if (relationTimelineHasTone(record.timeline)) section.appendChild(renderRelationRide(record));
  else section.appendChild(renderCountryHistory(record));
  return section;
}

function renderRelationRide(record) {
  let layout = relationRideLayoutForViewport(record.timeline, window.innerWidth);
  const root = document.createElement("div");
  root.className = "relation-ride";
  const readout = document.createElement("div");
  readout.className = "relation-ride-readout";
  const yearEl = document.createElement("p");
  yearEl.className = "relation-ride-year";
  const moodEl = document.createElement("p");
  moodEl.className = "relation-ride-mood";
  const eventEl = document.createElement("p");
  eventEl.className = "relation-ride-event";
  const hint = document.createElement("p");
  hint.className = "relation-ride-hint";
  hint.textContent = "Scroll sideways. They rise when the relationship warms and sink when it strains.";
  const linksEl = document.createElement("div");
  linksEl.className = "relation-ride-links";
  readout.append(yearEl, moodEl, eventEl, linksEl, hint);

  const stage = document.createElement("div");
  stage.className = "relation-ride-stage";
  const scroller = document.createElement("div");
  scroller.className = "relation-ride-scroll";
  scroller.tabIndex = 0;
  scroller.setAttribute("aria-label", "Relationship timeline. Scroll sideways.");
  const track = document.createElement("div");
  const cardTop = layout.pathHeight + 16;
  const cardBand = 150;
  track.className = "relation-ride-track";
  track.style.background = `linear-gradient(180deg, rgba(125, 206, 160, 0.16), rgba(224, 106, 98, 0.16) ${layout.pathHeight}px, transparent ${layout.pathHeight}px)`;

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

  const cards = layout.points.map((point, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `relation-ride-card ${relationToneClass(point.tone)}`;
    const year = document.createElement("span");
    year.textContent = String(record.timeline[point.index]?.year || point.year);
    const text = document.createElement("p");
    text.textContent = point.event;
    card.append(year, text);
    card.addEventListener("click", () => {
      const here = layout.points[index];
      scroller.scrollTo({ left: Math.max(0, here.x - scroller.clientWidth / 2), behavior: "smooth" });
    });
    track.appendChild(card);
    return card;
  });
  const marks = [...svg.querySelectorAll(".relation-ride-mark")];
  const frame = { track, svg, sky, zero, trail, marks, cards, cardTop, cardBand };
  paintRelationRideFrame({ ...frame, layout });

  scroller.appendChild(track);
  const rider = renderRelationRider(record);
  stage.append(scroller, rider);
  root.append(readout, stage);

  const paint = () => {
    const x = scroller.scrollLeft + scroller.clientWidth / 2;
    const here = relationRideAt(layout, x);
    rider.style.top = `${here.y}px`;
    paintRelationRider(rider, here.tone);
    let nearest = layout.points[0];
    layout.points.forEach((point) => {
      if (Math.abs(point.x - x) < Math.abs(nearest.x - x)) nearest = point;
    });
    yearEl.textContent = String(record.timeline[nearest.index]?.year || nearest.year);
    moodEl.textContent = relationMoodLabel(here.tone);
    moodEl.dataset.mood = relationToneClass(here.tone);
    eventEl.textContent = nearest.event;
    linksEl.replaceChildren();
    const chips = renderSourceChips(record.timeline[nearest.index]?.links, "relation-links beat-links");
    if (chips) linksEl.appendChild(chips);
    cards.forEach((card, index) => {
      card.classList.toggle("is-now", layout.points[index] === nearest);
    });
  };
  scroller.addEventListener("scroll", paint, { passive: true });
  scroller.addEventListener("wheel", (event) => {
    if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    event.preventDefault();
    scroller.scrollLeft += event.deltaY;
  }, { passive: false });
  const refit = () => {
    if (!scroller.isConnected) return;
    const clientWidth = scroller.clientWidth || window.innerWidth;
    const tallest = cards.reduce((max, card) => Math.max(max, card.offsetHeight), 0);
    const available = scroller.clientHeight;
    const pathHeight = available && tallest
      ? Math.max(140, Math.min(320, available - tallest - 36))
      : 320;
    const next = relationRideLayoutForViewport(record.timeline, clientWidth, { pathHeight });
    frame.cardTop = next.pathHeight + 16;
    if (next.padX === layout.padX && next.width === layout.width && next.pathHeight === layout.pathHeight) return;
    const focusX = scroller.scrollLeft + clientWidth / 2;
    let nearest = 0;
    layout.points.forEach((point, index) => {
      if (Math.abs(point.x - focusX) < Math.abs(layout.points[nearest].x - focusX)) nearest = index;
    });
    layout = next;
    track.style.background = `linear-gradient(180deg, rgba(125, 206, 160, 0.16), rgba(224, 106, 98, 0.16) ${layout.pathHeight}px, transparent ${layout.pathHeight}px)`;
    paintRelationRideFrame({ ...frame, layout });
    const point = layout.points[nearest];
    if (point) scroller.scrollLeft = Math.max(0, point.x - clientWidth / 2);
  };
  const onResize = () => {
    if (!scroller.isConnected) {
      window.removeEventListener("resize", onResize);
      return;
    }
    refit();
    paint();
  };
  window.addEventListener("resize", onResize);
  requestAnimationFrame(() => {
    refit();
    paint();
  });
  const sources = renderCountrySources(record);
  if (sources) root.appendChild(sources);
  return root;
}

function renderRelationRider(record) {
  const flags = relationRiderFlags(record, peopleById, { centerId: plot.centerId });
  const rider = document.createElement("div");
  rider.className = "relation-rider";
  rider.setAttribute("aria-hidden", "true");
  rider.dataset.partner = flags.partner.slug;
  rider.dataset.center = flags.center.slug;
  rider.append(
    riderFaceSvg(),
    riderFlagBadge(flags.partner, "rider-flag-partner"),
    riderFlagBadge(flags.center, "rider-flag-center"),
  );
  return rider;
}

function riderFlagBadge(flag, className) {
  const badge = document.createElement("span");
  badge.className = `rider-flag ${className}`;
  if (flag.slug) badge.dataset.slug = flag.slug;
  if (flag.src) badge.dataset.src = flag.src;
  if (flag.src) {
    const image = document.createElement("img");
    image.src = flag.src;
    image.alt = "";
    image.decoding = "async";
    image.addEventListener("error", () => {
      image.remove();
      badge.textContent = initials(flag.name);
    }, { once: true });
    badge.appendChild(image);
    return badge;
  }
  badge.textContent = initials(flag.name);
  return badge;
}

function riderFaceSvg() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 128 78");
  svg.setAttribute("width", "128");
  svg.setAttribute("height", "78");
  svg.innerHTML = `
    <path class="rider-string" d="M34 40 Q64 48 94 40" fill="none" stroke="#e8c47a" stroke-width="2" stroke-linecap="round"/>
    <g class="rider-face" transform="translate(64 30)">
      <circle r="16" fill="#f4e2c4" stroke="#1a1612" stroke-width="1.5"/>
      <path class="rider-eye rider-eye-l" d="M-7 -1 q1.6 -2.4 3.2 0" fill="none" stroke="#1a1612" stroke-width="1.4" stroke-linecap="round"/>
      <path class="rider-eye rider-eye-r" d="M3.8 -1 q1.6 -2.4 3.2 0" fill="none" stroke="#1a1612" stroke-width="1.4" stroke-linecap="round"/>
      <path class="rider-mouth" d="M-6 5 Q0 11 6 5" fill="none" stroke="#1a1612" stroke-width="1.5" stroke-linecap="round"/>
    </g>
  `;
  return svg;
}

function paintRelationRider(rider, tone) {
  const clamped = Math.max(-2, Math.min(2, tone));
  const smile = clamped / 2;
  const mouth = rider.querySelector(".rider-mouth");
  const string = rider.querySelector(".rider-string");
  const eyes = rider.querySelectorAll(".rider-eye");
  if (mouth) {
    const curve = 6 + smile * 10;
    mouth.setAttribute("d", `M-6 5 Q0 ${curve.toFixed(1)} 6 5`);
  }
  if (string) {
    const sag = 46 - smile * 22;
    string.setAttribute("d", `M34 40 Q64 ${sag.toFixed(1)} 94 40`);
  }
  eyes.forEach((eye, index) => {
    const start = index === 0 ? -7 : 3.8;
    const lift = -1 - smile * 1.2;
    const bend = -1.2 - smile * 2.6;
    eye.setAttribute("d", `M${start} ${lift.toFixed(1)} q1.6 ${bend.toFixed(1)} 3.2 0`);
  });
  rider.dataset.mood = relationToneClass(clamped);
}

function renderSourceChips(items, className = "relation-links") {
  const links = httpsSourceLinks(items);
  if (!links.length) return null;
  const wrap = document.createElement("div");
  wrap.className = className;
  links.forEach((link) => {
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.textContent = link.label || "Source";
    wrap.appendChild(anchor);
  });
  return wrap;
}

function renderCountrySources(record) {
  const sources = document.createElement("div");
  sources.className = "country-sources";
  const countryChips = renderSourceChips(record.links, "relation-links country-links");
  if (countryChips) {
    const heading = document.createElement("p");
    heading.className = "country-sources-label";
    heading.textContent = "Sources";
    sources.append(heading, countryChips);
  }
  if (record.wiki_bilateral) {
    const more = document.createElement("a");
    more.className = "drawer-more";
    more.href = record.wiki_bilateral;
    more.target = "_blank";
    more.rel = "noreferrer";
    more.textContent = "Read more on Wikipedia";
    sources.appendChild(more);
  }
  return sources.childNodes.length ? sources : null;
}

function renderCountryHistory(record, { variant = "drawer", chartWidth } = {}) {
  const block = document.createElement("div");
  block.className = `country-history${variant === "page" ? " is-page" : ""}`;
  const width = chartWidth || (variant === "page" ? 1100 : 360);
  const chartWrap = variant === "drawer" && relationTimelineHasTone(record.timeline)
    ? renderRelationSentimentChart(record, { width, tall: false })
    : null;
  if (chartWrap) block.appendChild(chartWrap.root);
  const list = document.createElement("ol");
  list.className = "relation-timeline";
  (record.timeline || []).forEach((beat, index) => {
    const item = document.createElement("li");
    item.dataset.beat = String(index);
    if (typeof beat.tone === "number") item.classList.add(relationToneClass(beat.tone));
    const year = document.createElement("span");
    year.className = "relation-year";
    year.textContent = String(beat.year);
    const text = document.createElement("p");
    text.textContent = beat.event;
    item.append(year, text);
    const beatLinks = renderSourceChips(beat.links, "relation-links beat-links");
    if (beatLinks) item.appendChild(beatLinks);
    list.appendChild(item);
  });
  if (chartWrap) wireRelationSentimentChart(chartWrap, list);
  block.appendChild(list);
  const sources = renderCountrySources(record);
  if (sources) block.appendChild(sources);
  return block;
}

function relationToneClass(tone) {
  if (tone >= 1.5) return "tone-strong-warm";
  if (tone >= 0.5) return "tone-warm";
  if (tone <= -1.5) return "tone-strong-strained";
  if (tone <= -0.5) return "tone-strained";
  return "tone-mixed";
}

function renderRelationSentimentChart(record, { width = 360, tall = false } = {}) {
  const layout = relationSentimentChart(record.timeline, { width, height: tall ? 200 : 132 });
  const root = document.createElement("div");
  root.className = "relation-sentiment";
  const title = document.createElement("p");
  title.className = "relation-sentiment-title";
  title.textContent = "Relationship warmth over time";
  const hint = document.createElement("p");
  hint.className = "relation-sentiment-hint";
  hint.textContent = "Above the line reads warmer; below reads more strained. Hover a point or beat to match.";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "relation-sentiment-chart");
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", `Chart of United States–${record.country} relationship warmth by year`);
  const defs = document.createElementNS(SVG_NS, "defs");
  const warm = document.createElementNS(SVG_NS, "linearGradient");
  warm.setAttribute("id", "relation-warm");
  warm.setAttribute("x1", "0");
  warm.setAttribute("y1", "0");
  warm.setAttribute("x2", "0");
  warm.setAttribute("y2", "1");
  [["0%", "#7dcea0", "0.55"], ["100%", "#7dcea0", "0"]].forEach(([offset, color, opacity]) => {
    const stop = document.createElementNS(SVG_NS, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    stop.setAttribute("stop-opacity", opacity);
    warm.appendChild(stop);
  });
  const cool = document.createElementNS(SVG_NS, "linearGradient");
  cool.setAttribute("id", "relation-cool");
  cool.setAttribute("x1", "0");
  cool.setAttribute("y1", "0");
  cool.setAttribute("x2", "0");
  cool.setAttribute("y2", "1");
  [["0%", "#e06a62", "0"], ["100%", "#e06a62", "0.5"]].forEach(([offset, color, opacity]) => {
    const stop = document.createElementNS(SVG_NS, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    stop.setAttribute("stop-opacity", opacity);
    cool.appendChild(stop);
  });
  defs.append(warm, cool);
  svg.appendChild(defs);
  const axis = document.createElementNS(SVG_NS, "line");
  axis.setAttribute("class", "relation-sentiment-zero");
  axis.setAttribute("x1", String(layout.pad.left));
  axis.setAttribute("x2", String(layout.width - layout.pad.right));
  axis.setAttribute("y1", String(layout.zeroY));
  axis.setAttribute("y2", String(layout.zeroY));
  svg.appendChild(axis);
  const area = document.createElementNS(SVG_NS, "path");
  area.setAttribute("class", "relation-sentiment-area");
  area.setAttribute("d", layout.areaPath);
  area.setAttribute("fill", "url(#relation-warm)");
  svg.appendChild(area);
  const line = document.createElementNS(SVG_NS, "path");
  line.setAttribute("class", "relation-sentiment-line");
  line.setAttribute("d", layout.linePath);
  svg.appendChild(line);
  layout.ticks.forEach((tick) => {
    const label = document.createElementNS(SVG_NS, "text");
    label.setAttribute("class", "relation-sentiment-tick");
    label.setAttribute("x", String(tick.x));
    label.setAttribute("y", String(layout.height - 6));
    label.textContent = String(tick.year);
    svg.appendChild(label);
  });
  const dots = [];
  layout.points.forEach((point) => {
    const dot = document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("class", "relation-sentiment-dot");
    dot.setAttribute("cx", String(point.x));
    dot.setAttribute("cy", String(point.y));
    dot.setAttribute("r", "4.5");
    dot.dataset.beat = String(point.index);
    dot.dataset.tone = String(point.tone);
    svg.appendChild(dot);
    dots.push(dot);
  });
  const labels = document.createElement("div");
  labels.className = "relation-sentiment-labels";
  labels.innerHTML = "<span>Strained</span><span>Warm</span>";
  root.append(title, hint, svg, labels);
  return { root, svg, dots, layout };
}

function wireRelationSentimentChart(chartWrap, list) {
  const items = [...list.querySelectorAll("li")];
  const clear = () => {
    chartWrap.dots.forEach((dot) => dot.classList.remove("is-active"));
    items.forEach((item) => item.classList.remove("is-active"));
  };
  chartWrap.dots.forEach((dot) => {
    dot.addEventListener("pointerenter", () => {
      clear();
      dot.classList.add("is-active");
      const item = list.querySelector(`li[data-beat="${dot.dataset.beat}"]`);
      item?.classList.add("is-active");
      item?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    dot.addEventListener("pointerleave", clear);
    dot.addEventListener("focus", () => {
      clear();
      dot.classList.add("is-active");
      list.querySelector(`li[data-beat="${dot.dataset.beat}"]`)?.classList.add("is-active");
    });
    dot.addEventListener("blur", clear);
    dot.setAttribute("tabindex", "0");
    dot.setAttribute("role", "button");
  });
  items.forEach((item) => {
    item.addEventListener("pointerenter", () => {
      clear();
      item.classList.add("is-active");
      chartWrap.dots.find((dot) => dot.dataset.beat === item.dataset.beat)?.classList.add("is-active");
    });
    item.addEventListener("pointerleave", clear);
  });
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

function renderTopicBar() {
  const bar = document.createElement("div");
  bar.className = "region-bar topic-bar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Show one policy topic");
  (plot.topics || []).forEach((topic) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "region-toggle";
    button.dataset.topic = topic.id;
    const count = people.filter((person) => person.topic === topic.id).length;
    const open = openTopic === topic.id;
    button.classList.toggle("is-open", open);
    button.setAttribute("aria-pressed", String(open));
    button.textContent = `${topic.label} · ${count}`;
    button.addEventListener("click", () => toggleTopic(topic.id));
    bar.appendChild(button);
  });
  return bar;
}

function toggleTopic(id) {
  openTopic = openTopic === id ? "" : id;
  document.querySelectorAll(".topic-bar .region-toggle").forEach((button) => {
    const open = button.dataset.topic === openTopic;
    button.classList.toggle("is-open", open);
    button.setAttribute("aria-pressed", String(open));
  });
  const stage = document.querySelector(".web-stage");
  if (stage) paintWeb(stage, { animate: false });
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
  if (isGunBoardActive()) {
    syncRegulationBoardDom(gunBoard, state);
  } else if (plot?.arrangement === "wars") {
    warHover = "";
    paintWars();
  } else {
    const stage = document.querySelector(".web-stage");
    if (stage) paintWeb(stage, { animate: false });
  }
  writeUrl(true);
}

function paintWeb(stage, { animate = true } = {}) {
  if (!stage.isConnected) return;
  const bounds = stage.getBoundingClientRect();
  const scroller = stage.parentElement;
  const compact = isCompact();
  const camps = plot.arrangement === "camps";
  const topics = plot.arrangement === "topics";
  const bubbles = plot.images === "bubbles";
  const personWebFocus = usesHubWebPersonFocus() && state.person && state.person !== ALL;
  const hubField = Boolean(plot.includeOrbit && plotHubs(plot).length >= 2 && !camps && !topics && !personWebFocus);
  const hubCameraField = hubField || personWebFocus;
  let width;
  let height;
  if (hubCameraField) {
    const viewW = scroller?.clientWidth || 0;
    const viewH = scroller?.clientHeight || 0;
    if (viewW < 2 || viewH < 2) {
      requestAnimationFrame(() => paintWeb(stage, { animate }));
      return;
    }
    width = Math.max(320, viewW);
    height = Math.max(260, viewH);
    stage.classList.remove("is-compact-map");
  } else if (compact && !camps && !topics) {
    const viewport = Math.max(scroller?.clientWidth || 0, bounds.width, 320);
    const size = Math.max(1120, Math.round(viewport * 2.8));
    width = size;
    height = size;
    stage.style.width = `${size}px`;
    stage.style.height = `${size}px`;
    stage.classList.add("is-compact-map");
  } else if (compact && topics) {
    width = 320;
    height = 320;
    stage.style.width = "";
    stage.style.height = "";
  } else {
    if (bounds.width < 2 || bounds.height < 2) {
      requestAnimationFrame(() => paintWeb(stage, { animate }));
      return;
    }
    width = Math.max(320, Math.floor(bounds.width));
    height = Math.max(topics ? (compact ? 720 : 500) : 260, Math.floor(bounds.height));
    stage.style.width = "";
  }
  const titleScoped = usesTitleFilter()
    ? peopleForTitleSearch(people, events, relations, { query: state.query, hub: state.hub }, peopleById, chronology)
    : { people, relations };
  const cast = personWebFocus
    ? webCastForPersonFocus(titleScoped.people, titleScoped.relations, state.person)
    : titleScoped;
  const layout = webLayout(cast.people, cast.relations, {
    centerId: personWebFocus
      ? state.person
      : (plotHubs(plot).length ? activeCenter() : (activeCenter() || plot.centerId)),
    revealAll: state.hub === ALL && !personWebFocus,
    hubField: !personWebFocus,
    friendKinds: plot.friendKinds,
    enemyKinds: plot.enemyKinds,
    arrangement: plot.arrangement,
    year: plot.year ? state.year : undefined,
    events,
    width,
    height,
    topics: plot.topics,
    topicId: openTopic,
    includeOrbit: Boolean(plot.includeOrbit),
    minBeats: plot.minBeats,
    hubIds: plotHubs(plot).map((hub) => hub.centerId),
    hubs: plotHubs(plot),
  });
  stage.classList.toggle("is-quiet", !animate);
  stage.classList.toggle("is-hub-field", hubCameraField);
  if (hubCameraField) {
    stage.style.width = `${layout.width}px`;
    stage.style.height = `${layout.height}px`;
  } else if (layout.height > height + 2 || ((camps || topics) && layout.height >= height)) stage.style.height = `${layout.height}px`;
  else if (!(compact && !camps)) stage.style.height = "";
  stage.style.setProperty("--node", `${layout.nodeSize}px`);
  stage.style.setProperty("--center", `${layout.centerSize}px`);
  stage.style.setProperty("--bubble-w", `${layout.bubbleWidth || 128}px`);
  stage.style.setProperty("--topic-w", `${layout.topicWidth || 154}px`);
  stage.replaceChildren();

  const byId = new Map(layout.nodes.map((node) => [node.id, node]));
  (layout.regions || []).forEach((region) => {
    const el = document.createElement("section");
    el.className = `hub-region${region.active ? " is-active" : ""}`;
    el.dataset.kind = region.kind;
    el.style.left = `${region.x}px`;
    el.style.top = `${region.y}px`;
    el.style.width = `${region.width}px`;
    el.style.height = `${region.height}px`;
    const heading = document.createElement("h2");
    heading.textContent = region.label;
    const count = layout.nodes.filter((node) => node.hubRegion === region.id && node.id !== region.id).length;
    const note = document.createElement("span");
    note.textContent = `${count} ${count === 1 ? "person" : "people"}`;
    el.append(heading, note);
    stage.appendChild(el);
  });
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
    let camp = "";
    if (from.camp === "center") camp = to.camp;
    else if (to.camp === "center") camp = from.camp;
    else if (from.camp === "topic") camp = to.camp;
    else if (to.camp === "topic") camp = from.camp;
    if (camp && camp !== "topic") path.dataset.camp = camp;
    if (edge.kind === "topic") path.dataset.kind = "topic";
    svg.appendChild(path);
  });
  stage.appendChild(svg);

  (layout.labels || []).forEach((label) => {
    const el = document.createElement("div");
    el.className = "topic-label";
    el.textContent = label.text;
    el.style.left = `${label.x}px`;
    el.style.top = `${label.y}px`;
    stage.appendChild(el);
  });
  const light = (nodeId) => {
    const near = new Set(neighborhood(nodeId, relations));
    if (nodeId.startsWith("topic:")) {
      layout.nodes.forEach((item) => {
        if (item.topic === nodeId.slice(6) && item.camp !== "topic") near.add(item.id);
      });
      const centerId = activeCenter();
      if (centerId) near.add(centerId);
    } else {
      const person = peopleById.get(nodeId);
      if (person?.topic) near.add(`topic:${person.topic}`);
    }
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
    button.className = `node camp-${node.camp}${node.camp === "center" ? " is-center" : ""}${node.hub ? " is-topic-hub" : ""}${node.plotHub && node.camp !== "center" ? " is-plot-hub" : ""}${node.side ? ` node-${node.side}` : ""}${personWebFocus && node.id === state.person ? " is-selected" : ""}`;
    button.dataset.id = node.id;
    button.style.left = `${node.x}px`;
    button.style.top = `${node.y}px`;
    button.style.setProperty("--i", String(index));
    if (node.camp === "topic") {
      button.classList.add("is-bubble");
      const chip = document.createElement("span");
      chip.className = "node-bubble topic-hub";
      chip.textContent = node.name;
      button.appendChild(chip);
      button.setAttribute("aria-label", `${node.name}, policy topic`);
      button.title = node.name;
      button.addEventListener("click", () => toggleTopic(node.topic));
    } else if (bubbles && node.camp !== "center") {
      button.classList.add("is-bubble");
      const chip = document.createElement("span");
      chip.className = "node-bubble";
      chip.textContent = node.name;
      button.appendChild(chip);
    } else {
      button.append(avatar(node, node.camp === "center" ? "lg" : "md"));
      if (!(compact && !camps)) button.append(nameEl(node.name));
    }
    if (node.camp !== "topic") {
      const camp = campLabel(node.camp);
      const beats = node.beats ? `, ${node.beats} timeline ${node.beats === 1 ? "beat" : "beats"}` : "";
      button.setAttribute("aria-label", `${node.name}${camp ? `, ${camp}` : ""}${beats}`);
      button.title = node.beats ? `${node.name} · ${node.beats} beats` : node.name;
      button.addEventListener("click", () => openPerson(node.id));
    }
    button.addEventListener("pointerenter", () => light(node.id));
    button.addEventListener("pointerleave", clear);
    button.addEventListener("focus", () => light(node.id));
    button.addEventListener("blur", clear);
    stage.appendChild(button);
  });
  const counts = document.getElementById("year-counts");
  if (counts) {
    const friendCount = layout.nodes.filter((node) => node.camp === "friend").length;
    const foeCount = layout.nodes.filter((node) => node.camp === "enemy").length;
    counts.textContent = `${friendCount} ${countWord("friend", friendCount)} · ${foeCount} ${countWord("enemy", foeCount)}`;
  }
  if (hubField && usesTitleFilter() && state.query.trim() && !layout.nodes.length) {
    const note = document.createElement("p");
    note.className = "empty web-empty";
    note.textContent = "No one on this web matches that title in the current focus.";
    stage.appendChild(note);
  }
  if (hubCameraField) {
    stage.webLayout = layout;
    const token = `${plot.id}:${state.hub}:${state.person}:${state.query}:${layout.nodes.map((node) => node.id).sort().join(",")}`;
    const shouldFit = webFitToken !== token;
    webFitToken = token;
    applyHubCamera(stage, layout, { animate, fit: shouldFit });
  }
  else if (compact && !camps && !topics && scroller) {
    scroller.scrollLeft = Math.max(0, (stage.offsetWidth - scroller.clientWidth) / 2);
    scroller.scrollTop = Math.max(0, (stage.offsetHeight - scroller.clientHeight) / 2);
  }
  const roster = stage.closest(".web")?.querySelector(".web-people");
  if (roster) paintWebPeople(roster, layout);
  if (usesPolicyPanel(plot)) paintPolicySelection(stage.closest(".web"));
}

function clampWebZoom(value) {
  const next = Math.round(Number(value) * 100) / 100;
  return Math.min(WEB_ZOOM_MAX, Math.max(WEB_ZOOM_MIN, next));
}

function webCameraTransform(camera) {
  return `translate(${camera.x.toFixed(2)}px, ${camera.y.toFixed(2)}px) scale(${camera.scale.toFixed(4)})`;
}

function fittedWebCamera(stage, layout) {
  const scroller = stage.parentElement;
  const wideHubReveal = Boolean(
    plot?.includeOrbit
    && plotHubs(plot).length >= 5
    && state.hub === ALL
    && !(state.person && state.person !== ALL),
  );
  return hubFrame(layout.nodes, {
    viewWidth: scroller?.clientWidth || 0,
    viewHeight: scroller?.clientHeight || 0,
    boxW: Math.max(layout.boxW || 0, isCompact() ? 104 : 128),
    boxH: Math.max(layout.boxH || 0, isCompact() ? 96 : 116),
    preferWidth: wideHubReveal,
  });
}

function paintWebCamera(stage, camera, { animate = false } = {}) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const previous = hubCamera;
  if (animate && !reduced && previous) {
    stage.style.transition = "none";
    stage.style.transform = webCameraTransform(previous);
    stage.offsetWidth;
    stage.style.transition = "";
    stage.style.transform = webCameraTransform(camera);
  } else {
    stage.style.transition = animate && !reduced ? "" : "none";
    stage.style.transform = webCameraTransform(camera);
  }
  hubCamera = camera;
  stage.classList.toggle("is-web-small", camera.scale < 0.55);
  const scroller = stage.parentElement;
  const slider = scroller?.querySelector(".web-zoom");
  const readout = scroller?.querySelector(".web-readout");
  const percent = String(Math.round(camera.scale * 100));
  if (slider && document.activeElement !== slider) slider.value = percent;
  if (readout) readout.textContent = `${percent}%`;
}

function applyHubCamera(stage, layout, { animate = true, fit = false } = {}) {
  const frame = fittedWebCamera(stage, layout);
  if (fit || !hubCamera) {
    paintWebCamera(stage, frame, { animate });
    return;
  }
  paintWebCamera(stage, hubCamera, { animate: false });
}

function changeWebZoom(stage, zoom, anchor) {
  const scroller = stage.parentElement;
  if (!scroller) return;
  const prev = hubCamera || fittedWebCamera(stage, stage.webLayout || { nodes: [] });
  const scale = clampWebZoom(zoom);
  const rect = scroller.getBoundingClientRect();
  const originX = anchor ? anchor.x - rect.left : rect.width / 2;
  const originY = anchor ? anchor.y - rect.top : rect.height / 2;
  const contentX = (originX - prev.x) / (prev.scale || 1);
  const contentY = (originY - prev.y) / (prev.scale || 1);
  paintWebCamera(stage, {
    scale,
    x: originX - contentX * scale,
    y: originY - contentY * scale,
  });
}

function fitWebCamera(stage) {
  if (!stage.webLayout) return;
  paintWebCamera(stage, fittedWebCamera(stage, stage.webLayout), { animate: true });
}

function buildWebTools(stage) {
  const tools = document.createElement("div");
  tools.className = "web-tools";
  const zoomButton = (label, text, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lane-button";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", onClick);
    return button;
  };
  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "lane-zoom web-zoom";
  slider.min = String(Math.round(WEB_ZOOM_MIN * 100));
  slider.max = String(Math.round(WEB_ZOOM_MAX * 100));
  slider.value = "100";
  slider.setAttribute("aria-label", "Web zoom");
  slider.addEventListener("input", () => {
    const rect = stage.parentElement.getBoundingClientRect();
    changeWebZoom(stage, Number(slider.value) / 100, {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  });
  const readout = document.createElement("span");
  readout.className = "lane-readout web-readout";
  readout.textContent = "100%";
  tools.append(
    zoomButton("Zoom out", "−", () => changeWebZoom(stage, (hubCamera?.scale || 1) / 1.2)),
    slider,
    readout,
    zoomButton("Zoom in", "+", () => changeWebZoom(stage, (hubCamera?.scale || 1) * 1.2)),
    zoomButton("Fit the web to the page", "Fit", () => fitWebCamera(stage)),
  );
  return tools;
}

function bindWebGestures(scroller, stage) {
  scroller.addEventListener("wheel", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    const factor = Math.exp(-event.deltaY * 0.0016);
    changeWebZoom(stage, (hubCamera?.scale || 1) * factor, { x: event.clientX, y: event.clientY });
  }, { passive: false });

  let pan = null;
  scroller.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.pointerType !== "mouse") return;
    if (event.target.closest("button, a, input")) return;
    const camera = hubCamera || { x: 0, y: 0, scale: 1 };
    pan = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camX: camera.x,
      camY: camera.y,
    };
    scroller.setPointerCapture(event.pointerId);
    scroller.classList.add("is-panning");
  });
  scroller.addEventListener("pointermove", (event) => {
    if (!pan || event.pointerId !== pan.id) return;
    paintWebCamera(stage, {
      scale: hubCamera?.scale || 1,
      x: pan.camX + (event.clientX - pan.x),
      y: pan.camY + (event.clientY - pan.y),
    });
  });
  const endPan = (event) => {
    if (!pan || event.pointerId !== pan.id) return;
    pan = null;
    scroller.classList.remove("is-panning");
  };
  scroller.addEventListener("pointerup", endPan);
  scroller.addEventListener("pointercancel", endPan);
}

function topicPeopleGroups(nodes, byName) {
  const topics = plot.topics || [];
  return topics.map((topic) => {
    const list = nodes
      .filter((node) => node.topic === topic.id && node.camp !== "topic" && node.camp !== "center")
      .slice()
      .sort(byName);
    return [topic.id, topic.label, list];
  }).filter(([, , list]) => list.length);
}

function paintWebPeople(root, layout) {
  const byName = (a, b) => String(a.name).localeCompare(String(b.name), "en", { sensitivity: "base" });
  const groups = plot.arrangement === "topics"
    ? topicPeopleGroups(layout.nodes, byName)
    : [
      ["friend", plot.friendLabelPlural || plot.friendLabel || "Friends", layout.nodes.filter((node) => node.camp === "friend").slice().sort(byName)],
      ["enemy", plot.enemyLabelPlural || plot.enemyLabel || "Foes", layout.nodes.filter((node) => node.camp === "enemy").slice().sort(byName)],
    ];
  if (plot.arrangement !== "topics" && plot.includeOrbit) {
    groups.push(["orbit", plot.orbitLabel || "Around the show", layout.nodes.filter((node) => node.camp === "orbit").slice().sort(byName)]);
  }
  root.replaceChildren();
  groups.forEach(([camp, label, list]) => {
    if (!list.length) return;
    const block = document.createElement("section");
    block.className = `web-people-group camp-${camp}`;
    const heading = document.createElement("h3");
    heading.textContent = `${label} · ${list.length}`;
    const chips = document.createElement("ul");
    chips.className = "chip-list";
    list.forEach((person) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = `web-person camp-${person.camp || camp}`;
      const name = document.createElement("span");
      name.className = "chip-name";
      name.textContent = person.name;
      button.append(avatar(person, "sm"), name);
      const beats = person.beats ? ` · ${person.beats} ${person.beats === 1 ? "beat" : "beats"}` : "";
      button.setAttribute("aria-label", `${person.name}, ${campLabel(person.camp || camp) || label}${beats}`);
      button.addEventListener("click", () => openPerson(person.id));
      item.appendChild(button);
      chips.appendChild(item);
    });
    block.append(heading, chips);
    root.appendChild(block);
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

  const record = countryBySlug.get(person.id);
  const head = document.createElement("div");
  head.className = "focus-head";
  head.appendChild(back);
  const face = avatar(person, "lg");
  if (record) face.classList.add(outlineClass(record));
  head.appendChild(face);
  const copy = document.createElement("div");
  const centerId = activeCenter();
  const camp = campOf(
    person.id,
    relations,
    centerId,
    plot.friendKinds,
    plot.enemyKinds,
    plot.year ? state.year : undefined,
  );
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = person.id === centerId
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

  const center = peopleById.get(centerId);
  const ties = tiesWith(person.id, relations, centerId);
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
    section.classList.add("lane-page");
    section.append(head, renderCountryHistory(record));
    return section;
  }
  const theirs = events.filter((event) => event.people.includes(person.id));
  section.classList.add("lane-page");
  section.append(head, renderRail(theirs, {
    focusId: person.id,
    note: person.id === centerId
      ? (isCompact() ? "Every sourced beat, oldest at the top." : "Every sourced beat, oldest on the left.")
      : (isCompact()
        ? `Beats with ${person.name}, oldest at the top.`
        : `Beats with ${person.name}, oldest on the left.`),
  }));
  return section;
}

function renderChronologyPage() {
  return renderMarvelChronologyIndex({
    chronology,
    focusId: resolveChronologyTitle(state.chronologyTitle),
    onFocus: (id) => {
      state.chronologyTitle = id;
      state.view = "timeline";
      rememberView("timeline");
      render({ push: true });
    },
  });
}

function renderTimeline() {
  if (usesPlotChronology(plot) && chronology?.titles?.length) {
    return renderMarvelChronology({
      chronology,
      peopleById,
      focusId: resolveChronologyTitle(state.chronologyTitle),
      onFocus: (id) => {
        state.chronologyTitle = id;
        writeUrl(true);
      },
      onOpenPerson: (id) => openPerson(id),
      onOpenWeb: () => {
        state.view = "web";
        state.person = ALL;
        rememberView("web");
        render({ push: true });
      },
      onOpenChronology: () => {
        state.view = "chronology";
        state.person = ALL;
        rememberView("chronology");
        render({ push: true });
      },
      avatar,
    });
  }
  const section = document.createElement("section");
  section.className = "focus timeline-focus lane-page";
  const head = document.createElement("div");
  head.className = "timeline-head";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  const hub = activeHub();
  eyebrow.textContent = hub ? `${hub.label} timeline` : "Full timeline";
  const title = document.createElement("h2");
  title.textContent = hub ? hub.label : "Across the years";
  copy.append(eyebrow, title);

  if (!usesTitleFilter()) {
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
      const next = $("app").querySelector(".timeline-focus input[type=search]");
      if (next) {
        next.focus();
        const end = next.value.length;
        next.setSelectionRange(end, end);
      }
    });
    search.append(searchLabel, input);
    head.append(copy, search);
  } else {
    head.append(copy);
  }

  const shown = filterEvents(events, { query: state.query, hub: state.hub }, peopleById);
  section.append(head, renderRail(shown, {
    note: isCompact()
      ? hub
        ? `${hub.label}'s public record, oldest at the top. Open a beat for the sources.`
        : "The whole public record, oldest at the top. Open a beat for the sources."
      : hub
        ? `${hub.label}'s public record, oldest on the left. Open a beat for the sources.`
        : "The whole public record, oldest on the left. Open a beat for the sources.",
  }));
  if (!shown.length) section.appendChild(emptyState("Nothing in this plot matches that search."));
  return section;
}

function renderRail(list, { focusId = "", note = "" } = {}) {
  if (isCompact()) return renderSpine(list, { focusId, note });
  const { view, rail } = buildLaneChrome(note);
  let year = "";
  let step = 0;
  list.forEach((event) => {
    const nextYear = event.date.slice(0, 4);
    if (nextYear !== year) {
      year = nextYear;
      rail.appendChild(laneYear(year));
    }
    const side = step % 2 === 0 ? "above" : "below";
    step += 1;
    rail.appendChild(renderLaneEvent(event, side, focusId));
  });
  requestAnimationFrame(() => layoutLane(view));
  return view;
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
  const era = document.createElement("em");
  era.textContent = eraLabel(event.era);
  const open = state.eventId === event.id;
  hit.append(when, heading);
  if (!open) {
    const tease = document.createElement("span");
    tease.className = "beat-tease";
    tease.textContent = eventTease(event, 140);
    hit.appendChild(tease);
  }
  hit.appendChild(era);
  hit.addEventListener("click", toggle);
  copy.appendChild(hit);

  if (open) {
    const more = document.createElement("div");
    more.className = "spine-more";
    const body = expandedSummary(event);
    if (body) {
      const summary = document.createElement("p");
      summary.textContent = body;
      more.appendChild(summary);
    }
    const names = document.createElement("p");
    names.className = "detail-names";
    names.textContent = event.people.map((id) => peopleById.get(id)?.name || id).join(" · ");
    more.append(names, faceRow(event.people));
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
  const era = document.createElement("em");
  era.textContent = eraLabel(event.era);
  const open = state.eventId === event.id;
  hit.append(when, rule, heading);
  if (!open) {
    const tease = document.createElement("span");
    tease.className = "beat-tease";
    tease.textContent = eventTease(event, 140);
    hit.appendChild(tease);
  }
  hit.appendChild(era);
  hit.addEventListener("click", toggle);
  card.append(mark, hit);

  if (open) {
    const more = document.createElement("div");
    more.className = "lane-more";
    const body = expandedSummary(event);
    if (body) {
      const summary = document.createElement("p");
      summary.textContent = body;
      more.appendChild(summary);
    }
    const names = document.createElement("p");
    names.className = "detail-names";
    names.textContent = event.people.map((id) => peopleById.get(id)?.name || id).join(" · ");
    more.append(names, faceRow(event.people));
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
  const skip = activeCenter();
  const preferred = focusId && ids.includes(focusId)
    ? focusId
    : ids.find((id) => id !== skip) || ids[0];
  return peopleById.get(preferred) || { name: "?", id: preferred || "unknown" };
}

function applyWarSpan(target, url = location.href) {
  if (plot?.arrangement !== "wars" || !plot.year) {
    target.from = null;
    target.to = null;
    return target;
  }
  const params = url ? new URL(url, "https://plotmaniac.com/").searchParams : new URLSearchParams();
  const yearParam = params.get("year");
  const fallback = yearParam == null || yearParam === "" ? plot.year.initial : target.year;
  const span = parseWarSpan(params.get("from"), params.get("to"), plot.year, fallback);
  target.from = span.from;
  target.to = span.to;
  target.year = span.to;
  return target;
}

function warSpanLabel(from, to) {
  return from === to ? String(from) : `${from}–${to}`;
}

function renderWarSpanBar() {
  const bar = document.createElement("div");
  bar.className = "year-bar wars-span";
  const readout = document.createElement("p");
  readout.className = "year-readout";
  readout.textContent = warSpanLabel(state.from, state.to);
  const hint = document.createElement("p");
  hint.className = "year-hint";
  hint.textContent = plot.yearHint || "Drag each end of the span. Click a country to read its wars.";
  const fromRow = document.createElement("label");
  fromRow.className = "span-row";
  const fromName = document.createElement("span");
  fromName.textContent = "From";
  const fromInput = document.createElement("input");
  fromInput.type = "range";
  fromInput.className = "year-drag";
  fromInput.dataset.bound = "from";
  fromInput.min = String(plot.year.min);
  fromInput.max = String(plot.year.max);
  fromInput.step = "1";
  fromInput.value = String(state.from);
  fromInput.setAttribute("aria-label", "First year of the time frame");
  fromInput.addEventListener("input", () => setWarSpan(fromInput.value, state.to));
  fromRow.append(fromName, fromInput);
  const toRow = document.createElement("label");
  toRow.className = "span-row";
  const toName = document.createElement("span");
  toName.textContent = "To";
  const toInput = document.createElement("input");
  toInput.type = "range";
  toInput.className = "year-drag";
  toInput.dataset.bound = "to";
  toInput.min = String(plot.year.min);
  toInput.max = String(plot.year.max);
  toInput.step = "1";
  toInput.value = String(state.to);
  toInput.setAttribute("aria-label", "Last year of the time frame");
  toInput.addEventListener("input", () => setWarSpan(state.from, toInput.value));
  toRow.append(toName, toInput);
  const marks = document.createElement("div");
  marks.className = "year-marks";
  const all = document.createElement("button");
  all.type = "button";
  all.dataset.span = "all";
  all.textContent = "All";
  all.classList.toggle("is-active", state.from === plot.year.min && state.to === plot.year.max);
  all.addEventListener("click", () => setWarSpan(plot.year.min, plot.year.max));
  marks.appendChild(all);
  (plot.year.marks || []).forEach((year) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.year = String(year);
    button.textContent = year === plot.year.max ? "Now" : String(year);
    button.classList.toggle("is-active", state.from === year && state.to === year);
    button.addEventListener("click", () => setWarSpan(year, year));
    marks.appendChild(button);
  });
  const counts = document.createElement("p");
  counts.className = "year-counts";
  counts.id = "year-counts";
  bar.append(readout, hint, fromRow, toRow, marks, counts);
  return bar;
}

function setWarSpan(from, to) {
  if (plot?.arrangement !== "wars" || !plot.year) return;
  const span = parseWarSpan(from, to, plot.year, state.year);
  state.from = span.from;
  state.to = span.to;
  state.year = span.to;
  const readout = document.querySelector(".wars-span .year-readout");
  if (readout) readout.textContent = warSpanLabel(span.from, span.to);
  document.querySelectorAll(".wars-span .year-drag").forEach((input) => {
    input.value = String(input.dataset.bound === "from" ? span.from : span.to);
  });
  document.querySelectorAll(".wars-span .year-marks button").forEach((button) => {
    if (button.dataset.span === "all") {
      button.classList.toggle("is-active", span.from === plot.year.min && span.to === plot.year.max);
      return;
    }
    const year = Number(button.dataset.year);
    button.classList.toggle("is-active", span.from === year && span.to === year);
  });
  warHover = "";
  paintWars();
  writeUrl(true);
}

function warSources() {
  return httpsSourceLinks(plot?.sources || []);
}

function appendExternalLinks(parent, links, separator) {
  links.forEach((source, index) => {
    if (index) parent.append(document.createTextNode(separator));
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = source.label;
    parent.appendChild(link);
  });
}

function renderWars() {
  const section = document.createElement("section");
  section.className = "wars-board";
  section.appendChild(renderWarSpanBar());
  const stage = document.createElement("div");
  stage.className = "wars-stage";
  const mapWrap = document.createElement("div");
  mapWrap.className = "wars-map-wrap";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("wars-map");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "World map of countries at war in the selected year");
  mapWrap.appendChild(svg);
  const list = document.createElement("div");
  list.className = "wars-list";
  list.id = "wars-list";
  stage.append(mapWrap, list);
  section.appendChild(stage);
  requestAnimationFrame(() => paintWars());
  return section;
}

function selectWarCountry(iso) {
  if (!iso) return;
  const next = `country:${iso}`;
  warFocus = warFocus === next ? "" : next;
  warHover = "";
  paintWars();
}

function warSpan(war) {
  if (war.end == null || war.end === "") return `${war.start}–now`;
  if (Number(war.end) === Number(war.start)) return String(war.start);
  return `${war.start}–${war.end}`;
}

function paintWars() {
  const svg = document.querySelector(".wars-map");
  const list = document.getElementById("wars-list");
  if (!svg || !list || !worldMap) return;
  const size = warMapSize();
  svg.setAttribute("viewBox", `0 0 ${size.width.toFixed(1)} ${size.height.toFixed(1)}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  if (!svg.dataset.lands) {
    const lands = document.createElementNS(SVG_NS, "g");
    lands.classList.add("lands");
    worldMap.features.forEach((feature) => {
      const iso = feature.properties?.iso;
      const outline = geometryOutline(feature.geometry, (lon, lat) => projectWarPoint(lon, lat));
      if (!iso || !outline) return;
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", outline);
      path.classList.add("land");
      path.dataset.iso = iso;
      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = feature.properties.name || iso;
      path.appendChild(title);
      path.addEventListener("click", () => selectWarCountry(iso));
      lands.appendChild(path);
    });
    svg.appendChild(lands);
    svg.dataset.lands = "1";
  }
  const snapshot = warsInSpan(warsData.conflicts, state.from, state.to);
  if (warFocus && !warFocus.startsWith("country:") && !snapshot.wars.some((war) => war.id === warFocus)) warFocus = "";
  const counts = document.getElementById("year-counts");
  if (counts) {
    const warsLabel = snapshot.wars.length === 1 ? "war" : "wars";
    const pairsLabel = snapshot.pairs.length === 1 ? "pair" : "pairs";
    counts.textContent = `${snapshot.wars.length} ${warsLabel} · ${snapshot.pairs.length} ${pairsLabel}`;
  }
  const fighting = new Set(snapshot.countries);
  svg.querySelectorAll(".land").forEach((path) => {
    path.classList.toggle("is-fighting", fighting.has(path.dataset.iso));
  });
  svg.querySelectorAll(".war-arc, .war-dot").forEach((node) => node.remove());
  const anchors = countryAnchors(worldMap);
  const dots = spreadWarDots(snapshot.countries.map((iso) => {
    const anchor = anchors.get(iso);
    if (!anchor) return null;
    const point = projectWarPoint(anchor.lon, anchor.lat);
    const warIds = snapshot.wars
      .filter((war) => (war.sides || []).some((side) => (side.states || []).includes(iso)))
      .map((war) => war.id);
    return {
      iso,
      x: point.x,
      y: point.y,
      name: warsData.countries[iso]?.name || anchor.name,
      warIds,
    };
  }).filter(Boolean));
  const byIso = new Map(dots.map((dot) => [dot.iso, dot]));
  const focus = warHover || warFocus;
  snapshot.pairs.forEach((pair) => {
    const from = byIso.get(pair.a);
    const to = byIso.get(pair.b);
    if (!from || !to) return;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", warArcPath(from.x, from.y, to.x, to.y));
    path.classList.add("war-arc");
    path.dataset.wars = pair.warIds.join(" ");
    const names = pair.warIds
      .map((id) => snapshot.wars.find((war) => war.id === id)?.name)
      .filter(Boolean);
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = names.join(", ");
    path.appendChild(title);
    path.addEventListener("mouseenter", () => {
      warHover = pair.warIds[0] || "";
      applyWarFocus();
    });
    path.addEventListener("mouseleave", () => {
      warHover = "";
      applyWarFocus();
    });
    path.addEventListener("click", () => {
      const next = pair.warIds[0] || "";
      warFocus = warFocus === next ? "" : next;
      applyWarFocus();
    });
    svg.appendChild(path);
  });
  dots.forEach((dot) => {
    const mark = document.createElementNS(SVG_NS, "circle");
    mark.classList.add("war-dot");
    mark.setAttribute("cx", dot.x.toFixed(1));
    mark.setAttribute("cy", dot.y.toFixed(1));
    mark.setAttribute("r", "4.5");
    mark.dataset.iso = dot.iso;
    mark.dataset.wars = dot.warIds.join(" ");
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = dot.name;
    mark.appendChild(title);
    mark.addEventListener("mouseenter", () => {
      warHover = `country:${dot.iso}`;
      applyWarFocus();
    });
    mark.addEventListener("mouseleave", () => {
      warHover = "";
      applyWarFocus();
    });
    mark.addEventListener("click", () => selectWarCountry(dot.iso));
    svg.appendChild(mark);
  });
  const chosenIso = (warFocus || "").startsWith("country:") ? warFocus.slice("country:".length) : "";
  const chosenWars = chosenIso ? warsForCountry(snapshot.wars, chosenIso) : snapshot.wars;
  const chosenName = chosenIso
    ? (warsData.countries[chosenIso]?.name || svg.querySelector(`.land[data-iso="${chosenIso}"] title`)?.textContent || chosenIso)
    : "";
  const header = document.createElement("div");
  header.className = "wars-list-head";
  const kicker = document.createElement("p");
  kicker.className = chosenIso ? "wars-country" : "wars-kicker";
  kicker.textContent = chosenIso ? chosenName : "Wars in this span";
  header.appendChild(kicker);
  const frame = document.createElement("p");
  frame.className = "wars-frame";
  const frameLabel = warSpanLabel(state.from, state.to);
  const shownCount = chosenWars.length;
  frame.textContent = chosenIso
    ? `${frameLabel} · ${shownCount} ${shownCount === 1 ? "war" : "wars"}`
    : frameLabel;
  header.appendChild(frame);
  if (chosenIso) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "wars-back";
    back.textContent = "All wars in this span";
    back.addEventListener("click", () => {
      warFocus = "";
      paintWars();
    });
    header.appendChild(back);
  }
  const sources = document.createElement("p");
  sources.className = "wars-sources";
  appendExternalLinks(sources, warSources(), " · ");
  header.appendChild(sources);
  const stack = document.createElement("div");
  stack.className = "wars-cards";
  const ordered = chosenWars.slice().sort(compareWarsByStart);
  if (!ordered.length) {
    const empty = document.createElement("p");
    empty.className = "wars-empty";
    empty.textContent = chosenIso
      ? `No war from these lists names ${chosenName} in ${frameLabel}.`
      : `No war from these lists overlaps ${frameLabel}.`;
    stack.appendChild(empty);
  }
  ordered.forEach((war) => {
    const card = document.createElement("article");
    card.className = "war-card";
    card.dataset.war = war.id;
    card.tabIndex = 0;
    const title = document.createElement("a");
    title.href = war.wikipedia;
    title.target = "_blank";
    title.rel = "noreferrer";
    title.textContent = war.name;
    const years = document.createElement("p");
    years.className = "war-years";
    years.textContent = warSpan(war);
    const parties = document.createElement("p");
    parties.className = "war-parties";
    parties.textContent = chosenIso
      ? warCountryNote(war, chosenIso, warsData.countries)
      : warPartyLine(war, warsData.countries);
    card.append(title, years, parties);
    if (chosenIso) {
      const sides = document.createElement("p");
      sides.className = "war-parties";
      sides.textContent = warPartyLine(war, warsData.countries);
      card.appendChild(sides);
    }
    const focusCard = () => {
      warHover = war.id;
      applyWarFocus();
    };
    card.addEventListener("mouseenter", focusCard);
    card.addEventListener("focusin", focusCard);
    card.addEventListener("mouseleave", () => {
      warHover = "";
      applyWarFocus();
    });
    card.addEventListener("focusout", () => {
      warHover = "";
      applyWarFocus();
    });
    card.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      if (chosenIso) {
        warFocus = warFocus === war.id ? `country:${chosenIso}` : war.id;
      } else {
        warFocus = warFocus === war.id ? "" : war.id;
      }
      applyWarFocus();
    });
    stack.appendChild(card);
  });
  list.replaceChildren(header, stack);
  applyWarFocus();
}

function applyWarFocus() {
  const svg = document.querySelector(".wars-map");
  const focus = warHover || warFocus;
  if (svg) svg.classList.toggle("is-focused", Boolean(focus));
  const wars = (warsData.conflicts || []).filter((war) => warOverlapsSpan(war, state.from, state.to));
  const litWar = (id) => warMatchesFocus(wars.find((war) => war.id === id), focus);
  svg?.querySelectorAll(".war-arc").forEach((path) => {
    const ids = (path.dataset.wars || "").split(" ").filter(Boolean);
    path.classList.toggle("is-lit", Boolean(focus) && ids.some((id) => litWar(id)));
  });
  svg?.querySelectorAll(".war-dot").forEach((dot) => {
    const ids = (dot.dataset.wars || "").split(" ").filter(Boolean);
    const countryHit = focus === `country:${dot.dataset.iso}`;
    dot.classList.toggle("is-lit", Boolean(focus) && (countryHit || ids.some((id) => litWar(id))));
  });
  svg?.querySelectorAll(".land").forEach((path) => {
    const countryHit = focus === `country:${path.dataset.iso}`;
    const involved = wars.some((war) => warMatchesFocus(war, focus) && (war.sides || []).some((side) => (side.states || []).includes(path.dataset.iso)));
    path.classList.toggle("is-lit", Boolean(focus) && (countryHit || involved));
    path.classList.toggle("is-chosen", warFocus === `country:${path.dataset.iso}`);
  });
  document.querySelectorAll(".war-card").forEach((card) => {
    const war = wars.find((item) => item.id === card.dataset.war);
    card.classList.toggle("is-lit", Boolean(focus) && warMatchesFocus(war, focus));
  });
}

function renderCredits() {
  const list = $("credit-list");
  list.replaceChildren();
  if (plot?.arrangement === "wars") {
    const item = document.createElement("li");
    item.append(
      document.createTextNode("Coastlines are Natural Earth, public domain. War rows follow "),
    );
    appendExternalLinks(item, warSources(), ", ");
    item.append(document.createTextNode("."));
    list.appendChild(item);
    $("footer-note").textContent = plot.sourceNote || `${plot.title} on Plotmaniac`;
    $("credits").hidden = false;
    return;
  }
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
  if (usesHubWebPersonFocus()) {
    if (state.view === "web" && state.person === id) {
      state.person = ALL;
      hubCamera = null;
      webFitToken = "";
      render({ push: true });
      return;
    }
    hubCamera = null;
    webFitToken = "";
    state.view = "web";
    state.person = id;
    state.eventId = "";
    render({ push: true });
    return;
  }
  if (usesPolicyPanel(plot)) {
    if (state.person === id) {
      closePolicyPanel();
      return;
    }
    state.view = "web";
    state.person = id;
    state.eventId = "";
    state.query = "";
    paintPolicySelection();
    writeUrl(false);
    return;
  }
  state.view = "person";
  state.person = id;
  state.eventId = "";
  state.query = "";
  render({ push: true });
}

function closePolicyPanel() {
  state.person = ALL;
  state.eventId = "";
  paintPolicySelection();
  writeUrl(true);
}

function paintPolicySelection(root = document) {
  if (!usesPolicyPanel(plot)) return;
  const selected = state.person && state.person !== ALL ? state.person : "";
  root.querySelectorAll(".web-stage .node").forEach((node) => {
    const on = Boolean(selected) && node.dataset.id === selected;
    node.classList.toggle("is-selected", on);
    if (!node.classList.contains("is-topic-hub")) {
      node.setAttribute("aria-pressed", String(on));
    }
  });
  const drawer = root.querySelector(".policy-drawer");
  if (!drawer) return;
  const host = root.classList?.contains("web") ? root : root.querySelector(".web") || root;
  host.querySelectorAll(".drawer-scrim").forEach((scrim) => scrim.remove());
  drawer.replaceChildren();
  if (!selected) {
    drawer.hidden = true;
    return;
  }
  const person = peopleById.get(selected);
  if (!person) {
    drawer.hidden = true;
    return;
  }
  drawer.hidden = false;
  if (isCompact()) {
    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "drawer-scrim";
    scrim.setAttribute("aria-label", "Close policy position");
    scrim.addEventListener("click", () => closePolicyPanel());
    drawer.before(scrim);
  }
  const camp = campOf(
    person.id,
    relations,
    plot.centerId,
    plot.friendKinds,
    plot.enemyKinds,
    plot.year ? state.year : undefined,
  );
  drawer.classList.remove("outline-green", "outline-red", "outline-none");
  drawer.classList.add(camp === "friend" ? "outline-green" : camp === "enemy" ? "outline-red" : "outline-none");
  const close = document.createElement("button");
  close.type = "button";
  close.className = "drawer-close";
  close.textContent = "Close";
  close.addEventListener("click", () => closePolicyPanel());
  const head = document.createElement("div");
  head.className = "drawer-head";
  head.appendChild(avatar(person, "lg"));
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = person.id === plot.centerId
    ? "The center of this plot"
    : plot.year
      ? `${campLabel(camp) || plot.orbitLabel || "No stance yet"} in ${state.year}`
      : (campLabel(camp) || plot.orbitLabel || "No stance yet");
  const title = document.createElement("h2");
  title.id = "policy-title";
  title.textContent = person.name;
  drawer.setAttribute("aria-labelledby", "policy-title");
  const role = document.createElement("p");
  role.className = "drawer-notes";
  role.textContent = person.role || "";
  copy.append(eyebrow, title, role);
  head.appendChild(copy);
  drawer.append(close, head);

  const ties = stanceHistory(person.id, relations, plot.centerId);
  if (ties.length) {
    const heading = document.createElement("h3");
    heading.className = "drawer-heading";
    heading.textContent = "Stance over time";
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
    drawer.append(heading, list);
  }

  if (person.links?.length) {
    const heading = document.createElement("h3");
    heading.className = "drawer-heading";
    heading.textContent = "Sources";
    drawer.append(heading, renderPolicyLinks(person.links));
  }

  const theirs = events.filter((event) => event.people.includes(person.id));
  const heading = document.createElement("h3");
  heading.className = "drawer-heading";
  heading.textContent = theirs.length === 1 ? "1 timeline beat" : `${theirs.length} timeline beats`;
  drawer.appendChild(heading);
  if (!theirs.length) {
    const note = document.createElement("p");
    note.className = "drawer-note";
    note.textContent = "No sourced beats for this position yet.";
    drawer.appendChild(note);
    return;
  }
  drawer.appendChild(renderPolicyBeats(theirs));
}

function renderPolicyLinks(links) {
  const list = document.createElement("div");
  list.className = "event-links drawer-links";
  links.forEach((link) => {
    if (!/^https:\/\//.test(link.url || "")) return;
    const anchor = document.createElement("a");
    anchor.href = link.url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = link.label || "Source";
    if (link.type) {
      const type = document.createElement("span");
      type.className = "link-type";
      type.textContent = link.type;
      anchor.appendChild(type);
    }
    list.appendChild(anchor);
  });
  return list;
}

function renderPolicyBeats(list) {
  const beats = document.createElement("ol");
  beats.className = "relation-timeline drawer-beats";
  list.forEach((event) => {
    const item = document.createElement("li");
    const open = state.eventId === event.id;
    if (open) item.classList.add("is-active");
    const hit = document.createElement("button");
    hit.type = "button";
    hit.className = "drawer-beat";
    const when = document.createElement("time");
    when.dateTime = event.date;
    when.textContent = formatDate(event.date);
    const heading = document.createElement("strong");
    heading.textContent = event.title;
    hit.append(when, heading);
    if (!open) {
      const tease = document.createElement("span");
      tease.className = "beat-tease";
      tease.textContent = eventTease(event, 140);
      hit.appendChild(tease);
    }
    hit.addEventListener("click", () => {
      state.eventId = open ? "" : event.id;
      paintPolicySelection();
      writeUrl(false);
    });
    item.appendChild(hit);
    if (open) {
      const more = document.createElement("div");
      more.className = "drawer-more";
      const body = expandedSummary(event);
      if (body) {
        const summary = document.createElement("p");
        summary.textContent = body;
        more.appendChild(summary);
      }
      if (event.links?.length) more.appendChild(renderPolicyLinks(event.links));
      item.appendChild(more);
    }
    beats.appendChild(item);
  });
  return beats;
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
  el.title = name;
  return el;
}

function faceRow(ids, size = "sm") {
  const row = document.createElement("span");
  row.className = "faces";
  ids.forEach((id) => {
    const person = peopleById.get(id);
    if (!person) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "face-link";
    button.appendChild(avatar(person, size));
    button.title = person.name;
    button.setAttribute("aria-label", `${person.name}. Open their timeline.`);
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openPerson(person.id);
    });
    row.appendChild(button);
  });
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
    gunLawCriteria: serializeGunStateLawFilters(state.gunLawFilters),
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
