import {
  chronologyById,
  chronologyFeedsInto,
  chronologyFilterLabel,
  chronologyPrereqsGrouped,
} from "./engine.js";

const TIER_LABEL = {
  must: "Must watch",
  should: "Should watch",
  could: "Could watch",
  unreleased: "Unreleased / predicted",
};

function posterAcronym(title) {
  const words = String(title || "").replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase();
}

function swapFocusPane(root, render) {
  const pane = root.querySelector(".chrono-focus-layout");
  if (!pane || !document.startViewTransition) {
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

  const head = document.createElement("div");
  head.className = "chrono-head";
  const copy = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "MCU + Mutant Legacy";
  const title = document.createElement("h2");
  title.textContent = "Watch order";
  const lede = document.createElement("p");
  lede.className = "chrono-lede";
  lede.textContent = "Scroll the full list or search a title. Study up on prerequisites before you press play.";
  copy.append(eyebrow, title, lede);

  const legend = document.createElement("ul");
  legend.className = "chrono-legend";
  legend.setAttribute("aria-label", "Prerequisite tiers");
  ["must", "should", "could", "unreleased"].forEach((tier) => {
    const item = document.createElement("li");
    item.className = `chrono-legend-item tier-${tier}`;
    item.textContent = TIER_LABEL[tier];
    legend.appendChild(item);
  });
  head.append(copy, legend);
  section.appendChild(head);

  const focusHost = document.createElement("div");
  focusHost.className = "chrono-focus-host";
  section.appendChild(focusHost);

  const spine = document.createElement("ol");
  spine.className = "chrono-spine";
  spine.setAttribute("aria-label", "Full chronological title list");
  section.appendChild(spine);

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
      item.classList.toggle("is-active", item.dataset.id === entry.id);
    });
  };

  const setFocus = (id, { scrollSpine = true, pushState = true } = {}) => {
    const next = index.get(id);
    if (!next) return;
    activeId = id;
    swapFocusPane(focusHost, paintFocus);
    if (pushState) onFocus(id);
    if (scrollSpine) {
      const row = spine.querySelector(`[data-id="${id}"]`);
      row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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

  const observer = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    const top = visible[0]?.target?.dataset?.id;
    if (!top || top === activeId) return;
    setFocus(top, { scrollSpine: false, pushState: false });
  }, { root: null, rootMargin: "-40% 0px -45% 0px", threshold: [0, 0.25, 0.5] });

  spine.querySelectorAll(".chrono-spine-item").forEach((item) => observer.observe(item));

  return section;
}

function buildFocusLayout({ entry, chronology, index, peopleById, onFocus, onOpenPerson, avatar }) {
  const layout = document.createElement("div");
  layout.className = "chrono-focus-layout";
  layout.style.viewTransitionName = "chrono-focus";

  const inbound = document.createElement("aside");
  inbound.className = "chrono-rail chrono-rail--in";
  inbound.appendChild(railHeading("Study up first"));
  inbound.appendChild(prereqRail(entry, index, onFocus));

  const center = document.createElement("main");
  center.className = "chrono-center";
  center.appendChild(centerDetail(entry, { peopleById, onOpenPerson, avatar }));

  const outbound = document.createElement("aside");
  outbound.className = "chrono-rail chrono-rail--out";
  outbound.appendChild(railHeading("Feeds into"));
  outbound.appendChild(feedsRail(entry, chronology, onFocus));

  layout.append(inbound, center, outbound);
  return layout;
}

function centerDetail(entry, { peopleById, onOpenPerson, avatar }) {
  const wrap = document.createElement("article");
  wrap.className = "chrono-center-card";
  const hero = document.createElement("div");
  hero.className = "chrono-center-hero";
  hero.append(posterTile(entry, { size: "lg" }), centerTitles(entry));
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
  const castHead = document.createElement("h3");
  castHead.textContent = "Cast in this title";
  const cast = document.createElement("ul");
  cast.className = "chip-list chrono-cast";
  (entry.characters || []).forEach((id) => {
    const p = peopleById.get(id);
    if (!p) return;
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "web-person";
    const name = document.createElement("span");
    name.className = "chip-name";
    name.textContent = p.name;
    button.append(avatar(p, "sm"), name);
    button.addEventListener("click", () => onOpenPerson(p.id));
    li.appendChild(button);
    cast.appendChild(li);
  });
  wrap.append(castHead, cast);
  return wrap;
}

function centerTitles(entry) {
  const copy = document.createElement("div");
  copy.className = "chrono-center-copy";
  const h = document.createElement("h3");
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

function prereqRail(entry, index, onFocus) {
  const root = document.createElement("div");
  root.className = "chrono-rail-body";
  const groups = chronologyPrereqsGrouped(entry, index);
  if (!groups.length) {
    root.appendChild(emptyBlock("No chart prerequisites listed — you can start here or follow the full order above."));
    return root;
  }
  groups.forEach((group) => {
    const block = document.createElement("section");
    block.className = `chrono-tier-block tier-${group.tier}`;
    const label = document.createElement("h4");
    label.textContent = TIER_LABEL[group.tier];
    block.appendChild(label);
    const list = document.createElement("ul");
    list.className = "chrono-poster-list";
    group.items.forEach((item) => {
      list.appendChild(posterButton(item, group.tier, onFocus));
    });
    block.appendChild(list);
    root.appendChild(block);
  });
  return root;
}

function feedsRail(entry, chronology, onFocus) {
  const root = document.createElement("div");
  root.className = "chrono-rail-body";
  const feeds = chronologyFeedsInto(chronology, entry.id);
  if (!feeds.length) {
    root.appendChild(emptyBlock("Nothing downstream depends on this title directly in our chart subset."));
    return root;
  }
  const list = document.createElement("ul");
  list.className = "chrono-poster-list";
  feeds.forEach((item) => {
    list.appendChild(posterButton(item, "outbound", onFocus));
  });
  root.appendChild(list);
  return root;
}

function posterButton(entry, tier, onFocus) {
  const li = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.className = `chrono-poster-button tier-${tier}`;
  button.append(posterTile(entry, { size: "md" }), posterCaption(entry));
  button.addEventListener("click", () => onFocus(entry.id));
  li.appendChild(button);
  return li;
}

function posterTile(entry, { size = "md" } = {}) {
  const tile = document.createElement("span");
  tile.className = `chrono-poster chrono-poster--${size}`;
  tile.setAttribute("aria-hidden", "true");
  const mark = document.createElement("span");
  mark.className = "chrono-poster-acronym";
  mark.textContent = posterAcronym(entry.title);
  tile.appendChild(mark);
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
