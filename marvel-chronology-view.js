import {
  chronologyById,
  chronologyFilterLabel,
  chronologyPosterUrl,
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

  const focusHost = document.createElement("div");
  focusHost.className = "chrono-focus-host";
  section.appendChild(focusHost);

  const spineWrap = document.createElement("details");
  spineWrap.className = "chrono-full-order";
  const spineSummary = document.createElement("summary");
  spineSummary.textContent = "Full chronological list";
  spineWrap.appendChild(spineSummary);
  const spine = document.createElement("ol");
  spine.className = "chrono-spine";
  spine.setAttribute("aria-label", "Full chronological title list");
  spineWrap.appendChild(spine);
  section.appendChild(spineWrap);

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
    spine.querySelectorAll(".chrono-spine-item").forEach((item) => {
      const on = item.dataset.id === entry.id;
      item.classList.toggle("is-active", on);
      if (on) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    });
  };

  const setFocus = (id, { scrollSpine = true, pushState = true } = {}) => {
    const next = index.get(id);
    if (!next) return;
    activeId = id;
    swapFocusPane(focusHost, paintFocus);
    if (pushState) onFocus(id);
    if (scrollSpine) {
      const row = spine.querySelector(`[data-id="${CSS.escape(id)}"]`);
      row?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  };

  titles.forEach((entry, order) => {
    const item = document.createElement("li");
    item.className = "chrono-spine-item";
    item.dataset.id = entry.id;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chrono-spine-button";
    button.append(
      posterTile(entry, { size: "sm" }),
      spineCopy(entry, order + 1),
    );
    button.addEventListener("click", () => setFocus(entry.id));
    item.appendChild(button);
    spine.appendChild(item);
  });

  paintFocus();
  return section;
}

function buildFocusLayout({ entry, chronology, index, peopleById, onFocus, onOpenPerson, avatar }) {
  const layout = document.createElement("div");
  layout.className = "chrono-focus-layout";
  layout.style.viewTransitionName = "chrono-focus";

  const inbound = document.createElement("aside");
  inbound.className = "chrono-rail chrono-rail--in";
  inbound.appendChild(railHeading("Watch Before"));
  inbound.appendChild(watchRail({
    items: chronologyWatchBefore(entry, index),
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
    items: chronologyWatchNext(chronology, entry.id),
    empty: "This is a resting point — nothing follows directly.",
    onFocus,
    side: "out",
  }));

  layout.append(inbound, center, outbound);
  return layout;
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
  items.forEach((item) => {
    list.appendChild(posterCard(item, onFocus, side));
  });
  root.appendChild(list);
  return root;
}

function posterCard(entry, onFocus, side) {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = `chrono-poster-card chrono-poster-card--${side}`;
  button.setAttribute("aria-label", `Focus ${chronologyFilterLabel(entry)}`);
  const bundle = document.createElement("span");
  bundle.className = "chrono-poster-bundle";
  bundle.append(posterTile(entry, { size: "md" }), posterCaption(entry));
  const arrow = document.createElement("span");
  arrow.className = "chrono-arrow";
  arrow.setAttribute("aria-hidden", "true");
  if (side === "out") button.append(arrow, bundle);
  else button.append(bundle, arrow);
  button.addEventListener("click", () => onFocus(entry.id));
  li.appendChild(button);
  return li;
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
