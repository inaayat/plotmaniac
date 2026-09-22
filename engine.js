export const ALL = "all";
export const COMPACT_MAX_WIDTH = 768;

export function requestedView(urlLike) {
  try {
    const url = new URL(urlLike, "https://plotmaniac.com/");
    const value = url.searchParams.get("view");
    if (value === "timeline" || value === "web" || value === "person") return value;
  } catch {
    return "";
  }
  return "";
}

export function defaultPlotView({ requested = "", eventId = "" } = {}) {
  if (requested === "timeline" || requested === "web" || requested === "person") return requested;
  if (eventId) return "timeline";
  return "web";
}

export function resolvePlotView(parsed, { href = "" } = {}) {
  const requested = requestedView(href);
  if (requested) return parsed.view;
  return defaultPlotView({
    eventId: parsed?.eventId || "",
  });
}

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

// Body copy for an opened beat. The closed card already shows the title and a
// preview of this text, so an opened card omits a summary that only repeats them.
export function expandedSummary(event) {
  const summary = String(event?.summary || "").trim();
  const title = String(event?.title || "").trim();
  if (!summary || summary === title) return "";
  return summary;
}

export function eraLabel(id) {
  return String(id || "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const RELATION_REGIONS = [
  "Americas",
  "Europe",
  "North Africa",
  "Middle East",
  "Sub-Saharan Africa",
  "Central Asia",
  "South Asia",
  "East Asia",
  "Southeast Asia",
  "Oceania",
];

const STATUS_RANK = { friend: 0, foe: 1, neutral: 2 };

export function outlineFor(country) {
  if (country?.outline === "green" || country?.outline === "red" || country?.outline === "none") {
    return country.outline;
  }
  if (country?.status === "friend") return "green";
  if (country?.status === "foe") return "red";
  return "none";
}

export function firstLoadCountries(countries) {
  return (countries || []).filter((country) => country.first_load);
}

export function visibleRelationCountries(countries, openRegions = []) {
  const selectedRegion = (openRegions || [])[0] || "";
  return (countries || []).filter((country) =>
    country && (selectedRegion ? country.region === selectedRegion : country.first_load));
}

export function groupCountriesByStatus(countries) {
  const groups = { friend: [], foe: [], neutral: [] };
  (countries || []).forEach((country) => {
    if (country?.status === "friend") groups.friend.push(country);
    else if (country?.status === "foe") groups.foe.push(country);
    else if (country?.status === "neutral") groups.neutral.push(country);
  });
  return groups;
}

export function countriesByRegion(countries) {
  const list = countries || [];
  return RELATION_REGIONS.map((region) => ({
    region,
    countries: list
      .filter((country) => country.region === region)
      .slice()
      .sort((a, b) => {
        const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
        if (rank) return rank;
        return String(a.country).localeCompare(String(b.country));
      }),
  }));
}

const FIELD_GOLDEN = Math.PI * (3 - Math.sqrt(5));

function ellipseRadius(angle, radiusX, radiusY) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const denom = (cos * cos) / (radiusX * radiusX) + (sin * sin) / (radiusY * radiusY);
  return denom === 0 ? Math.min(radiusX, radiusY) : 1 / Math.sqrt(denom);
}

function byRelevance(a, b) {
  const major = Number(Boolean(b.first_load)) - Number(Boolean(a.first_load));
  if (major) return major;
  const beats = (b.timeline || []).length - (a.timeline || []).length;
  if (beats) return beats;
  return String(a.country).localeCompare(String(b.country));
}

export function relationsFieldLayout(countries, options = {}) {
  const width = Math.max(320, Number(options.width) || 1100);
  const height = Math.max(280, Number(options.height) || 760);
  const selectedRegion = (options.openRegions || [])[0] || "";
  const visible = visibleRelationCountries(countries, options.openRegions);
  const majors = visible.filter((country) => country.first_load && (country.status === "friend" || country.status === "foe"));
  const broader = visible.filter((country) => !country.first_load);
  const count = majors.length + broader.length;
  let nodeSize = 58;
  if (count > 60) nodeSize = 28;
  else if (count > 31) nodeSize = 34;
  nodeSize = Math.min(nodeSize, Math.max(26, Math.floor(Math.min(width, height) / 14)));
  const centerSize = Math.round(Math.min(96, Math.max(64, nodeSize * 1.7)));
  const pad = nodeSize * 0.72 + 20;
  const radiusX = Math.max(centerSize, width / 2 - pad);
  const radiusY = Math.max(centerSize, height / 2 - pad);
  const cx = width / 2;
  const cy = height / 2;
  const innerFloor = centerSize * 0.52 + nodeSize * 0.42;

  const placeBand = (list, radiusAt, angleOffset = 0) => {
    const ranked = list.slice().sort(byRelevance);
    const total = ranked.length;
    return ranked.map((country, index) => {
      const span = total <= 1 ? 0 : Math.sqrt((index + 0.5) / total);
      const angle = -Math.PI / 2 + angleOffset + index * FIELD_GOLDEN;
      const dist = radiusAt(span, angle);
      return {
        id: country.slug,
        slug: country.slug,
        country: country.country,
        status: country.status,
        outline: country.outline,
        region: country.region,
        first_load: Boolean(country.first_load),
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        dist,
      };
    });
  };

  const nodes = !selectedRegion || !majors.length || !broader.length
    ? placeBand(visible, (span, angle) => {
      const rim = ellipseRadius(angle, radiusX, radiusY) * 0.98;
      return innerFloor + span * Math.max(0, rim - innerFloor);
    })
    : placeBand(majors, (span) => {
      const majorRim = Math.max(innerFloor + nodeSize, Math.min(radiusX, radiusY) * 0.55);
      return innerFloor + span * Math.max(0, majorRim - innerFloor);
    }).concat(placeBand(broader, (span, angle) => {
      const majorRim = Math.max(innerFloor + nodeSize, Math.min(radiusX, radiusY) * 0.55);
      const start = majorRim + nodeSize * 0.7;
      const rim = ellipseRadius(angle, radiusX, radiusY) * 0.98;
      return start + span * Math.max(0, rim - start);
    }, FIELD_GOLDEN / 2));

  return {
    width,
    height,
    nodeSize,
    centerSize,
    nodes,
    selectedRegion,
    center: { id: options.centerId || "united-states", x: cx, y: cy },
  };
}

export const RELATION_BLOCS = [
  {
    id: "nato",
    label: "NATO",
    slugs: [
      "albania", "belgium", "bulgaria", "canada", "croatia", "czech-republic", "denmark", "estonia",
      "finland", "france", "germany", "greece", "hungary", "iceland", "italy", "latvia", "lithuania",
      "luxembourg", "montenegro", "netherlands", "north-macedonia", "norway", "poland", "portugal",
      "romania", "slovakia", "slovenia", "spain", "sweden", "turkey", "united-kingdom",
    ],
  },
  {
    id: "five-eyes",
    label: "Five Eyes",
    slugs: ["australia", "canada", "new-zealand", "united-kingdom"],
  },
  {
    id: "aukus",
    label: "AUKUS",
    slugs: ["australia", "united-kingdom"],
  },
  {
    id: "quad",
    label: "Quad",
    slugs: ["australia", "india", "japan"],
  },
  {
    id: "usmca",
    label: "USMCA",
    slugs: ["canada", "mexico"],
  },
  {
    id: "gcc",
    label: "Gulf Cooperation Council",
    slugs: ["bahrain", "kuwait", "oman", "qatar", "saudi-arabia", "united-arab-emirates"],
  },
  {
    id: "cofa",
    label: "Compact of Free Association",
    slugs: ["marshall-islands", "micronesia", "palau"],
  },
  {
    id: "asean",
    label: "ASEAN",
    slugs: [
      "brunei", "cambodia", "indonesia", "laos", "malaysia", "myanmar", "philippines",
      "singapore", "thailand", "vietnam",
    ],
  },
  {
    id: "european-union",
    label: "European Union",
    slugs: [
      "austria", "belgium", "bulgaria", "croatia", "cyprus", "czech-republic", "denmark", "estonia",
      "finland", "france", "germany", "greece", "hungary", "ireland", "italy", "latvia", "lithuania",
      "luxembourg", "malta", "netherlands", "poland", "portugal", "romania", "slovakia", "slovenia",
      "spain", "sweden",
    ],
  },
];

function blocTree(members) {
  if (members.length < 2) return [];
  const inside = [members[0]];
  const outside = members.slice(1);
  const links = [];
  while (outside.length) {
    let best = 0;
    let pair = [inside[0], outside[0]];
    let bestDist = Infinity;
    inside.forEach((near) => {
      outside.forEach((far, index) => {
        const dist = (near.x - far.x) ** 2 + (near.y - far.y) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = index;
          pair = [near, far];
        }
      });
    });
    links.push(pair);
    inside.push(outside.splice(best, 1)[0]);
  }
  return links;
}

export function relationsFieldEdges(layout, blocs = RELATION_BLOCS) {
  const centerId = layout?.center?.id || "united-states";
  const nodes = layout?.nodes || [];
  const edges = nodes.map((node) => ({
    from: centerId,
    to: node.id,
    kind: "spoke",
    camp: node.status === "friend" ? "friend" : node.status === "foe" ? "enemy" : "neutral",
    scope: node.first_load ? "major" : "broad",
  }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set();
  (blocs || []).forEach((bloc) => {
    const members = (bloc.slugs || []).map((slug) => byId.get(slug)).filter(Boolean);
    blocTree(members).forEach(([from, to]) => {
      const key = [from.id, to.id].sort().join("|");
      if (seen.has(key)) return;
      seen.add(key);
      edges.push({
        from: from.id,
        to: to.id,
        kind: "bloc",
        bloc: bloc.id,
        camp: "bloc",
        scope: from.first_load && to.first_load ? "major" : "broad",
      });
    });
  });
  return edges;
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
  const country = valid.countries?.has(url.searchParams.get("country"))
    ? url.searchParams.get("country")
    : "";
  const requested = url.searchParams.get("view");
  let view = requested === "timeline" || requested === "person" ? requested : "web";
  if (view === "person" && person === ALL) view = "web";
  return {
    view,
    person,
    era,
    query: url.searchParams.get("q") || "",
    eventId,
    country,
  };
}

export function stateUrl(currentUrl, state, eventId = "") {
  const url = new URL(currentUrl, "https://plotmaniac.com/");
  if (state.view === "pick") {
    url.search = "";
    url.hash = "";
    return url.pathname || "/";
  }
  ["view", "person", "era", "q", "plot", "year", "country"].forEach((key) => url.searchParams.delete(key));
  if (state.plot) url.searchParams.set("plot", state.plot);
  if (state.view === "timeline" || state.view === "person") url.searchParams.set("view", state.view);
  else url.searchParams.set("view", "web");
  if (state.person && state.person !== ALL) url.searchParams.set("person", state.person);
  if (state.era && state.era !== ALL) url.searchParams.set("era", state.era);
  if (state.query?.trim()) url.searchParams.set("q", state.query.trim());
  if (Number.isFinite(state.year)) url.searchParams.set("year", String(state.year));
  if (state.country) url.searchParams.set("country", state.country);
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

function topicArrangement({
  center,
  people,
  relations,
  topics = [],
  events,
  width,
  height,
  friendKinds,
  enemyKinds,
  year,
  centerId,
  topicId,
}) {
  const cx = width / 2;
  const cy = height / 2;
  const catalog = topics.length
    ? topics
    : [...new Set((people || []).map((person) => person.topic).filter(Boolean))].map((id) => ({
      id,
      label: id,
    }));
  const visible = (people || []).filter((person) => !topicId || person.topic === topicId);
  const groups = catalog
    .map((topic) => ({
      ...topic,
      members: visible.filter((person) => person.topic === topic.id),
    }))
    .filter((group) => group.members.length);
  const leftovers = visible.filter((person) => !catalog.some((topic) => topic.id === person.topic));
  if (leftovers.length) groups.push({ id: "other", label: "Other", members: leftovers });

  const ids = visible.map((person) => person.id);
  const counts = beatCounts(events, ids);
  const tally = ids.map((id) => counts.get(id) || 0);
  const fewest = tally.length ? Math.min(...tally) : 0;
  const most = tally.length ? Math.max(...tally) : 0;
  const bubbleW = Math.max(96, Math.min(132, Math.floor(width / 7)));
  const bubbleH = 40;
  const nodeSize = Math.round(Math.min(bubbleW, 72));
  const centerSize = Math.round(Math.min(104, Math.max(72, Math.min(width, height) * 0.16)));
  const padX = bubbleW / 2 + 8;
  const padY = bubbleH / 2 + 16;
  const radiusX = Math.max(centerSize, width / 2 - padX);
  const radiusY = Math.max(centerSize, height / 2 - padY);
  const innerFloor = centerSize * 0.52 + bubbleH * 0.7;
  const n = Math.max(groups.length, 1);
  const wedge = (Math.PI * 2) / n;
  const spread = groups.length <= 1;
  const nodes = [];
  const edges = [];
  if (center) nodes.push({ ...center, x: cx, y: cy, camp: "center" });

  groups.forEach((group, gIndex) => {
    const mid = spread
      ? -Math.PI / 2
      : -Math.PI / 2 + gIndex * wedge;
    const hubId = `topic:${group.id}`;
    const hubAngle = mid;
    const hubRim = ellipseRadius(hubAngle, radiusX, radiusY) * (spread ? 0.55 : 0.48);
    const hubDist = innerFloor + Math.max(0, hubRim - innerFloor) * 0.42;
    const hubX = cx + Math.cos(hubAngle) * hubDist;
    const hubY = cy + Math.sin(hubAngle) * hubDist;
    nodes.push({
      id: hubId,
      name: group.label,
      x: hubX,
      y: hubY,
      camp: "topic",
      topic: group.id,
      hub: true,
    });
    if (center) edges.push({ from: center.id, to: hubId, kind: "topic" });

    const members = group.members
      .map((person) => ({ person, beats: counts.get(person.id) || 0 }))
      .sort((a, b) => b.beats - a.beats || a.person.name.localeCompare(b.person.name, "en", { sensitivity: "base" }));
    const count = members.length;
    members.forEach((entry, index) => {
      const closeness = most > fewest ? (entry.beats - fewest) / (most - fewest) : 0;
      let angle;
      let dist;
      if (spread) {
        angle = -Math.PI / 2 + index * Math.PI * (3 - Math.sqrt(5));
        const rim = ellipseRadius(angle, radiusX, radiusY) * 0.9;
        dist = innerFloor + (1 - closeness) * Math.max(0, rim - innerFloor);
      } else {
        const fan = count <= 1 ? 0 : ((index + 0.5) / count - 0.5);
        angle = mid + fan * wedge * 0.74;
        const rim = ellipseRadius(angle, radiusX, radiusY) * 0.82;
        const ring = count <= 1 ? 0.4 : 0.16 + (index / Math.max(count - 1, 1)) * 0.84;
        dist = innerFloor + (1 - closeness * 0.5) * Math.max(0, rim - innerFloor) * Math.min(1, 0.28 + ring);
      }
      const policyId = entry.person.id;
      nodes.push({
        ...entry.person,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        camp: campOf(policyId, relations, centerId || center.id, friendKinds, enemyKinds, year),
        beats: entry.beats,
        closeness,
        topic: entry.person.topic,
      });
      edges.push({ from: hubId, to: policyId, kind: "topic" });
    });
  });

  holdApart(nodes, {
    minDist: Math.min(bubbleW * 0.86, 108),
    minX: bubbleW / 2 + 6,
    maxX: width - (bubbleW / 2 + 6),
    minY: bubbleH / 2 + 8,
    maxY: height - (bubbleH / 2 + 10),
  });

  return {
    width,
    height,
    nodes,
    edges,
    nodeSize,
    centerSize,
    labels: [],
  };
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

  if (options.arrangement === "topics") {
    const extras = people.filter((person) => center && person.id !== center.id);
    return topicArrangement({
      center,
      people: extras,
      relations,
      topics: options.topics || [],
      events: options.events,
      width,
      height,
      friendKinds,
      enemyKinds,
      year: options.year,
      centerId: center.id,
      topicId: options.topicId || "",
    });
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
  const counts = beatCounts(options.events, ordered.map((person) => person.id));
  const tally = ordered.map((person) => counts.get(person.id) || 0);
  const fewest = tally.length ? Math.min(...tally) : 0;
  const most = tally.length ? Math.max(...tally) : 0;
  const weighted = Boolean(options.events) && most > fewest;
  const minRadius = centerSize / 2 + nodeSize / 2 + 28;
  const fitR = Math.min(radiusX, radiusY);

  const nodes = [];
  if (center) nodes.push({ ...center, x: cx, y: cy, camp: "center" });
  const placed = weighted
    ? orderByBeats(ordered, counts)
    : ordered.map((person, index) => ({ person, index }));
  placed.forEach(({ person, index }) => {
    const beats = counts.get(person.id) || 0;
    const closeness = weighted ? (beats - fewest) / (most - fewest) : 0;
    const angle = weighted
      ? -Math.PI / 2 + index * Math.PI * (3 - Math.sqrt(5))
      : -Math.PI / 2 + (Math.PI * 2 * index) / Math.max(ordered.length, 1);
    const dist = weighted ? minRadius + (1 - closeness) * Math.max(0, fitR - minRadius) : 0;
    const camp = campOf(person.id, relations, center.id, friendKinds, enemyKinds, options.year);
    nodes.push({
      ...person,
      x: cx + Math.cos(angle) * (weighted ? dist : radiusX),
      y: cy + Math.sin(angle) * (weighted ? dist : radiusY),
      camp,
      beats,
      closeness,
    });
  });

  if (weighted && center) {
    holdApart(nodes, {
      minDist: nodeSize + 18,
      minX: nodeSize / 2 + 8,
      maxX: width - (nodeSize / 2 + 8),
      minY: nodeSize / 2 + 8,
      maxY: height - (nodeSize / 2 + 22),
    });
  }

  return { width, height, nodes, edges: edgesAmong(nodes, applicable), nodeSize, centerSize };
}

function beatCounts(events, ids) {
  const counts = new Map(ids.map((id) => [id, 0]));
  (events || []).forEach((event) => {
    (event.people || []).forEach((id) => {
      if (counts.has(id)) counts.set(id, counts.get(id) + 1);
    });
  });
  return counts;
}

function orderByBeats(people, counts) {
  return people
    .map((person, index) => ({ person, index, beats: counts.get(person.id) || 0 }))
    .sort((a, b) => b.beats - a.beats || a.person.name.localeCompare(b.person.name))
    .map((entry, rank) => ({ person: entry.person, index: rank }));
}

function holdApart(nodes, bounds) {
  const center = nodes.find((node) => node.camp === "center");
  const orbit = nodes.filter((node) => node.camp !== "center");
  if (!center || orbit.length < 2) return;
  const { minDist, minX, maxX, minY, maxY } = bounds;
  orbit.forEach((node) => {
    node.radius = Math.hypot(node.x - center.x, node.y - center.y);
    node.angle = Math.atan2(node.y - center.y, node.x - center.x);
  });
  const place = (node) => {
    node.x = center.x + Math.cos(node.angle) * node.radius;
    node.y = center.y + Math.sin(node.angle) * node.radius;
  };
  for (let pass = 0; pass < 48; pass += 1) {
    let moved = false;
    for (let i = 0; i < orbit.length; i += 1) {
      for (let j = i + 1; j < orbit.length; j += 1) {
        const a = orbit[i];
        const b = orbit[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        if (dist >= minDist) continue;
        const gap = Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle));
        const sign = gap === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(gap);
        const nudge = ((minDist - dist) / Math.max(a.radius, b.radius, 1)) * 0.85;
        const aShare = 1 - (a.closeness || 0);
        const bShare = 1 - (b.closeness || 0);
        const share = aShare + bShare || 1;
        a.angle -= sign * nudge * (aShare / share);
        b.angle += sign * nudge * (bShare / share);
        place(a);
        place(b);
        moved = true;
      }
    }
    if (!moved) break;
  }
  orbit.forEach((node) => {
    node.x = Math.min(maxX, Math.max(minX, node.x));
    node.y = Math.min(maxY, Math.max(minY, node.y));
    delete node.angle;
    delete node.radius;
  });
}

// How much of the quiet side to keep readable when an opened beat needs the rest.
const QUIET_KEEP = 0.72;

// Split a fixed timeline height between the opened beat and the other side.
// The lane itself does not grow, so both sides stay inside the viewport.
export function laneBands(height, selectedNeed, quietNeed, minQuiet = 160) {
  const span = Math.max(0, Number(height) || 0);
  if (!(span > 0)) return { selectedBand: 0, quietBand: 0 };
  const floor = Math.min(Math.max(0, minQuiet), span / 2);
  const need = Math.max(0, Number(selectedNeed) || 0);
  const quiet = Math.max(0, Number(quietNeed) || 0);
  if (need <= span / 2 && quiet <= span / 2) {
    return { selectedBand: span / 2, quietBand: span / 2 };
  }
  const readableQuiet = Math.min(span / 2, Math.max(floor, quiet * QUIET_KEEP));
  if (need + readableQuiet <= span) {
    const selectedBand = Math.max(need, span / 2);
    return { selectedBand, quietBand: span - selectedBand };
  }
  const selectedBand = Math.min(Math.max(need, span / 2), span - readableQuiet);
  const band = Math.round(selectedBand);
  return { selectedBand: band, quietBand: span - band };
}

export const RELATION_TONE_MIN = -2;
export const RELATION_TONE_MAX = 2;

export function relationTimelineHasTone(timeline = []) {
  return (timeline || []).some((beat) => typeof beat?.tone === "number");
}

export function relationToneSeries(timeline = []) {
  return (timeline || [])
    .map((beat, index) => {
      const year = Number.parseInt(String(beat?.year || "").replace(/[^\d-]/g, ""), 10);
      return {
        index,
        year: Number.isFinite(year) ? year : 0,
        tone: typeof beat?.tone === "number" ? beat.tone : 0,
        event: String(beat?.event || ""),
        hasTone: typeof beat?.tone === "number",
      };
    })
    .filter((point) => point.year > 0 && point.hasTone)
    .sort((a, b) => a.year - b.year || a.index - b.index);
}

export function relationSentimentChart(timeline = [], options = {}) {
  const points = relationToneSeries(timeline);
  const width = Math.max(280, Number(options.width) || 360);
  const height = Math.max(96, Number(options.height) || 128);
  const pad = { top: 10, right: 10, bottom: 24, left: 34 };
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = Math.max(1, height - pad.top - pad.bottom);
  if (!points.length) {
    return { width, height, pad, points: [], linePath: "", areaPath: "", zeroY: pad.top + innerH / 2, minYear: 0, maxYear: 0 };
  }
  const years = points.map((point) => point.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const yearSpan = Math.max(1, maxYear - minYear);
  const toneScale = Math.max(Math.abs(RELATION_TONE_MIN), Math.abs(RELATION_TONE_MAX));
  const xAt = (year) => pad.left + ((year - minYear) / yearSpan) * innerW;
  const yAt = (tone) => pad.top + innerH / 2 - (tone / toneScale) * (innerH / 2);
  const zeroY = yAt(0);
  const plotted = points.map((point) => ({
    ...point,
    x: xAt(point.year),
    y: yAt(point.tone),
  }));
  const linePath = plotted.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${plotted.at(-1).x.toFixed(2)} ${zeroY.toFixed(2)} L ${plotted[0].x.toFixed(2)} ${zeroY.toFixed(2)} Z`;
  const ticks = [];
  const markCount = Math.min(5, yearSpan <= 4 ? yearSpan + 1 : 5);
  for (let i = 0; i < markCount; i += 1) {
    const year = Math.round(minYear + (yearSpan * i) / Math.max(1, markCount - 1));
    ticks.push({ year, x: xAt(year) });
  }
  return {
    width,
    height,
    pad,
    points: plotted,
    linePath,
    areaPath,
    zeroY,
    minYear,
    maxYear,
    ticks,
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
