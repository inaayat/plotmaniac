import {
  GUN_TYPE_HANDGUN,
  GUN_TYPE_LONG_GUN,
  getStateCriterionCell,
  gunTypeLabel,
  highlightForState,
  resolveStatusForGunType,
  statusLabel,
} from "./gun-laws-by-state-model.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderGunStateLawsBoard({
  plot,
  snapshot,
  filterConfig,
  mapPaths,
  filters,
  gunType,
  onFilterChange,
  onGunTypeChange,
  selectedStateId,
  onSelectState,
}) {
  const section = document.createElement("section");
  section.className = "gun-state-laws web";

  const head = document.createElement("header");
  head.className = "gun-state-laws-head";
  const title = document.createElement("h2");
  title.textContent = plot.title || "Gun laws by state";
  const lede = document.createElement("p");
  lede.className = "gun-state-laws-lede";
  lede.textContent = plot.lede;
  const note = document.createElement("p");
  note.className = "gun-state-laws-note";
  note.textContent = snapshot.disclaimer || filterConfig.disclaimer || "";
  const source = document.createElement("p");
  source.className = "gun-state-laws-source";
  source.textContent = snapshot.source
    ? `Current snapshot · ${snapshot.source.title} (${snapshot.source.retrieved}) · ${snapshot.source.url}`
    : "";
  head.append(title, lede, note, source);
  section.appendChild(head);

  const allStates = snapshot.states || [];
  const painted = allStates.map((state) => ({
    state,
    highlight: highlightForState(state, filters, gunType),
  }));
  const lit = painted.filter((row) => row.highlight === "lit").map((row) => row.state);
  const unknownCount = painted.filter((row) => row.highlight === "unknown").length;

  const split = document.createElement("div");
  split.className = "gun-state-laws-split";
  split.appendChild(renderFilterPanel(filterConfig, filters, gunType, onFilterChange, onGunTypeChange));

  const mapColumn = document.createElement("div");
  mapColumn.className = "gun-state-laws-map-column";
  mapColumn.appendChild(renderSummary(lit.length, allStates.length, unknownCount, gunType, filters));
  mapColumn.appendChild(renderLegend());
  mapColumn.appendChild(renderStateMap(mapPaths, painted, selectedStateId, onSelectState));
  split.appendChild(mapColumn);
  section.appendChild(split);

  if (selectedStateId) {
    const detail = allStates.find((s) => s.id === selectedStateId);
    if (detail) section.appendChild(renderStateDetail(detail, filterConfig, gunType));
  }

  return section;
}

function renderGunTypeControl(filterConfig, gunType, onGunTypeChange) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "gun-state-laws-gun-type";
  const legend = document.createElement("legend");
  legend.textContent = "Firearm column";
  fieldset.appendChild(legend);
  const options = filterConfig.gunTypes || [
    { id: GUN_TYPE_HANDGUN, label: "Handgun" },
    { id: GUN_TYPE_LONG_GUN, label: "Long gun" },
  ];
  options.forEach((opt) => {
    const label = document.createElement("label");
    label.className = "gun-state-laws-gun-type-option";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "gun-type";
    input.value = opt.id;
    input.checked = gunType === opt.id;
    input.addEventListener("change", () => {
      if (input.checked) onGunTypeChange(opt.id);
    });
    label.append(input, document.createTextNode(opt.label));
    fieldset.appendChild(label);
  });
  const selected = options.find((opt) => opt.id === gunType) || options[0];
  if (selected?.explanation) {
    const explain = document.createElement("p");
    explain.className = "gun-state-laws-gun-type-explain";
    explain.textContent = selected.explanation;
    fieldset.appendChild(explain);
  }
  return fieldset;
}

function renderFilterPanel(filterConfig, filters, gunType, onFilterChange, onGunTypeChange) {
  const panel = document.createElement("div");
  panel.className = "gun-state-laws-filters";
  const heading = document.createElement("h3");
  heading.textContent = "Criteria";
  panel.appendChild(heading);
  panel.appendChild(renderGunTypeControl(filterConfig, gunType, onGunTypeChange));
  const hint = document.createElement("p");
  hint.className = "gun-state-laws-filter-hint";
  hint.textContent =
    `Check a rule to light only places where that ${gunTypeLabel(gunType).toLowerCase()} rule is not required. Uncheck it to stop filtering on it. Federal dealer checks, ages, and prohibited-person rules still apply everywhere.`;
  panel.appendChild(hint);

  const groups = [
    { id: "ownership", title: "Own and buy" },
    { id: "carry", title: "Carry" },
  ];
  groups.forEach((group) => {
    const rows = (filterConfig.criteria || []).filter((row) => row.group === group.id);
    if (!rows.length) return;
    const block = document.createElement("fieldset");
    block.className = "gun-state-laws-filter-group";
    const sub = document.createElement("legend");
    sub.textContent = group.title;
    block.appendChild(sub);
    rows.forEach((row) => block.appendChild(renderFilterToggle(row, filters, onFilterChange)));
    panel.appendChild(block);
  });

  return panel;
}

function renderFilterToggle(row, filters, onFilterChange) {
  const label = document.createElement("label");
  label.className = "gun-state-laws-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.criterion = row.id;
  input.checked = filters[row.id] === "not_required";
  input.addEventListener("change", () => {
    onFilterChange(row.id, input.checked ? "not_required" : "any");
  });
  const copy = document.createElement("span");
  copy.className = "gun-state-laws-toggle-copy";
  const text = document.createElement("span");
  text.className = "gun-state-laws-toggle-title";
  text.textContent = row.toggleLabel || row.label;
  copy.appendChild(text);
  if (row.explanation) {
    const explain = document.createElement("span");
    explain.className = "gun-state-laws-toggle-explain";
    explain.id = `criterion-explain-${row.id}`;
    explain.textContent = row.explanation;
    input.setAttribute("aria-describedby", explain.id);
    copy.appendChild(explain);
  }
  label.append(input, copy);
  return label;
}

function activeFilterCount(filters) {
  return Object.values(filters || {}).filter((want) => want && want !== "any").length;
}

function renderSummary(litCount, total, unknownCount, gunType, filters) {
  const p = document.createElement("p");
  p.className = "gun-state-laws-summary";
  const filtersOn = activeFilterCount(filters);
  if (!filtersOn) {
    p.textContent = `All ${total} jurisdictions are lit (${gunTypeLabel(gunType)}). Check a criterion to narrow where that extra rule is not required.`;
    return p;
  }
  const unknownBit = unknownCount
    ? ` ${unknownCount} stay dimmed because Wikipedia has no row for a rule you checked.`
    : "";
  p.textContent = `${litCount} of ${total} jurisdictions light up for ${gunTypeLabel(gunType).toLowerCase()}s.${unknownBit}`;
  return p;
}

function renderLegend() {
  const list = document.createElement("ul");
  list.className = "gun-state-laws-legend";
  [
    ["is-lit", "Lights up — matches every checked rule"],
    ["is-unknown", "Outlined — a checked rule has no Wikipedia row"],
    ["is-dim", "Dark — does not match"],
  ].forEach(([cls, label]) => {
    const item = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.className = `gun-state-laws-swatch ${cls}`;
    swatch.setAttribute("aria-hidden", "true");
    item.append(swatch, document.createTextNode(label));
    list.appendChild(item);
  });
  return list;
}

function renderStateMap(mapPaths, painted, selectedStateId, onSelectState) {
  const wrap = document.createElement("div");
  wrap.className = "gun-state-laws-map";
  const byId = new Map(painted.map((row) => [row.state.id, row]));
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", mapPaths?.viewBox || "0 0 975 610");
  svg.setAttribute("role", "group");
  svg.setAttribute("aria-label", "United States map. Lit states match the criteria you checked.");
  svg.classList.add("gun-state-laws-svg");

  (mapPaths?.states || []).forEach((shape) => {
    const paintedRow = byId.get(shape.id);
    const highlight = paintedRow?.highlight || "dim";
    const record = paintedRow?.state;
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", shape.d);
    path.classList.add("gun-state-shape", `is-${highlight}`);
    if (shape.id === selectedStateId) path.classList.add("is-selected");
    path.dataset.state = shape.id;
    const name = record?.name || shape.name || shape.id;
    const postal = record?.postal || "";
    path.setAttribute("role", "button");
    path.setAttribute("tabindex", "0");
    path.setAttribute("aria-pressed", shape.id === selectedStateId ? "true" : "false");
    path.setAttribute("aria-label", `${name}${postal ? ` (${postal})` : ""}, ${highlightLabel(highlight)}`);
    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = `${name}${postal ? ` (${postal})` : ""} — ${highlightLabel(highlight)}`;
    path.appendChild(title);
    const select = () => onSelectState(shape.id);
    path.addEventListener("click", select);
    path.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        select();
      }
    });
    svg.appendChild(path);
  });

  if (!mapPaths?.states?.length) {
    const missing = document.createElement("p");
    missing.className = "gun-state-laws-note";
    missing.textContent = "State map shapes did not load.";
    wrap.appendChild(missing);
    return wrap;
  }

  wrap.appendChild(svg);
  return wrap;
}

function highlightLabel(highlight) {
  if (highlight === "lit") return "matches your criteria";
  if (highlight === "unknown") return "Wikipedia row missing for a checked rule";
  return "does not match";
}

function renderStateDetail(state, filterConfig, gunType) {
  const panel = document.createElement("aside");
  panel.className = "gun-state-laws-detail";
  const title = document.createElement("h3");
  title.textContent = `${state.name} (${state.postal}) · ${gunTypeLabel(gunType)}`;
  panel.appendChild(title);
  const list = document.createElement("dl");
  list.className = "gun-state-laws-detail-list";
  (filterConfig.criteria || []).forEach((row) => {
    const cell = getStateCriterionCell(state, row.id);
    const dt = document.createElement("dt");
    dt.textContent = row.toggleLabel || row.label;
    const dd = document.createElement("dd");
    const status = resolveStatusForGunType(cell, gunType, row.id);
    dd.textContent = cell
      ? `${statusLabel(status)} — ${cell.plainEnglish}`
      : "No Wikipedia row mapped yet.";
    list.append(dt, dd);
  });
  panel.appendChild(list);
  return panel;
}
