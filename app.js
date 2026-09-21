import {
  ALL,
  eraLabel,
  eventTease,
  filterEvents,
  graphLayout,
  parseState,
  relationEvents,
  stateUrl,
  youtubeId,
} from "./engine.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const peopleById = new Map();
const eventById = new Map();
let people = [];
let allEvents = [];
let relations = [];
let state = { view: "timeline", person: ALL, era: ALL, query: "", eventId: "" };
let graphTransform = { x: 0, y: 0, scale: 1 };
let graphPointerMoved = false;
let toastTimer = null;

const $ = (id) => document.getElementById(id);

async function load() {
  const [peopleRes, eventsRes, relationsRes] = await Promise.all([
    fetch("./data/people.json"),
    fetch("./data/events.json"),
    fetch("./data/relations.json"),
  ]);
  if (!peopleRes.ok || !eventsRes.ok || !relationsRes.ok) {
    throw new Error("Failed to load one or more lore data files");
  }
  people = await peopleRes.json();
  const events = await eventsRes.json();
  relations = await relationsRes.json();
  people.forEach((p) => peopleById.set(p.id, p));
  allEvents = events.slice().sort((a, b) => a.date.localeCompare(b.date));
  allEvents.forEach((event) => eventById.set(event.id, event));

  const eras = new Set(allEvents.map((event) => event.era));
  state = parseState(location.href, { people: new Set(peopleById.keys()), eras });
  if (state.eventId && eventById.has(state.eventId) &&
      !filterEvents([eventById.get(state.eventId)], state, peopleById).length) {
    state.person = ALL;
    state.era = ALL;
    state.query = "";
  }

  initializeControls(eras);
  syncControls();
  renderView();
  renderEvents();
  renderWeb();
  bindGraphGestures();

  if (state.eventId && eventById.has(state.eventId)) {
    requestAnimationFrame(() => openEvent(state.eventId, { scroll: true, updateUrl: false }));
  }
}

function initializeControls(eras) {
  const eraSelect = $("era-filter");
  [...eras].sort().forEach((era) => {
    const option = document.createElement("option");
    option.value = era;
    option.textContent = eraLabel(era);
    eraSelect.appendChild(option);
  });

  const groupOrder = ["crew", "ally", "rival", "recent", "subject", "legal"];
  const groupLabels = {
    crew: "H3 crew",
    ally: "Allies & collaborators",
    rival: "Public feuds",
    recent: "Recent discussions",
    subject: "Coverage subjects",
    legal: "Legal",
  };
  const grouped = new Map(groupOrder.map((group) => [group, []]));
  people.forEach((person) => {
    const group = groupOrder.find((tag) => person.tags?.includes(tag)) || "subject";
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(person);
  });
  const personSelect = $("person-filter");
  grouped.forEach((members, group) => {
    if (!members.length) return;
    const optgroup = document.createElement("optgroup");
    optgroup.label = groupLabels[group] || eraLabel(group);
    members.sort((a, b) => a.name.localeCompare(b.name)).forEach((person) => {
      const option = document.createElement("option");
      option.value = person.id;
      option.textContent = person.name;
      optgroup.appendChild(option);
    });
    personSelect.appendChild(optgroup);
  });

  $("event-search").addEventListener("input", (event) => {
    state.query = event.currentTarget.value;
    state.eventId = "";
    renderAll({ replace: true });
  });
  eraSelect.addEventListener("change", (event) => {
    state.era = event.currentTarget.value;
    state.eventId = "";
    renderAll();
  });
  personSelect.addEventListener("change", (event) => setPerson(event.currentTarget.value));
  $("clear-filters").addEventListener("click", clearFilters);
  document.querySelectorAll(".view-tab").forEach((tab) => {
    tab.addEventListener("click", () => setView(tab.dataset.view));
  });
  $("zoom-in").addEventListener("click", () => zoomGraph(1.2));
  $("zoom-out").addEventListener("click", () => zoomGraph(1 / 1.2));
  $("zoom-reset").addEventListener("click", resetGraph);
  $("close-video").addEventListener("click", closeVideo);
  $("video-dialog").addEventListener("click", (event) => {
    if (event.target === $("video-dialog")) closeVideo();
  });
  window.addEventListener("popstate", applyUrlState);
  window.addEventListener("hashchange", applyUrlState);
}

function setPerson(id) {
  state.person = peopleById.has(id) ? id : ALL;
  state.eventId = "";
  renderAll();
}

function filteredEvents() {
  return filterEvents(allEvents, state, peopleById);
}

function syncControls() {
  $("event-search").value = state.query;
  $("era-filter").value = state.era;
  $("person-filter").value = state.person;
  const hasFilters = state.person !== ALL || state.era !== ALL || Boolean(state.query.trim());
  $("clear-filters").disabled = !hasFilters;

  const labels = [];
  if (state.person !== ALL) labels.push(peopleById.get(state.person)?.name || state.person);
  if (state.era !== ALL) labels.push(eraLabel(state.era));
  if (state.query.trim()) labels.push(`“${state.query.trim()}”`);
  $("active-filter-summary").textContent = labels.length
    ? `Showing: ${labels.join(" · ")}`
    : "Showing every era and person.";
}

function clearFilters() {
  state.person = ALL;
  state.era = ALL;
  state.query = "";
  state.eventId = "";
  renderAll();
  $("event-search").focus();
}

function setView(view, { updateUrl = true } = {}) {
  state.view = view === "web" ? "web" : "timeline";
  state.eventId = "";
  renderView();
  if (updateUrl) updateAddress();
}

function renderView() {
  const timeline = state.view === "timeline";
  $("timeline-view").hidden = !timeline;
  $("web-view").hidden = timeline;
  $("timeline-tab").classList.toggle("is-active", timeline);
  $("web-tab").classList.toggle("is-active", !timeline);
  $("timeline-tab").setAttribute("aria-selected", String(timeline));
  $("web-tab").setAttribute("aria-selected", String(!timeline));
}

function renderAll({ replace = false } = {}) {
  syncControls();
  renderEvents();
  renderWeb();
  updateAddress(replace);
}

function updateAddress(replace = false, eventId = state.eventId) {
  const method = replace ? "replaceState" : "pushState";
  history[method]({}, "", stateUrl(location.href, state, eventId));
}

function applyUrlState() {
  const eras = new Set(allEvents.map((event) => event.era));
  state = parseState(location.href, { people: new Set(peopleById.keys()), eras });
  syncControls();
  renderView();
  renderEvents();
  renderWeb();
  if (state.eventId && eventById.has(state.eventId)) {
    requestAnimationFrame(() => openEvent(state.eventId, { scroll: true, updateUrl: false }));
  }
}

function formatDate(iso) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function renderEvents() {
  const list = $("event-list");
  const meta = $("timeline-meta");
  const events = filteredEvents();
  meta.textContent = `${events.length} sourced public beat${events.length === 1 ? "" : "s"} · oldest first`;

  list.innerHTML = "";
  list.setAttribute("aria-busy", "false");
  if (!events.length) {
    const empty = document.createElement("li");
    empty.className = "state-card";
    const title = document.createElement("strong");
    title.textContent = "That thread comes up empty.";
    const copy = document.createElement("span");
    copy.textContent = "Try another person, era, or a broader search.";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.textContent = "Clear all filters";
    clear.addEventListener("click", clearFilters);
    empty.append(title, copy, clear);
    list.appendChild(empty);
    return;
  }

  let currentYear = "";
  events.forEach((ev) => {
    const year = ev.date.slice(0, 4);
    if (year !== currentYear) {
      currentYear = year;
      const marker = document.createElement("li");
      marker.className = "year-marker";
      marker.textContent = year;
      marker.setAttribute("aria-label", `Year ${year}`);
      list.appendChild(marker);
    }

    const li = document.createElement("li");
    li.className = "event";
    li.id = ev.id;
    li.dataset.eventId = ev.id;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "event-btn";
    btn.setAttribute("aria-expanded", "false");

    const dateEl = document.createElement("span");
    dateEl.className = "event-date";
    dateEl.textContent = formatDate(ev.date);

    const main = document.createElement("div");
    main.className = "event-main";
    const title = document.createElement("div");
    title.className = "event-headline";
    title.textContent = ev.title;

    const tease = document.createElement("p");
    tease.className = "event-tease";
    tease.textContent = eventTease(ev);

    const eventMeta = document.createElement("div");
    eventMeta.className = "event-meta";
    const era = document.createElement("span");
    era.className = "event-era";
    era.textContent = eraLabel(ev.era);
    eventMeta.appendChild(era);
    ev.people.forEach((pid) => {
      const p = peopleById.get(pid);
      const tag = document.createElement("span");
      tag.className = "person-tag";
      tag.textContent = p ? p.name : pid;
      eventMeta.appendChild(tag);
    });

    main.append(title, tease, eventMeta);

    btn.appendChild(dateEl);
    btn.appendChild(main);

    const detail = document.createElement("div");
    detail.className = "event-detail";
    detail.hidden = true;

    const detailInner = document.createElement("div");
    detailInner.className = "event-detail-inner";
    const summary = document.createElement("p");
    summary.className = "event-summary";
    summary.textContent = ev.summary;
    detailInner.appendChild(summary);

    const videoLink = ev.links?.find((link) => youtubeId(link.url));
    const video = videoLink ? youtubeId(videoLink.url) : null;
    const thumbnail = ev.media?.thumbnail || (video ? `https://i.ytimg.com/vi/${video}/hqdefault.jpg` : "");
    if (thumbnail) {
      const media = document.createElement("div");
      media.className = "event-media";
      const image = document.createElement("img");
      image.src = thumbnail;
      image.alt = ev.media?.alt || "";
      image.loading = "lazy";
      image.decoding = "async";
      media.appendChild(image);
      if (video) {
        const play = document.createElement("button");
        play.type = "button";
        play.textContent = "▶ Watch video";
        play.addEventListener("click", () => openVideo(video, videoLink.label));
        media.appendChild(play);
      }
      detailInner.appendChild(media);
    }

    if (ev.links?.length) {
      const linksWrap = document.createElement("div");
      linksWrap.className = "event-links";
      ev.links.forEach((link) => {
        const a = document.createElement("a");
        a.href = link.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = link.label;
        const type = document.createElement("span");
        type.className = "link-type";
        type.textContent = link.type || "link";
        a.appendChild(type);
        linksWrap.appendChild(a);
      });
      const share = document.createElement("button");
      share.type = "button";
      share.className = "share-event";
      share.textContent = "Copy deep link";
      share.addEventListener("click", () => copyEventLink(ev.id));
      linksWrap.appendChild(share);
      detailInner.appendChild(linksWrap);
    }
    detail.appendChild(detailInner);

    btn.addEventListener("click", () => toggleEvent(ev.id));

    li.appendChild(btn);
    li.appendChild(detail);
    list.appendChild(li);
  });
}

function toggleEvent(id) {
  const li = document.getElementById(id);
  if (!li) return;
  const opening = !li.classList.contains("is-open");
  document.querySelectorAll(".event.is-open").forEach((event) => setEventOpen(event, false));
  setEventOpen(li, opening);
  state.eventId = opening ? id : "";
  updateAddress(false, state.eventId);
}

function setEventOpen(li, open) {
  li.classList.toggle("is-open", open);
  li.querySelector(".event-btn")?.setAttribute("aria-expanded", String(open));
  const detail = li.querySelector(".event-detail");
  if (detail) detail.hidden = !open;
}

function openEvent(id, { scroll = false, updateUrl = true } = {}) {
  const li = document.getElementById(id);
  if (!li) return;
  document.querySelectorAll(".event.is-open").forEach((event) => setEventOpen(event, false));
  setEventOpen(li, true);
  state.eventId = id;
  if (updateUrl) updateAddress(false, id);
  if (scroll) li.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function copyEventLink(id) {
  const url = new URL(stateUrl(location.href, state, id), location.origin);
  try {
    await navigator.clipboard.writeText(url.href);
    showToast("Deep link copied.");
  } catch {
    history.replaceState({}, "", url);
    showToast("Link is ready in the address bar.");
  }
}

function showToast(message) {
  clearTimeout(toastTimer);
  $("share-toast").textContent = message;
  $("share-toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("share-toast").hidden = true;
  }, 1800);
}

function openVideo(id, title) {
  $("video-title").textContent = title || "Watch source";
  const iframe = document.createElement("iframe");
  iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1`;
  iframe.title = title || "YouTube video";
  iframe.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture";
  iframe.allowFullscreen = true;
  $("video-frame").replaceChildren(iframe);
  $("video-dialog").showModal();
}

function closeVideo() {
  if ($("video-dialog").open) $("video-dialog").close();
  $("video-frame").replaceChildren();
}

function consolidatedRelations() {
  const byPair = new Map();
  relations.forEach((relation) => {
    const key = [relation.from, relation.to].sort().join("|");
    const current = byPair.get(key);
    if (current) {
      current.kinds.push(relation.kind);
      current.labels.push(relation.label);
    } else {
      byPair.set(key, {
        ...relation,
        kinds: [relation.kind],
        labels: [relation.label],
      });
    }
  });
  return [...byPair.values()];
}

function renderWeb() {
  const camera = $("web-camera");
  camera.replaceChildren();
  const nodes = graphLayout(people);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const edges = consolidatedRelations();
  const selected = state.person !== ALL ? state.person : null;
  const selectedNeighbors = new Set([selected]);
  edges.forEach((edge) => {
    if (edge.from === selected) selectedNeighbors.add(edge.to);
    if (edge.to === selected) selectedNeighbors.add(edge.from);
  });

  const edgeLayer = svgElement("g", { class: "web-edges" });
  edges.forEach((edge) => {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) return;
    const selectedEdge = selected && (edge.from === selected || edge.to === selected);
    const attrs = { x1: from.x, y1: from.y, x2: to.x, y2: to.y };
    const line = svgElement("line", {
      ...attrs,
      class: `web-edge${selectedEdge ? " is-selected" : ""}`,
    });
    const hit = svgElement("line", { ...attrs, class: "web-edge-hit", tabindex: "0" });
    const fromName = peopleById.get(edge.from)?.name || edge.from;
    const toName = peopleById.get(edge.to)?.name || edge.to;
    hit.setAttribute("role", "button");
    hit.setAttribute("aria-label", `${fromName} and ${toName}: ${edge.labels.join("; ")}`);
    const title = svgElement("title");
    title.textContent = `${fromName} ↔ ${toName}\n${edge.labels.join("\n")}`;
    hit.appendChild(title);
    hit.addEventListener("click", () => jumpFromRelation(edge));
    hit.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        jumpFromRelation(edge);
      }
    });
    edgeLayer.append(line, hit);
  });
  camera.appendChild(edgeLayer);

  const nodeLayer = svgElement("g", { class: "web-nodes" });
  nodes.forEach((node) => {
    const isSelected = node.id === selected;
    const muted = selected && !selectedNeighbors.has(node.id);
    const group = svgElement("g", {
      class: [
        "web-node",
        node.central ? "is-central" : "",
        isSelected ? "is-selected" : "",
        muted ? "is-muted" : "",
      ].filter(Boolean).join(" "),
      transform: `translate(${node.x} ${node.y})`,
      tabindex: "0",
    });
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", `Filter by ${node.name}. ${node.role}`);
    const radius = node.central ? 47 : 38;
    const circle = svgElement("circle", { r: radius });
    const name = svgElement("text", { y: -2 });
    const lines = shortNodeName(node.name);
    lines.forEach((line, index) => {
      const tspan = svgElement("tspan", {
        x: "0",
        dy: index === 0 ? "0" : "13",
      });
      tspan.textContent = line;
      name.appendChild(tspan);
    });
    const role = svgElement("text", {
      class: "node-role",
      y: lines.length > 1 ? 26 : 15,
    });
    role.textContent = primaryTag(node);
    group.append(circle, name, role);
    group.addEventListener("click", () => setPerson(node.id === selected ? ALL : node.id));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setPerson(node.id === selected ? ALL : node.id);
      }
    });
    nodeLayer.appendChild(group);
  });
  camera.appendChild(nodeLayer);
  applyGraphTransform();
  renderRelationList(edges);
}

function renderRelationList(edges) {
  const root = $("relation-list");
  root.replaceChildren();
  const sorted = edges.slice().sort((a, b) => {
    const aName = peopleById.get(a.to === "ethan-klein" ? a.from : a.to)?.name || "";
    const bName = peopleById.get(b.to === "ethan-klein" ? b.from : b.to)?.name || "";
    return aName.localeCompare(bName);
  });
  sorted.forEach((relation) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    const from = peopleById.get(relation.from)?.name || relation.from;
    const to = peopleById.get(relation.to)?.name || relation.to;
    const name = document.createElement("span");
    name.className = "relation-name";
    name.textContent = `${from} ↔ ${to}`;
    const kind = document.createElement("span");
    kind.className = "relation-kind";
    const count = relationEvents(relation, allEvents).length;
    kind.textContent = `${[...new Set(relation.kinds)].map(eraLabel).join(" · ")} · ${count} shared event${count === 1 ? "" : "s"}`;
    button.classList.toggle(
      "is-selected",
      state.person !== ALL && (relation.from === state.person || relation.to === state.person),
    );
    button.title = relation.labels.join(" ");
    button.append(name, kind);
    button.addEventListener("click", () => jumpFromRelation(relation));
    item.appendChild(button);
    root.appendChild(item);
  });
}

function jumpFromRelation(relation) {
  const matches = relationEvents(relation, allEvents);
  const other = relation.from === "ethan-klein" ? relation.to : relation.from;
  state.person = peopleById.has(other) ? other : ALL;
  state.era = ALL;
  state.query = "";
  state.view = "timeline";
  state.eventId = matches[0]?.id || "";
  syncControls();
  renderView();
  renderEvents();
  renderWeb();
  updateAddress(false, state.eventId);
  if (state.eventId) {
    requestAnimationFrame(() => openEvent(state.eventId, { scroll: true, updateUrl: false }));
  } else {
    $("timeline-view").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function shortNodeName(name) {
  if (name.length < 14) return [name];
  const words = name.split(" ");
  if (words.length === 1) return [name];
  const pivot = Math.ceil(words.length / 2);
  return [words.slice(0, pivot).join(" "), words.slice(pivot).join(" ")];
}

function primaryTag(person) {
  const labels = {
    crew: "crew",
    ally: "collaborator",
    rival: "public feud",
    recent: "recent",
    subject: "coverage",
    legal: "legal",
    family: "family",
  };
  const tag = person.tags?.find((item) => labels[item]);
  return labels[tag] || "H3 orbit";
}

function svgElement(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
  return element;
}

function applyGraphTransform() {
  $("web-camera").setAttribute(
    "transform",
    `translate(${graphTransform.x} ${graphTransform.y}) scale(${graphTransform.scale})`,
  );
}

function zoomGraph(factor, anchor = { x: 450, y: 280 }) {
  const previous = graphTransform.scale;
  const next = Math.min(2.4, Math.max(0.55, previous * factor));
  const ratio = next / previous;
  graphTransform.x = anchor.x - (anchor.x - graphTransform.x) * ratio;
  graphTransform.y = anchor.y - (anchor.y - graphTransform.y) * ratio;
  graphTransform.scale = next;
  applyGraphTransform();
}

function resetGraph() {
  graphTransform = { x: 0, y: 0, scale: 1 };
  applyGraphTransform();
}

function svgPoint(event) {
  const rect = $("relationship-web").getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 900,
    y: ((event.clientY - rect.top) / rect.height) * 560,
  };
}

function bindGraphGestures() {
  const stage = $("web-stage");
  const pointers = new Map();
  let dragOrigin = null;
  let pinchOrigin = null;

  stage.addEventListener("pointerdown", (event) => {
    if (!pointers.size) graphPointerMoved = false;
    pointers.set(event.pointerId, svgPoint(event));
    stage.setPointerCapture(event.pointerId);
    if (pointers.size === 1) {
      dragOrigin = {
        point: svgPoint(event),
        transform: { ...graphTransform },
      };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchOrigin = {
        distance: Math.hypot(b.x - a.x, b.y - a.y),
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        transform: { ...graphTransform },
      };
    }
  });

  stage.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, svgPoint(event));
    if (pointers.size === 1 && dragOrigin) {
      const point = svgPoint(event);
      if (Math.hypot(point.x - dragOrigin.point.x, point.y - dragOrigin.point.y) > 4) {
        graphPointerMoved = true;
      }
      graphTransform.x = dragOrigin.transform.x + point.x - dragOrigin.point.x;
      graphTransform.y = dragOrigin.transform.y + point.y - dragOrigin.point.y;
      applyGraphTransform();
    } else if (pointers.size === 2 && pinchOrigin) {
      graphPointerMoved = true;
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      graphTransform = { ...pinchOrigin.transform };
      zoomGraph(distance / Math.max(1, pinchOrigin.distance), pinchOrigin.center);
      graphTransform.x += center.x - pinchOrigin.center.x;
      graphTransform.y += center.y - pinchOrigin.center.y;
      applyGraphTransform();
    }
  });

  const endPointer = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size === 1) {
      const point = [...pointers.values()][0];
      dragOrigin = { point, transform: { ...graphTransform } };
    } else if (!pointers.size) {
      dragOrigin = null;
      pinchOrigin = null;
    }
  };
  stage.addEventListener("pointerup", endPointer);
  stage.addEventListener("pointercancel", endPointer);
  stage.addEventListener("click", (event) => {
    if (!graphPointerMoved) return;
    event.preventDefault();
    event.stopPropagation();
    graphPointerMoved = false;
  }, true);
  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomGraph(event.deltaY < 0 ? 1.12 : 1 / 1.12, svgPoint(event));
  }, { passive: false });
}

load().catch((error) => {
  console.error(error);
  $("timeline-meta").textContent = "The archive could not load.";
  $("event-list").setAttribute("aria-busy", "false");
  const stateCard = document.createElement("li");
  stateCard.className = "state-card";
  const heading = document.createElement("strong");
  heading.textContent = "The lore slipped through a portal.";
  const copy = document.createElement("span");
  copy.textContent = "Refresh the page to try loading the local data again.";
  const retry = document.createElement("button");
  retry.type = "button";
  retry.textContent = "Reload page";
  retry.addEventListener("click", () => location.reload());
  stateCard.append(heading, copy, retry);
  $("event-list").replaceChildren(stateCard);
});
