import { chronologyById, chronologyPosterUrl } from "./engine.js";

const TONE_LABEL = {
  ally: "Ally",
  romance: "Romance",
  family: "Family",
  mentor: "Mentor",
  protege: "Protégé",
  team: "Team",
  enemy: "Enemy",
  rival: "Rival",
  strained: "Strained",
  broken: "Broken",
  reconciled: "Reconciled",
  lost: "Lost",
  legacy: "Legacy",
};

const CHANGE_LABEL = {
  new: "Begins",
  deepened: "Deepens",
  strained: "Frays",
  broken: "Breaks",
  reconciled: "Mends",
  ended: "Ends",
  inherited: "Passed on",
  unchanged: "Holds",
};

export function renderTonyStarkSaga({
  saga,
  chronology,
  peopleById,
  avatar,
  onOpenPerson,
  onOpenTitle,
}) {
  const section = document.createElement("section");
  section.className = "stark-saga";
  section.setAttribute("aria-label", "Tony Stark Iron Man saga");

  if (!saga?.chapters?.length) {
    const empty = document.createElement("p");
    empty.className = "stark-empty";
    empty.textContent = "The Iron Man saga could not load.";
    section.appendChild(empty);
    return section;
  }

  const extras = new Map((saga.extras || []).map((person) => [person.id, person]));
  const titles = chronologyById(chronology);
  const knownIds = peopleById instanceof Map ? peopleById : new Map();
  const lookup = (id) => knownIds.get(id) || extras.get(id) || { id, name: id };
  const filmChapters = saga.chapters.filter((chapter) => chapter.kind !== "preamble");

  section.append(
    buildHero(saga, lookup, avatar, onOpenPerson),
    buildFilmstrip(filmChapters, titles, onOpenTitle),
    buildThreads(saga, filmChapters, lookup, avatar, onOpenPerson, knownIds),
    buildChapters({
      chapters: saga.chapters,
      titles,
      lookup,
      avatar,
      onOpenPerson,
      onOpenTitle,
      knownIds,
    }),
  );
  return section;
}

function buildHero(saga, lookup, avatar, onOpenPerson) {
  const hero = document.createElement("header");
  hero.className = "stark-hero";

  const reactor = document.createElement("div");
  reactor.className = "stark-reactor";
  const face = document.createElement("button");
  face.type = "button";
  face.className = "stark-hero-face";
  face.appendChild(avatar(lookup(saga.subjectId), "lg"));
  face.setAttribute("aria-label", `${lookup(saga.subjectId).name}. Open their timeline.`);
  face.addEventListener("click", () => onOpenPerson?.(saga.subjectId));
  reactor.appendChild(face);

  const copy = document.createElement("div");
  copy.className = "stark-hero-copy";
  const kicker = document.createElement("p");
  kicker.className = "stark-kicker";
  kicker.textContent = saga.kicker || "Iron Man";
  const title = document.createElement("h2");
  title.className = "stark-hero-title";
  title.textContent = saga.title;
  const lede = document.createElement("p");
  lede.className = "stark-lede";
  lede.textContent = saga.lede;
  if (saga.quote) {
    const quote = document.createElement("p");
    quote.className = "stark-quote";
    quote.textContent = `“${saga.quote}”`;
    copy.append(kicker, title, quote, lede);
  } else {
    copy.append(kicker, title, lede);
  }
  if (saga.source?.url) {
    const source = document.createElement("a");
    source.className = "stark-source";
    source.href = saga.source.url;
    source.target = "_blank";
    source.rel = "noreferrer";
    source.textContent = saga.source.label || saga.source.url;
    copy.appendChild(source);
  }

  hero.append(reactor, copy);
  return hero;
}

function buildFilmstrip(chapters, titles, onOpenTitle) {
  const nav = document.createElement("nav");
  nav.className = "stark-filmstrip";
  nav.setAttribute("aria-label", "Jump to a film");
  const list = document.createElement("ol");
  list.className = "stark-filmstrip-list";
  chapters.forEach((chapter, index) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.className = "stark-filmstrip-card";
    link.href = `#stark-${chapter.id}`;
    const poster = posterNode(chapter, titles.get(chapter.chronologyId), "strip");
    const meta = document.createElement("span");
    meta.className = "stark-filmstrip-meta";
    const num = document.createElement("span");
    num.textContent = String(index + 1).padStart(2, "0");
    const name = document.createElement("span");
    name.textContent = shortTitle(chapter.title);
    meta.append(num, name);
    link.append(poster, meta);
    item.appendChild(link);
    list.appendChild(item);
  });
  nav.appendChild(list);
  return nav;
}

function buildThreads(saga, filmChapters, lookup, avatar, onOpenPerson, knownIds) {
  const threads = saga.threads || [];
  if (!threads.length) return document.createComment("no threads");

  const wrap = document.createElement("section");
  wrap.className = "stark-threads";
  const heading = document.createElement("h3");
  heading.textContent = "How the bonds move";
  const hint = document.createElement("p");
  hint.className = "stark-hint";
  hint.textContent = "Each row is a person Tony keeps meeting. The color is the state of that bond in that film.";
  const scroller = document.createElement("div");
  scroller.className = "stark-thread-scroll";
  const table = document.createElement("table");
  table.className = "stark-thread-table";
  table.setAttribute("aria-label", "Tony Stark relationships by film");

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.scope = "col";
  corner.textContent = "Person";
  headRow.appendChild(corner);
  filmChapters.forEach((chapter) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = shortTitle(chapter.title);
    th.title = `${chapter.year} · ${chapter.title}`;
    headRow.appendChild(th);
  });
  head.appendChild(headRow);

  const body = document.createElement("tbody");
  threads.forEach((thread) => {
    const person = lookup(thread.personId || thread.id);
    const row = document.createElement("tr");
    const nameCell = document.createElement("th");
    nameCell.scope = "row";
    const who = document.createElement("button");
    who.type = "button";
    who.className = "stark-thread-who";
    who.append(avatar(person, "sm"), nameEl(thread.name || person.name));
    if (thread.personId && knownIds.has(thread.personId) && onOpenPerson) {
      who.addEventListener("click", () => onOpenPerson(thread.personId));
    } else {
      who.disabled = true;
    }
    nameCell.appendChild(who);
    row.appendChild(nameCell);

    filmChapters.forEach((chapter) => {
      const rel = (chapter.relationships || []).find((item) => item.personId === thread.personId || item.personId === thread.id);
      const td = document.createElement("td");
      if (rel) {
        const cell = document.createElement("span");
        cell.className = `stark-pip tone-${rel.tone || "ally"}`;
        cell.title = `${chapter.title}: ${rel.bond}. ${CHANGE_LABEL[rel.change] || rel.change || ""}.`;
        cell.textContent = TONE_LABEL[rel.tone] || rel.tone || "·";
        td.appendChild(cell);
      } else {
        td.className = "is-empty";
        td.textContent = "—";
      }
      row.appendChild(td);
    });
    body.appendChild(row);
  });

  table.append(head, body);
  scroller.appendChild(table);

  const legend = document.createElement("ul");
  legend.className = "stark-legend";
  ["ally", "romance", "family", "mentor", "team", "strained", "broken", "enemy", "lost", "legacy"].forEach((tone) => {
    const item = document.createElement("li");
    const pip = document.createElement("span");
    pip.className = `stark-pip tone-${tone}`;
    pip.textContent = TONE_LABEL[tone];
    item.appendChild(pip);
    legend.appendChild(item);
  });

  wrap.append(heading, hint, scroller, legend);
  return wrap;
}

function buildChapters({ chapters, titles, lookup, avatar, onOpenPerson, onOpenTitle, knownIds }) {
  const list = document.createElement("ol");
  list.className = "stark-chapters";
  chapters.forEach((chapter, index) => {
    list.appendChild(buildChapter({
      chapter,
      index,
      titles,
      lookup,
      avatar,
      onOpenPerson,
      onOpenTitle,
      knownIds,
    }));
  });
  return list;
}

function buildChapter({ chapter, index, titles, lookup, avatar, onOpenPerson, onOpenTitle, knownIds }) {
  const item = document.createElement("li");
  item.className = `stark-chapter kind-${chapter.kind || "lead"}`;
  item.id = `stark-${chapter.id}`;

  const rail = document.createElement("div");
  rail.className = "stark-chapter-rail";
  const num = document.createElement("span");
  num.className = "stark-chapter-num";
  num.textContent = String(index).padStart(2, "0");
  rail.appendChild(num);

  const card = document.createElement("article");
  card.className = "stark-chapter-card";

  const head = document.createElement("header");
  head.className = "stark-chapter-head";
  const titlesBlock = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "stark-chapter-eyebrow";
  eyebrow.textContent = chapterEyebrow(chapter);
  if (chapter.kind !== "preamble") {
    const poster = posterNode(chapter, titles.get(chapter.chronologyId), "chapter");
    if (chapter.chronologyId && onOpenTitle) {
      poster.classList.add("is-link");
      poster.addEventListener("click", () => onOpenTitle(chapter.chronologyId));
      poster.setAttribute("aria-label", `Open ${chapter.title} in Watch Order`);
    }
    head.appendChild(poster);
  }
  const heading = document.createElement("h3");
  heading.textContent = chapter.title;
  const state = document.createElement("p");
  state.className = "stark-tony-state";
  state.textContent = chapter.tonyState;
  titlesBlock.append(eyebrow, heading, state);
  if (chapter.quote) {
    const quote = document.createElement("p");
    quote.className = "stark-chapter-quote";
    quote.textContent = `“${chapter.quote}”`;
    titlesBlock.appendChild(quote);
  }
  head.appendChild(titlesBlock);

  const saga = document.createElement("p");
  saga.className = "stark-chapter-saga";
  saga.textContent = chapter.saga;

  const relHead = document.createElement("h4");
  relHead.textContent = "Who he is bound to, and how that changes";
  const rels = document.createElement("ul");
  rels.className = "stark-rels";
  (chapter.relationships || []).forEach((rel) => {
    rels.appendChild(relationCard(rel, lookup, avatar, onOpenPerson, knownIds));
  });

  card.append(head, saga, relHead, rels);
  item.append(rail, card);
  return item;
}

function relationCard(rel, lookup, avatar, onOpenPerson, knownIds) {
  const person = lookup(rel.personId);
  const item = document.createElement("li");
  item.className = `stark-rel tone-${rel.tone || "ally"}`;

  const top = document.createElement("div");
  top.className = "stark-rel-top";
  const face = document.createElement("button");
  face.type = "button";
  face.className = "stark-rel-face";
  face.appendChild(avatar(person, "sm"));
  const known = Boolean(rel.personId && knownIds.has(rel.personId) && onOpenPerson);
  if (known) {
    face.setAttribute("aria-label", `${person.name}. Open their timeline.`);
    face.addEventListener("click", () => onOpenPerson(rel.personId));
  } else {
    face.disabled = true;
    face.setAttribute("aria-hidden", "true");
  }
  const names = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = rel.name || person.name;
  const bond = document.createElement("span");
  bond.className = "stark-rel-bond";
  bond.textContent = rel.bond;
  names.append(name, bond);
  top.append(face, names);

  const chips = document.createElement("p");
  chips.className = "stark-rel-chips";
  chips.append(
    chip(TONE_LABEL[rel.tone] || rel.tone, `tone-${rel.tone || "ally"}`),
    chip(CHANGE_LABEL[rel.change] || rel.change, `change-${rel.change || "new"}`),
  );

  const note = document.createElement("p");
  note.className = "stark-rel-note";
  note.textContent = rel.note;
  item.append(top, chips, note);
  return item;
}

function posterNode(chapter, entry, size) {
  const figure = document.createElement(size === "chapter" ? "button" : "span");
  if (size === "chapter") figure.type = "button";
  figure.className = `stark-poster stark-poster--${size}`;
  const url = chronologyPosterUrl(entry) || chapter.posterUrl || "";
  if (url) {
    const image = document.createElement("img");
    image.src = url;
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    figure.appendChild(image);
    return figure;
  }
  const fallback = document.createElement("span");
  fallback.className = "stark-poster-fallback";
  fallback.textContent = posterAcronym(chapter.title);
  figure.appendChild(fallback);
  return figure;
}

function posterAcronym(title) {
  const words = String(title || "").replace(/[^\w\s]/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
}

function chapterEyebrow(chapter) {
  const parts = [];
  if (chapter.storyYear) parts.push(chapter.storyYear);
  else if (chapter.year) parts.push(String(chapter.year));
  if (chapter.role && chapter.kind !== "preamble") parts.push(chapter.role);
  if (chapter.phase) parts.push(chapter.phase);
  return parts.join(" · ");
}

function shortTitle(title) {
  return String(title || "")
    .replace("Avengers: ", "")
    .replace("Captain America: ", "")
    .replace("Spider-Man: ", "")
    .replace("The Incredible ", "")
    .replace("The ", "");
}

function nameEl(name) {
  const el = document.createElement("span");
  el.className = "stark-name";
  el.textContent = name;
  return el;
}

function chip(text, className) {
  const el = document.createElement("span");
  el.className = `stark-chip ${className}`;
  el.textContent = text;
  return el;
}
