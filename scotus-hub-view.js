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
    const label = document.createElement("span");
    label.className = "scotus-topic-label";
    label.textContent = topic.label;
    tile.appendChild(label);
    if (!live) {
      const badge = document.createElement("span");
      badge.className = "scotus-topic-badge";
      badge.textContent = "Coming soon";
      tile.appendChild(badge);
    } else {
      const badge = document.createElement("span");
      badge.className = "scotus-topic-badge is-live-badge";
      badge.textContent = "Open board";
      tile.appendChild(badge);
      tile.addEventListener("click", () => onSelectTopic(topic.id));
    }
    grid.appendChild(tile);
  });
  section.appendChild(grid);
  return section;
}
