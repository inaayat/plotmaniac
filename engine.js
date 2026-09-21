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
  if (state.view === "pick") {
    url.search = "";
    url.hash = "";
    return url.pathname || "/";
  }
  ["view", "person", "era", "q", "plot", "year"].forEach((key) => url.searchParams.delete(key));
  if (state.plot) url.searchParams.set("plot", state.plot);
  if (state.view === "timeline" || state.view === "person") url.searchParams.set("view", state.view);
  else url.searchParams.set("view", "web");
  if (state.person && state.person !== ALL) url.searchParams.set("person", state.person);
  if (state.era && state.era !== ALL) url.searchParams.set("era", state.era);
  if (state.query?.trim()) url.searchParams.set("q", state.query.trim());
  if (Number.isFinite(state.year)) url.searchParams.set("year", String(state.year));
  url.hash = eventId ? encodeURIComponent(eventId) : "";
  return `${url.pathname}${url.search}${url.hash}`;
}

function edgesAmong(nodes, relations) {
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
  return edges;
}

function campArrangement({ center, friends, foes, relations, width, height }) {
  const maxCount = Math.max(friends.length, foes.length, 1);
  let nodeSize = Math.floor((height - 24) / maxCount) - 12;
  nodeSize = Math.max(30, Math.min(64, nodeSize));
  const usedHeight = Math.max(height, (nodeSize + 12) * maxCount + 28);
  const centerSize = Math.round(Math.min(112, nodeSize * 1.75));
  const nameWidth = Math.min(168, Math.max(84, width * 0.2));
  let xFoe = nameWidth + 10 + nodeSize / 2;
  let xFriend = width - nameWidth - 10 - nodeSize / 2;
  let labels = "beside";
  if (xFriend - xFoe < centerSize + nodeSize + 48) {
    labels = "below";
    const inset = Math.max(nodeSize, Math.min(width * 0.28, 120));
    xFoe = inset;
    xFriend = width - inset;
  }

  const place = (list, x, side, camp) => {
    if (!list.length) return [];
    const step = usedHeight / (maxCount + 1);
    const block = step * list.length;
    const start = (usedHeight - block) / 2 + step / 2;
    return list.map((person, index) => ({
      ...person,
      x,
      y: start + step * index,
      camp,
      side: labels === "beside" ? side : "",
    }));
  };

  const nodes = [];
  if (center) nodes.push({ ...center, x: width / 2, y: usedHeight / 2, camp: "center", side: "" });
  nodes.push(...place(foes, xFoe, "left", "enemy"), ...place(friends, xFriend, "right", "friend"));
  return {
    width,
    height: usedHeight,
    nodes,
    edges: edgesAmong(nodes, relations),
    nodeSize,
    centerSize,
    labels,
  };
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

export function coversYear(relation, year) {
  const hasStart = relation.start != null && relation.start !== "";
  const hasEnd = relation.end != null && relation.end !== "";
  const dated = hasStart || hasEnd;
  if (year == null || year === "") return !dated;
  if (!dated) return true;
  const value = Number(year);
  if (!Number.isFinite(value)) return false;
  const start = hasStart ? Number(String(relation.start).slice(0, 4)) : -Infinity;
  const end = hasEnd ? Number(String(relation.end).slice(0, 4)) : Infinity;
  return value >= start && value <= end;
}

export function parseYear(value, range) {
  const min = Number(range.min);
  const max = Number(range.max);
  const fallback = range.initial == null ? max : Number(range.initial);
  const year = Number(value);
  if (!Number.isFinite(year)) return fallback;
  return Math.min(max, Math.max(min, Math.round(year)));
}

export function campOf(personId, relations, centerId, friendKinds = [], enemyKinds = [], year) {
  if (personId === centerId) return "center";
  const kinds = relations
    .filter((relation) =>
      coversYear(relation, year) &&
      ((relation.from === personId && relation.to === centerId) ||
        (relation.to === personId && relation.from === centerId)))
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
    const camp = campOf(person.id, relations, center.id, friendKinds, enemyKinds, options.year);
    if (camp === "friend") friends.push(person);
    if (camp === "enemy") foes.push(person);
  });
  friends.sort(byName);
  foes.sort(byName);
  const applicable = relations.filter((relation) => coversYear(relation, options.year));

  if (options.arrangement === "camps") {
    return campArrangement({ center, friends, foes, relations: applicable, width, height });
  }

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

  const count = Math.max(ordered.length, 1);
  let nodeSize = 72;
  let radiusX = width * 0.36;
  let radiusY = height * 0.36;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const padX = nodeSize / 2 + 12;
    const padY = nodeSize / 2 + 26;
    radiusX = Math.max(56, width / 2 - padX);
    radiusY = Math.max(56, height / 2 - padY);
    const chord = 2 * Math.min(radiusX, radiusY) * Math.sin(Math.PI / count);
    if (chord >= nodeSize * 1.2 || nodeSize <= 42) break;
    nodeSize -= 4;
  }
  const centerSize = Math.round(nodeSize * 1.42);

  const nodes = [];
  if (center) nodes.push({ ...center, x: cx, y: cy, camp: "center" });
  ordered.forEach((person, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(ordered.length, 1);
    const camp = campOf(person.id, relations, center.id, friendKinds, enemyKinds, options.year);
    nodes.push({
      ...person,
      x: cx + Math.cos(angle) * radiusX,
      y: cy + Math.sin(angle) * radiusY,
      camp,
    });
  });

  return { width, height, nodes, edges: edgesAmong(nodes, applicable), nodeSize, centerSize };
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
