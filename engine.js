export const ALL = "all";
export const COMPACT_MAX_WIDTH = 768;

export const PLOT_VIEWS = ["web", "timeline", "person", "relation", "chronology", "movie-web"];

export function requestedView(urlLike) {
  try {
    const url = new URL(urlLike, "https://plotmaniac.com/");
    const value = url.searchParams.get("view");
    if (PLOT_VIEWS.includes(value)) return value;
  } catch {
    return "";
  }
  return "";
}

export function usesScotusHub(plot) {
  return plot?.arrangement === "scotus-hub";
}

export function usesGunStateLawsPlot(plot) {
  return plot?.arrangement === "gun-state-laws";
}

export function usesDoctrineSummaryPlot(plot) {
  return plot?.arrangement === "doctrine-summary";
}

export function usesRegulationBoard(plot, topicId = "") {
  if (plot?.arrangement === "regulation-board") return true;
  return usesScotusHub(plot) && topicId === "gun-rights";
}

export function defaultPlotView({ requested = "", eventId = "", plot = null } = {}) {
  if (usesScotusHub(plot) || usesRegulationBoard(plot) || usesGunStateLawsPlot(plot) || usesDoctrineSummaryPlot(plot)) {
    return "web";
  }
  if (requested === "timeline" || requested === "web" || requested === "person" || requested === "chronology" || requested === "movie-web") {
    return requested;
  }
  if (eventId) return "timeline";
  if (plot?.defaultView === "timeline") return "timeline";
  return "web";
}

/** Gallery / plot-switcher entry URL. Marvel lands on Watch Order (`view=timeline`). */
export function plotChooserHref(plot) {
  if (!plot?.id) return "?";
  const params = new URLSearchParams();
  params.set("plot", plot.id);
  const view = defaultPlotView({ plot });
  if (view && view !== "web") params.set("view", view);
  return `?${params.toString()}`;
}

export function resolvePlotView(parsed, { href = "", plot = null } = {}) {
  const requested = requestedView(href);
  if (requested) return parsed.view;
  return defaultPlotView({
    eventId: parsed?.eventId || "",
    plot,
  });
}

export function eventSearchText(event, peopleById = new Map()) {
  const people = (event.people || []).map((id) => peopleById.get(id)?.name || id);
  return [event.title, event.tease, event.summary, event.era, ...(event.themes || []), ...people]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();
}

export function eventMatchesHub(event, hubId) {
  if (!hubId || hubId === ALL) return true;
  const hubs = event?.hubs;
  if (!Array.isArray(hubs) || !hubs.length) return true;
  return hubs.includes(hubId);
}

export function filterEvents(events, filters = {}, peopleById = new Map()) {
  const query = (filters.query || "").trim().toLocaleLowerCase();
  return events.filter((event) => {
    if (filters.person && filters.person !== ALL && !event.people.includes(filters.person)) return false;
    if (filters.era && filters.era !== ALL && event.era !== filters.era) return false;
    if (filters.hub && filters.hub !== ALL && !eventMatchesHub(event, filters.hub)) return false;
    return !query || eventSearchText(event, peopleById).includes(query);
  });
}

/** Unique film/series labels for title filter suggestions, in display order. */
export function titleFilterLabels(events = [], chronology = null, options = {}) {
  if (chronology?.titles?.length) {
    return filterChronologyTitles(chronology.titles, options).map((entry) => chronologyFilterLabel(entry));
  }
  const seen = new Set();
  const labels = [];
  (events || []).forEach((event) => {
    const label = eventMediaLabel(event);
    if (!label || seen.has(label)) return;
    seen.add(label);
    labels.push(label);
  });
  return labels.sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
}

export function usesPlotChronology(plot) {
  return Boolean(plot?.paths?.chronology);
}

export function chronologyFilterLabel(entry) {
  return String(entry?.filterLabel || entry?.title || "").trim();
}

/** Resolved TMDB poster URL baked at build/enrich time (no runtime API key). */
export function chronologyPosterUrl(entry, size = "w342") {
  const pathOnly = entry?.posterPath;
  if (pathOnly) {
    const normalized = String(pathOnly).startsWith("/") ? pathOnly : `/${pathOnly}`;
    return `https://image.tmdb.org/t/p/${size}${normalized}`;
  }
  const url = String(entry?.posterUrl || "").trim();
  if (url.startsWith("https://image.tmdb.org/")) return url;
  return "";
}

export function chronologyTitles(chronology) {
  return chronology?.titles || [];
}

export function chronologyTitleKind(entry) {
  const explicit = String(entry?.kind || entry?.type || "").toLowerCase();
  if (explicit === "tv" || explicit === "series") return "tv";
  if (explicit === "movie" || explicit === "film") return "movie";
  const hay = `${entry?.id || ""} ${entry?.title || ""}`;
  if (/\bs\d+\b/i.test(hay)) return "tv";
  return "movie";
}

export function chronologyTitleIsTv(entry) {
  return chronologyTitleKind(entry) === "tv";
}

/** Default Watch Order hides TV; `tv=1` includes Disney+/Netflix/series already in the chronology. */
export const CHRONOLOGY_INCLUDE_TV_DEFAULT = false;

export function parseChronologyIncludeTv(urlLike, fallback = CHRONOLOGY_INCLUDE_TV_DEFAULT) {
  try {
    const raw = new URL(urlLike, "https://plotmaniac.com/").searchParams.get("tv");
    if (raw == null || raw === "") return Boolean(fallback);
    const value = String(raw).toLowerCase();
    if (value === "0" || value === "false" || value === "no" || value === "off") return false;
    if (value === "1" || value === "true" || value === "yes" || value === "on") return true;
    return Boolean(fallback);
  } catch {
    return Boolean(fallback);
  }
}

export function filterChronologyTitles(titles = [], { includeTv = true } = {}) {
  const list = Array.isArray(titles) ? titles : [];
  if (includeTv) return list;
  return list.filter((entry) => !chronologyTitleIsTv(entry));
}

export function filterChronology(chronology, options = {}) {
  if (!chronology?.titles) return chronology;
  if (options.includeTv !== false) return chronology;
  return { ...chronology, titles: filterChronologyTitles(chronology.titles, options) };
}

export function chronologyNearestVisibleId(chronology, requestedId = "", options = {}) {
  const visible = filterChronologyTitles(chronologyTitles(chronology), options);
  if (!visible.length) return "";
  if (requestedId && visible.some((entry) => entry.id === requestedId)) return requestedId;
  const all = chronologyTitles(chronology);
  const pos = all.findIndex((entry) => entry.id === requestedId);
  if (pos >= 0) {
    for (let i = pos; i >= 0; i -= 1) {
      if (visible.some((entry) => entry.id === all[i].id)) return all[i].id;
    }
    for (let i = pos + 1; i < all.length; i += 1) {
      if (visible.some((entry) => entry.id === all[i].id)) return all[i].id;
    }
  }
  return visible[0].id;
}

export function chronologyById(chronology) {
  return new Map(chronologyTitles(chronology).map((entry) => [entry.id, entry]));
}

export function chronologyEntryForQuery(chronology, query) {
  const q = String(query || "").trim();
  if (!q || !chronology?.titles?.length) return null;
  const lower = q.toLocaleLowerCase();
  const exact = chronology.titles.filter((entry) => {
    const label = chronologyFilterLabel(entry);
    return label === q || entry.title === q || label.toLocaleLowerCase() === lower;
  });
  if (exact.length === 1) return exact[0];
  const partial = chronology.titles.filter((entry) => {
    const label = chronologyFilterLabel(entry);
    return label.toLocaleLowerCase().includes(lower) || entry.title.toLocaleLowerCase().includes(lower);
  });
  if (partial.length === 1) return partial[0];
  return null;
}

const CHRONO_PREREQ_TIERS = ["must", "should", "could", "unreleased"];

/** Group prereqs on one title by tier (must → unreleased). */
export function chronologyPrereqsGrouped(entry, chronologyIndex) {
  const list = entry?.prereqs || [];
  const groups = CHRONO_PREREQ_TIERS.map((tier) => ({
    tier,
    items: list.filter((item) => item.tier === tier).map((item) => chronologyIndex.get(item.id)).filter(Boolean),
  }));
  return groups.filter((group) => group.items.length);
}

/** Direct outbound edges: titles that list this id as a prerequisite. */
export function chronologyFeedsInto(chronology, id) {
  const titles = chronologyTitles(chronology);
  const index = chronologyById(chronology);
  const out = [];
  titles.forEach((entry) => {
    if (!(entry.prereqs || []).some((item) => item.id === id)) return;
    out.push(index.get(entry.id));
  });
  return out.filter(Boolean);
}

/** Watch Before rail: prereqs flattened in must → should → could → unreleased order. */
export function chronologyWatchBefore(entry, chronologyIndex) {
  return chronologyPrereqsGrouped(entry, chronologyIndex).flatMap((group) => group.items);
}

/** Watch Next rail: titles this one feeds into, or the next chronological successors. */
export const CHRONOLOGY_WATCH_NEXT_FALLBACK = 3;

export function chronologyWatchNext(chronology, id, limit = CHRONOLOGY_WATCH_NEXT_FALLBACK) {
  const feeds = chronologyFeedsInto(chronology, id);
  if (feeds.length) return feeds;
  const cap = Math.max(1, Number(limit) || CHRONOLOGY_WATCH_NEXT_FALLBACK);
  const titles = chronologyTitles(chronology);
  const index = titles.findIndex((entry) => entry.id === id);
  if (index < 0 || index >= titles.length - 1) return [];
  return titles.slice(index + 1, index + 1 + cap);
}

/**
 * Poster board for the Movie web. Eras are gathered into one cluster each,
 * in the order that era first appears. Edges mark prerequisites.
 */
export function movieWebLayout(titles = [], options = {}) {
  const list = Array.isArray(titles) ? titles : [];
  const posterW = options.posterW || 188;
  const posterH = options.posterH || 282;
  const labelH = 58;
  const gapX = 56;
  const gapY = 64;
  const columns = Math.max(2, Number(options.columns) || 5);
  const pad = 36;
  const eraH = 52;
  const colW = posterW + gapX;
  const rowStride = posterH + labelH + gapY;
  const nodes = [];
  const groups = [];
  list.forEach((entry, order) => {
    const era = entry.era || "Other";
    let group = groups.find((item) => item.era === era);
    if (!group) {
      group = { era, entries: [] };
      groups.push(group);
    }
    group.entries.push({ entry, order });
  });
  let y = pad;
  groups.forEach((group) => {
    nodes.push({
      type: "era",
      id: `era-${nodes.length}`,
      era: group.era,
      x: pad,
      y,
      w: Math.max(posterW, columns * colW - gapX),
      h: eraH,
    });
    y += eraH;
    let col = 0;
    group.entries.forEach(({ entry, order }) => {
      nodes.push({
        type: "title",
        id: entry.id,
        title: chronologyFilterLabel(entry),
        era: group.era,
        order: order + 1,
        x: pad + col * colW,
        y,
        w: posterW,
        h: posterH,
      });
      col += 1;
      if (col >= columns) {
        col = 0;
        y += rowStride;
      }
    });
    y += col === 0 ? gapY : rowStride;
  });
  const byId = new Map(nodes.filter((node) => node.type === "title").map((node) => [node.id, node]));
  const edges = [];
  list.forEach((entry) => {
    (entry.prereqs || []).forEach((item) => {
      if (!byId.has(item.id) || !byId.has(entry.id)) return;
      edges.push({ from: item.id, to: entry.id, tier: item.tier || "" });
    });
  });
  return {
    nodes,
    edges,
    width: pad * 2 + columns * colW - gapX,
    height: y + pad,
    posterW,
    posterH,
  };
}

/**
 * Side-rail poster size so every Watch Before / Watch Next tile fits the host.
 * Shrinks posters and gaps together; never drops items.
 */
export function chronologyRailPosterSize({ count = 1, availableHeight = 560 } = {}) {
  const n = Math.max(1, Math.round(Number(count) || 1));
  const caption = 18;
  const gap = n >= 5 ? 6 : n >= 4 ? 8 : 10;
  const usable = Math.max(96, Number(availableHeight) || 0);
  const height = Math.max(44, Math.min(132, (usable - gap * (n - 1) - caption * n) / n));
  return {
    count: n,
    gap,
    width: Math.round(height * 2 / 3),
    height: Math.round(height),
  };
}

export function validateChronology(chronology, peopleIds, expectedOrderIds = []) {
  const titles = chronologyTitles(chronology);
  const index = chronologyById(chronology);
  const errors = [];
  if (expectedOrderIds.length && titles.length !== expectedOrderIds.length) {
    errors.push(`expected ${expectedOrderIds.length} titles, got ${titles.length}`);
  }
  expectedOrderIds.forEach((id, i) => {
    if (titles[i]?.id !== id) errors.push(`order mismatch at ${i}: ${titles[i]?.id} vs ${id}`);
  });
  titles.forEach((entry) => {
    if (!entry.id || !entry.title) errors.push("title missing id/title");
    if (!entry.characters?.length) errors.push(`${entry.id} has no characters`);
    const kind = chronologyTitleKind(entry);
    if (kind !== "movie" && kind !== "tv") errors.push(`${entry.id} bad kind ${entry.kind || entry.type}`);
    if (!entry.kind && !entry.type) errors.push(`${entry.id} missing kind`);
    (entry.characters || []).forEach((personId) => {
      if (!peopleIds.has(personId)) errors.push(`${entry.id} unknown character ${personId}`);
    });
    (entry.prereqs || []).forEach((item) => {
      if (!CHRONO_PREREQ_TIERS.includes(item.tier)) errors.push(`${entry.id} bad tier ${item.tier}`);
      if (!index.has(item.id)) errors.push(`${entry.id} prereq unknown ${item.id}`);
    });
  });
  return errors;
}

/** Match title labels for the custom suggestions panel (not native datalist). */
export function filterTitleLabels(labels, query, limit = 10) {
  const list = Array.isArray(labels) ? labels : [];
  const cap = Math.max(1, Number(limit) || 10);
  const q = String(query || "").trim().toLocaleLowerCase();
  if (!q) return list.slice(0, cap);
  return list.filter((label) => label.toLocaleLowerCase().includes(q)).slice(0, cap);
}

/** Prefer a film/series link label when the beat has one; otherwise the beat title. */
export function eventMediaLabel(event) {
  const reference = (event?.links || []).find((link) => link.type === "reference" && link.label);
  if (reference?.label) return String(reference.label).trim();
  return String(event?.title || "").trim();
}

/** People who appear on beats that match the current title search and hub focus. */
export function peopleForTitleSearch(people, events, relations, filters = {}, peopleById = new Map(), chronology = null) {
  const query = String(filters.query || "").trim();
  if (!query) return { people, relations };
  const chronoEntry = chronology ? chronologyEntryForQuery(chronology, query) : null;
  if (chronoEntry?.characters?.length) {
    const ids = new Set(chronoEntry.characters);
    const cast = people.filter((person) => ids.has(person.id));
    const visible = new Set(cast.map((person) => person.id));
    const scoped = relations.filter((relation) => visible.has(relation.from) && visible.has(relation.to));
    return { people: cast, relations: scoped };
  }
  const matched = filterEvents(events, filters, peopleById);
  if (!matched.length) return { people: [], relations: [] };
  const ids = new Set();
  matched.forEach((event) => {
    (event.people || []).forEach((id) => ids.add(id));
  });
  const cast = people.filter((person) => ids.has(person.id));
  const visible = new Set(cast.map((person) => person.id));
  const scoped = relations.filter((relation) => visible.has(relation.from) && visible.has(relation.to));
  return { people: cast, relations: scoped };
}

export function findPlot(plots, id) {
  const list = plots || [];
  if (!id) return null;
  return list.find((plot) => plot.id === id)
    || list.find((plot) => (plot.aliases || []).includes(id))
    || null;
}

export function plotCardFace(plot) {
  if (!plot?.cardImage) return "mono";
  if (plot.arrangement === "wars") return "map";
  if (plot.images === "flags") return "flag";
  return "person";
}

export function plotMatchesQuery(plot, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const hay = [plot?.title, plot?.kicker, plot?.cardLine, plot?.lede]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function plotHubs(plot) {
  return Array.isArray(plot?.hubs) ? plot.hubs : [];
}

export function hubOf(plot, hubId) {
  const hubs = plotHubs(plot);
  if (!hubs.length || !hubId || hubId === ALL) return null;
  return hubs.find((hub) => hub.id === hubId) || hubs[0];
}

export function hubCenterId(plot, hubId) {
  if (!hubId) return "";
  return hubOf(plot, hubId)?.centerId || "";
}

export const WEB_MIN_BEATS = 2;

export function hubsForPerson(personId, relations, hubIds = []) {
  const hubs = new Set();
  const known = new Set(hubIds);
  if (known.has(personId)) hubs.add(personId);
  (relations || []).forEach((relation) => {
    const other = relation.from === personId ? relation.to
      : relation.to === personId ? relation.from
        : "";
    if (other && known.has(other)) hubs.add(other);
  });
  return [...hubs];
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
  const requestedHub = url.searchParams.get("hub");
  const hub = requestedHub === "shared" || requestedHub === "none"
    ? ""
    : (valid.hubs?.has(requestedHub)
      ? requestedHub
      : (requestedHub === ALL && valid.hubs?.size
        ? ALL
        : (valid.defaultHub || "")));
  const requested = url.searchParams.get("view");
  let view = PLOT_VIEWS.includes(requested) ? requested : "web";
  if (view === "person" && person === ALL) view = "web";
  if (view === "relation" && !country) view = "web";
  const topicRaw = url.searchParams.get("topic") || "";
  const topic = valid.topics?.has(topicRaw) ? topicRaw : "";
  const chronologyTitle = url.searchParams.get("title") || "";
  const includeTv = parseChronologyIncludeTv(url.href, CHRONOLOGY_INCLUDE_TV_DEFAULT);
  return {
    view,
    person,
    era,
    query: url.searchParams.get("q") || "",
    eventId,
    country,
    hub,
    topic,
    chronologyTitle,
    includeTv,
  };
}

export function stateUrl(currentUrl, state, eventId = "") {
  const url = new URL(currentUrl, "https://plotmaniac.com/");
  if (state.view === "pick") {
    url.search = "";
    url.hash = "";
    return url.pathname || "/";
  }
  ["view", "person", "era", "q", "plot", "year", "country", "hub", "from", "to", "kind", "state", "topic", "criteria", "gun", "title", "tv"].forEach((key) => url.searchParams.delete(key));
  if (state.plot) url.searchParams.set("plot", state.plot);
  if (PLOT_VIEWS.includes(state.view) && state.view !== "web") {
    url.searchParams.set("view", state.view);
  } else {
    url.searchParams.set("view", "web");
  }
  if (state.person && state.person !== ALL) url.searchParams.set("person", state.person);
  if (state.era && state.era !== ALL) url.searchParams.set("era", state.era);
  if (state.query?.trim()) url.searchParams.set("q", state.query.trim());
  if (Number.isFinite(state.year)) url.searchParams.set("year", String(state.year));
  if (Number.isFinite(state.from)) url.searchParams.set("from", String(state.from));
  if (Number.isFinite(state.to)) url.searchParams.set("to", String(state.to));
  if (state.country) url.searchParams.set("country", state.country);
  if (state.regKind) url.searchParams.set("kind", state.regKind);
  if (state.gunLawState) url.searchParams.set("state", state.gunLawState);
  else if (state.exemplarState) url.searchParams.set("state", state.exemplarState);
  if (state.gunLawCriteria) url.searchParams.set("criteria", state.gunLawCriteria);
  if (state.gunLawGunType === "longgun") url.searchParams.set("gun", "longgun");
  if (state.topic) url.searchParams.set("topic", state.topic);
  if (state.hub) url.searchParams.set("hub", state.hub);
  else if (state.defaultHub) url.searchParams.set("hub", "shared");
  if (state.chronologyTitle) url.searchParams.set("title", state.chronologyTitle);
  if (state.includeTv) url.searchParams.set("tv", "1");
  url.hash = state.view === "person" || !eventId ? "" : encodeURIComponent(eventId);
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

function separateTopicNodes(nodes, { width, height, gap = 10 }) {
  const center = nodes.find((node) => node.camp === "center");
  const hubs = nodes.filter((node) => node.hub);
  const policies = nodes.filter((node) => node.camp !== "center" && !node.hub);
  const clamp = (node) => {
    const halfWidth = node.boxWidth / 2;
    const halfHeight = node.boxHeight / 2;
    node.x = Math.min(width - halfWidth - gap, Math.max(halfWidth + gap, node.x));
    node.y = Math.min(height - halfHeight - gap, Math.max(halfHeight + gap, node.y));
  };
  const overlaps = (a, b) =>
    Math.abs(a.x - b.x) < (a.boxWidth + b.boxWidth) / 2 + gap &&
    Math.abs(a.y - b.y) < (a.boxHeight + b.boxHeight) / 2 + gap;
  const angleDelta = (a, b) =>
    Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

  [center, ...hubs].filter(Boolean).forEach(clamp);
  const sample = policies[0];
  if (sample) {
    const stepX = sample.boxWidth + gap;
    const stepY = sample.boxHeight + gap;
    const columns = Math.max(1, Math.floor((width - gap * 2) / stepX));
    const rows = Math.max(1, Math.floor((height - gap * 2) / stepY));
    const gridWidth = sample.boxWidth + (columns - 1) * stepX;
    const gridHeight = sample.boxHeight + (rows - 1) * stepY;
    const startX = (width - gridWidth) / 2 + sample.boxWidth / 2;
    const startY = (height - gridHeight) / 2 + sample.boxHeight / 2;
    const candidates = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        candidates.push({ x: startX + column * stepX, y: startY + row * stepY });
      }
    }

    const placed = [center, ...hubs].filter(Boolean);
    policies.forEach((node) => {
      const hub = hubs.find((item) => item.topic === node.topic);
      const hubAngle = hub && center
        ? Math.atan2(hub.y - center.y, hub.x - center.x)
        : Math.atan2(node.anchorY - height / 2, node.anchorX - width / 2);
      const choices = candidates
        .filter((candidate) => {
          const probe = { ...node, ...candidate };
          return !placed.some((item) => overlaps(probe, item));
        })
        .map((candidate) => {
          const angle = Math.atan2(candidate.y - height / 2, candidate.x - width / 2);
          const anchorDistance = Math.hypot(candidate.x - node.anchorX, candidate.y - node.anchorY);
          const topicPenalty = angleDelta(angle, hubAngle) * Math.min(width, height) * 1.8;
          return { ...candidate, score: anchorDistance + topicPenalty };
        })
        .sort((a, b) => a.score - b.score);
      const choice = choices[0];
      if (choice) {
        node.x = choice.x;
        node.y = choice.y;
      }
      clamp(node);
      placed.push(node);
    });
  }

  nodes.forEach((node) => {
    delete node.anchorX;
    delete node.anchorY;
    delete node.fixed;
  });
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
  const bubbleW = Math.max(108, Math.min(136, Math.floor(width / 7)));
  const bubbleH = 56;
  const topicW = width < 700 ? bubbleW : 154;
  const topicH = 46;
  const compactHeight = Math.ceil((visible.length + groups.length + 1) / 2) * (bubbleH + 12);
  const usedHeight = Math.max(height, width < 700 ? Math.max(720, compactHeight) : 500);
  const cy = usedHeight / 2;
  const nodeSize = Math.round(Math.min(bubbleW, 72));
  const centerSize = Math.round(Math.min(104, Math.max(72, Math.min(width, usedHeight) * 0.16)));
  const padX = bubbleW / 2 + 8;
  const padY = bubbleH / 2 + 16;
  const radiusX = Math.max(centerSize, width / 2 - padX);
  const radiusY = Math.max(centerSize, usedHeight / 2 - padY);
  const innerFloor = centerSize * 0.52 + bubbleH * 0.7;
  const n = Math.max(groups.length, 1);
  const wedge = (Math.PI * 2) / n;
  const spread = groups.length <= 1;
  const nodes = [];
  const edges = [];
  if (center) {
    nodes.push({
      ...center,
      x: cx,
      y: cy,
      anchorX: cx,
      anchorY: cy,
      boxWidth: centerSize + 24,
      boxHeight: centerSize + 36,
      camp: "center",
      fixed: true,
    });
  }

  groups.forEach((group, gIndex) => {
    const mid = spread
      ? -Math.PI / 2
      : -Math.PI / 2 + gIndex * wedge;
    const hubId = `topic:${group.id}`;
    const hubAngle = mid;
    const hubRim = ellipseRadius(hubAngle, radiusX, radiusY) * (spread ? 0.55 : 0.48);
    const clearX = ((centerSize + 24 + topicW) / 2 + 12) / Math.max(Math.abs(Math.cos(hubAngle)), 0.001);
    const clearY = ((centerSize + 36 + topicH) / 2 + 12) / Math.max(Math.abs(Math.sin(hubAngle)), 0.001);
    const hubClearance = Math.min(clearX, clearY);
    const hubRingClearance = (topicW + 12) / (2 * Math.sin(wedge / 2));
    const hubDist = Math.max(
      hubClearance,
      hubRingClearance,
      innerFloor + Math.max(0, hubRim - innerFloor) * 0.42,
    );
    const hubX = cx + Math.cos(hubAngle) * hubDist;
    const hubY = cy + Math.sin(hubAngle) * hubDist;
    nodes.push({
      id: hubId,
      name: group.label,
      x: hubX,
      y: hubY,
      anchorX: hubX,
      anchorY: hubY,
      boxWidth: topicW,
      boxHeight: topicH,
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
        anchorX: cx + Math.cos(angle) * dist,
        anchorY: cy + Math.sin(angle) * dist,
        boxWidth: bubbleW,
        boxHeight: bubbleH,
        camp: campOf(policyId, relations, centerId || center.id, friendKinds, enemyKinds, year),
        beats: entry.beats,
        closeness,
        topic: entry.person.topic,
      });
      edges.push({ from: hubId, to: policyId, kind: "topic" });
    });
  });

  separateTopicNodes(nodes, { width, height: usedHeight, gap: 12 });

  return {
    width,
    height: usedHeight,
    nodes,
    edges,
    nodeSize,
    centerSize,
    bubbleWidth: bubbleW,
    bubbleHeight: bubbleH,
    topicWidth: topicW,
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

export function usesPolicyPanel(plot) {
  return plot?.arrangement === "topics";
}

export function usesHubWebPersonFocus(plot) {
  if (usesPlotChronology(plot)) return false;
  return Boolean(plot?.titleFilter && plot?.includeOrbit && plotHubs(plot).length >= 2);
}

export function webCastForPersonFocus(people, relations, personId) {
  const near = neighborhood(personId, relations);
  return {
    people: (people || []).filter((person) => near.has(person.id)),
    relations: (relations || []).filter((relation) => near.has(relation.from) && near.has(relation.to)),
  };
}

export function boardViewForPerson(plot, view) {
  if (usesPlotChronology(plot)) return view === "web" ? "timeline" : view;
  if (plot?.arrangement === "wars") return "web";
  if (usesScotusHub(plot) || usesRegulationBoard(plot) || usesGunStateLawsPlot(plot) || usesDoctrineSummaryPlot(plot)) {
    return "web";
  }
  if (usesPolicyPanel(plot) && view === "person") return "web";
  if (usesHubWebPersonFocus(plot) && view === "person") return "web";
  return view;
}

export function stanceHistory(personId, relations, centerId) {
  return tiesWith(personId, relations, centerId)
    .slice()
    .sort((a, b) =>
      String(a.start || "").localeCompare(String(b.start || "")) ||
      String(a.end || "9999").localeCompare(String(b.end || "9999")));
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
  const friendKinds = options.friendKinds || ["ally", "crew", "co-host", "collaborator", "family"];
  const enemyKinds = options.enemyKinds || ["feud", "litigation"];
  const width = options.width || 1100;
  const height = options.height || 980;
  const cx = width / 2;
  const cy = height / 2;
  const hubIds = Array.isArray(options.hubIds) ? options.hubIds.filter(Boolean) : [];
  const hubField = options.hubField !== false
    && Boolean(options.includeOrbit) && hubIds.length >= 2
    && options.arrangement !== "camps" && options.arrangement !== "topics";
  const centerId = options.centerId || (hubField ? "" : "ethan-klein");
  const center = people.find((person) => person.id === centerId) || (hubField ? null : people[0]);
  const friends = [];
  const foes = [];
  const orbit = [];
  people.forEach((person) => {
    if (!center || person.id === center.id) return;
    const camp = campOf(person.id, relations, center.id, friendKinds, enemyKinds, options.year);
    if (camp === "friend") friends.push(person);
    else if (camp === "enemy") foes.push(person);
    else if (options.includeOrbit) orbit.push(person);
  });
  friends.sort(byName);
  foes.sort(byName);
  orbit.sort(byName);
  const applicable = relations.filter((relation) => coversYear(relation, options.year));

  if (hubField) {
    return hubFieldLayout({
      people,
      relations: applicable,
      center,
      friendKinds,
      enemyKinds,
      year: options.year,
      events: options.events,
      width,
      height,
      hubIds,
      hubs: options.hubs,
      minBeats: options.minBeats ?? WEB_MIN_BEATS,
      revealAll: Boolean(options.revealAll),
    });
  }

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
  orbit.forEach((person) => ordered.push(person));

  const count = Math.max(ordered.length, 1);
  let nodeSize = 72;
  let radiusX = width * 0.36;
  let radiusY = height * 0.36;
  const minNode = count > 28 ? 28 : 42;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const padX = nodeSize / 2 + 12;
    const padY = nodeSize / 2 + 26;
    radiusX = Math.max(56, width / 2 - padX);
    radiusY = Math.max(56, height / 2 - padY);
    const chord = 2 * Math.min(radiusX, radiusY) * Math.sin(Math.PI / count);
    if (chord >= nodeSize * 1.2 || nodeSize <= minNode) break;
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

  const hubIdSet = new Set(hubIds);
  const nodes = [];
  if (center) nodes.push({ ...center, x: cx, y: cy, camp: "center", plotHub: hubIdSet.has(center.id) });
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
      plotHub: hubIdSet.has(person.id),
    });
  });

  if ((weighted || options.includeOrbit) && center) {
    holdApart(nodes, {
      minDist: options.includeOrbit ? Math.max(nodeSize * 0.92, 32) : nodeSize + 18,
      minX: nodeSize / 2 + 8,
      maxX: width - (nodeSize / 2 + 8),
      minY: nodeSize / 2 + 8,
      maxY: height - (nodeSize / 2 + 22),
    });
  }

  return { width, height, nodes, edges: edgesAmong(nodes, applicable), nodeSize, centerSize };
}

function angleDelta(from, to) {
  let delta = to - from;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  return delta;
}

function hubBox(nodeSize, spacious = false) {
  if (spacious) {
    const boxW = Math.max(nodeSize + 52, 148);
    const boxH = Math.max(nodeSize + 76, 156);
    return { nodeSize, boxW, boxH };
  }
  return { nodeSize, boxW: nodeSize + 48, boxH: nodeSize + 56 };
}

function hubNodeBounds(nodes, boxW, boxH) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  nodes.forEach((node) => {
    minX = Math.min(minX, node.x - boxW / 2);
    maxX = Math.max(maxX, node.x + boxW / 2);
    minY = Math.min(minY, node.y - boxH / 2);
    maxY = Math.max(maxY, node.y + boxH / 2);
  });
  return { minX, maxX, minY, maxY };
}

function shiftHubNodesIntoView(nodes, boxW, boxH, width, height, pad) {
  const bounds = hubNodeBounds(nodes, boxW, boxH);
  let dx = 0;
  let dy = 0;
  if (bounds.minX < pad) dx = pad - bounds.minX;
  if (bounds.maxX > width - pad) dx = (width - pad) - bounds.maxX;
  if (bounds.minY < pad) dy = pad - bounds.minY;
  if (bounds.maxY > height - pad) dy = (height - pad) - bounds.maxY;
  if (!dx && !dy) return;
  nodes.forEach((node) => {
    node.x += dx;
    node.y += dy;
  });
}

function hubBoxesOverlap(a, b, boxW, boxH) {
  return Math.abs(a.x - b.x) < boxW && Math.abs(a.y - b.y) < boxH;
}

function hubLayoutHasOverlaps(nodes, boxW, boxH) {
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (hubBoxesOverlap(nodes[i], nodes[j], boxW, boxH)) return true;
    }
  }
  return false;
}

/** Push hub nodes apart after non-uniform scaling so label cells keep minimum separation. */
export function resolveHubBoxOverlaps(nodes, boxW, boxH, {
  minX = -Infinity,
  maxX = Infinity,
  minY = -Infinity,
  maxY = Infinity,
  passes = 72,
} = {}) {
  const halfW = boxW / 2;
  const halfH = boxH / 2;
  const clampNode = (node) => {
    node.x = Math.min(maxX - halfW, Math.max(minX + halfW, node.x));
    node.y = Math.min(maxY - halfH, Math.max(minY + halfH, node.y));
  };
  for (let pass = 0; pass < passes; pass += 1) {
    let moved = false;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const gapX = boxW - Math.abs(b.x - a.x);
        const gapY = boxH - Math.abs(b.y - a.y);
        if (gapX <= 0 || gapY <= 0) continue;
        const overlap = Math.min(gapX, gapY);
        const dx = b.x - a.x || (i % 2 === 0 ? 1 : -1);
        const dy = b.y - a.y || (j % 2 === 0 ? -1 : 1);
        const dist = Math.hypot(dx, dy) || 1;
        const push = overlap * 0.52;
        a.x -= (dx / dist) * push;
        a.y -= (dy / dist) * push;
        b.x += (dx / dist) * push;
        b.y += (dy / dist) * push;
        clampNode(a);
        clampNode(b);
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/** Fit the cast footprint to the viewport width without squashing vertical spacing. */
export function spreadHubFieldToView(nodes, boxW, boxH, targetWidth, targetHeight) {
  if (!nodes.length) return { width: targetWidth, height: targetHeight };
  const pad = 36;
  const goalX = Math.max(boxW, targetWidth - pad * 2);
  let bounds = hubNodeBounds(nodes, boxW, boxH);
  const spanX = Math.max(1, bounds.maxX - bounds.minX);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const sx = goalX / spanX;
  nodes.forEach((node) => {
    node.x = targetWidth / 2 + (node.x - cx) * sx;
    node.y = targetHeight / 2 + (node.y - cy);
  });
  bounds = hubNodeBounds(nodes, boxW, boxH);
  const height = Math.max(targetHeight, bounds.maxY - bounds.minY + pad * 2);
  shiftHubNodesIntoView(nodes, boxW, boxH, targetWidth, height, pad);
  return { width: targetWidth, height };
}

function stageGrid(cx, cy, width, height, boxW, boxH, pad) {
  const minX = pad + boxW / 2;
  const maxX = width - pad - boxW / 2;
  const minY = pad + boxH / 2;
  const maxY = height - pad - boxH / 2;
  if (maxX < minX || maxY < minY) return [];
  const slots = [];
  const x0 = cx - Math.floor((cx - minX) / boxW) * boxW;
  const y0 = cy - Math.floor((cy - minY) / boxH) * boxH;
  for (let x = x0; x <= maxX + 0.01; x += boxW) {
    if (x < minX - 0.01) continue;
    for (let y = y0; y <= maxY + 0.01; y += boxH) {
      if (y < minY - 0.01) continue;
      slots.push({ x, y });
    }
  }
  return slots;
}

function pageDist(slot, cx, cy) {
  return Math.hypot(slot.x - cx, slot.y - cy);
}

function nearestSlots(slots, origin, count) {
  return slots
    .slice()
    .sort((a, b) => {
      const da = Math.hypot(a.x - origin.x, a.y - origin.y);
      const db = Math.hypot(b.x - origin.x, b.y - origin.y);
      return da - db || a.x - b.x || a.y - b.y;
    })
    .slice(0, count);
}

function hubDirections(hubIds, groups, width, height) {
  const ranked = hubIds
    .map((id, index) => ({ index, count: (groups.get(id) || []).length }))
    .sort((a, b) => b.count - a.count || a.index - b.index);
  if (hubIds.length > 4) {
    const start = -Math.PI / 2;
    const step = (Math.PI * 2) / hubIds.length;
    const directions = new Array(hubIds.length);
    ranked.forEach((item, rank) => {
      const angle = start + rank * step;
      directions[item.index] = { x: Math.cos(angle), y: Math.sin(angle) };
    });
    return directions;
  }
  const cardinals = width >= height
    ? [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }]
    : [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
  const directions = new Array(hubIds.length);
  ranked.forEach((item, rank) => {
    directions[item.index] = cardinals[rank % cardinals.length];
  });
  return directions;
}

function sectorIndex(slot, cx, cy, directions) {
  const angle = Math.atan2(slot.y - cy, slot.x - cx);
  let best = 0;
  let bestAbs = Infinity;
  directions.forEach((dir, index) => {
    const abs = Math.abs(angleDelta(Math.atan2(dir.y, dir.x), angle));
    if (abs < bestAbs - 1e-6) {
      best = index;
      bestAbs = abs;
    }
  });
  return best;
}

function planHubWeb(width, height, sharedCount, hubIds, groups, nodeSize, spacious = false, batchExclusive = false) {
  const { boxW, boxH } = hubBox(nodeSize, spacious);
  const pad = 10;
  const cx = width / 2;
  const cy = height / 2;
  const grid = stageGrid(cx, cy, width, height, boxW, boxH, pad);
  if (grid.length < sharedCount + hubIds.length) return null;
  const sharedSlots = nearestSlots(grid, { x: cx, y: cy }, sharedCount);
  const maxShared = sharedSlots.reduce((max, slot) => Math.max(max, pageDist(slot, cx, cy)), 0);
  const used = new Set(sharedSlots.map((slot) => `${slot.x},${slot.y}`));
  const directions = hubDirections(hubIds, groups, width, height);
  const hubSlots = [];
  for (let index = 0; index < hubIds.length; index += 1) {
    const dir = directions[index];
    const pick = grid
      .filter((slot) => !used.has(`${slot.x},${slot.y}`) && pageDist(slot, cx, cy) > maxShared + 0.5)
      .filter((slot) => sectorIndex(slot, cx, cy, directions) === index)
      .filter((slot) => (slot.x - cx) * dir.x + (slot.y - cy) * dir.y > 0)
      .sort((a, b) => pageDist(a, cx, cy) - pageDist(b, cx, cy) || a.x - b.x || a.y - b.y)[0];
    if (!pick) return null;
    used.add(`${pick.x},${pick.y}`);
    hubSlots.push(pick);
  }
  const exclusiveSlots = [];
  let exclusiveBand = null;
  const sectorDistance = (slot, sector) => {
    const angle = Math.atan2(slot.y - cy, slot.x - cx);
    const hubAngle = Math.atan2(directions[sector].y, directions[sector].x);
    return Math.abs(angleDelta(hubAngle, angle));
  };
  if (batchExclusive) {
    const totalExclusive = hubIds.reduce((sum, id) => sum + (groups.get(id)?.length || 0), 0);
    const band = grid
      .filter((slot) => !used.has(`${slot.x},${slot.y}`))
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .slice(0, totalExclusive);
    if (band.length < totalExclusive) return null;
    band.forEach((slot) => used.add(`${slot.x},${slot.y}`));
    exclusiveBand = band;
  }
  for (let index = 0; index < hubIds.length; index += 1) {
    if (batchExclusive) break;
    const hubSlot = hubSlots[index];
    const dir = directions[index];
    const hubDist = pageDist(hubSlot, cx, cy);
    const needed = (groups.get(hubIds[index]) || []).length;
    const sectorStep = (Math.PI * 2) / Math.max(hubIds.length, 1);
    const sectorSlack = spacious && needed > 20 ? sectorStep * 1.35 : 0;
    let outward;
    if (spacious && needed > 20) {
      outward = grid.filter((slot) => {
        if (used.has(`${slot.x},${slot.y}`)) return false;
        return pageDist(slot, cx, cy) > hubDist + 0.5;
      }).sort((a, b) => a.y - b.y || a.x - b.x);
    } else {
      outward = grid.filter((slot) => {
        if (used.has(`${slot.x},${slot.y}`)) return false;
        if (sectorIndex(slot, cx, cy, directions) !== index) return false;
        if (pageDist(slot, cx, cy) <= hubDist + 0.5) return false;
        return (slot.x - hubSlot.x) * dir.x + (slot.y - hubSlot.y) * dir.y > 0;
      });
    }
    const nearest = spacious && needed > 20
      ? outward.slice(0, needed)
      : nearestSlots(outward, hubSlot, needed);
    if (nearest.length < needed) return null;
    nearest.forEach((slot) => used.add(`${slot.x},${slot.y}`));
    exclusiveSlots.push(nearest);
  }
  return {
    nodeSize,
    boxW,
    boxH,
    width,
    height,
    cx,
    cy,
    sharedSlots,
    hubSlots,
    exclusiveSlots,
    exclusiveBand,
  };
}

function fitHubWeb(width, height, sharedCount, hubIds, groups, spacious = false, batchExclusive = false) {
  const attempt = (nextWidth, nextHeight, minSize) => {
    for (let nodeSize = 56; nodeSize >= minSize; nodeSize -= 2) {
      const plan = planHubWeb(
        nextWidth,
        nextHeight,
        sharedCount,
        hubIds,
        groups,
        nodeSize,
        spacious,
        batchExclusive,
      );
      if (plan) return plan;
    }
    return null;
  };
  const minNode = spacious ? 24 : 28;
  const fitted = attempt(width, height, minNode);
  if (fitted) return fitted;
  const aspect = width / Math.max(height, 1);
  const maxExtra = spacious ? 3600 : 2400;
  for (let extra = 0; extra <= maxExtra; extra += 120) {
    const addH = extra;
    const addW = Math.max(120, Math.round(extra * (spacious ? 0 : 1)));
    const grown = spacious
      ? attempt(width, height + addH, 24)
      : (attempt(width + addW, height + addH, 32));
    if (grown) return grown;
  }
  const side = Math.max(width, height, 1200) + (spacious ? 1200 : 800);
  return attempt(side, side, spacious ? 22 : 26);
}

function placeByBeats(list, slots, counts) {
  const ranked = list
    .slice()
    .sort((a, b) => (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return ranked.map((person, index) => ({ person, slot: slots[index] }));
}

function hubFieldLayout({
  people,
  relations,
  center,
  friendKinds,
  enemyKinds,
  year,
  events,
  width,
  height,
  hubIds,
  minBeats = WEB_MIN_BEATS,
  revealAll = false,
}) {
  const counts = beatCounts(events, people.map((person) => person.id));
  const visible = people.filter((person) => {
    if (hubIds.includes(person.id)) return true;
    return (counts.get(person.id) || 0) >= minBeats;
  });
  const groups = new Map(hubIds.map((id) => [id, []]));
  const shared = [];
  visible.forEach((person) => {
    if (hubIds.includes(person.id)) return;
    const affiliated = hubsForPerson(person.id, relations, hubIds);
    if (affiliated.length === 1) groups.get(affiliated[0])?.push(person);
    else shared.push(person);
  });
  const spacious = hubIds.length >= 5;
  const batchExclusive = spacious && revealAll;
  const plan = fitHubWeb(width, height, shared.length, hubIds, groups, spacious, batchExclusive);
  const nodes = [];
  const focused = Boolean(center && hubIds.includes(center.id));
  const push = (person, slot, extra) => {
    if (!person || !slot) return;
    const camp = focused && person.id === center.id
      ? "center"
      : focused
        ? campOf(person.id, relations, center.id, friendKinds, enemyKinds, year)
        : "orbit";
    nodes.push({
      ...person,
      x: slot.x,
      y: slot.y,
      camp,
      beats: counts.get(person.id) || 0,
      closeness: extra.ring === "shared" ? 1 : extra.ring === "hub" ? 0.7 : 0.3,
      plotHub: extra.ring === "hub",
      ring: extra.ring,
      hubId: extra.hubId || "",
    });
  };
  placeByBeats(shared, plan?.sharedSlots || [], counts).forEach(({ person, slot }) => {
    push(person, slot, { ring: "shared" });
  });
  hubIds.forEach((id, index) => {
    push(visible.find((person) => person.id === id), plan?.hubSlots?.[index], { ring: "hub", hubId: id });
  });
  if (batchExclusive && plan?.exclusiveBand?.length) {
    let slotAt = 0;
    hubIds.forEach((id) => {
      const group = groups.get(id) || [];
      const slots = plan.exclusiveBand.slice(slotAt, slotAt + group.length);
      slotAt += group.length;
      placeByBeats(group, slots, counts).forEach(({ person, slot }) => {
        push(person, slot, { ring: "exclusive", hubId: id });
      });
    });
  } else {
    hubIds.forEach((id, index) => {
      if (!revealAll && (!focused || center.id !== id)) return;
      placeByBeats(groups.get(id) || [], plan?.exclusiveSlots?.[index] || [], counts).forEach(({ person, slot }) => {
        push(person, slot, { ring: "exclusive", hubId: id });
      });
    });
  }
  const nodeSize = plan?.nodeSize || 28;
  const boxW = plan?.boxW || hubBox(nodeSize).boxW;
  const boxH = plan?.boxH || hubBox(nodeSize).boxH;
  const spread = revealAll && hubIds.length >= 5
    ? spreadHubFieldToView(nodes, boxW, boxH, width, height)
    : { width: plan?.width || width, height: plan?.height || height };
  return {
    width: spread.width,
    height: spread.height,
    nodes,
    edges: edgesAmong(nodes, relations),
    nodeSize,
    centerSize: nodeSize,
    boxW,
    boxH,
  };
}

export function hubFrame(nodes, {
  viewWidth = 0,
  viewHeight = 0,
  boxW = 128,
  boxH = 112,
  pad = 28,
  minScale = 0.08,
  maxScale = 2.4,
  preferWidth = false,
} = {}) {
  if (!nodes?.length || viewWidth < 2 || viewHeight < 2) return { scale: 1, x: 0, y: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((node) => {
    minX = Math.min(minX, node.x - boxW / 2);
    maxX = Math.max(maxX, node.x + boxW / 2);
    minY = Math.min(minY, node.y - boxH / 2);
    maxY = Math.max(maxY, node.y + boxH / 2);
  });
  const margin = Math.min(pad, Math.floor(Math.min(viewWidth, viewHeight) * 0.08));
  const roomW = Math.max(1, viewWidth - margin * 2);
  const roomH = Math.max(1, viewHeight - margin * 2);
  const scaleW = roomW / Math.max(1, maxX - minX);
  const scaleH = roomH / Math.max(1, maxY - minY);
  const scale = Math.max(
    minScale,
    Math.min(maxScale, preferWidth ? scaleW : Math.min(scaleW, scaleH)),
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    scale,
    x: viewWidth / 2 - cx * scale,
    y: viewHeight / 2 - cy * scale,
  };
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

/** First calendar year from a beat label (handles ranges like 1942–1964). */
export function parseRelationTimelineYear(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/^(-?\d{1,4})/);
  if (!match) return 0;
  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : 0;
}

export function relationTimelineHasTone(timeline = []) {
  return (timeline || []).some((beat) => typeof beat?.tone === "number");
}

/** Keep only https source chips; plots without `links` stay empty. */
export function httpsSourceLinks(items = []) {
  return (items || []).filter((link) => {
    const url = String(link?.url || "").trim();
    const label = String(link?.label || "").trim();
    return Boolean(label) && /^https:\/\//.test(url);
  });
}

/** Commons FilePath used by country portraits (`Flag_of_Russia.svg`, etc.). */
export function commonsFlagSrc(countryName) {
  const name = String(countryName || "").trim();
  if (!name) return "";
  const file = `Flag_of_${name.replace(/\s+/g, "_")}.svg`;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=480`;
}

/** Portrait flags for the relation-ride rider: partner on the left, plot center on the right. */
export function relationRiderFlags(record, peopleById = new Map(), { centerId = "united-states" } = {}) {
  const partner = peopleById.get(record?.slug);
  const center = peopleById.get(centerId);
  const partnerName = record?.country || partner?.name || "";
  const centerName = center?.name || "United States";
  return {
    partner: {
      slug: record?.slug || "",
      name: partnerName,
      src: String(partner?.portrait?.src || commonsFlagSrc(partnerName)),
    },
    center: {
      slug: centerId || "",
      name: centerName,
      src: String(center?.portrait?.src || commonsFlagSrc(centerName)),
    },
  };
}

export function relationToneSeries(timeline = []) {
  return (timeline || [])
    .map((beat, index) => {
      const year = parseRelationTimelineYear(beat?.year);
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

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

export function relationMoodLabel(tone) {
  if (tone >= 1.25) return "Warm";
  if (tone >= 0.4) return "Friendly";
  if (tone > -0.4) return "Uneasy";
  if (tone > -1.25) return "Strained";
  return "Hostile";
}

// Horizontal ride: beats are evenly spaced so the ups and downs read as a scroll,
// and the path between them is a smooth curve rather than a jagged chart.
export function relationRideLayout(timeline = [], options = {}) {
  const series = relationToneSeries(timeline);
  const step = Math.max(160, Number(options.step) || 280);
  const pathHeight = Math.max(140, Number(options.pathHeight) || 320);
  const padX = Math.max(80, Number(options.padX) || 180);
  const padTop = 36;
  const padBottom = 28;
  const innerH = Math.max(40, pathHeight - padTop - padBottom);
  const width = Math.round(padX * 2 + Math.max(0, series.length - 1) * step);
  const yAt = (tone) => padTop + innerH / 2 - (tone / 2) * (innerH / 2);
  const placed = series.map((point, index) => ({
    ...point,
    x: padX + index * step,
    y: yAt(point.tone),
  }));
  const samples = [];
  if (placed.length === 1) {
    samples.push({ x: placed[0].x, y: placed[0].y, tone: placed[0].tone });
  } else if (placed.length > 1) {
    for (let index = 0; index < placed.length - 1; index += 1) {
      const p0 = placed[Math.max(0, index - 1)];
      const p1 = placed[index];
      const p2 = placed[index + 1];
      const p3 = placed[Math.min(placed.length - 1, index + 2)];
      const pieces = 28;
      for (let stepIndex = 0; stepIndex < pieces; stepIndex += 1) {
        const t = stepIndex / pieces;
        const tone = catmull(p0.tone, p1.tone, p2.tone, p3.tone, t);
        samples.push({
          x: catmull(p0.x, p1.x, p2.x, p3.x, t),
          y: Math.min(pathHeight - 8, Math.max(8, yAt(tone))),
          tone,
        });
      }
    }
    const last = placed.at(-1);
    samples.push({ x: last.x, y: last.y, tone: last.tone });
  }
  const path = samples.map((sample, index) => `${index ? "L" : "M"} ${sample.x.toFixed(1)} ${sample.y.toFixed(1)}`).join(" ");
  return {
    width,
    pathHeight,
    padX,
    zeroY: yAt(0),
    points: placed,
    samples,
    path,
    step,
  };
}

// The ride selects whichever beat is under the center of the scroller.
// Pad at least half the viewport so the first and last beats can reach that center.
export function relationRideLayoutForViewport(timeline = [], clientWidth = 0, options = {}) {
  const minimum = Math.max(80, Number(options.padX) || 180);
  const half = Math.ceil(Math.max(0, Number(clientWidth) || 0) / 2);
  return relationRideLayout(timeline, { ...options, padX: Math.max(minimum, half) });
}

export function relationRideAt(layout, x) {
  const samples = layout?.samples || [];
  if (!samples.length) return { x: 0, y: 0, tone: 0 };
  if (x <= samples[0].x) return { ...samples[0] };
  const last = samples.at(-1);
  if (x >= last.x) return { ...last };
  let low = 0;
  let high = samples.length - 1;
  while (low < high - 1) {
    const mid = (low + high) >> 1;
    if (samples[mid].x < x) low = mid;
    else high = mid;
  }
  const from = samples[low];
  const to = samples[high];
  const span = to.x - from.x || 1;
  const t = (x - from.x) / span;
  return {
    x,
    y: from.y + (to.y - from.y) * t,
    tone: from.tone + (to.tone - from.tone) * t,
  };
}

export function warActive(war, year) {
  return warOverlapsSpan(war, year, year);
}

function finiteYear(value) {
  if (value == null || value === "") return NaN;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

export function parseWarSpan(valueFrom, valueTo, range, fallbackYear) {
  const min = Number(range.min);
  const max = Number(range.max);
  const year = finiteYear(fallbackYear);
  const initial = Number.isFinite(year) ? year : (range.initial == null ? max : Number(range.initial));
  let from = finiteYear(valueFrom);
  let to = finiteYear(valueTo);
  if (!Number.isFinite(from)) from = initial;
  if (!Number.isFinite(to)) to = from;
  from = Math.min(max, Math.max(min, Math.round(from)));
  to = Math.min(max, Math.max(min, Math.round(to)));
  if (from > to) return { from: to, to: from };
  return { from, to };
}

export function warOverlapsSpan(war, from, to) {
  const start = Number(from);
  const end = Number(to);
  if (!war || !Number.isFinite(start) || !Number.isFinite(end)) return false;
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  if (Number(war.start) > hi) return false;
  if (war.end == null || war.end === "") return true;
  return Number(war.end) >= lo;
}

export function warsForCountry(wars, iso) {
  return (wars || []).filter((war) =>
    (war.sides || []).some((side) => (side.states || []).includes(iso)));
}

export function compareWarsByStart(a, b) {
  const start = Number(b.start) - Number(a.start);
  if (start) return start;
  return String(a.name || "").localeCompare(String(b.name || ""), "en");
}

export function warCountryNote(war, iso, countryNames = {}) {
  const nameOf = (id) => countryNames[id]?.name || id;
  const sides = war?.sides || [];
  const others = sides.filter((side) => !(side.states || []).includes(iso));
  const opponents = [];
  others.forEach((side) => {
    (side.states || []).forEach((id) => {
      if (!opponents.includes(nameOf(id))) opponents.push(nameOf(id));
    });
    (side.groups || []).slice(0, 3).forEach((group) => {
      if (!opponents.includes(group)) opponents.push(group);
    });
  });
  if (opponents.length) {
    const shown = opponents.slice(0, 4).join(", ");
    return opponents.length > 4 ? `Against ${shown}, and ${opponents.length - 4} more` : `Against ${shown}`;
  }
  const allies = [...new Set(sides.flatMap((side) => (side.states || []).filter((id) => id !== iso)))].map(nameOf);
  if (allies.length) {
    const shown = allies.slice(0, 3).join(", ");
    return allies.length > 3 ? `With ${shown}, and ${allies.length - 3} more` : `With ${shown}`;
  }
  const groups = [...new Set(others.flatMap((side) => side.groups || []))].slice(0, 3);
  if (groups.length) return `Inside the country · ${groups.join(", ")}`;
  return "Inside the country";
}

export function exclusiveWarSides(war) {
  const counts = new Map();
  (war?.sides || []).forEach((side) => {
    (side.states || []).forEach((iso) => counts.set(iso, (counts.get(iso) || 0) + 1));
  });
  return (war?.sides || []).map((side) => ({
    states: (side.states || []).filter((iso) => counts.get(iso) === 1),
    groups: side.groups || [],
  }));
}

export function opposingPairs(war) {
  const sides = exclusiveWarSides(war).map((side) => side.states);
  const pairs = [];
  const seen = new Set();
  for (let i = 0; i < sides.length; i += 1) {
    for (let j = i + 1; j < sides.length; j += 1) {
      sides[i].forEach((left) => {
        sides[j].forEach((right) => {
          if (!left || !right || left === right) return;
          const key = left < right ? `${left}|${right}` : `${right}|${left}`;
          if (seen.has(key)) return;
          seen.add(key);
          pairs.push(left < right ? [left, right] : [right, left]);
        });
      });
    }
  }
  return pairs;
}

export function warsInSpan(conflicts, from, to) {
  const active = (conflicts || []).filter((war) => warOverlapsSpan(war, from, to));
  const pairMap = new Map();
  const countryIds = new Set();
  active.forEach((war) => {
    (war.sides || []).forEach((side) => {
      (side.states || []).forEach((iso) => countryIds.add(iso));
    });
    opposingPairs(war).forEach(([left, right]) => {
      const key = `${left}|${right}`;
      if (!pairMap.has(key)) pairMap.set(key, { a: left, b: right, warIds: [] });
      pairMap.get(key).warIds.push(war.id);
    });
  });
  return {
    wars: active,
    pairs: [...pairMap.values()],
    countries: [...countryIds],
  };
}

export function warsInYear(conflicts, year) {
  return warsInSpan(conflicts, year, year);
}

export function warPartyLine(war, countryNames = {}) {
  const nameOf = (iso) => countryNames[iso]?.name || iso;
  const pairs = opposingPairs(war);
  const sides = exclusiveWarSides(war);
  const labelSide = (side) => {
    const parts = [...side.states.map(nameOf), ...(side.groups || []).slice(0, 3)];
    if (!parts.length) return "";
    if (parts.length <= 4) return parts.join(", ");
    return `${parts.slice(0, 3).join(", ")} and ${parts.length - 3} more`;
  };
  if (pairs.length) return sides.map(labelSide).filter(Boolean).join(" against ");
  const states = [...new Set((war.sides || []).flatMap((side) => side.states || []))].map(nameOf);
  const groups = [...new Set((war.sides || []).flatMap((side) => side.groups || []))].slice(0, 3);
  if (states.length === 1) {
    return groups.length ? `Inside ${states[0]} · ${groups.join(", ")}` : `Inside ${states[0]}`;
  }
  if (states.length) return groups.length ? `${states.join(", ")} · ${groups.join(", ")}` : states.join(", ");
  if (groups.length) return groups.join(", ");
  return "Parties are listed on the Wikipedia article";
}

export function warMatchesFocus(war, focus) {
  if (!focus || !war) return false;
  if (focus.startsWith("country:")) {
    const iso = focus.slice("country:".length);
    return (war.sides || []).some((side) => (side.states || []).includes(iso));
  }
  return war.id === focus;
}

const WAR_CAPITALS = {
  AE: [54.37, 24.47], AF: [69.17, 34.53], AM: [44.51, 40.18], AO: [13.23, -8.84],
  AU: [149.13, -35.28], AZ: [49.87, 40.41], BD: [90.41, 23.81], BF: [-1.53, 12.37],
  BH: [50.58, 26.23], BJ: [2.63, 6.5], BW: [25.91, -24.65], BY: [27.57, 53.9],
  CA: [-75.7, 45.42], CD: [15.31, -4.32], CF: [18.56, 4.36], CG: [15.27, -4.27],
  CI: [-5.36, 6.83], CM: [11.52, 3.87], CN: [116.41, 39.9], CO: [-74.07, 4.71],
  DJ: [43.15, 11.59], DK: [12.57, 55.68], DZ: [3.06, 36.75], EG: [31.24, 30.04],
  EH: [-13.2, 27.15], ER: [38.93, 15.34], ET: [38.75, 9.03], FI: [24.94, 60.17],
  FR: [2.35, 48.86], GB: [-0.13, 51.51], GE: [44.83, 41.69], GH: [-0.19, 5.56],
  HT: [-72.33, 18.54], IL: [35.22, 31.77], IN: [77.21, 28.61], IQ: [44.37, 33.31],
  IR: [51.39, 35.69], IT: [12.5, 41.9], JM: [-76.79, 18.02], JO: [35.93, 31.95],
  KE: [36.82, -1.29], KG: [74.59, 42.87], KH: [104.93, 11.56], KM: [43.26, -11.7],
  KP: [125.76, 39.04], KW: [47.98, 29.38], LB: [35.5, 33.89], LK: [79.86, 6.93],
  LS: [27.48, -29.31], LY: [13.18, 32.89], MA: [-6.85, 34.02], ML: [-8.0, 12.65],
  MM: [96.16, 16.84], MR: [-15.98, 18.07], MW: [33.77, -13.96], MY: [101.69, 3.14],
  MZ: [32.57, -25.97], NA: [17.08, -22.56], NE: [2.11, 13.51], NG: [7.49, 9.06],
  NL: [4.9, 52.37], NZ: [174.78, -41.29], OM: [58.41, 23.59], PH: [120.98, 14.6],
  PK: [73.05, 33.69], PL: [21.01, 52.23], PS: [35.2, 31.9], PT: [-9.14, 38.72],
  PY: [-57.58, -25.26], QA: [51.53, 25.29], RS: [20.46, 44.79], RU: [37.62, 55.75],
  RW: [30.06, -1.94], SA: [46.72, 24.71], SD: [32.56, 15.5], SN: [-17.47, 14.72],
  SO: [45.32, 2.05], SS: [31.58, 4.85], SY: [36.28, 33.51], TD: [15.04, 12.13],
  TG: [1.22, 6.14], TH: [100.5, 13.76], TJ: [68.77, 38.56], TL: [125.58, -8.56],
  TN: [10.18, 36.81], TR: [32.86, 39.93], TZ: [35.75, -6.16], UA: [30.52, 50.45],
  UG: [32.58, 0.35], US: [-77.04, 38.91], UZ: [69.24, 41.3], VE: [-66.9, 10.48],
  XK: [21.17, 42.67], YE: [44.21, 15.35], ZA: [28.19, -25.75], ZM: [28.28, -15.39],
  BN: [114.94, 4.89], LU: [6.13, 49.61], MC: [7.42, 43.73], PG: [147.18, -9.48],
  SB: [159.95, -9.43], SG: [103.85, 1.29], VU: [168.32, -17.73],
};

export const WAR_MAP = { west: -180, east: 180, south: -58, north: 84 };

export function warMapSize(frame = WAR_MAP) {
  const width = 960;
  const height = width * ((frame.north - frame.south) / (frame.east - frame.west));
  return { width, height };
}

export function projectWarPoint(lon, lat, frame = WAR_MAP) {
  const { width, height } = warMapSize(frame);
  return {
    x: ((lon - frame.west) / (frame.east - frame.west)) * width,
    y: ((frame.north - lat) / (frame.north - frame.south)) * height,
    width,
    height,
  };
}

function ringBounds(ring) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  (ring || []).forEach(([lon, lat]) => {
    if (lon < minX) minX = lon;
    if (lat < minY) minY = lat;
    if (lon > maxX) maxX = lon;
    if (lat > maxY) maxY = lat;
  });
  if (!Number.isFinite(minX)) return null;
  return { lon: (minX + maxX) / 2, lat: (minY + maxY) / 2, area: Math.abs((maxX - minX) * (maxY - minY)) };
}

function largestRingCenter(geometry) {
  const rings = [];
  if (geometry?.type === "Polygon") rings.push(geometry.coordinates[0]);
  else if (geometry?.type === "MultiPolygon") geometry.coordinates.forEach((poly) => rings.push(poly[0]));
  let best = null;
  rings.forEach((ring) => {
    const bounds = ringBounds(ring);
    if (!bounds) return;
    if (!best || bounds.area > best.area) best = bounds;
  });
  return best ? { lon: best.lon, lat: best.lat } : null;
}

export function countryAnchors(featureCollection) {
  const anchors = new Map();
  (featureCollection?.features || []).forEach((feature) => {
    const iso = feature.properties?.iso;
    const center = largestRingCenter(feature.geometry);
    if (!iso || !center) return;
    anchors.set(iso, { iso, name: feature.properties.name, ...center });
  });
  Object.entries(WAR_CAPITALS).forEach(([iso, [lon, lat]]) => {
    const current = anchors.get(iso);
    anchors.set(iso, { iso, name: current?.name || iso, lon, lat });
  });
  return anchors;
}

export function geometryOutline(geometry, project) {
  const commands = [];
  const pushRing = (ring) => {
    if (!ring?.length) return;
    const drawn = ring.map(([lon, lat], index) => {
      const point = project(lon, lat);
      return `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    });
    commands.push(`${drawn.join(" ")} Z`);
  };
  if (geometry?.type === "Polygon") pushRing(geometry.coordinates[0]);
  else if (geometry?.type === "MultiPolygon") geometry.coordinates.forEach((poly) => pushRing(poly[0]));
  return commands.join(" ");
}

export function warArcPath(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  let px = -dy / len;
  let py = dx / len;
  if (py > 0) {
    px = -px;
    py = -py;
  }
  const bow = Math.max(18, Math.min(78, len * 0.2));
  const cx = (x1 + x2) / 2 + px * bow;
  const cy = (y1 + y2) / 2 + py * bow;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

export function spreadWarDots(points, minDist = 14) {
  const placed = points.map((point) => ({ ...point }));
  for (let pass = 0; pass < 8; pass += 1) {
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const left = placed[i];
        const right = placed[j];
        let dx = right.x - left.x;
        let dy = right.y - left.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= minDist) continue;
        if (dist < 0.01) {
          dx = 1;
          dy = 0;
          dist = 1;
        }
        const push = (minDist - dist) / 2;
        const ux = dx / dist;
        const uy = dy / dist;
        left.x -= ux * push;
        left.y -= uy * push;
        right.x += ux * push;
        right.y += uy * push;
      }
    }
  }
  return placed;
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
