import { initials } from "./engine.js";
import { cameraBox, claimsRing, flows, linePath, markers, project, regions, ringPath, seams } from "./partition-geography.js";
import { buildFrames, kashmirClaimsNote, regionCaption, sourceRecords } from "./partition-model.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LATE = new Set(["hyderabad", "mysore", "travancore", "bhopal", "sylhet"]);
const TICKS = [
  ["evt-1905-bengal", "1905"],
  ["evt-1911-bengal-reunite", "1911"],
  ["evt-1937-elections", "1937"],
  ["evt-1940-lahore", "1940"],
  ["evt-1946-direct-action", "1946"],
  ["evt-1947-june-plan", "Jun 1947"],
  ["evt-1947-radcliffe-published", "Borders"],
  ["frame-kashmir", "Kashmir"],
  ["evt-1948-gandhi-fast", "1948"],
  ["frame-bangladesh", "1971"],
  ["frame-present", "Now"],
];

const POSITION_LABELS = {
  unitedIndia: "United India",
  pakistanOrMuslimState: "Pakistan or a Muslim state",
  populationExchange: "Population exchange",
  punjabAndBengalDivision: "Punjab and Bengal",
  twoNationTheory: "Two-nation theory",
};

function el(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function svgEl(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

export function mountPartition(root, reference, { frameId = "", onFrame, portraits = {} } = {}) {
  const frames = buildFrames(reference);
  const players = new Map(reference.keyPlayers.map((player) => [player.id, player]));
  const princes = new Map(reference.princelyStateActors.map((entry) => [entry.id, entry]));
  let index = Math.max(0, frames.findIndex((frame) => frame.id === frameId));
  let selectedPlayer = "";
  let selectedRegion = "";
  let detailsOpen = true;
  let claimsOn = false;
  let cameraToken = 0;
  let cameraName = "";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const shell = el("section", "partition");
  shell.setAttribute("aria-label", "Partition of India map");
  const stage = el("div", "partition-stage");
  const svg = svgEl("svg", { class: "partition-map", role: "img" });
  const all = cameraBox("all");
  svg.setAttribute("viewBox", all.join(" "));
  const ocean = svgEl("rect", {
    class: "partition-ocean",
    x: all[0],
    y: all[1],
    width: all[2],
    height: all[3],
  });
  svg.appendChild(ocean);

  const regionPaths = new Map();
  [...regions].sort((a, b) => Number(LATE.has(a.id)) - Number(LATE.has(b.id))).forEach((region) => {
    const path = svgEl("path", { class: "region", d: ringPath(region.ring) });
    path.dataset.region = region.id;
    path.addEventListener("click", () => {
      selectedRegion = selectedRegion === region.id ? "" : region.id;
      selectedPlayer = "";
      paintInspector();
    });
    svg.appendChild(path);
    regionPaths.set(region.id, path);
  });

  const seamPaths = new Map();
  Object.entries(seams).forEach(([id, line]) => {
    const path = svgEl("path", { class: "decision", d: linePath(line), pathLength: 1 });
    path.dataset.seam = id;
    svg.appendChild(path);
    seamPaths.set(id, path);
  });

  const claims = svgEl("path", { class: "claims", d: ringPath(claimsRing), pathLength: 1 });
  svg.appendChild(claims);

  const flowPaths = new Map();
  Object.entries(flows).forEach(([id, line]) => {
    const path = svgEl("path", { class: "flow", d: linePath(line), pathLength: 1 });
    path.dataset.flow = id;
    svg.appendChild(path);
    flowPaths.set(id, path);
  });

  const markerNodes = new Map();
  Object.entries(markers).forEach(([id, marker]) => {
    const [x, y] = project(marker.lon, marker.lat);
    const group = svgEl("g", { class: "map-marker" });
    group.appendChild(svgEl("circle", { cx: x, cy: y, r: 5 }));
    const text = svgEl("text", { x: x + 8, y: y - 8 });
    text.textContent = marker.label;
    group.appendChild(text);
    svg.appendChild(group);
    markerNodes.set(id, group);
  });

  const labelLayer = svgEl("g", { class: "map-labels" });
  svg.appendChild(labelLayer);

  const legend = el("ul", "partition-legend");
  [
    ["raj", "British province"],
    ["princely", "Princely state"],
    ["india", "India"],
    ["pakistan", "Pakistan"],
    ["eastpak", "East Pakistan"],
    ["bangladesh", "Bangladesh"],
    ["pending", "Award pending"],
    ["flow", "Migration"],
  ].forEach(([kind, label]) => {
    const item = el("li");
    const swatch = el("i", `swatch fill-${kind}`);
    item.append(swatch, document.createTextNode(label));
    legend.appendChild(item);
  });
  const legendNote = el("p", "partition-legend-note", "Simplified map, aligned to the subcontinent. Borders draw when a decision changes them.");
  const casualty = el("p", "partition-casualty", reference.scope?.casualtyNote || "");

  const inspector = el("aside", "partition-inspector");
  inspector.tabIndex = -1;

  const scrubber = el("div", "partition-scrubber");
  const now = el("div", "partition-now");
  const kicker = el("p", "kicker");
  const title = el("h2");
  const controls = el("div", "partition-controls");
  const detailsButton = el("button", "partition-toggle");
  detailsButton.type = "button";
  const claimsLabel = el("label", "partition-claims");
  const claimsInput = document.createElement("input");
  claimsInput.type = "checkbox";
  claimsLabel.append(claimsInput, document.createTextNode("Kashmir claims"));
  controls.append(detailsButton, claimsLabel, imageCredits(portraits, players));
  now.append(kicker, title, controls);

  const range = document.createElement("input");
  range.type = "range";
  range.className = "partition-range";
  range.min = "0";
  range.max = String(frames.length - 1);
  range.step = "1";
  range.setAttribute("aria-label", "Partition timeline");

  const ticks = el("div", "partition-ticks");
  TICKS.forEach(([id, label]) => {
    const at = frames.findIndex((frame) => frame.id === id);
    if (at < 0) return;
    const button = el("button", "", label);
    button.type = "button";
    button.dataset.frame = id;
    button.style.left = `${(at / (frames.length - 1)) * 100}%`;
    button.addEventListener("click", () => goToIndex(at, { historyMode: "push" }));
    ticks.appendChild(button);
  });

  stage.append(svg, legend, legendNote, casualty, inspector);
  scrubber.append(now, range, ticks);
  shell.append(stage, scrubber);
  root.appendChild(shell);

  function frame() {
    return frames[index];
  }

  function paintMap() {
    const visual = frame().visual;
    regionPaths.forEach((path, id) => {
      const fill = visual.fills[id] || "raj";
      path.setAttribute("class", `region fill-${fill}${visual.emphasis.includes(id) ? " is-emphasis" : ""}`);
    });
    seamPaths.forEach((path, id) => {
      const state = visual.seams[id] || "off";
      path.setAttribute("class", `decision is-${state}`);
    });
    flowPaths.forEach((path, id) => {
      path.classList.toggle("is-on", visual.flows.includes(id));
    });
    markerNodes.forEach((node, id) => {
      node.classList.toggle("is-on", visual.markers.includes(id));
    });
    const showClaims = claimsOn;
    claims.classList.toggle("is-on", showClaims);
    svg.setAttribute("aria-label", `${frame().dateDisplay}. ${frame().title}`);
    paintLabels();
    const nextCamera = visual.camera || "all";
    if (nextCamera !== cameraName) {
      cameraName = nextCamera;
      animateCamera(nextCamera);
    }
  }

  function paintLabels() {
    labelLayer.replaceChildren();
    const visual = frame().visual;
    const ids = visual.emphasis.length
      ? visual.emphasis
      : regions
        .map((region) => region.id)
        .filter((id) => !["raj", "princely", "neighbor"].includes(visual.fills[id]));
    ids.forEach((id) => {
      const region = regions.find((item) => item.id === id);
      if (!region) return;
      const [x, y] = centroid(region.ring);
      const text = svgEl("text", { class: "region-label", x, y });
      text.textContent = region.name;
      labelLayer.appendChild(text);
    });
    if ((visual.camera || "all") !== "all") return;
    const countryLabels = [];
    if (Object.values(visual.fills).includes("india")) countryLabels.push(["India", 79.2, 21.6]);
    if (Object.values(visual.fills).includes("pakistan")) countryLabels.push(["Pakistan", 68.4, 29.2]);
    if (visual.fills["bengal-east"] === "eastpak") countryLabels.push(["East Pakistan", 90.2, 23.4]);
    if (visual.fills["bengal-east"] === "bangladesh") countryLabels.push(["Bangladesh", 90.2, 23.4]);
    countryLabels.forEach(([label, lon, lat]) => {
      const [x, y] = project(lon, lat);
      const text = svgEl("text", { class: "country-label", x, y });
      text.textContent = label;
      labelLayer.appendChild(text);
    });
  }

  function paintInspector() {
    const current = frame();
    inspector.replaceChildren();
    inspector.appendChild(el("p", "kicker", current.kind === "aftermath" ? "Aftermath" : "Timeline"));
    inspector.appendChild(el("h3", "", current.title));
    inspector.appendChild(el("p", "partition-date", current.dateDisplay));
    inspector.appendChild(el("p", "", current.summary));
    if (current.consequences.length) {
      const list = el("ul", "partition-points");
      current.consequences.forEach((item) => list.appendChild(el("li", "", item)));
      inspector.appendChild(list);
    }
    if (current.actions.length) {
      const list = el("ul", "partition-actions");
      current.actions.forEach((action) => {
        const person = players.get(action.playerId);
        const item = el("li");
        item.append(el("strong", "", person?.name || action.playerId), document.createTextNode(` ${action.description}`));
        list.appendChild(item);
      });
      inspector.appendChild(list);
    }
    if (current.playerIds.length) {
      const row = el("div", "partition-players");
      current.playerIds.forEach((id) => {
        const person = players.get(id);
        const button = el("button", selectedPlayer === id ? "is-selected" : "");
        button.type = "button";
        button.append(portraitMark(person?.name || id, portraits[id]), el("span", "", person?.name || id));
        button.addEventListener("click", () => {
          selectedPlayer = selectedPlayer === id ? "" : id;
          selectedRegion = "";
          paintInspector();
        });
        row.appendChild(button);
      });
      inspector.appendChild(row);
    }
    if (selectedPlayer && players.get(selectedPlayer)) paintPlayer(players.get(selectedPlayer));
    if (selectedRegion) {
      inspector.appendChild(el("p", "partition-region", regionCaption(selectedRegion, current)));
    }
    current.princelyIds.forEach((id) => {
      const entry = princes.get(id);
      if (!entry) return;
      const block = el("p", "partition-princely");
      block.append(el("strong", "", entry.stateName), document.createTextNode(` — ${entry.rulerName}. ${entry.oneLineRole}`));
      inspector.appendChild(block);
    });
    current.extras.forEach((extra) => {
      if (!extra.body) return;
      const block = el("p", "partition-extra");
      block.append(el("strong", "", extra.heading), document.createTextNode(` ${extra.body}`));
      inspector.appendChild(block);
    });
    if (claimsOn) inspector.appendChild(el("p", "partition-extra", kashmirClaimsNote(current)));
    const sources = sourceRecords(reference.sourcesCatalog, current.sourceIds);
    if (sources.length) {
      const list = el("ul", "partition-sources");
      sources.forEach((source) => {
        const item = el("li");
        const link = el("a", "", source.title);
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        item.appendChild(link);
        list.appendChild(item);
      });
      inspector.appendChild(list);
    }
    inspector.hidden = !detailsOpen;
  }

  function paintPlayer(person) {
    const block = el("div", "partition-player");
    const portrait = portraits[person.id];
    if (portrait?.src) block.appendChild(portraitFigure(person.name, portrait));
    block.appendChild(el("h4", "", person.name));
    if (person.roles?.length) block.appendChild(el("p", "partition-date", person.roles.join(" · ")));
    block.appendChild(el("p", "", person.pointOfView));
    addList(block, "Wanted", person.desiresAndGoals);
    addList(block, "Feared or opposed", person.fearsAndOppositions);
    if (person.positions) {
      const list = el("ul", "partition-points");
      Object.entries(POSITION_LABELS).forEach(([key, label]) => {
        if (!person.positions[key]) return;
        const item = el("li");
        item.append(el("strong", "", label), document.createTextNode(` — ${person.positions[key]}`));
        list.appendChild(item);
      });
      block.appendChild(list);
    }
    block.appendChild(el("p", "", person.impactSummary));
    const sources = sourceRecords(reference.sourcesCatalog, person.sourceIds);
    if (sources.length) {
      const list = el("ul", "partition-sources");
      sources.forEach((source) => {
        const item = el("li");
        const link = el("a", "", source.title);
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noreferrer";
        item.appendChild(link);
        list.appendChild(item);
      });
      block.appendChild(list);
    }
    inspector.appendChild(block);
  }

  function paintChrome() {
    const current = frame();
    kicker.textContent = `${current.dateDisplay} · ${current.kind === "aftermath" ? "Aftermath" : "Timeline"} · ${index + 1} of ${frames.length}`;
    title.textContent = current.title;
    detailsButton.textContent = detailsOpen ? "Hide details" : "Show details";
    detailsButton.setAttribute("aria-expanded", String(detailsOpen));
    range.value = String(index);
    range.setAttribute("aria-valuetext", `${current.dateDisplay}. ${current.title}`);
    ticks.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.frame === current.id);
    });
    shell.classList.toggle("is-details-hidden", !detailsOpen);
  }

  function paint() {
    if (selectedPlayer && !frame().playerIds.includes(selectedPlayer)) selectedPlayer = "";
    paintChrome();
    paintMap();
    paintInspector();
  }

  function goToIndex(next, { historyMode = "replace", notify = true } = {}) {
    const bounded = Math.max(0, Math.min(frames.length - 1, next));
    if (bounded === index && notify === false) return;
    index = bounded;
    paint();
    if (notify) onFrame?.(frames[index].id, { historyMode });
  }

  function animateCamera(name) {
    const target = cameraBox(name);
    const token = ++cameraToken;
    const box = svg.viewBox.baseVal;
    const from = [box.x, box.y, box.width, box.height];
    if (reducedMotion || sameBox(from, target)) {
      svg.setAttribute("viewBox", target.map((value) => value.toFixed(1)).join(" "));
      return;
    }
    const started = performance.now();
    const duration = 720;
    const step = (now) => {
      if (token !== cameraToken) return;
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = from.map((value, i) => value + (target[i] - value) * eased);
      svg.setAttribute("viewBox", next.map((value) => value.toFixed(1)).join(" "));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  range.addEventListener("input", () => goToIndex(Number(range.value), { historyMode: "replace" }));
  range.addEventListener("change", () => goToIndex(Number(range.value), { historyMode: "push" }));
  detailsButton.addEventListener("click", () => {
    detailsOpen = !detailsOpen;
    paintChrome();
    inspector.hidden = !detailsOpen;
  });
  claimsInput.addEventListener("change", () => {
    claimsOn = claimsInput.checked;
    paintMap();
    paintInspector();
  });

  function onKey(event) {
    if (event.target.closest("input, textarea, select, a")) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToIndex(index + 1, { historyMode: "push" });
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToIndex(index - 1, { historyMode: "push" });
    } else if (event.key === "Escape" && detailsOpen) {
      detailsOpen = false;
      paintChrome();
      inspector.hidden = true;
    }
  }
  window.addEventListener("keydown", onKey);
  paint();

  return {
    goTo(id) {
      const next = frames.findIndex((item) => item.id === id);
      if (next < 0) return;
      goToIndex(next, { notify: false });
    },
    destroy() {
      window.removeEventListener("keydown", onKey);
      cameraToken += 1;
    },
  };
}

function portraitMark(name, portrait) {
  if (portrait?.src) {
    const image = document.createElement("img");
    image.className = "partition-chip-photo";
    image.src = portrait.src;
    image.alt = "";
    return image;
  }
  return el("span", "partition-monogram", initials(name));
}

function portraitFigure(name, portrait) {
  const figure = el("figure", "partition-portrait");
  const image = document.createElement("img");
  image.src = portrait.src;
  image.alt = `Portrait of ${name}`;
  const caption = el("figcaption");
  caption.append(document.createTextNode(`${portrait.author} · `));
  const license = el("a", "", portrait.license);
  license.href = portrait.licenseUrl;
  const source = el("a", "", "Wikimedia Commons");
  source.href = portrait.page;
  [license, source].forEach((link) => {
    link.target = "_blank";
    link.rel = "noreferrer";
  });
  caption.append(license, document.createTextNode(" · "), source);
  figure.append(image, caption);
  return figure;
}

function imageCredits(portraits, players) {
  const credits = el("details", "partition-credits");
  credits.appendChild(el("summary", "", "Image credits"));
  const list = el("ul");
  Object.entries(portraits).forEach(([id, portrait]) => {
    const person = players.get(id);
    if (!person || !portrait?.src) return;
    const item = el("li");
    item.append(document.createTextNode(`${person.name}: ${portrait.author} · `));
    const license = el("a", "", portrait.license);
    license.href = portrait.licenseUrl;
    const source = el("a", "", "Wikimedia Commons");
    source.href = portrait.page;
    [license, source].forEach((link) => {
      link.target = "_blank";
      link.rel = "noreferrer";
    });
    item.append(license, document.createTextNode(" · "), source);
    list.appendChild(item);
  });
  credits.appendChild(list);
  return credits;
}

function centroid(ring) {
  const totals = ring.reduce((sum, point) => {
    const [x, y] = project(point[0], point[1]);
    return [sum[0] + x, sum[1] + y];
  }, [0, 0]);
  return [totals[0] / ring.length, totals[1] / ring.length];
}

function addList(parent, heading, items = []) {
  if (!items?.length) return;
  parent.appendChild(el("h4", "", heading));
  const list = el("ul", "partition-points");
  items.forEach((item) => list.appendChild(el("li", "", item)));
  parent.appendChild(list);
}

function sameBox(a, b) {
  return a.every((value, index) => Math.abs(value - b[index]) < 0.5);
}
