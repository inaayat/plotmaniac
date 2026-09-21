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

export function webLayout(people, relations, options = {}) {
  const centerId = options.centerId || "ethan-klein";
  const friendKinds = options.friendKinds || ["ally", "crew", "co-host", "collaborator", "family"];
  const enemyKinds = options.enemyKinds || ["feud", "litigation"];
  const width = options.width || 1100;
  const height = options.height || 940;
  const cx = 440;
  const cy = 360;
  const center = people.find((person) => person.id === centerId) || people[0];
  const groups = { friend: [], enemy: [], orbit: [] };
  people.forEach((person) => {
    if (!center || person.id === center.id) return;
    const camp = campOf(person.id, relations, center.id, friendKinds, enemyKinds);
    groups[camp].push(person);
  });
  Object.values(groups).forEach((group) => group.sort(byName));

  const nodes = [];
  if (center) nodes.push({ ...center, x: cx, y: cy, camp: "center" });

  const friendGap = groups.friend.length <= 1 ? 0 : Math.min(170, 480 / (groups.friend.length - 1));
  groups.friend.forEach((person, index) => {
    nodes.push({ ...person, x: 168, y: 190 + index * friendGap, camp: "friend" });
  });

  const rows = Math.min(5, Math.max(groups.enemy.length, 1));
  const enemyGap = rows <= 1 ? 0 : Math.min(128, 520 / (rows - 1));
  groups.enemy.forEach((person, index) => {
    const column = Math.floor(index / rows);
    const row = index % rows;
    nodes.push({
      ...person,
      x: 760 + column * 175,
      y: 130 + row * enemyGap,
      camp: "enemy",
    });
  });

  groups.orbit.forEach((person, index) => {
    const span = groups.orbit.length <= 1 ? 0 : (width - 160) / (groups.orbit.length - 1);
    nodes.push({ ...person, x: 80 + index * span, y: 830, camp: "orbit" });
  });

  return {
    width,
    height,
    nodes,
    labels: [
      { id: "friend", text: "Friends", x: 168, y: 78 },
      { id: "enemy", text: "Enemies", x: 847, y: 64 },
      { id: "orbit", text: "Around the show", x: width / 2, y: 760 },
    ],
  };
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
