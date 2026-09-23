import {
  chronologyById,
  chronologyFilterLabel,
  chronologyPosterUrl,
  chronologyRailPosterSize,
  chronologyWatchBefore,
  chronologyWatchNext,
} from "./engine.js";

function posterAcronym(title) {
  const words = String(title || "").replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function swapFocusPane(root, render) {
  const pane = root.querySelector(".chrono-focus-layout");
  if (!pane || prefersReducedMotion() || !document.startViewTransition) {
    render();
    return;
  }
  document.startViewTransition(() => render());
}

export function renderMarvelChronology({
  chronology,
  peopleById,
  focusId,
  onFocus,
  onOpenPerson,
  onOpenWeb,
  onOpenChronology,
  avatar,
}) {
  const section = document.createElement("section");
  section.className = "focus marvel-chronology";
  const index = chronologyById(chronology);
  const titles = chronology.titles || [];
  let activeId = focusId || titles[0]?.id;
  if (!activeId) {
    section.appendChild(emptyBlock("No chronology titles loaded."));
    return section;
  }

  const tools = document.createElement("p");
  tools.className = "chrono-archive-tools";
  if (typeof onOpenWeb === "function") {
    const archived = document.createElement("button");
    archived.type = "button";
    archived.className = "chrono-archive-link";
    archived.textContent = "Character web (archived)";
    archived.addEventListener("click", () => onOpenWeb());
    tools.appendChild(archived);
    section.appendChild(tools);
  }

  const strip = buildOrderStrip({
    titles,
    activeId: () => activeId,
    onFocus: (id) => setFocus(id),
    onOpenChronology,
    variant: "compact",
  });
  section.appendChild(strip);

  const focusHost = document.createElement("div");
  focusHost.className = "chrono-focus-host";
  section.appendChild(focusHost);

  const paintFocus = () => {
    const entry = index.get(activeId) || titles[0];
    if (!entry) return;
    focusHost.replaceChildren(buildFocusLayout({
      entry,
      chronology,
      index,
      peopleById,
      onFocus: setFocus,
      onOpenPerson,
      avatar,
    }));
    strip.querySelectorAll(".chrono-chip").forEach((item) => {
      const on = item.dataset.id === entry.id;
      item.classList.toggle("is-active", on);
      if (on) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    });
    requestAnimationFrame(() => {
      fitChronoRails(focusHost.querySelector(".chrono-focus-layout"));
      strip.querySelector(".chrono-chip.is-active")?.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
    });
  };

  const setFocus = (id, { pushState = true } = {}) => {
    const next = index.get(id);
    if (!next) return;
    activeId = id;
    swapFocusPane(focusHost, paintFocus);
    if (pushState) onFocus(id);
  };

  const ro = new ResizeObserver(() => {
    fitChronoRails(focusHost.querySelector(".chrono-focus-layout"));
  });
  ro.observe(focusHost);

  paintFocus();
  return section;
}

export function renderMarvelChronologyIndex({
  chronology,
  focusId,
  onFocus,
}) {
  const section = document.createElement("section");
  section.className = "focus marvel-chronology marvel-chronology-index";
  const titles = chronology?.titles || [];
  if (!titles.length) {
    section.appendChild(emptyBlock("No chronology titles loaded."));
    return section;
  }

  const head = document.createElement("header");
  head.className = "chrono-index-head";
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "MCU + Mutant Legacy";
  const title = document.createElement("h2");
  title.textContent = "Full chronological list";
  const lede = document.createElement("p");
  lede.className = "chrono-index-lede";
  lede.textContent = "Story order across the shared MCU and guest-world titles. Pick a row to open Watch Order for that film.";
  head.append(eyebrow, title, lede);
  section.appendChild(head);
  section.appendChild(buildOrderStrip({
    titles,
    activeId: () => focusId,
    onFocus,
    variant: "page",
  }));
  return section;
}

function currentFocusId(activeId) {
  return typeof activeId === "function" ? activeId() : activeId;
}

function buildOrderStrip({ titles, activeId, onFocus, onOpenChronology, variant = "compact" }) {
  const wrap = document.createElement("div");
  wrap.className = `chrono-order-strip chrono-order-strip--${variant}`;

  const bar = document.createElement("div");
  bar.className = "chrono-order-bar";
  const heading = document.createElement("h3");
  heading.className = "chrono-order-heading";
  heading.textContent = variant === "page" ? "Story order" : "Full chronological list";
  bar.appendChild(heading);
  if (variant === "compact" && typeof onOpenChronology === "function") {
    const open = document.createElement("button");
    open.type = "button";
    open.className = "chrono-order-open";
    open.textContent = "Open full list";
    open.setAttribute("aria-label", "Open the full chronological list page");
    open.addEventListener("click", () => onOpenChronology());
    bar.appendChild(open);
  }
  wrap.appendChild(bar);

  if (variant === "page") {
    wrap.appendChild(buildIndexGroups(titles, currentFocusId(activeId), onFocus));
    return wrap;
  }

  const list = document.createElement("div");
  list.className = "chrono-chip-cloud";
  list.setAttribute("aria-label", "Full chronological title list");
  let lastEra = "";
  titles.forEach((entry, order) => {
    if (entry.era && entry.era !== lastEra) {
      lastEra = entry.era;
      const era = document.createElement("span");
      era.className = "chrono-era-label";
      era.textContent = entry.era;
      list.appendChild(era);
    }
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chrono-chip";
    chip.dataset.id = entry.id;
    chip.title = chronologyFilterLabel(entry);
    const num = document.createElement("span");
    num.className = "chrono-chip-num";
    num.textContent = String(order + 1);
    const name = document.createElement("span");
    name.className = "chrono-chip-title";
    name.textContent = chronologyFilterLabel(entry);
    chip.append(num, name);
    if (currentFocusId(activeId) === entry.id) {
      chip.classList.add("is-active");
      chip.setAttribute("aria-current", "true");
    }
    chip.addEventListener("click", () => onFocus(entry.id));
    list.appendChild(chip);
  });
  wrap.appendChild(list);
  return wrap;
}

function buildIndexGroups(titles, focusId, onFocus) {
  const root = document.createElement("div");
  root.className = "chrono-index-list";
  root.setAttribute("aria-label", "Full chronological title list");
  let group = null;
  let list = null;
  titles.forEach((entry, order) => {
    if (!group || entry.era !== group.dataset.era) {
      group = document.createElement("section");
      group.className = "chrono-index-group";
      group.dataset.era = entry.era || "";
      const era = document.createElement("h4");
      era.className = "chrono-era-label";
      era.textContent = entry.era || "Chronology";
      list = document.createElement("ol");
      list.className = "chrono-index-ol";
      list.start = order + 1;
      group.append(era, list);
      root.appendChild(group);
    }
    list.appendChild(indexRow(entry, order + 1, focusId === entry.id, onFocus));
  });
  return root;
}

function indexRow(entry, order, active, onFocus) {
  const item = document.createElement("li");
  item.className = `chrono-index-item${active ? " is-active" : ""}`;
  item.dataset.id = entry.id;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "chrono-index-button";
  button.setAttribute("aria-label", `Focus ${chronologyFilterLabel(entry)} in Watch Order`);
  if (active) button.setAttribute("aria-current", "true");
  button.append(
    posterTile(entry, { size: "sm" }),
    spineCopy(entry, order),
  );
  button.addEventListener("click", () => onFocus(entry.id));
  item.appendChild(button);
  return item;
}

function buildFocusLayout({ entry, chronology, index, peopleById, onFocus, onOpenPerson, avatar }) {
  const layout = document.createElement("div");
  layout.className = "chrono-focus-layout";
  layout.style.viewTransitionName = "chrono-focus";

  const before = chronologyWatchBefore(entry, index);
  const next = chronologyWatchNext(chronology, entry.id);
  const railCount = Math.max(before.length, next.length, 1);
  layout.dataset.railCount = String(railCount);
  layout.style.setProperty("--chrono-rail-count", String(railCount));

  const inbound = document.createElement("aside");
  inbound.className = "chrono-rail chrono-rail--in";
  inbound.appendChild(railHeading("Watch Before"));
  inbound.appendChild(watchRail({
    items: before,
    empty: "Nothing required before this title.",
    onFocus,
    side: "in",
  }));

  const center = document.createElement("main");
  center.className = "chrono-center";
  center.appendChild(centerDetail(entry, { peopleById, onOpenPerson, avatar }));

  const outbound = document.createElement("aside");
  outbound.className = "chrono-rail chrono-rail--out";
  outbound.appendChild(railHeading("Watch Next"));
  outbound.appendChild(watchRail({
    items: next,
    empty: "This is a resting point — nothing follows directly.",
    onFocus,
    side: "out",
  }));

  layout.append(inbound, center, outbound);
  return layout;
}

function fitChronoRails(layout) {
  if (!layout) return;
  const stacks = [...layout.querySelectorAll(".chrono-poster-stack")];
  const count = Math.max(1, ...stacks.map((stack) => stack.children.length), Number(layout.dataset.railCount) || 1);
  const host = layout.closest(".chrono-focus-host") || layout.parentElement || layout;
  const heading = layout.querySelector(".chrono-rail-heading");
  const headingH = heading ? heading.getBoundingClientRect().height + 10 : 28;
  const hostH = host.getBoundingClientRect().height || 0;
  const size = chronologyRailPosterSize({
    count,
    availableHeight: Math.max(120, hostH - headingH),
  });
  layout.dataset.railCount = String(count);
  layout.style.setProperty("--chrono-rail-count", String(count));
  layout.style.setProperty("--chrono-md-h", `${size.height}px`);
  layout.style.setProperty("--chrono-md-w", `${size.width}px`);
  layout.style.setProperty("--chrono-rail-gap", `${size.gap}px`);
}

function centerDetail(entry, { peopleById, onOpenPerson, avatar }) {
  const wrap = document.createElement("article");
  wrap.className = "chrono-center-card";
  wrap.appendChild(railHeading("Selected Movie"));

  const hero = document.createElement("div");
  hero.className = "chrono-selected";
  hero.append(posterTile(entry, { size: "xl" }), centerTitles(entry));
  wrap.appendChild(hero);

  if (entry.note) {
    const note = document.createElement("p");
    note.className = "chrono-note";
    note.textContent = entry.note;
    wrap.appendChild(note);
  }
  if (entry.essential) {
    const badge = document.createElement("p");
    badge.className = "chrono-essential";
    badge.textContent = "Avengers: Doomsday essential";
    wrap.appendChild(badge);
  }

  const castBlock = document.createElement("div");
  castBlock.className = "chrono-characters";
  castBlock.appendChild(railHeading("Characters"));
  const cast = document.createElement("ul");
  cast.className = "chrono-cast-row";
  (entry.characters || []).forEach((id) => {
    const p = peopleById.get(id);
    if (!p) return;
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chrono-cast-avatar";
    button.title = p.name;
    button.setAttribute("aria-label", `${p.name}. Open their neighborhood.`);
    button.appendChild(avatar(p, "sm"));
    const name = document.createElement("span");
    name.className = "chrono-cast-name";
    name.textContent = p.name;
    button.appendChild(name);
    button.addEventListener("click", () => onOpenPerson(p.id));
    li.appendChild(button);
    cast.appendChild(li);
  });
  if (!cast.childElementCount) {
    castBlock.appendChild(emptyBlock("No principal cast listed."));
  } else {
    castBlock.appendChild(cast);
  }
  wrap.appendChild(castBlock);
  return wrap;
}

function centerTitles(entry) {
  const copy = document.createElement("div");
  copy.className = "chrono-center-copy";
  const h = document.createElement("h2");
  h.textContent = entry.title;
  copy.appendChild(h);
  if (entry.filterLabel && entry.filterLabel !== entry.title) {
    const sub = document.createElement("p");
    sub.className = "chrono-center-sub";
    sub.textContent = entry.filterLabel;
    copy.appendChild(sub);
  }
  if (entry.era) {
    const era = document.createElement("p");
    era.className = "chrono-era";
    era.textContent = entry.era;
    copy.appendChild(era);
  }
  return copy;
}

function watchRail({ items, empty, onFocus, side }) {
  const root = document.createElement("div");
  root.className = "chrono-rail-body";
  if (!items.length) {
    root.appendChild(emptyBlock(empty));
    return root;
  }
  const list = document.createElement("ul");
  list.className = "chrono-poster-stack";
  items.forEach((item, index) => {
    list.appendChild(posterCard(item, onFocus, side, index, items.length));
  });
  root.appendChild(list);
  return root;
}

function posterCard(entry, onFocus, side, index, total) {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = `chrono-poster-card chrono-poster-card--${side}`;
  button.setAttribute("aria-label", `Focus ${chronologyFilterLabel(entry)}`);
  const bundle = document.createElement("span");
  bundle.className = "chrono-poster-bundle";
  bundle.append(posterTile(entry, { size: "md" }), posterCaption(entry));
  const arrow = roundedArrow(side, arrowBend(index, total));
  if (side === "out") button.append(arrow, bundle);
  else button.append(bundle, arrow);
  button.addEventListener("click", () => onFocus(entry.id));
  li.appendChild(button);
  return li;
}

function arrowBend(index, total) {
  if (total <= 1) return 0;
  if (index === 0) return 1;
  if (index === total - 1) return -1;
  return 0;
}

function roundedArrow(side, bend) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", `chrono-arrow chrono-arrow--${side}${bend ? ` chrono-arrow--bend-${bend < 0 ? "up" : "down"}` : ""}`);
  svg.setAttribute("viewBox", "0 0 56 28");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const shaft = document.createElementNS("http://www.w3.org/2000/svg", "path");
  shaft.setAttribute("class", "chrono-arrow-shaft");
  const head = document.createElementNS("http://www.w3.org/2000/svg", "path");
  head.setAttribute("class", "chrono-arrow-head");
  if (bend > 0) {
    shaft.setAttribute("d", "M5 9 C 18 9, 30 16, 38 18");
    head.setAttribute("d", "M30 12 C 38 16, 44 18, 48 19 C 44 21, 36 23, 28 24");
  } else if (bend < 0) {
    shaft.setAttribute("d", "M5 19 C 18 19, 30 12, 38 10");
    head.setAttribute("d", "M30 16 C 38 12, 44 10, 48 9 C 44 7, 36 5, 28 4");
  } else {
    shaft.setAttribute("d", "M5 14 H 38");
    head.setAttribute("d", "M32 7 C 40 11, 45 13.5, 49 14 C 45 14.5, 40 17, 32 21");
  }
  svg.append(shaft, head);
  return svg;
}

function posterTile(entry, { size = "md" } = {}) {
  const tile = document.createElement("span");
  tile.className = `chrono-poster chrono-poster--${size}`;
  tile.setAttribute("aria-hidden", "true");
  const imageSize = size === "xl" ? "w500" : size === "lg" ? "w342" : "w154";
  const url = chronologyPosterUrl(entry, imageSize);

  const showAcronym = () => {
    tile.replaceChildren();
    const mark = document.createElement("span");
    mark.className = "chrono-poster-acronym";
    mark.textContent = posterAcronym(entry.title);
    tile.appendChild(mark);
  };

  if (url) {
    const img = document.createElement("img");
    img.className = "chrono-poster-img";
    img.src = url;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.addEventListener("error", showAcronym, { once: true });
    tile.appendChild(img);
  } else {
    showAcronym();
  }
  return tile;
}

function posterCaption(entry) {
  const cap = document.createElement("span");
  cap.className = "chrono-poster-caption";
  cap.textContent = chronologyFilterLabel(entry);
  return cap;
}

function spineCopy(entry, order) {
  const copy = document.createElement("span");
  copy.className = "chrono-spine-copy";
  const num = document.createElement("span");
  num.className = "chrono-spine-num";
  num.textContent = String(order);
  const name = document.createElement("span");
  name.className = "chrono-spine-title";
  name.textContent = chronologyFilterLabel(entry);
  copy.append(num, name);
  return copy;
}

function railHeading(text) {
  const h = document.createElement("h3");
  h.className = "chrono-rail-heading";
  h.textContent = text;
  return h;
}

function emptyBlock(message) {
  const p = document.createElement("p");
  p.className = "chrono-empty";
  p.textContent = message;
  return p;
}
