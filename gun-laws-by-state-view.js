import {
  filterStatesByCriteria,
  GUN_STATE_FILTER_ANY,
  GUN_STATE_FILTER_STATUSES,
  GUN_TYPE_HANDGUN,
  GUN_TYPE_LONG_GUN,
  getStateCriterionCell,
  gunTypeLabel,
  resolveStatusForGunType,
  statusLabel,
} from "./gun-laws-by-state-model.js";

export function renderGunStateLawsBoard({
  plot,
  snapshot,
  filterConfig,
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

  section.appendChild(renderFilterPanel(filterConfig, filters, gunType, onFilterChange, onGunTypeChange));

  const allStates = snapshot.states || [];
  const matching = filterStatesByCriteria(allStates, filters, gunType);
  section.appendChild(renderSummary(matching.length, allStates.length, gunType));
  section.appendChild(renderMapPlaceholder(matching));
  section.appendChild(renderStateTable(matching, selectedStateId, onSelectState, gunType));

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
  legend.textContent = "Apply Wikipedia columns for";
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
  return fieldset;
}

function renderFilterPanel(filterConfig, filters, gunType, onFilterChange, onGunTypeChange) {
  const panel = document.createElement("div");
  panel.className = "gun-state-laws-filters";
  const heading = document.createElement("h3");
  heading.textContent = "Filter states";
  panel.appendChild(heading);
  panel.appendChild(renderGunTypeControl(filterConfig, gunType, onGunTypeChange));
  const hint = document.createElement("p");
  hint.className = "gun-state-laws-filter-hint";
  hint.textContent =
    `Table and filters use the ${gunTypeLabel(gunType).toLowerCase()} column from each Wikipedia state table. “Any” skips a rule. Federal dealer checks, ages, and prohibited-person rules still apply everywhere.`;
  panel.appendChild(hint);

  const groups = [
    { id: "ownership", title: "Purchase & possession" },
    { id: "carry", title: "Carry (concealed & open)" },
  ];
  groups.forEach((group) => {
    const rows = (filterConfig.criteria || []).filter((row) => row.group === group.id);
    if (!rows.length) return;
    const block = document.createElement("div");
    block.className = "gun-state-laws-filter-group";
    const sub = document.createElement("h4");
    sub.textContent = group.title;
    block.appendChild(sub);
    const grid = document.createElement("div");
    grid.className = "gun-state-laws-filter-grid";
    rows.forEach((row) => {
      grid.appendChild(renderFilterSelect(row, filters, onFilterChange));
    });
    block.appendChild(grid);
    panel.appendChild(block);
  });

  const ungrouped = (filterConfig.criteria || []).filter((row) => !row.group);
  if (ungrouped.length) {
    const grid = document.createElement("div");
    grid.className = "gun-state-laws-filter-grid";
    ungrouped.forEach((row) => grid.appendChild(renderFilterSelect(row, filters, onFilterChange)));
    panel.appendChild(grid);
  }

  return panel;
}

function renderFilterSelect(row, filters, onFilterChange) {
  const field = document.createElement("label");
  field.className = "gun-state-laws-filter-field";
  const span = document.createElement("span");
  span.textContent = row.label;
  const select = document.createElement("select");
  select.dataset.criterion = row.id;
  select.setAttribute("aria-label", row.label);
  GUN_STATE_FILTER_STATUSES.forEach((value) => {
    const opt = document.createElement("option");
    opt.value = value;
    if (value === GUN_STATE_FILTER_ANY) opt.textContent = "Any";
    else if (value === "not_required") opt.textContent = "Must be: No / not required";
    else if (value === "required") opt.textContent = "Must be: Yes / required";
    else if (value === "partial") opt.textContent = "Must be: Partial (includes stricter)";
    else if (value === "not_applicable") opt.textContent = "Must be: N/A";
    else opt.textContent = `Must be: ${statusLabel(value)}`;
    select.appendChild(opt);
  });
  select.value = filters[row.id] || GUN_STATE_FILTER_ANY;
  select.addEventListener("change", () => onFilterChange(row.id, select.value));
  field.append(span, select);
  return field;
}

function renderSummary(matchCount, total, gunType) {
  const p = document.createElement("p");
  p.className = "gun-state-laws-summary";
  p.textContent = `${matchCount} of ${total} jurisdictions match (${gunTypeLabel(gunType)} column · 50 states + D.C.).`;
  return p;
}

function renderMapPlaceholder(states) {
  const wrap = document.createElement("div");
  wrap.className = "gun-state-laws-map-placeholder";
  const title = document.createElement("h3");
  title.textContent = "Map (coming next)";
  const p = document.createElement("p");
  p.textContent =
    "Choropleth map will highlight matching states. For now, use the table below — selected filters apply to the same data.";
  wrap.append(title, p);
  const chips = document.createElement("div");
  chips.className = "gun-state-laws-map-chips";
  chips.setAttribute("role", "list");
  states.forEach((state) => {
    const chip = document.createElement("span");
    chip.className = "gun-state-laws-chip";
    chip.setAttribute("role", "listitem");
    chip.textContent = state.postal;
    chip.title = state.name;
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);
  return wrap;
}

function cellLabel(state, criterionId, gunType) {
  const cell = getStateCriterionCell(state, criterionId);
  return statusLabel(resolveStatusForGunType(cell, gunType, criterionId));
}

function renderStateTable(states, selectedStateId, onSelectState, gunType) {
  const table = document.createElement("table");
  table.className = "gun-state-laws-table";
  const gt = gunTypeLabel(gunType);
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  [
    "State",
    `Purchase (${gt})`,
    `Private check (${gt})`,
    `Wait (${gt})`,
    "Concealed",
    "Open carry",
    `AW (${gt})`,
    `Mag (${gt})`,
    `Reg (${gt})`,
  ].forEach((label) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  states.forEach((state) => {
    const tr = document.createElement("tr");
    tr.classList.toggle("is-selected", state.id === selectedStateId);
    const nameCell = document.createElement("th");
    nameCell.scope = "row";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gun-state-laws-row-btn";
    btn.textContent = `${state.postal} · ${state.name}`;
    btn.addEventListener("click", () => onSelectState(state.id));
    nameCell.appendChild(btn);
    tr.appendChild(nameCell);
    [
      "purchase-permit",
      "private-sale-check",
      "waiting-period",
      "carry-permit",
      "open-carry-permit",
      "assault-weapons-restriction",
      "magazine-capacity-limit",
      "handgun-registration",
    ].forEach((key) => {
      const td = document.createElement("td");
      td.textContent = cellLabel(state, key, gunType);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
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
    dt.textContent = row.label;
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
