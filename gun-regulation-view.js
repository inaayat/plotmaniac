import {
  activeRegulationBanners,
  checklistStatusClass,
  checklistStatusLabel,
  filterRegulationBeats,
  regulationToneClass,
  regulationToneLabel,
  resolveChecklistAtYear,
  statsReadoutAtYear,
} from "./gun-regulation-model.js";
import {
  buildLaneChrome,
  layoutLane,
} from "./lane.js";

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderRegulationBoard({
  plot,
  board,
  state,
  isCompact,
  onKindFilter,
  onToggleChecklist,
  onCloseChecklist,
  onBeatToggle,
}) {
  const section = document.createElement("section");
  section.className = "regulation-board web";

  section.appendChild(renderRegulationHeader(plot, board));
  section.appendChild(renderRegulationLegend());

  const stats = renderRegulationStats(board, state.year);
  stats.classList.add("regulation-stats");
  section.appendChild(stats);

  section.appendChild(renderKindFilters(state.regKind, onKindFilter));

  const main = document.createElement("div");
  main.className = "regulation-main";

  const railWrap = document.createElement("div");
  railWrap.className = "regulation-rail-wrap";
  railWrap.appendChild(renderRegulationRail(board, state, onBeatToggle, isCompact));
  main.appendChild(railWrap);

  if (isCompact) {
    const open = document.createElement("button");
    open.type = "button";
    open.className = "regulation-checklist-open";
    open.textContent = "Ownership criteria checklist";
    open.addEventListener("click", onToggleChecklist);
    main.appendChild(open);
  }

  const side = renderChecklistPanel(board, state, isCompact, onCloseChecklist);
  main.appendChild(side);
  section.appendChild(main);

  section.appendChild(renderExemplarGrid(board, state));
  section.appendChild(renderComingSoonCta());

  if (isCompact && state.checklistOpen) {
    const scrim = document.createElement("button");
    scrim.type = "button";
    scrim.className = "drawer-scrim";
    scrim.setAttribute("aria-label", "Close checklist");
    scrim.addEventListener("click", onCloseChecklist);
    side.before(scrim);
  }

  return section;
}

function renderRegulationHeader(plot, board) {
  const head = document.createElement("header");
  head.className = "regulation-head";
  const title = document.createElement("h2");
  title.textContent = plot.title || "Gun regulation in the United States";
  const lede = document.createElement("p");
  lede.className = "regulation-lede";
  lede.textContent = plot.lede;
  const snap = document.createElement("p");
  snap.className = "regulation-snapshot";
  snap.textContent = board.statsMeta?.snapshot
    ? `Data snapshot · ${board.statsMeta.snapshot}`
    : "";
  head.append(title, lede, snap);
  return head;
}

function renderRegulationLegend() {
  const key = document.createElement("ul");
  key.className = "regulation-key web-key";
  [
    ["tone-reg-tight", "Tighter / higher regulation (blue)"],
    ["tone-reg-loose", "Looser / lower regulation (yellow)"],
    ["tone-reg-mixed", "Mixed or varies by state (amber/gray)"],
    ["reg-stat-neutral", "Statistics stay neutral — not moral colors"],
  ].forEach(([cls, label]) => {
    const item = document.createElement("li");
    const swatch = document.createElement("i");
    swatch.className = `swatch ${cls}`;
    item.append(swatch, document.createTextNode(label));
    key.appendChild(item);
  });
  return key;
}

export function renderRegulationStats(board, year) {
  const wrap = document.createElement("div");
  wrap.className = "regulation-stats-grid";
  const readouts = statsReadoutAtYear(board.stats, year);
  readouts.forEach(({ series, point, measures, missing }) => {
    const card = document.createElement("article");
    card.className = "regulation-stat-card";
    card.classList.toggle("is-empty", missing);
    const label = document.createElement("h3");
    label.textContent = series.label;
    const value = document.createElement("p");
    value.className = "regulation-stat-value";
    if (missing) {
      value.textContent = "No comparable series yet";
    } else if (measures) {
      value.textContent = measures
        .map(({ measure, point: pt }) => (pt ? `${measure.label}: ${pt.value}` : `${measure.label}: —`))
        .join(" · ");
    } else if (point) {
      const badge = series.coverage?.quality === "modeled" ? " (modeled)" : "";
      value.textContent = `${point.value}${series.unit ? ` ${series.unit}` : ""}${badge}`;
    }
    const meta = document.createElement("p");
    meta.className = "regulation-stat-meta";
    meta.textContent = series.sourceMethod || "";
    card.append(label, value, meta);
    if (series.sources?.length) {
      const links = document.createElement("div");
      links.className = "relation-links beat-links";
      series.sources.forEach((link) => {
        const a = document.createElement("a");
        a.href = link.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = link.label;
        links.appendChild(a);
      });
      card.appendChild(links);
    }
    wrap.appendChild(card);
  });
  return wrap;
}

function renderKindFilters(activeKind, onKindFilter) {
  const bar = document.createElement("div");
  bar.className = "region-bar regulation-kind-bar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Filter timeline beats");
  const all = document.createElement("button");
  all.type = "button";
  all.className = "region-toggle";
  all.textContent = "All beats";
  all.classList.toggle("is-open", !activeKind);
  all.setAttribute("aria-pressed", String(!activeKind));
  all.addEventListener("click", () => onKindFilter(""));
  bar.appendChild(all);
  ["scotus", "statute", "agency", "state"].forEach((kind) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "region-toggle";
    button.textContent = kind.toUpperCase();
    button.classList.toggle("is-open", activeKind === kind);
    button.setAttribute("aria-pressed", String(activeKind === kind));
    button.addEventListener("click", () => onKindFilter(kind));
    bar.appendChild(button);
  });
  return bar;
}

function renderRegulationRail(board, state, onBeatToggle, isCompact) {
  const beats = filterRegulationBeats(board.timeline, { kind: state.regKind || "" })
    .slice()
    .sort((a, b) => Number(a.year) - Number(b.year) || a.id.localeCompare(b.id));

  if (isCompact) {
    const view = document.createElement("div");
    view.className = "spine-view regulation-spine";
    const hint = document.createElement("p");
    hint.className = "rail-note";
    hint.textContent = "Federal regulation timeline from 1791. Open a beat for plain-English context and sources.";
    view.appendChild(hint);
    const rail = document.createElement("ol");
    rail.className = "spine";
    let year = "";
    beats.forEach((beat) => {
      if (beat.year !== year) {
        year = beat.year;
        const stone = document.createElement("li");
        stone.className = "spine-year";
        stone.textContent = year;
        rail.appendChild(stone);
      }
      rail.appendChild(regulationSpineBeat(beat, state, onBeatToggle));
    });
    view.appendChild(rail);
    return view;
  }

  const { view, rail } = buildLaneChrome(
    "Federal regulation timeline from 1791. Drag to pan; Control-scroll or use Fit to zoom.",
    { ariaLabel: "Gun regulation timeline from 1791. Drag to move. Control-scroll to zoom." },
  );
  view.classList.add("regulation-lane");
  let year = "";
  let step = 0;
  beats.forEach((beat) => {
    if (beat.year !== year) {
      year = beat.year;
      rail.appendChild(laneYearLabel(year));
    }
    const side = step % 2 === 0 ? "above" : "below";
    step += 1;
    rail.appendChild(regulationLaneBeat(beat, side, state, onBeatToggle));
  });
  requestAnimationFrame(() => layoutLane(view));
  return view;
}

function laneYearLabel(year) {
  const stone = document.createElement("li");
  stone.className = "lane-year";
  const text = document.createElement("span");
  text.textContent = year;
  stone.appendChild(text);
  return stone;
}

function regulationLaneBeat(beat, side, state, onBeatToggle) {
  const item = document.createElement("li");
  item.className = `lane-event side-${side} ${regulationToneClass(beat.tone)}`;
  item.classList.toggle("is-selected", state.eventId === beat.id);
  item.id = `beat-${beat.id}`;
  const card = document.createElement("div");
  card.className = "lane-card";
  const mark = document.createElement("button");
  mark.type = "button";
  mark.className = "lane-mark regulation-kind-mark";
  mark.textContent = beat.kind;
  mark.setAttribute("aria-label", `${beat.year}. ${beat.event}`);
  mark.addEventListener("click", () => onBeatToggle(beat.id));
  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "lane-hit";
  const when = document.createElement("time");
  when.dateTime = beat.date || `${beat.year}-01-01`;
  when.textContent = beat.year;
  const heading = document.createElement("strong");
  heading.textContent = beat.event;
  const tone = document.createElement("em");
  tone.textContent = regulationToneLabel(beat.tone);
  hit.append(when, heading);
  if (state.eventId !== beat.id) {
    const tease = document.createElement("span");
    tease.className = "beat-tease";
    tease.textContent = beat.plainEnglish.slice(0, 140) + (beat.plainEnglish.length > 140 ? "…" : "");
    hit.appendChild(tease);
  }
  hit.appendChild(tone);
  hit.addEventListener("click", () => onBeatToggle(beat.id));
  card.append(mark, hit);
  if (state.eventId === beat.id) {
    card.appendChild(regulationBeatMore(beat));
  }
  item.appendChild(card);
  return item;
}

function regulationSpineBeat(beat, state, onBeatToggle) {
  const item = document.createElement("li");
  item.className = `spine-event ${regulationToneClass(beat.tone)}`;
  item.classList.toggle("is-selected", state.eventId === beat.id);
  item.id = `beat-${beat.id}`;
  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "spine-hit";
  const when = document.createElement("time");
  when.textContent = beat.year;
  const heading = document.createElement("strong");
  heading.textContent = beat.event;
  hit.append(when, heading);
  hit.addEventListener("click", () => onBeatToggle(beat.id));
  item.appendChild(hit);
  if (state.eventId === beat.id) item.appendChild(regulationBeatMore(beat));
  return item;
}

function regulationBeatMore(beat) {
  const more = document.createElement("div");
  more.className = "lane-more";
  const summary = document.createElement("p");
  summary.textContent = beat.plainEnglish;
  more.appendChild(summary);
  if (beat.links?.length) {
    const links = document.createElement("div");
    links.className = "relation-links beat-links";
    beat.links.forEach((link) => {
      const a = document.createElement("a");
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = link.label;
      links.appendChild(a);
    });
    more.appendChild(links);
  }
  return more;
}

function renderChecklistPanel(board, state, isCompact, onCloseChecklist) {
  const panel = document.createElement("aside");
  panel.className = "relation-drawer regulation-checklist";
  panel.hidden = isCompact && !state.checklistOpen;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Ownership criteria checklist");

  const close = document.createElement("button");
  close.type = "button";
  close.className = "drawer-close";
  close.textContent = "Close";
  close.addEventListener("click", onCloseChecklist);

  const head = document.createElement("div");
  head.className = "drawer-head";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = `Federal baseline · ${state.year}`;
  const title = document.createElement("h2");
  title.textContent = "Ownership criteria";
  copy.append(eyebrow, title);
  head.appendChild(copy);

  panel.append(close, head);

  activeRegulationBanners(board.banners, state.year).forEach((banner) => {
    const box = document.createElement("div");
    box.className = "regulation-banner";
    const h = document.createElement("h3");
    h.textContent = banner.title;
    const p = document.createElement("p");
    p.textContent = banner.plainEnglish;
    box.append(h, p);
    panel.appendChild(box);
  });

  const list = document.createElement("ol");
  list.className = "regulation-checklist-rows";
  const rows = resolveChecklistAtYear(board.checklistRows, board.federalKeyframes, null, state.year);
  rows.forEach(({ row, cell }) => {
    const item = document.createElement("li");
    item.className = checklistStatusClass(cell.status);
    const label = document.createElement("strong");
    label.textContent = row.label;
    const status = document.createElement("span");
    status.className = "regulation-check-status";
    status.textContent = checklistStatusLabel(cell.status);
    const note = document.createElement("p");
    note.textContent = cell.plainEnglish;
    item.append(label, status, note);
    list.appendChild(item);
  });
  panel.appendChild(list);
  return panel;
}

function renderExemplarGrid(board, state) {
  const wrap = document.createElement("section");
  wrap.className = "regulation-exemplars";
  const title = document.createElement("h3");
  title.textContent = `State divergence · ${state.year}`;
  wrap.appendChild(title);
  const grid = document.createElement("div");
  grid.className = "regulation-exemplar-grid";
  ["ca", "ny", "tx"].forEach((id) => {
    const record = board.states[id];
    if (!record) return;
    const col = document.createElement("article");
    col.className = "regulation-exemplar-col";
    const heading = document.createElement("h4");
    heading.textContent = record.name;
    col.appendChild(heading);
    const table = document.createElement("dl");
    table.className = "regulation-exemplar-rows";
    const rows = resolveChecklistAtYear(board.checklistRows, board.federalKeyframes, record, state.year);
    rows.forEach(({ row, cell }) => {
      const dt = document.createElement("dt");
      dt.textContent = row.label;
      const dd = document.createElement("dd");
      dd.className = checklistStatusClass(cell.status);
      dd.textContent = `${checklistStatusLabel(cell.status)} — ${cell.plainEnglish}`;
      table.append(dt, dd);
    });
    col.appendChild(table);
    grid.appendChild(col);
  });
  wrap.appendChild(grid);
  return wrap;
}

function renderComingSoonCta() {
  const cta = document.createElement("div");
  cta.className = "regulation-coming-soon";
  const p = document.createElement("p");
  p.textContent = "Explore all 50 states — coming soon";
  const note = document.createElement("p");
  note.className = "regulation-coming-note";
  note.textContent = "V1 shows California, New York, and Texas only. A searchable state picker will reuse this checklist and timeline schema.";
  cta.append(p, note);
  return cta;
}

export function syncRegulationBoardDom(board, state, root = document) {
  const stats = root.querySelector(".regulation-stats-grid");
  if (stats) {
    const next = renderRegulationStats(board, state.year);
    stats.replaceWith(next);
    next.classList.add("regulation-stats");
  }
  const panel = root.querySelector(".regulation-checklist");
  if (panel) {
    const list = panel.querySelector(".regulation-checklist-rows");
    if (list) {
      list.replaceChildren();
      resolveChecklistAtYear(board.checklistRows, board.federalKeyframes, null, state.year).forEach(({ row, cell }) => {
        const item = document.createElement("li");
        item.className = checklistStatusClass(cell.status);
        const label = document.createElement("strong");
        label.textContent = row.label;
        const status = document.createElement("span");
        status.className = "regulation-check-status";
        status.textContent = checklistStatusLabel(cell.status);
        const note = document.createElement("p");
        note.textContent = cell.plainEnglish;
        item.append(label, status, note);
        list.appendChild(item);
      });
    }
    panel.querySelector(".eyebrow").textContent = `Federal baseline · ${state.year}`;
    panel.querySelectorAll(".regulation-banner").forEach((node) => node.remove());
    const anchor = panel.querySelector(".regulation-checklist-rows");
    activeRegulationBanners(board.banners, state.year).forEach((banner) => {
      const box = document.createElement("div");
      box.className = "regulation-banner";
      box.innerHTML = `<h3></h3><p></p>`;
      box.querySelector("h3").textContent = banner.title;
      box.querySelector("p").textContent = banner.plainEnglish;
      anchor.before(box);
    });
  }
  const exemplar = root.querySelector(".regulation-exemplar-grid");
  if (exemplar) {
    exemplar.replaceChildren();
    ["ca", "ny", "tx"].forEach((id) => {
      const record = board.states[id];
      if (!record) return;
      const col = document.createElement("article");
      col.className = "regulation-exemplar-col";
      col.innerHTML = `<h4>${record.name}</h4><dl class="regulation-exemplar-rows"></dl>`;
      const table = col.querySelector("dl");
      resolveChecklistAtYear(board.checklistRows, board.federalKeyframes, record, state.year).forEach(({ row, cell }) => {
        const dt = document.createElement("dt");
        dt.textContent = row.label;
        const dd = document.createElement("dd");
        dd.className = checklistStatusClass(cell.status);
        dd.textContent = `${checklistStatusLabel(cell.status)} — ${cell.plainEnglish}`;
        table.append(dt, dd);
      });
      exemplar.appendChild(col);
    });
  }
}
