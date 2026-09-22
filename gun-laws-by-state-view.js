import {
  filterStatesByCriteria,
  GUN_STATE_FILTER_ANY,
  GUN_STATE_FILTER_STATUSES,
  statusLabel,
} from "./gun-laws-by-state-model.js";

export function renderGunStateLawsBoard({
  plot,
  snapshot,
  filterConfig,
  filters,
  onFilterChange,
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
    ? `Source: ${snapshot.source.title} (${snapshot.source.retrieved}) · ${snapshot.source.url}`
    : "";
  head.append(title, lede, note, source);
  section.appendChild(head);

  section.appendChild(renderFilterPanel(filterConfig, filters, onFilterChange));

  const allStates = snapshot.states || [];
  const matching = filterStatesByCriteria(allStates, filters);
  section.appendChild(renderSummary(matching.length, allStates.length));
  section.appendChild(renderMapPlaceholder(matching));
  section.appendChild(renderStateTable(matching, selectedStateId, onSelectState));

  if (selectedStateId) {
    const detail = allStates.find((s) => s.id === selectedStateId);
    if (detail) section.appendChild(renderStateDetail(detail, filterConfig));
  }

  return section;
}

function renderFilterPanel(filterConfig, filters, onFilterChange) {
  const panel = document.createElement("div");
  panel.className = "gun-state-laws-filters";
  const heading = document.createElement("h3");
  heading.textContent = "Filter states";
  panel.appendChild(heading);
  const hint = document.createElement("p");
  hint.className = "gun-state-laws-filter-hint";
  hint.textContent =
    "Pick how each rule should look in states you care about. “Any” ignores that row. Federal dealer checks, ages, and prohibited-person rules still apply everywhere.";
  panel.appendChild(hint);

  const grid = document.createElement("div");
  grid.className = "gun-state-laws-filter-grid";
  (filterConfig.criteria || []).forEach((row) => {
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
      opt.textContent =
        value === GUN_STATE_FILTER_ANY
          ? "Any"
          : `Must be: ${statusLabel(value === "not_required" ? "not_required" : value)}`;
      if (value === "not_required") opt.textContent = "Must be: No / not required";
      if (value === "required") opt.textContent = "Must be: Yes / required";
      if (value === "partial") opt.textContent = "Must be: Partial (includes stricter)";
      if (value === "not_applicable") opt.textContent = "Must be: N/A";
      select.appendChild(opt);
    });
    select.value = filters[row.id] || GUN_STATE_FILTER_ANY;
    select.addEventListener("change", () => {
      onFilterChange(row.id, select.value);
    });
    field.append(span, select);
    grid.appendChild(field);
  });
  panel.appendChild(grid);
  return panel;
}

function renderSummary(matchCount, total) {
  const p = document.createElement("p");
  p.className = "gun-state-laws-summary";
  p.textContent = `${matchCount} of ${total} jurisdictions match your filters (50 states + D.C.).`;
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

function renderStateTable(states, selectedStateId, onSelectState) {
  const table = document.createElement("table");
  table.className = "gun-state-laws-table";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["State", "Purchase permit", "Private check", "Wait", "Carry license", "AW ban", "Mag limit", "Registration"].forEach(
    (label) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = label;
      headRow.appendChild(th);
    },
  );
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
      "assault-weapons-restriction",
      "magazine-capacity-limit",
      "handgun-registration",
    ].forEach((key) => {
      const td = document.createElement("td");
      td.textContent = statusLabel(state.checklist?.[key]?.status || "unknown");
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function renderStateDetail(state, filterConfig) {
  const panel = document.createElement("aside");
  panel.className = "gun-state-laws-detail";
  const title = document.createElement("h3");
  title.textContent = `${state.name} (${state.postal})`;
  panel.appendChild(title);
  const list = document.createElement("dl");
  list.className = "gun-state-laws-detail-list";
  (filterConfig.criteria || []).forEach((row) => {
    const cell = state.checklist?.[row.id];
    const dt = document.createElement("dt");
    dt.textContent = row.label;
    const dd = document.createElement("dd");
    dd.textContent = cell
      ? `${statusLabel(cell.status)} — ${cell.plainEnglish}`
      : "No Wikipedia row mapped yet.";
    list.append(dt, dd);
  });
  panel.appendChild(list);
  return panel;
}
