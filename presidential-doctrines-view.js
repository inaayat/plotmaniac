import { eraLabel, filterEvents } from "./engine.js";

function formatDate(iso) {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function presidentForEvent(event, centerId, peopleById) {
  const id = (event.people || []).find((personId) => personId !== centerId);
  return id ? peopleById.get(id) : null;
}

function portraitImg(person) {
  const src = person?.portrait?.src;
  if (!src) return null;
  const img = document.createElement("img");
  img.className = "doctrine-summary-portrait";
  img.src = src;
  img.alt = person.name || "";
  img.loading = "lazy";
  img.decoding = "async";
  if (person.portrait.page) {
    img.title = `Portrait: ${person.name}`;
  }
  return img;
}

function monogram(person) {
  const el = document.createElement("span");
  el.className = "doctrine-summary-monogram";
  const parts = String(person?.name || "?").trim().split(/\s+/);
  el.textContent = parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
  return el;
}

function renderThemePills(themes = []) {
  if (!themes.length) return null;
  const list = document.createElement("ul");
  list.className = "doctrine-summary-theme-pills";
  themes.forEach((theme) => {
    const item = document.createElement("li");
    item.textContent = theme;
    list.appendChild(item);
  });
  return list;
}

function renderLinks(links = []) {
  if (!links.length) return null;
  const nav = document.createElement("nav");
  nav.className = "doctrine-summary-links";
  nav.setAttribute("aria-label", "Sources");
  links.forEach((link) => {
    const a = document.createElement("a");
    a.href = link.url;
    a.textContent = link.label;
    a.rel = "noopener noreferrer";
    a.target = "_blank";
    nav.appendChild(a);
  });
  return nav;
}

function renderDoctrineCard(event, { centerId, peopleById }) {
  const president = presidentForEvent(event, centerId, peopleById);
  const article = document.createElement("article");
  article.className = "doctrine-summary-card";
  article.id = `doctrine-${event.id}`;

  const media = document.createElement("div");
  media.className = "doctrine-summary-card-media";
  media.append(president ? (portraitImg(president) || monogram(president)) : monogram({ name: "?" }));

  const body = document.createElement("div");
  body.className = "doctrine-summary-card-body";

  const meta = document.createElement("p");
  meta.className = "doctrine-summary-card-meta";
  meta.textContent = [formatDate(event.date), president?.name].filter(Boolean).join(" · ");

  const title = document.createElement("h3");
  title.className = "doctrine-summary-card-title";
  title.textContent = event.title;

  const summary = document.createElement("p");
  summary.className = "doctrine-summary-card-summary";
  summary.textContent = event.summary;

  body.append(meta, title, summary);
  const pills = renderThemePills(event.themes);
  if (pills) body.appendChild(pills);
  const links = renderLinks(event.links);
  if (links) body.appendChild(links);

  article.append(media, body);
  return article;
}

export function renderPresidentialDoctrinesSummary({
  plot,
  summary,
  events,
  peopleById,
  query = "",
  onQueryChange,
}) {
  const section = document.createElement("section");
  section.className = "doctrine-summary web";

  const head = document.createElement("header");
  head.className = "doctrine-summary-head";
  const title = document.createElement("h2");
  title.className = "doctrine-summary-page-title";
  title.textContent = "Doctrines at a glance";
  const lede = document.createElement("p");
  lede.className = "doctrine-summary-page-lede";
  lede.textContent = plot.lede;
  head.append(title, lede);

  const search = document.createElement("label");
  search.className = "search doctrine-summary-search";
  const searchLabel = document.createElement("span");
  searchLabel.textContent = "Search";
  const input = document.createElement("input");
  input.type = "search";
  input.value = query;
  input.placeholder = plot.searchPlaceholder || "Search doctrines…";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.addEventListener("input", () => onQueryChange?.(input.value));
  search.append(searchLabel, input);
  head.appendChild(search);
  section.appendChild(head);

  if (summary?.crossCuttingThemes?.length) {
    const themesBlock = document.createElement("section");
    themesBlock.className = "doctrine-summary-themes";
    themesBlock.setAttribute("aria-labelledby", "doctrine-themes-heading");
    const themesTitle = document.createElement("h3");
    themesTitle.id = "doctrine-themes-heading";
    themesTitle.textContent = "Themes that repeat across presidents";
    themesBlock.appendChild(themesTitle);
    const grid = document.createElement("div");
    grid.className = "doctrine-summary-themes-grid";
    summary.crossCuttingThemes.forEach((theme) => {
      const card = document.createElement("article");
      card.className = "doctrine-summary-theme-card";
      const h4 = document.createElement("h4");
      h4.textContent = theme.label;
      const p = document.createElement("p");
      p.textContent = theme.description;
      card.append(h4, p);
      grid.appendChild(card);
    });
    themesBlock.appendChild(grid);
    section.appendChild(themesBlock);
  }

  const filtered = filterEvents(events, { query }, peopleById);
  const eraLabels = summary?.eraLabels || {};
  const eras = [];
  filtered.forEach((event) => {
    if (!eras.includes(event.era)) eras.push(event.era);
  });

  const listRoot = document.createElement("div");
  listRoot.className = "doctrine-summary-list";
  eras.forEach((era) => {
    const eraSection = document.createElement("section");
    eraSection.className = "doctrine-summary-era";
    const eraHeading = document.createElement("h3");
    eraHeading.className = "doctrine-summary-era-title";
    eraHeading.textContent = eraLabels[era] || eraLabel(era);
    eraSection.appendChild(eraHeading);
    const stack = document.createElement("div");
    stack.className = "doctrine-summary-era-stack";
    filtered
      .filter((event) => event.era === era)
      .forEach((event) => {
        stack.appendChild(renderDoctrineCard(event, { centerId: plot.centerId, peopleById }));
      });
    eraSection.appendChild(stack);
    listRoot.appendChild(eraSection);
  });

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Nothing in this plot matches that search.";
    listRoot.appendChild(empty);
  }

  section.appendChild(listRoot);
  return section;
}
