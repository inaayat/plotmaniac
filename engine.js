export const ALL = "all";

export function eventSearchText(event, peopleById = new Map()) {
  const people = (event.people || []).map((id) => peopleById.get(id)?.name || id);
  return [event.title, event.tease, event.summary, event.era, ...people]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

export function filterEvents(events, filters = {}, peopleById = new Map()) {
  const query = (filters.query || "").trim().toLocaleLowerCase();
  return events.filter((event) => {
    if (filters.person && filters.person !== ALL && !event.people.includes(filters.person)) return false;
    if (filters.era && filters.era !== ALL && event.era !== filters.era) return false;
    return !query || eventSearchText(event, peopleById).includes(query);
  });
}

export function eventTease(event, limit = 132) {
  if (event.tease) return event.tease;
  const summary = String(event.summary || "").trim();
  if (summary.length <= limit) return summary;
  const short = summary.slice(0, limit + 1);
  const boundary = Math.max(short.lastIndexOf(". "), short.lastIndexOf(" "));
  return `${short.slice(0, boundary > 60 ? boundary : limit).trim()}…`;
}

export function eraLabel(id) {
  return String(id || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function relationEvents(relation, events) {
  return events.filter((event) =>
    event.people.includes(relation.from) && event.people.includes(relation.to));
}

export function parseState(urlLike, valid = {}) {
  const url = new URL(urlLike, "https://plotmaniac.com/");
  let eventId = "";
  try {
    eventId = decodeURIComponent(url.hash.slice(1));
  } catch {
    eventId = "";
  }
  const person = valid.people?.has(url.searchParams.get("person"))
    ? url.searchParams.get("person")
    : ALL;
  const era = valid.eras?.has(url.searchParams.get("era"))
    ? url.searchParams.get("era")
    : ALL;
  const requested = url.searchParams.get("view");
  let view = requested === "timeline" || requested === "person" ? requested : "web";
  if (view === "person" && person === ALL) view = "web";
  return {
    view,
    person,
    era,
    query: url.searchParams.get("q") || "",
    eventId,
  };
}

export function stateUrl(currentUrl, state, eventId = "") {
  const url = new URL(currentUrl, "https://plotmaniac.com/");
  ["view", "person", "era", "q", "plot"].forEach((key) => url.searchParams.delete(key));
  if (state.plot) url.searchParams.set("plot", state.plot);
  if (state.view === "timeline" || state.view === "person") url.searchParams.set("view", state.view);
  else url.searchParams.set("view", "web");
  if (state.person && state.person !== ALL) url.searchParams.set("person", state.person);
  if (state.era && state.era !== ALL) url.searchParams.set("era", state.era);
  if (state.query?.trim()) url.searchParams.set("q", state.query.trim());
  url.hash = eventId ? encodeURIComponent(eventId) : "";
  return `${url.pathname}${url.search}${url.hash}`;
}

export function graphLayout(people, width = 900, height = 560) {
  const center = people.find((person) => person.id === "ethan-klein") || people[0];
  const others = people.filter((person) => person !== center);
  const radiusX = Math.max(120, width * 0.37);
  const radiusY = Math.max(120, height * 0.37);
  const nodes = [];
  if (center) nodes.push({ ...center, x: width / 2, y: height / 2, central: true });
  others.forEach((person, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(others.length, 1);
    nodes.push({
      ...person,
      x: width / 2 + Math.cos(angle) * radiusX,
      y: height / 2 + Math.sin(angle) * radiusY,
      central: false,
    });
  });
  return nodes;
}

export function initials(name) {
  const parts = String(name || "").replace(/[()]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name || "").replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";
}

export function campOf(personId, relations, centerId, friendKinds = [], enemyKinds = []) {
  if (personId === centerId) return "center";
  const kinds = relations
    .filter((relation) =>
      (relation.from === personId && relation.to === centerId) ||
      (relation.to === personId && relation.from === centerId))
    .map((relation) => relation.kind);
  if (kinds.some((kind) => enemyKinds.includes(kind))) return "enemy";
  if (kinds.some((kind) => friendKinds.includes(kind))) return "friend";
  return "orbit";
}

export function tiesWith(personId, relations, centerId) {
  return relations.filter((relation) =>
    (relation.from === personId && relation.to === centerId) ||
    (relation.to === personId && relation.from === centerId));
}

const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

export function neighborhood(personId, relations) {
  const ids = new Set([personId]);
  relations.forEach((relation) => {
    if (relation.from === personId) ids.add(relation.to);
    if (relation.to === personId) ids.add(relation.from);
  });
  return ids;
}

export function webLayout(people, relations, options = {}) {
  const centerId = options.centerId || "ethan-klein";
  const friendKinds = options.friendKinds || ["ally", "crew", "co-host", "collaborator", "family"];
  const enemyKinds = options.enemyKinds || ["feud", "litigation"];
  const width = options.width || 1100;
  const height = options.height || 980;
  const cx = width / 2;
  const cy = height / 2;
  const center = people.find((person) => person.id === centerId) || people[0];
  const friends = [];
  const foes = [];
  people.forEach((person) => {
    if (!center || person.id === center.id) return;
    const camp = campOf(person.id, relations, center.id, friendKinds, enemyKinds);
    if (camp === "friend") friends.push(person);
    if (camp === "enemy") foes.push(person);
  });
  friends.sort(byName);
  foes.sort(byName);

  const ordered = [];
  const gap = Math.max(1, Math.round(foes.length / Math.max(friends.length, 1)));
  let foeIndex = 0;
  friends.forEach((person) => {
    ordered.push(person);
    for (let step = 0; step < gap && foeIndex < foes.length; step += 1) {
      ordered.push(foes[foeIndex]);
      foeIndex += 1;
    }
  });
  while (foeIndex < foes.length) {
    ordered.push(foes[foeIndex]);
    foeIndex += 1;
  }

  const nodes = [];
  if (center) nodes.push({ ...center, x: cx, y: cy, camp: "center" });
  const radiusX = Math.min(width, height) * 0.36;
  const radiusY = radiusX * 0.9;
  ordered.forEach((person, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(ordered.length, 1);
    const camp = campOf(person.id, relations, center.id, friendKinds, enemyKinds);
    nodes.push({
      ...person,
      x: cx + Math.cos(angle) * radiusX,
      y: cy + Math.sin(angle) * radiusY,
      camp,
    });
  });

  const visible = new Set(nodes.map((node) => node.id));
  const seen = new Set();
  const edges = [];
  relations.forEach((relation) => {
    if (!visible.has(relation.from) || !visible.has(relation.to)) return;
    const key = [relation.from, relation.to].sort().join("|");
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from: relation.from, to: relation.to });
  });

  return { width, height, nodes, edges };
}

export function youtubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1).split("/")[0] || null;
    if (parsed.hostname.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const match = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
      return match?.[1] || null;
    }
  } catch {
    return null;
  }
  return null;
}
