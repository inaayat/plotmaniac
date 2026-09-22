export const SCOTUS_GUN_TOPIC_ID = "gun-rights";

export const GUN_REGULATION_PLOT_ALIASES = new Set([
  "gun-regulation",
  "guns",
  "second-amendment",
]);

export function scotusTopicFromPlotAlias(plotParam) {
  if (GUN_REGULATION_PLOT_ALIASES.has(plotParam)) return SCOTUS_GUN_TOPIC_ID;
  return "";
}

const SVG_NS = "http://www.w3.org/2000/svg";

const TOPIC_ICONS = {
  "abortion-reproductive-rights": `<circle cx="12" cy="12" r="7"/><path d="M12 9v6M9 12h6"/>`,
  "antitrust": `<path d="M5 8h6M5 16h6M13 6l6 6M19 6l-6 6"/>`,
  "climate-environment": `<path d="M6 18c4-1 6-5 5-9 4 2 6 6 5 10-3 1-7 1-10-1z"/><path d="M11 14c1-2 2-4 4-6"/>`,
  "copyrights": `<circle cx="12" cy="12" r="7"/><path d="M14 9.5a3 3 0 0 0-4 2.2 3 3 0 0 0 4 2.8"/>`,
  "criminal-trials": `<path d="M4 19h16M8 19V9M16 19V9M6 9h12L12 4z"/>`,
  "death-penalty": `<path d="M12 3v2M6 7h12M12 7v4M8 15h8l-1 4H9z"/>`,
  "due-process": `<path d="M7 4h8l4 4v12H7z"/><path d="M15 4v4h4M9 12h6M9 16h4"/>`,
  "equal-protection": `<path d="M5 7h14M5 12h14M5 17h14"/>`,
  "free-speech": `<path d="M6 16v-2a6 6 0 1 1 12 0v2"/><path d="M6 16h3v3H6zM15 16h3v3h-3z"/>`,
  "government-agencies": `<path d="M4 20h16M6 20V10M18 20V10M4 10h16L12 4z"/>`,
  "gun-rights": `<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>`,
  "health-care": `<path d="M12 5v14M5 12h14"/>`,
  "immigration-security": `<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2 2.4 3 5 3 8s-1 5.6-3 8c-2-2.4-3-5-3-8s1-5.6 3-8"/>`,
  "labor-employment": `<path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M4 8h16v10H4zM4 13h16"/>`,
  "lawsuits-procedures": `<path d="M7 4h7l4 4v12H7z"/><path d="M14 4v4h4"/>`,
  "lgbtq-rights": `<path d="M8 13c-2-2-2-5 0-6s4 0 4 2 2-2 4-2 2 4 0 6l-4 4z"/>`,
  "miranda-rights": `<path d="M8 7c-2 1-3 3-2 5M16 7c2 1 3 3 2 5"/><path d="M9 17h6"/>`,
  "patents": `<path d="M9 18h6M10 18v-3a5 5 0 1 1 4 0v3"/><path d="M12 8v2"/>`,
  "powers-of-congress": `<path d="M5 19h14M7 19V9M12 19V9M17 19V9M4 9h16L12 4z"/>`,
  "property-land-use": `<path d="M4 11l8-7 8 7"/><path d="M7 10v9h10v-9"/>`,
  "religion": `<path d="M12 4v16M8 8h8"/><path d="M7 20h10"/>`,
  "role-of-courts": `<path d="M4 19h16M12 4v15M7 8h10M8 8l-2 7h4l-2-7M16 8l-2 7h4l-2-7"/>`,
  "search-seizure": `<circle cx="11" cy="11" r="5"/><path d="M15 15l4 4"/>`,
  "separation-of-powers": `<path d="M5 20V8M12 20V4M19 20V8"/><path d="M3 8h4M10 4h4M17 8h4"/>`,
  "taxes": `<path d="M7 17L17 7"/><circle cx="8" cy="8" r="1.4"/><circle cx="16" cy="16" r="1.4"/>`,
  "trademarks": `<path d="M8 7h8l2 3v9H6V10z"/><path d="M9 13h6"/>`,
  "voting-elections": `<path d="M5 6h14v12H5z"/><path d="M8 12l2 2 4-5"/>`,
  "topics": `<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>`,
};

export function scotusTopicIcon(topicId) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "scotus-topic-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = TOPIC_ICONS[topicId] || `<circle cx="12" cy="12" r="7"/>`;
  svg.querySelectorAll("*").forEach((node) => {
    node.setAttribute("fill", "none");
    node.setAttribute("stroke", "currentColor");
    node.setAttribute("stroke-width", "1.6");
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round");
  });
  return svg;
}

export function renderScotusTopicHub({ plot, topics, activeTopicId, onSelectTopic }) {
  const section = document.createElement("section");
  section.className = "scotus-hub";
  const head = document.createElement("header");
  head.className = "scotus-hub-head";
  const title = document.createElement("h2");
  title.textContent = "Landmark Supreme Court topics";
  const lede = document.createElement("p");
  lede.className = "scotus-hub-lede";
  lede.textContent = "Topic areas follow Justia’s landmark-case hub. Only Gun Rights / Gun Control is live in V1; other tiles preview what’s coming.";
  head.append(title, lede);
  section.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "scotus-topic-grid";
  grid.setAttribute("role", "list");
  topics.forEach((topic) => {
    const live = topic.status === "live";
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "scotus-topic-tile";
    tile.dataset.topic = topic.id;
    tile.setAttribute("role", "listitem");
    tile.classList.toggle("is-live", live);
    tile.classList.toggle("is-soon", !live);
    tile.classList.toggle("is-active", activeTopicId === topic.id);
    if (!live) {
      tile.disabled = true;
      tile.setAttribute("aria-disabled", "true");
    }
    const copy = document.createElement("span");
    copy.className = "scotus-topic-copy";
    const label = document.createElement("span");
    label.className = "scotus-topic-label";
    label.textContent = topic.label;
    copy.appendChild(label);
    if (!live) {
      const badge = document.createElement("span");
      badge.className = "scotus-topic-badge";
      badge.textContent = "Coming soon";
      copy.appendChild(badge);
    } else {
      const badge = document.createElement("span");
      badge.className = "scotus-topic-badge is-live-badge";
      badge.textContent = "Open board";
      copy.appendChild(badge);
      tile.addEventListener("click", () => onSelectTopic(topic.id));
    }
    tile.append(scotusTopicIcon(topic.id), copy);
    grid.appendChild(tile);
  });
  section.appendChild(grid);
  return section;
}
