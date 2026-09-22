import { claimsRing, regions } from "./partition-geography.js";

const REGION_IDS = regions.map((region) => region.id);

/** Month keys (YYYYMM) and day keys (YYYYMMDD) share one order. */
export function chronoKey(sortKey) {
  const text = String(sortKey);
  if (text.length <= 6) return Number(text) * 100;
  return Number(text);
}

export const FILL_LABEL = {
  raj: "British province",
  princely: "Princely state — not yet acceded",
  india: "India",
  pakistan: "Pakistan",
  eastpak: "East Pakistan",
  bangladesh: "Bangladesh",
  neighbor: "Outside British India",
  "bengal-a": "Western Bengal, 1905 partition",
  "bengal-b": "Eastern Bengal and Assam, 1905 partition",
  pending: "Border not yet published",
};

export function sourceRecords(catalog, ids = []) {
  return (ids || []).map((id) => catalog?.[id]).filter(Boolean);
}

const NA_RE = /^(n\/a|na|none|—|-)$/i;

export const POSITION_LABELS = {
  unitedIndia: "United India",
  pakistanOrMuslimState: "Pakistan or a Muslim state",
  populationExchange: "Population exchange",
  punjabAndBengalDivision: "Punjab and Bengal",
  twoNationTheory: "Two-nation theory",
};

export function playerDisplayName(person) {
  const name = String(person?.name || "").trim();
  const comma = name.indexOf(",");
  if (comma > 8) return name.slice(0, comma).trim();
  return name;
}

export function playerAllegiance(person) {
  const faction = String(person?.faction || "").trim();
  const nationality = String(person?.nationality?.primary || "").trim();
  const community = String(person?.nationality?.ethnicOrRegionalIdentity || "").trim();
  const parts = [faction, nationality, community].filter(Boolean);
  return {
    faction: faction || "Unaligned in this record",
    nationality,
    community,
    line: parts.join(" · ") || "Unaligned in this record",
  };
}

export function playerIncentives(person) {
  const wanted = (person?.desiresAndGoals || []).map((item) => String(item).trim()).filter(Boolean);
  const opposed = (person?.fearsAndOppositions || []).map((item) => String(item).trim()).filter(Boolean);
  return {
    wanted,
    opposed,
    line: wanted[0] || opposed[0] || person?.pointOfView || "",
  };
}

const PARTITION_DECISION_MAKER_IDS = ["mountbatten", "patel", "nehru", "jinnah", "radcliffe", "tara"];

export function decisionMakers(reference, players) {
  const causalChain = reference?.rolesDelineationAndLegacyToPresent?.causalChain || [];
  const settlementStep = causalChain.find((step) => step.period === "June–Aug 1947");
  if (!settlementStep) return [];
  const available = players instanceof Map
    ? new Set(players.keys())
    : new Set((players || []).map((player) => player?.id).filter(Boolean));
  return PARTITION_DECISION_MAKER_IDS.filter((id) => available.has(id));
}

export function statedPositions(person) {
  const positions = person?.positions || {};
  return Object.entries(POSITION_LABELS)
    .map(([key, label]) => {
      const value = String(positions[key] || "").trim();
      return { key, label, value };
    })
    .filter((row) => row.value && !NA_RE.test(row.value.replace(/\s*\(.*\)\s*$/, "").trim()));
}

export function factionCamp(person) {
  const raw = String(person?.faction || "").toLowerCase();
  if (/congress/.test(raw)) return "congress";
  if (/muslim league|krishak praja/.test(raw)) return "muslim-league";
  if (/british|raj|labour|uk /.test(raw)) return "british";
  if (/scheduled|depressed|ambedkar/.test(raw)) return "scheduled-castes";
  if (/akhali|sikh/.test(raw)) return "sikh";
  if (/hindu mahasabha|rss|hindu/.test(raw) && !/congress/.test(raw)) return "hindu-right";
  return raw.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "";
}

export function stancePolarity(value) {
  const text = String(value || "").toLowerCase();
  if (!text || NA_RE.test(text.replace(/\s*\(.*\)\s*$/, "").trim())) return "";
  const no = /\b(reject|opposed|against|never|refused|lost cause|impossible|overruled)\b/.test(text);
  const yes = /\b(accept|support|prefer|preferred|wanted|favoured|favored|chose|implement)\b/.test(text);
  if (no && yes) return "mixed";
  if (no) return "no";
  if (yes) return "yes";
  return "note";
}

export function playerAgreements(person, players = []) {
  const selfId = person?.id;
  const camp = factionCamp(person);
  const mine = statedPositions(person);
  return players
    .filter((other) => other?.id && other.id !== selfId)
    .map((other) => {
      const reasons = [];
      if (camp && factionCamp(other) === camp) {
        reasons.push(other.faction || person.faction || "Same camp");
      }
      const shared = [];
      mine.forEach((row) => {
        const theirs = statedPositions(other).find((item) => item.key === row.key);
        if (!theirs) return;
        const a = stancePolarity(row.value);
        const b = stancePolarity(theirs.value);
        if (a && b && a === b && a !== "mixed" && a !== "note") shared.push(row.label);
      });
      if (shared.length) reasons.push(shared.join(" · "));
      return {
        id: other.id,
        name: playerDisplayName(other),
        fullName: other.name,
        faction: other.faction || "",
        reasons,
        score: (camp && factionCamp(other) === camp ? 2 : 0) + shared.length,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "en"));
}

export function eventCast(event, players, focusId = "") {
  const actions = new Map((event?.actions || []).map((action) => [action.playerId, action.description]));
  const ids = [...new Set([...(event?.playerIds || []), ...actions.keys()])];
  return ids.map((id) => {
    const person = players.get(id);
    const incentives = playerIncentives(person);
    return {
      id,
      name: playerDisplayName(person) || id,
      fullName: person?.name || id,
      focus: id === focusId,
      allegiance: playerAllegiance(person),
      incentive: incentives.line,
      wanted: incentives.wanted,
      opposed: incentives.opposed,
      action: actions.get(id) || "",
    };
  });
}

function baseFills() {
  const fills = {};
  REGION_IDS.forEach((id) => {
    fills[id] = "raj";
  });
  ["nepal", "bhutan"].forEach((id) => {
    fills[id] = "neighbor";
  });
  [
    "kalat",
    "kashmir-pak",
    "kashmir-ind",
    "bahawalpur",
    "rajasthan",
    "bhopal",
    "hyderabad",
    "mysore",
    "travancore",
  ].forEach((id) => {
    fills[id] = "princely";
  });
  return fills;
}

function baseVisual() {
  return {
    fills: baseFills(),
    seams: { bengal: "off", punjab: "off", kashmir: "off", sylhet: "off" },
    flows: [],
    markers: [],
    emphasis: [],
    camera: "all",
    claims: false,
  };
}

function applyVisual(current, delta = {}) {
  const next = {
    fills: { ...current.fills, ...(delta.fills || {}) },
    seams: { ...current.seams, ...(delta.seams || {}) },
    flows: Object.prototype.hasOwnProperty.call(delta, "flows") ? delta.flows.slice() : current.flows.slice(),
    markers: delta.markers ? delta.markers.slice() : [],
    emphasis: delta.emphasis ? delta.emphasis.slice() : [],
    camera: "all",
    claims: current.claims,
  };
  return next;
}

const MIGRATION = ["punjab-westward", "punjab-eastward", "bengal-westward", "bengal-eastward", "meo"];

function eventStory(event) {
  return {
    id: event.id,
    sortKey: event.sortKey,
    kind: "research",
    dateDisplay: event.dateDisplay,
    title: event.title,
    summary: event.summary,
    consequences: event.consequences || [],
    actions: event.actions || [],
    playerIds: event.playerIds || [],
    sourceIds: event.sourceIds || [],
    princelyIds: [],
    extras: [],
  };
}

function aftermathStory(spec) {
  return {
    id: spec.id,
    sortKey: spec.sortKey,
    kind: "aftermath",
    dateDisplay: spec.dateDisplay,
    title: spec.title,
    summary: spec.summary,
    consequences: spec.consequences || [],
    actions: [],
    playerIds: spec.playerIds || [],
    sourceIds: spec.sourceIds || [],
    princelyIds: spec.princelyIds || [],
    extras: spec.extras || [],
  };
}

function princelyLine(reference, id) {
  const entry = reference.princelyStateActors.find((item) => item.id === id);
  if (!entry) return "";
  return `${entry.stateName} — ${entry.rulerName}. ${entry.oneLineRole} Outcome: ${entry.accessionOutcome} (${entry.accessionDateApprox}).`;
}

export function buildFrames(reference) {
  const events = [...reference.timeline].sort((a, b) => chronoKey(a.sortKey) - chronoKey(b.sortKey) || a.id.localeCompare(b.id));
  const byId = new Map(events.map((event) => [event.id, event]));
  const legacy = reference.rolesDelineationAndLegacyToPresent;
  const bangladesh = legacy.ongoingIssuesLinkedTo1947.find((issue) => issue.issue.startsWith("Bangladesh"));
  const presentIssues = legacy.ongoingIssuesLinkedTo1947;
  const misconceptions = legacy.attributionGuide.commonMisconceptions;

  const steps = events.map((event) => ({ story: eventStory(event), delta: {} }));
  const deltaAt = (id) => steps.find((step) => step.story.id === id);

  deltaAt("evt-1905-bengal").delta = {
    camera: "bengal",
    seams: { bengal: "set" },
    fills: { "bengal-west": "bengal-a", "bengal-east": "bengal-b", sylhet: "bengal-b", assam: "bengal-b" },
    emphasis: ["bengal-west", "bengal-east", "assam", "sylhet"],
  };
  deltaAt("evt-1906-league").delta = { camera: "bengal", markers: ["dacca"] };
  deltaAt("evt-1911-bengal-reunite").delta = {
    camera: "bengal",
    seams: { bengal: "off" },
    fills: { "bengal-west": "raj", "bengal-east": "raj", sylhet: "raj", assam: "raj" },
  };
  deltaAt("evt-1937-elections").delta = {
    emphasis: ["punjab-west", "punjab-east", "bengal-west", "bengal-east"],
    camera: "all",
  };
  deltaAt("evt-1940-lahore").delta = { markers: ["lahore"], camera: "punjab" };
  deltaAt("evt-1946-direct-action").delta = {
    markers: ["calcutta", "noakhali", "rawalpindi", "patna"],
    camera: "all",
  };
  deltaAt("evt-1947-tara-lahore").delta = { markers: ["lahore"], camera: "punjab" };
  deltaAt("evt-1947-june-plan").delta = {
    camera: "all",
    seams: { punjab: "proposed", bengal: "proposed", sylhet: "proposed" },
    fills: {
      "punjab-west": "pending",
      "punjab-east": "pending",
      "bengal-west": "pending",
      "bengal-east": "pending",
      sylhet: "pending",
    },
    emphasis: ["punjab-west", "punjab-east", "bengal-west", "bengal-east", "sylhet"],
  };
  deltaAt("evt-1947-independence-act").delta = {
    seams: { sylhet: "set" },
    fills: { sylhet: "eastpak" },
    emphasis: ["sylhet", "nwfp"],
  };
  deltaAt("evt-1947-pakistan-indep").delta = {
    markers: ["karachi"],
    fills: { nwfp: "pakistan", sindh: "pakistan", "baloch-british": "pakistan" },
    emphasis: ["nwfp", "sindh", "baloch-british"],
  };
  deltaAt("evt-1947-pakistan-indep").story.princelyIds = ["ps-khairpur"];
  deltaAt("evt-1947-india-indep").delta = {
    markers: ["delhi"],
    fills: {
      gujarat: "india",
      maharashtra: "india",
      madras: "india",
      central: "india",
      up: "india",
      bihar: "india",
      orissa: "india",
      assam: "india",
      rajasthan: "india",
      mysore: "india",
      travancore: "india",
    },
  };
  deltaAt("evt-1947-india-indep").story.princelyIds = ["ps-mysore", "ps-travancore", "ps-bikaner"];
  deltaAt("evt-1947-radcliffe-published").delta = {
    camera: "all",
    seams: { punjab: "set", bengal: "set" },
    fills: {
      "punjab-west": "pakistan",
      "punjab-east": "india",
      "bengal-west": "india",
      "bengal-east": "eastpak",
    },
    flows: MIGRATION,
    markers: ["lahore", "calcutta"],
    emphasis: ["punjab-west", "punjab-east", "bengal-west", "bengal-east"],
  };
  deltaAt("evt-1947-radcliffe-published").story.princelyIds = ["ps-patiala", "ps-faridkot", "ps-alwar", "ps-bharatpur", "ps-malerkotla"];
  deltaAt("evt-1948-gandhi-fast").delta = { markers: ["delhi"], camera: "all" };

  const aftermath = [
    aftermathStory({
      id: "frame-junagadh-announce",
      sortKey: 19470915,
      dateDisplay: "September 1947",
      title: "Junagadh announces accession to Pakistan",
      summary: "Muhammad Mahabat Khanji III announced Junagadh’s accession to Pakistan in September 1947. The state had a Hindu-majority population and a geographic link to India. The research records that choice as a preview of the accession disputes.",
      princelyIds: ["ps-junagadh"],
      playerIds: ["patel", "vp-menon", "mountbatten"],
      sourceIds: byId.get("evt-1947-independence-act") ? ["junagadh", "politicalIntegration", "partitionWiki"] : ["junagadh"],
    }),
    aftermathStory({
      id: "frame-kashmir",
      sortKey: 19471026,
      dateDisplay: "October 1947",
      title: "Kashmir accedes; Bahawalpur joins Pakistan",
      summary: `${princelyLine(reference, "ps-kashmir-hari")} ${princelyLine(reference, "ps-bahawalpur")}`,
      consequences: [
        "Colors show who administers the former princely state after the 1947 war.",
        "The claim overlay, when turned on, marks the whole state without replacing those administered areas.",
      ],
      princelyIds: ["ps-kashmir-hari", "ps-bahawalpur"],
      playerIds: ["hari", "patel", "vp-menon", "mountbatten"],
      sourceIds: ["kashmirConflict", "jammu1947", "politicalIntegration", "partitionWiki"],
    }),
    aftermathStory({
      id: "frame-junagadh-vote",
      sortKey: 19471109,
      dateDisplay: "November 1947",
      title: "Junagadh plebiscite joins India",
      summary: "The September accession to Pakistan was reversed after a blockade and a plebiscite that the research records as overwhelmingly for India.",
      princelyIds: ["ps-junagadh"],
      playerIds: ["patel", "vp-menon"],
      sourceIds: ["junagadh", "politicalIntegration"],
    }),
    aftermathStory({
      id: "frame-kalat",
      sortKey: 19480327,
      dateDisplay: "March 1948",
      title: "Kalat is incorporated into Pakistan",
      summary: princelyLine(reference, "ps-kalat"),
      princelyIds: ["ps-kalat", "ps-khairpur"],
      playerIds: [],
      sourceIds: ["politicalIntegration", "princelyStatesList"],
    }),
    aftermathStory({
      id: "frame-hyderabad",
      sortKey: 19480917,
      dateDisplay: "September 1948",
      title: "Hyderabad is integrated; Bhopal accedes",
      summary: `${princelyLine(reference, "ps-hyderabad-nizam")} ${princelyLine(reference, "ps-bhopal")}`,
      princelyIds: ["ps-hyderabad-nizam", "ps-bhopal", "ps-patel-menon-integration"],
      playerIds: ["patel", "vp-menon"],
      sourceIds: ["hyderabad1948", "politicalIntegration", "menonBook"],
    }),
    aftermathStory({
      id: "frame-bangladesh",
      sortKey: 19711216,
      dateDisplay: "1971",
      title: "East Pakistan becomes Bangladesh",
      summary: bangladesh
        ? `${bangladesh.issue}. ${bangladesh.roots.join(" ")} ${bangladesh.mainAuthorContribution}. ${bangladesh.princelyContribution}.`
        : legacy.todayMapExplained.modernBangladesh.territoryFrom[0],
      consequences: legacy.todayMapExplained.modernBangladesh.key1947Choices,
      sourceIds: ["bangladesh1971", "partitionBengal1947", "partitionWiki"],
      extras: [{ heading: "Not a princely decision", body: legacy.attributionGuide.commonMisconceptions.find((item) => item.wrong.includes("Bangladesh"))?.correct || "" }],
    }),
    aftermathStory({
      id: "frame-present",
      sortKey: 20260101,
      dateDisplay: "Today",
      title: "The map those decisions left",
      summary: legacy.summary,
      consequences: presentIssues.map((issue) => issue.issue),
      sourceIds: ["partitionWiki", "indoPakRelations", "kashmirConflict", "bangladesh1971"],
      extras: [
        { heading: "India", body: legacy.todayMapExplained.modernIndia.territoryFrom.join(" ") },
        { heading: "Pakistan", body: legacy.todayMapExplained.modernPakistan.territoryFrom.join(" ") },
        { heading: "Bangladesh", body: legacy.todayMapExplained.modernBangladesh.territoryFrom.join(" ") },
        ...legacy.todayMapExplained.disputedOrAnomalous.map((item) => ({
          heading: item.issue,
          body: `${item.origin1947}. Today: ${item.today}.`,
        })),
        ...misconceptions.map((item) => ({ heading: "Often misread", body: item.correct })),
      ],
    }),
  ];

  const aftermathDelta = {
    "frame-junagadh-announce": { camera: "kathiawar", markers: ["junagadh"] },
    "frame-kashmir": {
      camera: "kashmir",
      markers: ["srinagar"],
      seams: { kashmir: "set" },
      fills: { "kashmir-ind": "india", "kashmir-pak": "pakistan", bahawalpur: "pakistan" },
      emphasis: ["kashmir-ind", "kashmir-pak", "bahawalpur"],
    },
    "frame-junagadh-vote": { camera: "kathiawar", markers: ["junagadh"] },
    "frame-kalat": {
      camera: "baloch",
      fills: { kalat: "pakistan" },
      emphasis: ["kalat"],
    },
    "frame-hyderabad": {
      camera: "deccan",
      markers: ["hyderabad"],
      fills: { hyderabad: "india", bhopal: "india" },
      flows: [],
      emphasis: ["hyderabad", "bhopal"],
    },
    "frame-bangladesh": {
      camera: "bengal",
      fills: { "bengal-east": "bangladesh" },
      emphasis: ["bengal-east"],
      markers: ["dacca"],
    },
    "frame-present": { camera: "all", emphasis: ["kashmir-ind", "kashmir-pak", "bengal-east"] },
  };

  const combined = [
    ...steps,
    ...aftermath.map((story) => ({ story, delta: aftermathDelta[story.id] || {} })),
  ].sort((a, b) => chronoKey(a.story.sortKey) - chronoKey(b.story.sortKey) || a.story.id.localeCompare(b.story.id));

  let visual = baseVisual();
  return combined.map((step) => {
    visual = applyVisual(visual, step.delta);
    return { ...step.story, visual: {
      fills: { ...visual.fills },
      seams: { ...visual.seams },
      flows: visual.flows.slice(),
      markers: visual.markers.slice(),
      emphasis: visual.emphasis.slice(),
      camera: visual.camera,
    } };
  });
}

export function regionCaption(regionId, frame) {
  const region = regions.find((item) => item.id === regionId);
  const fill = frame?.visual?.fills?.[regionId];
  if (!region || !fill) return "";
  return `${region.name}. ${FILL_LABEL[fill] || fill}.`;
}

export function kashmirClaimsNote(frame) {
  const split = frame?.visual?.fills?.["kashmir-ind"] === "india";
  if (!split) {
    return "Kashmir is still one princely state on this frame. Administered areas appear after the October 1947 accession.";
  }
  return "Colors show who administers the former princely state. The dashed claim line is the optional overlay; it does not replace those areas.";
}

export { claimsRing, REGION_IDS };
