import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildFrames,
  chronoKey,
  eventCast,
  playerAllegiance,
  decisionMakers,
  playerDisplayName,
  playerIncentives,
  playerAgreements,
  sourceRecords,
  statedPositions,
} from "../partition-model.js";
import { flows, markers, outlines, regions, seams } from "../partition-geography.js";
import {
  ALL,
  campOf,
  countriesByRegion,
  coversYear,
  eventTease,
  expandedSummary,
  filterEvents,
  findPlot,
  plotCardFace,
  plotMatchesQuery,
  firstLoadCountries,
  graphLayout,
  groupCountriesByStatus,
  hubCenterId,
  hubFrame,
  hubOf,
  hubsForPerson,
  WEB_MIN_BEATS,
  RELATION_BLOCS,
  relationsFieldEdges,
  relationsFieldLayout,
  initials,
  laneBands,
  outlineFor,
  parseState,
  parseYear,
  requestedView,
  defaultPlotView,
  resolvePlotView,
  relationEvents,
  parseRelationTimelineYear,
  relationMoodLabel,
  relationRideAt,
  relationRideLayout,
  relationSentimentChart,
  relationTimelineHasTone,
  relationToneSeries,
  commonsFlagSrc,
  httpsSourceLinks,
  relationRiderFlags,
  RELATION_REGIONS,
  stateUrl,
  stanceHistory,
  neighborhood,
  visibleRelationCountries,
  webLayout,
  youtubeId,
  usesPolicyPanel,
  boardViewForPerson,
  COMPACT_MAX_WIDTH,
  warActive,
  warOverlapsSpan,
  parseWarSpan,
  warsInSpan,
  warsForCountry,
  compareWarsByStart,
  warCountryNote,
  opposingPairs,
  warsInYear,
  warPartyLine,
  warMatchesFocus,
  projectWarPoint,
  warMapSize,
  countryAnchors,
} from "../engine.js";

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const plots = readJson("../data/plots.json");
const people = readJson("../data/youtubers/people.json");
const events = readJson("../data/youtubers/events.json");
const relations = readJson("../data/youtubers/relations.json");
const ids = new Set(people.map((person) => person.id));
const peopleById = new Map(people.map((person) => [person.id, person]));
const h3Events = filterEvents(events, { hub: "h3" }, peopleById);
const dobrikEvents = filterEvents(events, { hub: "dobrik" }, peopleById);
const trishaEvents = filterEvents(events, { hub: "trisha" }, peopleById);
const knownHubs = new Set(["h3", "dobrik", "trisha", "jeffree"]);

assert.equal(ids.size, people.length, "person ids must be unique");
assert.equal(people.filter((person) => person.id === "trisha-paytas").length, 1, "Trisha is one person");
assert.equal(people.filter((person) => person.id === "ethan-klein").length, 1);
assert.equal(people.filter((person) => person.id === "david-dobrik").length, 1);
assert.equal(people.filter((person) => person.id === "jason-nash").length, 1);
assert.equal(people.filter((person) => person.id === "oscar-gracey").length, 1);
assert.ok(h3Events.length >= 35 && h3Events.length <= 70, `H3 hub should contain 35–70 events, got ${h3Events.length}`);
assert.ok(dobrikEvents.length >= 20 && dobrikEvents.length <= 55, `Dobrik hub should contain 20–55 events, got ${dobrikEvents.length}`);
assert.ok(trishaEvents.length >= 25 && trishaEvents.length <= 55, `Trisha hub should contain 25–55 events, got ${trishaEvents.length}`);
const jeffreeEvents = filterEvents(events, { hub: "jeffree" }, peopleById);
assert.ok(jeffreeEvents.length >= 12 && jeffreeEvents.length <= 40, `Jeffree hub should contain 12–40 events, got ${jeffreeEvents.length}`);
assert.ok(jeffreeEvents.some((event) => event.id === "jeffree-racial-slur-footage"));
assert.ok(jeffreeEvents.some((event) => event.id === "jeffree-james-predator-tweets"));
assert.equal(jeffreeEvents.some((event) => event.id === "dobrik-early-life"), false);
assert.equal(new Set(events.map((event) => event.id)).size, events.length, "event ids must be unique");

for (const person of people) {
  assert.ok(person.name && person.role, `${person.id} needs a name and role`);
  assert.ok(Array.isArray(person.tags) && person.tags.length, `${person.id} needs filter tags`);
}

for (const event of events) {
  assert.match(event.date, /^\d{4}-\d{2}-\d{2}$/, `${event.id} needs an ISO date`);
  assert.ok(event.title && event.summary && event.era, `${event.id} is missing core copy`);
  assert.ok(event.people.length >= 1, `${event.id} needs people`);
  assert.ok(event.hubs?.length, `${event.id} needs hubs`);
  event.hubs.forEach((hub) => assert.ok(knownHubs.has(hub), `${event.id} unknown hub ${hub}`));
  event.people.forEach((id) => assert.ok(ids.has(id), `${event.id} references unknown person ${id}`));
  assert.ok(event.links?.length, `${event.id} needs at least one source`);
  event.links.forEach((link) => {
    assert.match(link.url, /^https:\/\//, `${event.id} source must use https`);
    assert.ok(link.label && link.type, `${event.id} source needs label and type`);
  });
  assert.ok(eventTease(event).length <= 140, `${event.id} tease is too long`);
  const body = expandedSummary(event);
  assert.notEqual(body, event.title, `${event.id} opened summary repeats the title`);
  assert.ok(body.startsWith(eventTease(event, 140).replace(/…$/, "").trim()), `${event.id} preview repeats outside the summary`);
}

assert.ok(events.some((event) => event.date.startsWith("2025-")), "needs verified 2025 coverage");
assert.ok(events.some((event) => event.date.startsWith("2026-")), "needs verified 2026 coverage");

for (const relation of relations) {
  assert.ok(ids.has(relation.from), `unknown relation source ${relation.from}`);
  assert.ok(ids.has(relation.to), `unknown relation target ${relation.to}`);
  assert.ok(relation.kind && relation.label, "relations need kind and label");
}

const hubCenters = new Set(["ethan-klein", "david-dobrik", "trisha-paytas", "jeffree-star"]);
for (const person of people.filter((person) => !hubCenters.has(person.id))) {
  assert.ok(
    relations.some((relation) =>
      hubCenters.has(relation.from) && relation.to === person.id
      || hubCenters.has(relation.to) && relation.from === person.id),
    `${person.id} needs a relationship to Ethan, David, Trisha, or Jeffree`,
  );
}

const frenemies = filterEvents(events, { person: "trisha-paytas", era: "frenemies" }, peopleById);
assert.ok(frenemies.length >= 2);
assert.deepEqual(filterEvents(events, { person: ALL, era: ALL }, peopleById), events);
assert.equal(filterEvents(events, { hub: "" }, peopleById).length, events.length, "no hub shows every beat");
assert.ok(filterEvents(events, { query: "fair use" }, peopleById).length >= 2);
assert.ok(h3Events.some((event) => event.id === "frenemies-launch"));
assert.ok(trishaEvents.some((event) => event.id === "frenemies-launch"));
assert.equal(h3Events.some((event) => event.id === "utah-excavator-accident"), false);
assert.equal(trishaEvents.some((event) => event.id === "utah-excavator-accident"), false);
assert.ok(dobrikEvents.some((event) => event.id === "utah-excavator-accident"));
assert.ok(trishaEvents.some((event) => event.id === "just-trish-launch"));
assert.ok(trishaEvents.some((event) => event.id === "frenemies-ep17-teacher-allegation"));
assert.ok(trishaEvents.some((event) => event.id === "frenemies-ep17-unlist"));
assert.ok(trishaEvents.some((event) => event.id === "moses-bruise-on-air"));
assert.ok(h3Events.some((event) => event.id === "frenemies-ep17-teacher-allegation"));
assert.ok(h3Events.some((event) => event.id === "frenemies-ep17-unlist"));
assert.equal(h3Events.some((event) => event.id === "just-trish-launch"), false);
const livestream = events.find((event) => event.id === "dobrik-safety-coverage");
assert.deepEqual(livestream.hubs.slice().sort(), ["dobrik", "h3", "trisha"]);
assert.ok(livestream.people.includes("jeff-wittek"));
assert.ok(livestream.people.includes("trisha-paytas"));
assert.ok(h3Events.some((event) => event.id === "dobrik-safety-coverage"));
assert.ok(dobrikEvents.some((event) => event.id === "dobrik-safety-coverage"));
assert.ok(trishaEvents.some((event) => event.id === "dobrik-safety-coverage"));
const hotel = events.find((event) => event.id === "paytas-hotel-filming");
assert.deepEqual(hotel.hubs.slice().sort(), ["dobrik", "trisha"]);
assert.ok(events.find((event) => event.id === "moses-bruise-on-air").title.toLowerCase().includes("unpinned")
  || events.find((event) => event.id === "moses-bruise-on-air").summary.toLowerCase().includes("unpinned"));

const firstRelation = relations[0];
assert.ok(relationEvents(firstRelation, events).every((event) =>
  event.people.includes(firstRelation.from) && event.people.includes(firstRelation.to)));

const youtubers = plots.plots.find((item) => item.id === "youtubers");
assert.ok(youtubers, "youtubers plot is registered");
assert.deepEqual(plots.plots.map((item) => item.id), [
  "youtubers",
  "marvel-universe",
  "barack-obama",
  "jd-vance",
  "united-states",
  "partition-of-india",
  "wars",
], "homepage gallery order");
for (const item of plots.plots) {
  assert.ok(item.kicker, `${item.id} needs a gallery kicker`);
  assert.ok(item.cardLine, `${item.id} needs a compact card line`);
}
assert.equal(plotCardFace(youtubers), "person");
assert.equal(plotCardFace(plots.plots.find((item) => item.id === "united-states")), "flag");
assert.equal(plotCardFace(plots.plots.find((item) => item.id === "partition-of-india")), "mono");
assert.equal(plotCardFace(plots.plots.find((item) => item.id === "wars")), "map");
assert.equal(plotMatchesQuery(youtubers, ""), true);
assert.equal(plotMatchesQuery(youtubers, "Jeffree"), true);
assert.equal(plotMatchesQuery(youtubers, "pakistan"), false);
assert.equal(plotMatchesQuery(plots.plots.find((item) => item.id === "partition-of-india"), "1947"), true);
assert.equal(findPlot(plots.plots, "h3")?.id, "youtubers");
assert.equal(findPlot(plots.plots, "youtubers")?.id, "youtubers");
assert.equal(youtubers.centerId, "ethan-klein");
assert.equal(youtubers.includeOrbit, true);
assert.equal(youtubers.hubs.length, 4);
assert.equal(hubOf(youtubers, "h3").centerId, "ethan-klein");
assert.equal(hubOf(youtubers, "h3").label, "Ethan Klein");
assert.equal(hubOf(youtubers, "dobrik").centerId, "david-dobrik");
assert.equal(hubOf(youtubers, "trisha").centerId, "trisha-paytas");
assert.equal(hubOf(youtubers, "jeffree").centerId, "jeffree-star");
assert.equal(hubOf(youtubers, "jeffree").label, "Jeffree Star");
assert.equal(hubCenterId(youtubers, "dobrik"), "david-dobrik");
assert.equal(hubCenterId(youtubers, "trisha"), "trisha-paytas");
assert.equal(initials("Hila Klein"), "HK");
assert.equal(initials("xQc"), "XQ");
assert.equal(campOf("hila-klein", relations, youtubers.centerId, youtubers.friendKinds, youtubers.enemyKinds), "friend");
assert.equal(campOf("trisha-paytas", relations, youtubers.centerId, youtubers.friendKinds, youtubers.enemyKinds), "enemy");
assert.equal(campOf("david-dobrik", relations, youtubers.centerId, youtubers.friendKinds, youtubers.enemyKinds), "orbit");
assert.equal(campOf("jeff-wittek", relations, "david-dobrik", youtubers.friendKinds, youtubers.enemyKinds), "enemy");
assert.equal(campOf("natalie-mariduena", relations, "david-dobrik", youtubers.friendKinds, youtubers.enemyKinds), "friend");
assert.equal(campOf("trisha-paytas", relations, "david-dobrik", youtubers.friendKinds, youtubers.enemyKinds), "enemy");
assert.equal(campOf("ethan-klein", relations, "david-dobrik", youtubers.friendKinds, youtubers.enemyKinds), "orbit");
assert.equal(campOf("ethan-klein", relations, "trisha-paytas", youtubers.friendKinds, youtubers.enemyKinds), "enemy");
assert.equal(campOf("hila-klein", relations, "trisha-paytas", youtubers.friendKinds, youtubers.enemyKinds), "enemy");
assert.equal(campOf("moses-hacmon", relations, "trisha-paytas", youtubers.friendKinds, youtubers.enemyKinds), "friend");
assert.equal(campOf("david-dobrik", relations, "trisha-paytas", youtubers.friendKinds, youtubers.enemyKinds), "enemy");
assert.equal(campOf("oscar-gracey", relations, "trisha-paytas", youtubers.friendKinds, youtubers.enemyKinds), "friend");
assert.equal(campOf("gabbie-hanna", relations, "trisha-paytas", youtubers.friendKinds, youtubers.enemyKinds), "enemy");
assert.equal(campOf("oscar-gracey", relations, youtubers.centerId, youtubers.friendKinds, youtubers.enemyKinds), "orbit");

const allowedLicenses = new Set(["CC BY 2.0", "CC BY 3.0", "CC BY 4.0", "CC BY-SA 2.0", "CC BY-SA 3.0", "CC BY-SA 4.0", "CC0", "Public domain"]);
for (const person of people) {
  if (!person.portrait) continue;
  assert.match(person.portrait.src, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//, person.id);
  assert.match(person.portrait.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, person.id);
  assert.ok(allowedLicenses.has(person.portrait.license), `${person.id} portrait license`);
  assert.ok(person.portrait.author && person.portrait.licenseUrl, `${person.id} portrait credit`);
}
assert.ok(people.find((person) => person.id === "casey-neistat").portrait, "Casey Neistat has a Commons portrait");
assert.ok(people.find((person) => person.id === "tana-mongeau").portrait, "Tana Mongeau has a Commons portrait");

const layout = webLayout(people, relations, {
  centerId: youtubers.centerId,
  friendKinds: youtubers.friendKinds,
  enemyKinds: youtubers.enemyKinds,
});
assert.ok(layout.nodes.length < people.length, "coverage-only people stay off the web");
assert.equal(layout.nodes.some((node) => node.camp === "orbit"), false);
assert.equal(layout.nodes.find((node) => node.id === "david-dobrik"), undefined);
assert.equal(layout.nodes.find((node) => node.id === "idubbbz").camp, "enemy");
assert.equal(layout.nodes.find((node) => node.id === "matt-hoss").camp, "enemy");
assert.equal(layout.nodes.find((node) => node.id === "denims").camp, "enemy");
assert.equal(layout.nodes.find((node) => node.id === "anisa-jomha").camp, "enemy");
assert.equal(layout.nodes.find((node) => node.id === "xqc"), undefined);
assert.equal(layout.nodes.find((node) => node.id === "hila-klein").camp, "friend");
assert.equal(layout.nodes.find((node) => node.id === "rich-lux").camp, "friend");
assert.equal(layout.nodes.find((node) => node.id === "nicol-concilio").camp, "friend");
assert.equal(layout.nodes.find((node) => node.id === "hutch").camp, "friend");
assert.equal(layout.nodes.find((node) => node.id === "harley-morenstein").camp, "friend");
assert.equal(layout.nodes.find((node) => node.id === "oliver-tree").camp, "friend");
const ethanNode = layout.nodes.find((node) => node.id === "ethan-klein");
assert.equal(ethanNode.camp, "center");
const others = layout.nodes.filter((node) => node.id !== "ethan-klein");
assert.ok(others.some((node) => node.x < ethanNode.x) && others.some((node) => node.x > ethanNode.x));
assert.ok(others.some((node) => node.y < ethanNode.y) && others.some((node) => node.y > ethanNode.y));
const trisha = neighborhood("trisha-paytas", relations);
["ethan-klein", "hila-klein", "moses-hacmon", "jason-nash", "david-dobrik", "oscar-gracey"].forEach((id) => assert.ok(trisha.has(id), id));
assert.ok(layout.edges.some((edge) => edge.from === "trisha-paytas" && edge.to === "moses-hacmon" || edge.from === "moses-hacmon" && edge.to === "trisha-paytas"));
let closest = Infinity;
for (let i = 0; i < layout.nodes.length; i += 1) {
  for (let j = i + 1; j < layout.nodes.length; j += 1) {
    const dx = layout.nodes[i].x - layout.nodes[j].x;
    const dy = layout.nodes[i].y - layout.nodes[j].y;
    closest = Math.min(closest, Math.hypot(dx, dy));
  }
}
assert.ok(closest >= 110, `web nodes overlap (${closest})`);
const fitted = webLayout(people, relations, {
  centerId: youtubers.centerId,
  friendKinds: youtubers.friendKinds,
  enemyKinds: youtubers.enemyKinds,
  width: 700,
  height: 420,
});
assert.ok(fitted.nodeSize <= 72);
assert.ok(fitted.nodes.every((node) => node.x > 16 && node.x < 684 && node.y > 16 && node.y < 404));

function centerDistance(layoutNodes, id) {
  const node = layoutNodes.find((item) => item.id === id);
  const middle = layoutNodes.find((item) => item.camp === "center");
  return Math.hypot(node.x - middle.x, node.y - middle.y);
}
const weighted = webLayout(people, relations, {
  centerId: youtubers.centerId,
  friendKinds: youtubers.friendKinds,
  enemyKinds: youtubers.enemyKinds,
  events: h3Events,
});
assert.ok(centerDistance(weighted.nodes, "hila-klein") < centerDistance(weighted.nodes, "moses-hacmon"));
assert.ok(centerDistance(weighted.nodes, "hasan-piker") < centerDistance(weighted.nodes, "philip-de-franco"));
assert.ok(centerDistance(weighted.nodes, "trisha-paytas") < centerDistance(weighted.nodes, "james-charles"));
for (const size of [{ width: 1100, height: 980 }, { width: 1400, height: 720 }, { width: 700, height: 420 }]) {
  const sample = webLayout(people, relations, {
    centerId: youtubers.centerId,
    friendKinds: youtubers.friendKinds,
    enemyKinds: youtubers.enemyKinds,
    events: h3Events,
    ...size,
  });
  assert.ok(centerDistance(sample.nodes, "hila-klein") < centerDistance(sample.nodes, "moses-hacmon"), `hila closer ${size.width}`);
  assert.ok(centerDistance(sample.nodes, "hasan-piker") < centerDistance(sample.nodes, "philip-de-franco"), `hasan closer ${size.width}`);
  assert.ok(centerDistance(sample.nodes, "hila-klein") < centerDistance(sample.nodes, "trisha-paytas"), `hila inside trisha ${size.width}`);
  const ranked = sample.nodes.filter((node) => node.camp !== "center");
  for (let i = 0; i < ranked.length; i += 1) {
    for (let j = 0; j < ranked.length; j += 1) {
      if (ranked[i].beats <= ranked[j].beats) continue;
      assert.ok(
        centerDistance(sample.nodes, ranked[i].id) < centerDistance(sample.nodes, ranked[j].id),
        `${ranked[i].id} should be closer than ${ranked[j].id} at ${size.width}x${size.height}`,
      );
    }
  }
  const orbit = sample.nodes.filter((node) => node.camp !== "center");
  let nearest = Infinity;
  for (let i = 0; i < sample.nodes.length; i += 1) {
    for (let j = i + 1; j < sample.nodes.length; j += 1) {
      nearest = Math.min(nearest, Math.hypot(sample.nodes[i].x - sample.nodes[j].x, sample.nodes[i].y - sample.nodes[j].y));
    }
  }
  assert.ok(nearest >= sample.nodeSize * 0.9, `weighted overlap at ${size.width} (${nearest})`);
  assert.ok(orbit.some((node) => node.x < sample.nodes.find((node) => node.camp === "center").x));
  assert.ok(orbit.some((node) => node.x > sample.nodes.find((node) => node.camp === "center").x));
}
const weightedOthers = weighted.nodes.filter((node) => node.camp !== "center");
assert.ok(weightedOthers.some((node) => node.x < ethanNode.x) && weightedOthers.some((node) => node.x > ethanNode.x));
assert.ok(weightedOthers.some((node) => node.y < ethanNode.y) && weightedOthers.some((node) => node.y > ethanNode.y));
let weightedClosest = Infinity;
for (let i = 0; i < weighted.nodes.length; i += 1) {
  for (let j = i + 1; j < weighted.nodes.length; j += 1) {
    const dx = weighted.nodes[i].x - weighted.nodes[j].x;
    const dy = weighted.nodes[i].y - weighted.nodes[j].y;
    weightedClosest = Math.min(weightedClosest, Math.hypot(dx, dy));
  }
}
assert.ok(weightedClosest >= weighted.nodeSize, `weighted nodes overlap (${weightedClosest})`);
const weightedFit = webLayout(people, relations, {
  centerId: youtubers.centerId,
  friendKinds: youtubers.friendKinds,
  enemyKinds: youtubers.enemyKinds,
  events: h3Events,
  width: 700,
  height: 420,
});
assert.ok(weightedFit.nodes.every((node) => node.x > 8 && node.x < 692 && node.y > 8 && node.y < 412));
assert.ok(centerDistance(weightedFit.nodes, "hila-klein") < centerDistance(weightedFit.nodes, "sneako"));

assert.equal(parseState("https://plotmaniac.com/").view, "web");
assert.equal(parseState("https://plotmaniac.com/?view=timeline").view, "timeline");
assert.equal(
  parseState("https://plotmaniac.com/?view=person&person=hila-klein", { people: ids }).view,
  "person",
);
assert.equal(requestedView("https://plotmaniac.com/"), "");
assert.equal(requestedView("https://plotmaniac.com/?plot=h3"), "");
assert.equal(requestedView("https://plotmaniac.com/?view=web"), "web");
assert.equal(requestedView("https://plotmaniac.com/?view=timeline"), "timeline");
assert.equal(requestedView("https://plotmaniac.com/?view=nope"), "");
assert.equal(defaultPlotView(), "web");
assert.equal(defaultPlotView({ requested: "web" }), "web");
assert.equal(defaultPlotView({ requested: "timeline" }), "timeline");
assert.equal(defaultPlotView({ eventId: "frenemies-39-walkout" }), "timeline");
assert.equal(defaultPlotView({ requested: "web", eventId: "frenemies-39-walkout" }), "web");

const phoneH3 = "https://plotmaniac.com/?plot=h3";
assert.equal(resolvePlotView(parseState(phoneH3), { href: phoneH3 }), "web");
assert.equal(
  resolvePlotView(parseState("https://plotmaniac.com/?plot=h3&view=web"), {
    href: "https://plotmaniac.com/?plot=h3&view=web",
  }),
  "web",
);
assert.equal(
  resolvePlotView(parseState("https://plotmaniac.com/?plot=h3&view=timeline"), {
    href: "https://plotmaniac.com/?plot=h3&view=timeline",
  }),
  "timeline",
);
assert.equal(
  resolvePlotView(parseState("https://plotmaniac.com/?plot=h3#frenemies-39-walkout", { people: ids, eras: new Set(events.map((event) => event.era)) }), {
    href: "https://plotmaniac.com/?plot=h3#frenemies-39-walkout",
  }),
  "timeline",
);
const compactMap = webLayout(people, relations, {
  centerId: youtubers.centerId,
  friendKinds: youtubers.friendKinds,
  enemyKinds: youtubers.enemyKinds,
  events: h3Events,
  width: 1120,
  height: 1120,
});
assert.ok(compactMap.nodes.some((node) => node.name === "Harley Morenstein"));
assert.ok(compactMap.nodes.some((node) => node.name === "Nicol Concilio"));
assert.equal(compactMap.nodes.some((node) => String(node.name).includes("…")), false);
assert.ok(compactMap.nodes.filter((node) => node.camp === "friend").length >= 2);
assert.ok(compactMap.nodes.filter((node) => node.camp === "enemy").length >= 2);

const parsed = parseState(
  "https://plotmaniac.com/?view=web&person=trisha-paytas&era=frenemies&q=walkout#frenemies-39-walkout",
  { people: ids, eras: new Set(events.map((event) => event.era)) },
);
assert.equal(parsed.view, "web");
assert.equal(parsed.person, "trisha-paytas");
assert.equal(parsed.eventId, "frenemies-39-walkout");
assert.match(stateUrl("https://plotmaniac.com/", parsed, parsed.eventId), /view=web/);
assert.match(
  stateUrl("https://plotmaniac.com/", { view: "timeline", plot: "youtubers", hub: "dobrik" }, ""),
  /plot=youtubers/,
);
assert.match(
  stateUrl("https://plotmaniac.com/", { view: "timeline", plot: "youtubers", hub: "dobrik" }, ""),
  /hub=dobrik/,
);
const hubState = parseState("https://plotmaniac.com/?plot=youtubers&hub=dobrik&view=timeline", {
  hubs: new Set(["h3", "dobrik", "trisha"]),
  defaultHub: "h3",
});
assert.equal(hubState.hub, "dobrik");
assert.equal(hubState.view, "timeline");
assert.equal(
  parseState("https://plotmaniac.com/?plot=youtubers", { hubs: new Set(["h3", "dobrik", "trisha"]), defaultHub: "h3" }).hub,
  "h3",
);
assert.equal(
  parseState("https://plotmaniac.com/?plot=youtubers&hub=trisha", { hubs: new Set(["h3", "dobrik", "trisha"]), defaultHub: "h3" }).hub,
  "trisha",
);
assert.match(
  stateUrl("https://plotmaniac.com/", { view: "timeline", plot: "youtubers", hub: "trisha" }, ""),
  /hub=trisha/,
);
assert.equal(
  parseState("https://plotmaniac.com/?plot=youtubers", { hubs: new Set(["h3", "dobrik", "trisha", "jeffree"]) }).hub,
  "",
);
assert.doesNotMatch(
  stateUrl("https://plotmaniac.com/", { view: "web", plot: "youtubers", hub: "" }, ""),
  /hub=/,
);
assert.equal(hubCenterId(youtubers, ""), "");
assert.equal(hubOf(youtubers, "all"), null);
assert.equal(hubCenterId(youtubers, "all"), "");
assert.equal(
  parseState("https://plotmaniac.com/?plot=youtubers&hub=all", { hubs: new Set(["h3", "dobrik", "trisha", "jeffree"]) }).hub,
  "all",
);
assert.match(
  stateUrl("https://plotmaniac.com/", { view: "web", plot: "youtubers", hub: "all" }, ""),
  /hub=all/,
);
assert.equal(filterEvents(events, { hub: "all" }, peopleById).length, events.length, "All keeps every beat on the timeline");

assert.equal(WEB_MIN_BEATS, 2);
assert.deepEqual(hubsForPerson("dan-swerdlove", relations, ["ethan-klein", "david-dobrik", "trisha-paytas"]), ["ethan-klein"]);
assert.deepEqual(hubsForPerson("natalie-mariduena", relations, ["ethan-klein", "david-dobrik", "trisha-paytas"]), ["david-dobrik"]);
assert.ok(hubsForPerson("jeff-wittek", relations, ["ethan-klein", "david-dobrik", "trisha-paytas"]).length >= 2);

const hubFieldOpts = {
  friendKinds: youtubers.friendKinds,
  enemyKinds: youtubers.enemyKinds,
  events,
  includeOrbit: true,
  hubIds: youtubers.hubs.map((hub) => hub.centerId),
  hubs: youtubers.hubs,
  width: 1400,
  height: 980,
};
const sharedWeb = webLayout(people, relations, { ...hubFieldOpts, centerId: "ethan-klein" });
assert.ok(sharedWeb.nodes.length < people.length, "one-beat people stay off the shared web");
assert.equal(events.find((event) => event.id === "dobrik-early-life"), undefined);
assert.equal(sharedWeb.nodes.find((node) => node.id === "oliver-tree"), undefined);
assert.equal(sharedWeb.nodes.find((node) => node.id === "oscar-gracey"), undefined);
assert.equal(sharedWeb.nodes.find((node) => node.id === "nik-keswani"), undefined);
assert.equal(sharedWeb.nodes.find((node) => node.id === "alex-ernst"), undefined);
assert.ok(sharedWeb.nodes.every((node) => node.plotHub || node.beats >= WEB_MIN_BEATS));
assert.equal(people.find((person) => person.id === "dom-zeglaitis").name, "Durte Dom");
assert.equal(sharedWeb.nodes.find((node) => node.id === "dom-zeglaitis"), undefined, "David-only people wait for David's focus");
assert.equal(sharedWeb.nodes.filter((node) => node.id === "trisha-paytas").length, 1);
assert.equal(sharedWeb.nodes.find((node) => node.id === "ethan-klein").camp, "center");
assert.equal(sharedWeb.nodes.find((node) => node.id === "david-dobrik").camp, "orbit");
assert.equal(sharedWeb.nodes.find((node) => node.id === "david-dobrik").plotHub, true);
assert.equal(sharedWeb.nodes.find((node) => node.id === "trisha-paytas").plotHub, true);
assert.equal(sharedWeb.nodes.find((node) => node.id === "jeff-wittek").camp, "orbit");
assert.equal(sharedWeb.nodes.find((node) => node.id === "trisha-paytas").camp, "enemy");
assert.ok(sharedWeb.edges.some((edge) =>
  (edge.from === "trisha-paytas" && edge.to === "jason-nash")
  || (edge.from === "jason-nash" && edge.to === "trisha-paytas")));
assert.equal(sharedWeb.regions, undefined);
assert.equal(sharedWeb.nodes.find((node) => node.id === "trisha-paytas").ring, "hub");
assert.equal(sharedWeb.nodes.find((node) => node.id === "jeff-wittek").ring, "shared");
assert.equal(sharedWeb.nodes.find((node) => node.id === "dan-swerdlove").ring, "exclusive");

function nodeOf(layoutNodes, id) {
  return layoutNodes.find((item) => item.id === id);
}
function pageDistance(layout, id) {
  const node = nodeOf(layout.nodes, id);
  return Math.hypot(node.x - layout.width / 2, node.y - layout.height / 2);
}
function boxesOverlap(a, b, boxW, boxH) {
  return Math.abs(a.x - b.x) < boxW - 0.5 && Math.abs(a.y - b.y) < boxH - 0.5;
}
function positionKey(layout) {
  return layout.nodes.map((node) => [node.id, node.x, node.y, node.ring].join(":")).sort().join("|");
}
function coreKey(layout) {
  return layout.nodes
    .filter((node) => node.ring !== "exclusive")
    .map((node) => [node.id, node.x, node.y, node.ring].join(":"))
    .sort()
    .join("|");
}
const ethanOnField = nodeOf(sharedWeb.nodes, "ethan-klein");
const davidOnField = nodeOf(sharedWeb.nodes, "david-dobrik");
const trishaOnField = nodeOf(sharedWeb.nodes, "trisha-paytas");
const jeffreeOnField = nodeOf(sharedWeb.nodes, "jeffree-star");
const danOnField = nodeOf(sharedWeb.nodes, "dan-swerdlove");
const jeffOnField = nodeOf(sharedWeb.nodes, "jeff-wittek");
const mosesOnField = nodeOf(sharedWeb.nodes, "moses-hacmon");
assert.ok(danOnField, "Dan stays on the web while Ethan is the focus");
assert.equal(danOnField.ring, "exclusive");
assert.equal(danOnField.hubId, "ethan-klein");
assert.equal(nodeOf(sharedWeb.nodes, "natalie-mariduena"), undefined, "David-only people stay hidden on Ethan's focus");
assert.equal(nodeOf(sharedWeb.nodes, "jackie-aina"), undefined, "Jeffree-only people stay hidden on Ethan's focus");
assert.equal(jeffOnField.ring, "shared");
assert.equal(mosesOnField.ring, "shared");
assert.equal(nodeOf(sharedWeb.nodes, "james-charles").ring, "shared");
assert.equal(nodeOf(sharedWeb.nodes, "shane-dawson").ring, "shared");
assert.equal(nodeOf(sharedWeb.nodes, "hasan-piker").hubId, "ethan-klein");
assert.ok(sharedWeb.nodes.filter((node) => node.ring === "exclusive").every((node) => node.hubId === "ethan-klein"));
const maxShared = Math.max(...sharedWeb.nodes.filter((node) => node.ring === "shared").map((node) => pageDistance(sharedWeb, node.id)));
const minHub = Math.min(...sharedWeb.nodes.filter((node) => node.ring === "hub").map((node) => pageDistance(sharedWeb, node.id)));
assert.ok(maxShared < minHub, "hubs sit outside the shared center");
assert.ok(pageDistance(sharedWeb, "dan-swerdlove") > pageDistance(sharedWeb, "ethan-klein"), "Dan sits outside Ethan");
for (const node of sharedWeb.nodes.filter((item) => item.ring === "exclusive")) {
  const hub = sharedWeb.nodes.find((item) => item.ring === "hub" && item.hubId === node.hubId);
  const outward = (node.x - hub.x) * (hub.x - sharedWeb.width / 2) + (node.y - hub.y) * (hub.y - sharedWeb.height / 2);
  assert.ok(outward > 0, `${node.id} sits on the outer side of ${hub.id}`);
}
assert.ok(ethanOnField.plotHub && davidOnField.plotHub && trishaOnField.plotHub && jeffreeOnField.plotHub);

const dobrikWeb = webLayout(people, relations, { ...hubFieldOpts, centerId: "david-dobrik" });
assert.ok(dobrikWeb.nodes.length < people.length);
assert.equal(dobrikWeb.nodes.find((node) => node.id === "oliver-tree"), undefined);
assert.equal(dobrikWeb.nodes.find((node) => node.id === "david-dobrik").camp, "center");
assert.equal(dobrikWeb.nodes.find((node) => node.id === "ethan-klein").camp, "orbit");
assert.equal(dobrikWeb.nodes.find((node) => node.id === "jeff-wittek").camp, "enemy");
assert.equal(dobrikWeb.nodes.find((node) => node.id === "natalie-mariduena").camp, "friend");
assert.equal(dobrikWeb.nodes.find((node) => node.id === "natalie-mariduena").ring, "exclusive");
assert.equal(dobrikWeb.nodes.find((node) => node.id === "natalie-mariduena").hubId, "david-dobrik");
assert.equal(dobrikWeb.nodes.find((node) => node.id === "dan-swerdlove"), undefined);
assert.equal(dobrikWeb.nodes.find((node) => node.id === "dom-zeglaitis").name, "Durte Dom");
assert.equal(dobrikWeb.nodes.find((node) => node.id === "dom-zeglaitis").hubId, "david-dobrik");
assert.ok(pageDistance(dobrikWeb, "natalie-mariduena") > pageDistance(dobrikWeb, "david-dobrik"), "Natalie sits outside David");
assert.equal(dobrikWeb.nodes.find((node) => node.id === "trisha-paytas").camp, "enemy");
assert.equal(dobrikWeb.nodes.find((node) => node.id === "hasan-piker"), undefined);
assert.equal(dobrikWeb.nodes.find((node) => node.id === "trisha-paytas").plotHub, true);

const trishaWeb = webLayout(people, relations, { ...hubFieldOpts, centerId: "trisha-paytas" });
assert.ok(trishaWeb.nodes.length < people.length);
assert.equal(trishaWeb.nodes.find((node) => node.id === "trisha-paytas").camp, "center");
assert.equal(trishaWeb.nodes.find((node) => node.id === "ethan-klein").camp, "enemy");
assert.equal(trishaWeb.nodes.find((node) => node.id === "ethan-klein").plotHub, true);
assert.equal(trishaWeb.nodes.find((node) => node.id === "david-dobrik").camp, "enemy");
assert.equal(trishaWeb.nodes.find((node) => node.id === "david-dobrik").plotHub, true);
assert.equal(trishaWeb.nodes.find((node) => node.id === "moses-hacmon").camp, "friend");
assert.equal(trishaWeb.nodes.find((node) => node.id === "oscar-gracey"), undefined);
assert.equal(trishaWeb.nodes.find((node) => node.id === "gabbie-hanna").camp, "enemy");
assert.equal(trishaWeb.nodes.find((node) => node.id === "hasan-piker"), undefined);
assert.equal(trishaWeb.nodes.find((node) => node.id === "dan-swerdlove"), undefined);
assert.equal(trishaWeb.nodes.filter((node) => node.ring === "exclusive").length, 0, "Trisha has no exclusive people");
const jeffreeWeb = webLayout(people, relations, { ...hubFieldOpts, centerId: "jeffree-star" });
assert.equal(jeffreeWeb.nodes.find((node) => node.id === "jeffree-star").camp, "center");
assert.equal(jeffreeWeb.nodes.find((node) => node.id === "jeffree-star").ring, "hub");
assert.equal(jeffreeWeb.nodes.find((node) => node.id === "jackie-aina").ring, "exclusive");
assert.equal(jeffreeWeb.nodes.find((node) => node.id === "jackie-aina").hubId, "jeffree-star");
assert.equal(jeffreeWeb.nodes.find((node) => node.id === "tati-westbrook").hubId, "jeffree-star");
assert.equal(jeffreeWeb.nodes.find((node) => node.id === "kat-von-d"), undefined, "one-beat people stay off Jeffree's web");
assert.equal(jeffreeWeb.nodes.find((node) => node.id === "makeup-shayla"), undefined);
assert.equal(jeffreeWeb.nodes.find((node) => node.id === "dan-swerdlove"), undefined);
assert.equal(jeffreeWeb.nodes.find((node) => node.id === "natalie-mariduena"), undefined);
assert.ok(jeffreeWeb.nodes.filter((node) => node.ring === "exclusive").every((node) => node.hubId === "jeffree-star"));
assert.equal(coreKey(sharedWeb), coreKey(dobrikWeb), "focus does not move hubs or shared people");
assert.equal(coreKey(sharedWeb), coreKey(trishaWeb), "Trisha focus does not move hubs or shared people");
assert.equal(coreKey(sharedWeb), coreKey(jeffreeWeb), "Jeffree focus does not move hubs or shared people");
assert.notEqual(positionKey(sharedWeb), positionKey(jeffreeWeb), "the focused hub's own people appear");
const openWeb = webLayout(people, relations, { ...hubFieldOpts, centerId: "" });
assert.equal(openWeb.nodes.filter((node) => node.ring === "exclusive").length, 0, "no hub means no one-hub people");
assert.equal(openWeb.nodes.find((node) => node.id === "dan-swerdlove"), undefined);
assert.equal(openWeb.nodes.find((node) => node.id === "jackie-aina"), undefined);
assert.equal(openWeb.nodes.find((node) => node.id === "ethan-klein").camp, "orbit");
assert.equal(openWeb.nodes.find((node) => node.id === "jeffree-star").plotHub, true);
assert.equal(openWeb.nodes.filter((node) => node.ring === "hub").length, 4);
assert.equal(coreKey(sharedWeb), coreKey(openWeb), "clearing focus does not move hubs or shared people");
const allWeb = webLayout(people, relations, { ...hubFieldOpts, centerId: "", revealAll: true });
const ethanExclusive = sharedWeb.nodes.filter((node) => node.ring === "exclusive").map((node) => node.id).sort();
const davidExclusive = dobrikWeb.nodes.filter((node) => node.ring === "exclusive").map((node) => node.id).sort();
const jeffreeExclusive = jeffreeWeb.nodes.filter((node) => node.ring === "exclusive").map((node) => node.id).sort();
const allExclusive = allWeb.nodes.filter((node) => node.ring === "exclusive").map((node) => node.id).sort();
assert.deepEqual(allExclusive, [...ethanExclusive, ...davidExclusive, ...jeffreeExclusive].sort(), "All shows every hub's own people");
assert.equal(allWeb.nodes.filter((node) => node.camp === "center").length, 0);
assert.equal(allWeb.nodes.find((node) => node.id === "ethan-klein").camp, "orbit");
assert.equal(allWeb.nodes.find((node) => node.id === "dan-swerdlove").hubId, "ethan-klein");
assert.equal(allWeb.nodes.find((node) => node.id === "dom-zeglaitis").hubId, "david-dobrik");
assert.equal(allWeb.nodes.find((node) => node.id === "jackie-aina").hubId, "jeffree-star");
assert.equal(allWeb.nodes.find((node) => node.id === "nik-keswani"), undefined, "one-beat people stay off All");
assert.equal(allWeb.nodes.find((node) => node.id === "kat-von-d"), undefined);
assert.equal(coreKey(sharedWeb), coreKey(allWeb), "All does not move hubs or shared people");
function frameFits(layout, view, camera) {
  const boxW = view.boxW;
  const boxH = view.boxH;
  return layout.nodes.every((node) => {
    const left = camera.x + (node.x - boxW / 2) * camera.scale;
    const right = camera.x + (node.x + boxW / 2) * camera.scale;
    const top = camera.y + (node.y - boxH / 2) * camera.scale;
    const bottom = camera.y + (node.y + boxH / 2) * camera.scale;
    return left >= -1 && top >= -1 && right <= view.viewWidth + 1 && bottom <= view.viewHeight + 1;
  });
}
const wideView = { viewWidth: 1440, viewHeight: 860, boxW: 128, boxH: 116, pad: 28, maxScale: 4 };
const shortView = { viewWidth: 900, viewHeight: 520, boxW: 128, boxH: 116, pad: 28, maxScale: 4 };
const noneWide = hubFrame(openWeb.nodes, wideView);
const ethanWide = hubFrame(sharedWeb.nodes, wideView);
const allWide = hubFrame(allWeb.nodes, wideView);
const tight = [{ x: 200, y: 200 }, { x: 260, y: 220 }];
const wideSpread = [...tight, { x: 900, y: 200 }, { x: 200, y: 780 }];
const zoomView = { viewWidth: 1000, viewHeight: 700, boxW: 80, boxH: 80, pad: 20, maxScale: 6 };
assert.ok(hubFrame(tight, zoomView).scale > hubFrame(wideSpread, zoomView).scale, "a tighter focus zooms in");
assert.ok(allWide.scale < noneWide.scale, "All zooms out to hold every person");
assert.ok(allWide.scale <= ethanWide.scale, "All is at least as wide as one hub");
assert.ok(hubFrame(openWeb.nodes, wideView).scale > hubFrame(openWeb.nodes, shortView).scale, "a larger page zooms in more");
assert.equal(frameFits(openWeb, wideView, noneWide), true);
assert.equal(frameFits(sharedWeb, wideView, ethanWide), true);
assert.equal(frameFits(allWeb, wideView, allWide), true);
assert.equal(frameFits(allWeb, shortView, hubFrame(allWeb.nodes, shortView)), true);
assert.equal(frameFits({ nodes: wideSpread }, zoomView, hubFrame(wideSpread, zoomView)), true);

for (const size of [{ width: 1400, height: 980 }, { width: 1024, height: 500 }, { width: 1120, height: 1120 }, { width: 390, height: 700 }]) {
  const sample = webLayout(people, relations, { ...hubFieldOpts, centerId: "ethan-klein", ...size });
  assert.equal(sample.nodes.length, sharedWeb.nodes.length, `same cast at ${size.width}`);
  assert.equal(sample.centerSize, sample.nodeSize);
  const sharedDist = Math.max(...sample.nodes.filter((node) => node.ring === "shared").map((node) => pageDistance(sample, node.id)));
  const hubDist = Math.min(...sample.nodes.filter((node) => node.ring === "hub").map((node) => pageDistance(sample, node.id)));
  assert.ok(sharedDist < hubDist, `hubs stay outside the center at ${size.width}`);
  sample.nodes.filter((node) => node.ring === "exclusive").forEach((node) => {
    const hub = sample.nodes.find((item) => item.ring === "hub" && item.id === node.hubId);
    assert.ok(pageDistance(sample, node.id) > pageDistance(sample, hub.id), `${node.id} outside its hub at ${size.width}`);
  });
  for (let i = 0; i < sample.nodes.length; i += 1) {
    for (let j = i + 1; j < sample.nodes.length; j += 1) {
      assert.equal(boxesOverlap(sample.nodes[i], sample.nodes[j], sample.boxW, sample.boxH), false, `${sample.nodes[i].id} overlaps ${sample.nodes[j].id} at ${size.width}`);
    }
  }
  assert.ok(sample.nodes.every((node) => node.x > 8 && node.x < sample.width - 8 && node.y > 8 && node.y < sample.height - 8));
  const everyone = webLayout(people, relations, { ...hubFieldOpts, centerId: "", revealAll: true, ...size });
  assert.ok(everyone.nodes.length > sample.nodes.length, `All keeps every circle at ${size.width}`);
  for (let i = 0; i < everyone.nodes.length; i += 1) {
    for (let j = i + 1; j < everyone.nodes.length; j += 1) {
      assert.equal(boxesOverlap(everyone.nodes[i], everyone.nodes[j], everyone.boxW, everyone.boxH), false, `${everyone.nodes[i].id} overlaps ${everyone.nodes[j].id} at ${size.width}`);
    }
  }
}

const nodes = graphLayout(people);
assert.equal(nodes.length, people.length);
assert.equal(nodes.find((node) => node.id === "ethan-klein").central, true);
assert.equal(youtubeId("https://www.youtube.com/watch?v=ZSUDHx-1_ww"), "ZSUDHx-1_ww");
assert.equal(youtubeId("https://youtu.be/8UizTBc6FP8"), "8UizTBc6FP8");

const usPeople = readJson("../data/united-states/people.json");
const usEvents = readJson("../data/united-states/events.json");
const usRelations = readJson("../data/united-states/relations.json");
const usCountries = readJson("../data/united-states/countries.json");
const us = plots.plots.find((item) => item.id === "united-states");
const usIds = new Set(usPeople.map((person) => person.id));
const yearRange = { min: 1776, max: 2026, initial: 2026 };
assert.ok(us, "united states plot is registered");
assert.equal(us.centerId, "united-states");
assert.equal(us.disclosure, "regions");
assert.equal(us.images, "flags");
assert.equal(us.year, undefined);
assert.equal(usIds.size, usPeople.length);
assert.equal(usCountries.length, 197);
assert.equal(usPeople.length, 198);
assert.equal(new Set(usEvents.map((event) => event.id)).size, usEvents.length);
assert.equal(new Set(usCountries.map((country) => country.slug)).size, usCountries.length);

const statusCounts = { friend: 0, foe: 0, neutral: 0 };
const outlineCounts = { green: 0, red: 0, none: 0 };
for (const country of usCountries) {
  statusCounts[country.status] += 1;
  outlineCounts[country.outline] += 1;
  assert.equal(outlineFor(country), country.outline, country.slug);
  assert.ok(country.timeline?.length, `${country.slug} needs a timeline`);
  assert.equal(usIds.has(country.slug), true, country.slug);
  assert.equal(usPeople.find((person) => person.id === country.slug)?.name, country.country);
  if (country.status === "neutral") {
    assert.equal(country.outline, "none", country.slug);
    assert.equal(country.first_load, false, country.slug);
  }
  if (country.status === "friend") assert.equal(country.outline, "green", country.slug);
  if (country.status === "foe") assert.equal(country.outline, "red", country.slug);
}
assert.deepEqual(statusCounts, { friend: 56, foe: 21, neutral: 120 });
assert.deepEqual(outlineCounts, { green: 56, red: 21, none: 120 });

const majors = firstLoadCountries(usCountries);
assert.equal(majors.length, 31);
assert.equal(majors.filter((country) => country.status === "friend").length, 24);
assert.equal(majors.filter((country) => country.status === "foe").length, 7);
assert.equal(majors.some((country) => country.status === "neutral"), false);

const grouped = countriesByRegion(usCountries);
assert.deepEqual(grouped.map((group) => group.region), RELATION_REGIONS);
assert.equal(grouped.reduce((sum, group) => sum + group.countries.length, 0), 197);
for (const group of grouped) {
  assert.ok(group.countries.length > 0, group.region);
  const rank = { friend: 0, foe: 1, neutral: 2 };
  group.countries.forEach((country, index) => {
    if (!index) return;
    assert.ok(
      rank[country.status] >= rank[group.countries[index - 1].status],
      `${group.region} lists friends, then foes, then neutrals`,
    );
  });
}

const foeNames = usCountries.filter((country) => country.status === "foe").map((country) => country.country).sort();
assert.deepEqual(foeNames, [
  "Afghanistan", "Belarus", "Burkina Faso", "Burundi", "Central African Republic", "China", "Cuba",
  "Eritrea", "Iran", "Libya", "Mali", "Myanmar", "Nicaragua", "Niger", "North Korea", "Russia",
  "Somalia", "South Sudan", "Sudan", "Yemen", "Zimbabwe",
]);

for (const person of usPeople) {
  assert.equal(person.portrait?.frame, "flag", person.id);
  assert.match(person.portrait.src, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//, person.id);
  assert.equal(person.portrait.license, "Public domain");
}

const related = new Set();
for (const relation of usRelations) {
  assert.ok(usIds.has(relation.from) && usIds.has(relation.to));
  assert.equal(relation.from, "united-states");
  related.add(relation.to);
  const country = usCountries.find((item) => item.slug === relation.to);
  if (country.status === "friend") assert.equal(relation.kind, "ally");
  if (country.status === "foe") assert.equal(relation.kind, "foe");
  assert.notEqual(country.status, "neutral");
}
assert.equal(related.size, 77);
for (const country of usCountries) {
  if (country.status === "neutral") assert.equal(related.has(country.slug), false, country.slug);
}

for (const event of usEvents) {
  assert.match(event.date, /^\d{4}-\d{2}-\d{2}$/, event.id);
  assert.ok(eventTease(event).length <= 140, event.id);
  assert.equal(expandedSummary(event), "", `${event.id} opened summary repeats the title`);
  event.people.forEach((id) => assert.ok(usIds.has(id), `${event.id} references ${id}`));
  assert.ok(event.links?.length, event.id);
}

const stance = (id) => campOf(id, usRelations, us.centerId, us.friendKinds, us.enemyKinds);
assert.equal(stance("france"), "friend");
assert.equal(stance("united-kingdom"), "friend");
assert.equal(stance("russia"), "enemy");
assert.equal(stance("china"), "enemy");
assert.equal(stance("iran"), "enemy");
assert.equal(stance("north-korea"), "enemy");
assert.equal(stance("taiwan"), "friend");
assert.equal(stance("venezuela"), "orbit");
assert.equal(stance("mexico"), "orbit");
assert.equal(stance("pakistan"), "orbit");
assert.equal(stance("syria"), "orbit");
assert.equal(coversYear({ start: "1941", end: "1945" }, null), false);
assert.equal(coversYear({ kind: "feud" }, null), true);
assert.equal(parseYear("1930", yearRange), 1930);
assert.equal(parseYear("nope", yearRange), 2026);
assert.equal(parseYear("1492", yearRange), 1776);

const camps = webLayout(
  [
    { id: "united-states", name: "United States" },
    { id: "germany", name: "Germany" },
    { id: "united-kingdom", name: "United Kingdom" },
  ],
  [
    { from: "united-states", to: "germany", kind: "foe", start: "1941", end: "1945" },
    { from: "united-states", to: "united-kingdom", kind: "ally", start: "1785" },
  ],
  {
    centerId: "united-states",
    friendKinds: ["ally"],
    enemyKinds: ["foe"],
    arrangement: "camps",
    year: 1942,
    width: 1100,
    height: 800,
  },
);
const germany = camps.nodes.find((node) => node.id === "germany");
const britain = camps.nodes.find((node) => node.id === "united-kingdom");
const america = camps.nodes.find((node) => node.id === "united-states");
assert.equal(germany.camp, "enemy");
assert.equal(germany.side, "left");
assert.equal(britain.camp, "friend");
assert.equal(britain.side, "right");
assert.ok(germany.x < america.x && britain.x > america.x);

const countryState = parseState("https://plotmaniac.com/?plot=united-states&country=france", {
  countries: new Set(usCountries.map((country) => country.slug)),
});
assert.equal(countryState.country, "france");
assert.equal(countryState.view, "web");
assert.match(
  stateUrl("https://plotmaniac.com/", { view: "web", plot: "united-states", country: "mexico" }, ""),
  /country=mexico/,
);

function linkedBloc(ids, edges) {
  if (ids.length < 2) return false;
  const want = new Set(ids);
  const adj = new Map(ids.map((id) => [id, []]));
  edges.forEach((edge) => {
    if (edge.kind !== "bloc" || !want.has(edge.from) || !want.has(edge.to)) return;
    adj.get(edge.from).push(edge.to);
    adj.get(edge.to).push(edge.from);
  });
  const seen = new Set([ids[0]]);
  const stack = [ids[0]];
  while (stack.length) {
    const id = stack.pop();
    adj.get(id).forEach((next) => {
      if (seen.has(next)) return;
      seen.add(next);
      stack.push(next);
    });
  }
  return seen.size === ids.length;
}

const pixelDist = (node, center) => Math.hypot(node.x - center.x, node.y - center.y);
const meanDist = (nodes, center) => nodes.reduce((sum, node) => sum + pixelDist(node, center), 0) / nodes.length;
const span = (nodes, key) => Math.max(...nodes.map((node) => node[key])) - Math.min(...nodes.map((node) => node[key]));
const nearestDistance = (nodes) => {
  let nearest = Infinity;
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      nearest = Math.min(nearest, Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y));
    }
  }
  return nearest;
};

const majorsOnly = relationsFieldLayout(usCountries, { width: 1400, height: 800 });
assert.equal(majorsOnly.nodes.length, 31);
assert.equal(majorsOnly.nodes.every((node) => node.first_load), true);
assert.equal(majorsOnly.nodes.some((node) => node.status === "neutral"), false);
assert.ok(span(majorsOnly.nodes, "x") > 1400 * 0.62, `major width ${span(majorsOnly.nodes, "x")}`);
assert.ok(span(majorsOnly.nodes, "y") > 800 * 0.5, `major height ${span(majorsOnly.nodes, "y")}`);
const majorMeanX = majorsOnly.nodes.reduce((sum, node) => sum + node.x, 0) / majorsOnly.nodes.length;
const majorMeanY = majorsOnly.nodes.reduce((sum, node) => sum + node.y, 0) / majorsOnly.nodes.length;
assert.ok(Math.abs(majorMeanX - majorsOnly.center.x) < 220);
assert.ok(Math.abs(majorMeanY - majorsOnly.center.y) < 160);
const beatCount = new Map(usCountries.map((country) => [country.slug, (country.timeline || []).length]));
const byBeats = majorsOnly.nodes.slice().sort((a, b) => beatCount.get(b.slug) - beatCount.get(a.slug));
assert.ok(pixelDist(byBeats[0], majorsOnly.center) < pixelDist(byBeats.at(-1), majorsOnly.center));
assert.ok(majorsOnly.nodes.every((node) => node.x > 0 && node.x < 1400 && node.y > 0 && node.y < 800));

const europe = relationsFieldLayout(usCountries, { width: 1400, height: 800, openRegions: ["Europe"] });
const europeMajors = europe.nodes.filter((node) => node.first_load);
const europeBroader = europe.nodes.filter((node) => !node.first_load);
assert.equal(europe.selectedRegion, "Europe");
assert.equal(europe.nodes.length, usCountries.filter((country) => country.region === "Europe").length);
assert.equal(europe.nodes.every((node) => node.region === "Europe"), true);
assert.ok(europeBroader.length > 10);
assert.equal(europeBroader.every((node) => node.region === "Europe"), true);
assert.ok(Math.max(...europeMajors.map((node) => pixelDist(node, europe.center))) < Math.min(...europeBroader.map((node) => pixelDist(node, europe.center))));
assert.ok(meanDist(europeMajors, europe.center) < meanDist(majorsOnly.nodes, majorsOnly.center) * 0.72);
assert.ok(span(europeBroader, "x") > 1400 * 0.7, `europe width ${span(europeBroader, "x")}`);
assert.ok(span(europeBroader, "y") > 800 * 0.5, `europe height ${span(europeBroader, "y")}`);
assert.equal(europe.nodes.some((node) => node.region === "Oceania" && !node.first_load), false);
assert.ok(europe.nodes.filter((node) => node.status === "neutral").every((node) => node.outline === "none"));
assert.ok(europe.nodes.filter((node) => node.status === "friend").every((node) => node.outline === "green"));
assert.ok(europe.nodes.filter((node) => node.status === "foe").every((node) => node.outline === "red"));
const europeMeanX = europe.nodes.reduce((sum, node) => sum + node.x, 0) / europe.nodes.length;
const europeMeanY = europe.nodes.reduce((sum, node) => sum + node.y, 0) / europe.nodes.length;
assert.ok(Math.abs(europeMeanX - europe.center.x) < 280);
assert.ok(Math.abs(europeMeanY - europe.center.y) < 180);

const firstRegionWins = relationsFieldLayout(usCountries, {
  width: 1400,
  height: 800,
  openRegions: ["Europe", "Americas"],
});
assert.equal(firstRegionWins.selectedRegion, "Europe");
assert.equal(firstRegionWins.nodes.every((node) => node.region === "Europe"), true);

for (const region of RELATION_REGIONS) {
  const regional = relationsFieldLayout(usCountries, { width: 1024, height: 430, openRegions: [region] });
  assert.equal(regional.nodes.length, usCountries.filter((country) => country.region === region).length, region);
  assert.equal(regional.nodes.every((node) => node.region === region), true, region);
  assert.ok(nearestDistance(regional.nodes) >= regional.nodeSize, `${region} flags do not overlap`);
}

const tall = relationsFieldLayout(usCountries, { width: 700, height: 980, openRegions: ["Sub-Saharan Africa"] });
const tallBroad = tall.nodes.filter((node) => !node.first_load);
assert.equal(tall.nodes.every((node) => node.region === "Sub-Saharan Africa"), true);
assert.ok(span(tallBroad, "x") > 700 * 0.62);
assert.ok(span(tallBroad, "y") > 980 * 0.55);
assert.ok(Math.max(...tall.nodes.filter((node) => node.first_load).map((node) => pixelDist(node, tall.center))) < Math.min(...tallBroad.map((node) => pixelDist(node, tall.center))));

const slugs = new Set(usCountries.map((country) => country.slug));
for (const bloc of RELATION_BLOCS) {
  bloc.slugs.forEach((slug) => assert.ok(slugs.has(slug), `${bloc.id} ${slug}`));
}

const majorEdges = relationsFieldEdges(majorsOnly);
const majorSpokes = majorEdges.filter((edge) => edge.kind === "spoke");
const majorBlocs = majorEdges.filter((edge) => edge.kind === "bloc");
assert.equal(majorSpokes.length, majorsOnly.nodes.length);
assert.equal(majorSpokes.every((edge) => edge.from === "united-states" && edge.scope === "major"), true);
assert.equal(majorSpokes.filter((edge) => edge.camp === "friend").length, 24);
assert.equal(majorSpokes.filter((edge) => edge.camp === "enemy").length, 7);
assert.equal(majorSpokes.some((edge) => edge.camp === "neutral"), false);
assert.ok(majorBlocs.length >= 8 && majorBlocs.length < 40, `bloc edges ${majorBlocs.length}`);
assert.equal(majorBlocs.every((edge) => edge.scope === "major" && edge.camp === "bloc"), true);
assert.equal(majorEdges.some((edge) => edge.to === "mexico" || edge.from === "mexico"), false);

const natoMajors = RELATION_BLOCS.find((bloc) => bloc.id === "nato").slugs.filter((slug) =>
  majorsOnly.nodes.some((node) => node.id === slug));
assert.ok(linkedBloc(natoMajors, majorBlocs), "NATO majors form one alliance tree");
const fiveEyes = ["australia", "canada", "new-zealand", "united-kingdom"];
assert.ok(linkedBloc(fiveEyes, majorBlocs), "Five Eyes majors are linked");

const europeEdges = relationsFieldEdges(europe);
const europeSpokes = europeEdges.filter((edge) => edge.kind === "spoke");
assert.equal(europeSpokes.length, europe.nodes.length);
assert.ok(europeSpokes.some((edge) => edge.camp === "neutral" && edge.scope === "broad"));
assert.equal(europeSpokes.filter((edge) => edge.scope === "broad").every((edge) =>
  europeBroader.some((node) => node.id === edge.to)), true);
assert.equal(europeEdges.some((edge) => edge.from === "mexico" || edge.to === "mexico"), false);
const austria = europeEdges.find((edge) => edge.kind === "bloc" && (edge.from === "austria" || edge.to === "austria"));
assert.ok(austria && austria.scope === "broad");

assert.deepEqual(laneBands(640, 300, 280), { selectedBand: 320, quietBand: 320 });
{
  const fitted = laneBands(640, 400, 180);
  assert.equal(fitted.selectedBand + fitted.quietBand, 640);
  assert.equal(fitted.selectedBand, 400);
  assert.ok(fitted.quietBand >= 180);
}
{
  const crowded = laneBands(640, 560, 280);
  assert.equal(crowded.selectedBand + crowded.quietBand, 640);
  assert.ok(crowded.quietBand >= 280 * 0.72 - 1);
  assert.ok(crowded.selectedBand > 320 && crowded.selectedBand < 560);
}
assert.deepEqual(laneBands(0, 400, 200), { selectedBand: 0, quietBand: 0 });
{
  const short = laneBands(280, 400, 200);
  assert.equal(short.selectedBand + short.quietBand, 280);
  assert.ok(short.quietBand >= 140);
  assert.ok(short.selectedBand >= 140);
}

assert.equal(stateUrl("https://plotmaniac.com/", { view: "pick" }, ""), "/");
assert.match(stateUrl("https://plotmaniac.com/", { view: "web", plot: "united-states", year: 1942 }, ""), /plot=united-states/);
assert.match(stateUrl("https://plotmaniac.com/", { view: "web", plot: "united-states", year: 1942 }, ""), /year=1942/);

assert.equal(COMPACT_MAX_WIDTH, 768);
assert.equal(visibleRelationCountries(usCountries).length, 31);
assert.equal(visibleRelationCountries(usCountries, ["Europe"]).every((country) => country.region === "Europe"), true);
const groupedStatus = groupCountriesByStatus(visibleRelationCountries(usCountries));
assert.equal(groupedStatus.friend.length, 24);
assert.equal(groupedStatus.foe.length, 7);
assert.equal(groupedStatus.neutral.length, 0);
const europeStatus = groupCountriesByStatus(visibleRelationCountries(usCountries, ["Europe"]));
assert.ok(europeStatus.neutral.length > 0);
assert.ok(europeStatus.friend.length > 0);

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.match(html, /viewport-fit=cover/, "mobile viewport should include safe-area");
assert.match(html, /id="hub-select"/, "hub focus control");
assert.match(html, /Gallery of obsessions/, "pick view eyebrow");
assert.match(html, /id="plot-search"/, "homepage plot search");
assert.match(html, /Turn rabbit holes into clickable plots: maps, webs, lists, timelines\./, "homepage tagline");
const css = fs.readFileSync(new URL("../lore.css", import.meta.url), "utf8");
assert.match(css, /max-width: 768px/, "compact layout breakpoint");
assert.match(css, /\.gallery-search/, "homepage search is an underline field");
assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/, "desktop gallery is 3 columns");
assert.match(css, /\.plot-cards > li/, "gallery items stretch so cards share a height");
assert.match(css, /-webkit-line-clamp: 2/, "gallery titles can wrap to two lines");
assert.equal(/\.plot-card strong \{[^}]*min-height:/.test(css), false, "gallery titles do not reserve a blank second line");
assert.match(css, /body\[data-view="pick"\] h1 \{[\s\S]*?6\.4rem/, "pick view keeps the large title");
assert.match(css, /\.spine-event/, "vertical timeline cards");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
const partitionViewSource = fs.readFileSync(new URL("../partition-view.js", import.meta.url), "utf8");
assert.match(appSource, /function renderSpine/, "compact timeline renders a vertical spine");
assert.match(appSource, /function fillHubSelect/, "youtubers plot can switch timeline hubs");
assert.match(appSource, /function filterGallery/, "homepage search filters plot cards");
assert.match(appSource, /function enhanceSelect/, "plot and focus use themed choice menus");
assert.match(css, /\.choice-menu/, "choice menus match the ink and gold chrome");
assert.match(appSource, /textContent = "All"/, "focus can show every YouTuber");
assert.match(appSource, /function applyHubCamera/, "the web eases its zoom to the current focus");
assert.match(appSource, /Map \+ people/, "Partition navigation names its map and people view");
assert.match(partitionViewSource, /Who wanted what — and who made the call/, "Partition overview explains decision-makers");
assert.match(partitionViewSource, /Show Kashmir claims overlay/, "claims control explains its effect");
assert.match(partitionViewSource, /showPerson\(/, "person pages swap in place");
assert.match(appSource, /partitionMount\.showPerson/, "opening another person keeps the person mount");
const partitionCss = fs.readFileSync(new URL("../partition.css", import.meta.url), "utf8");
assert.match(partitionCss, /body\[data-board="history"\] h1 \{[\s\S]*?margin: 0 0 8px;/, "Partition title sits on the lede");
assert.match(partitionCss, /body\[data-board="history"\] \.mark \{\s*display: none;/, "Partition drops the gold arc between title and lede");
assert.match(partitionCss, /\.partition-beat li[\s\S]*?font-size: 0\.78rem/, "beat bullets match the moment copy");
assert.match(partitionCss, /\.partition-person-page \{\s*width: 100%;/, "person page uses the board width");
assert.match(partitionCss, /\.partition-person-page h2 \{\s*font-size: 2rem;/, "person headers stay one size");
assert.match(partitionCss, /body\[data-board="history"\]\[data-view="timeline"\] \.app \{[\s\S]*?width: 100%;/, "Partition full timeline uses the page width");
assert.match(partitionCss, /\.partition-actions strong \{[\s\S]*?font-size: inherit/, "action names stay body size");
assert.match(partitionViewSource, /buildLaneChrome/, "Partition full timeline uses the shared horizontal lane");
assert.match(partitionViewSource, /oldest on the left/, "Partition desktop timeline reads left to right");
assert.match(partitionViewSource, /playerDisplayName\(person\) \|\| action\.playerId/, "timeline action lines use short names");
assert.match(partitionViewSource, /COMPACT_MAX_WIDTH/, "Partition timeline follows the compact breakpoint");
const laneSource = fs.readFileSync(new URL("../lane.js", import.meta.url), "utf8");
assert.match(laneSource, /export function buildLaneChrome/, "shared lane chrome builds the horizontal rail");
assert.match(appSource, /from "\.\/lane\.js"/, "other plots share the same lane chrome");
assert.match(css, /\.web-stage\.is-hub-field/, "hub web can scale to the page");
assert.match(appSource, /Shared people sit in the center/, "youtubers web describes the shared center");
assert.match(css, /\.web-stage \.node-name/, "web names stay inside their node");
assert.match(css, /\.web-stage\.is-hub-field \.node-name \{[\s\S]*?white-space: normal/, "hub names stay fully readable when the camera zooms");
assert.match(appSource, /relations-lists/, "compact country web uses a list layout");
assert.match(appSource, /renderRelationSentimentChart/, "country drawer can chart bilateral warmth");
assert.match(appSource, /renderSourceChips/, "country history can show source chips");
assert.match(appSource, /beat\.links/, "per-beat source links render in the country panel");
assert.match(appSource, /country-sources-label/, "country-level sources are labeled");
assert.match(css, /\.relation-sentiment/, "relationship warmth chart styles");
assert.match(css, /\.relation-links/, "source chip styles");

assert.deepEqual(
  httpsSourceLinks([
    { label: "Keep", url: "https://history.state.gov/countries/russia" },
    { label: "Skip http", url: "http://example.com/old" },
    { label: "Skip empty", url: "" },
    { url: "https://example.com/no-label" },
    { label: "Skip relative", url: "/local" },
  ]).map((link) => link.label),
  ["Keep"],
);

const mexico = usCountries.find((country) => country.slug === "mexico");
assert.ok(mexico, "mexico country record");
assert.ok(relationTimelineHasTone(mexico.timeline), "mexico timeline carries warmth scores");
assert.ok(mexico.timeline.length >= 24, "mexico timeline is detailed");
const mexSeries = relationToneSeries(mexico.timeline);
assert.equal(mexSeries.length, mexico.timeline.length);
assert.ok(mexSeries.every((point) => point.year > 1700));
const mexChart = relationSentimentChart(mexico.timeline);
assert.ok(mexChart.linePath.startsWith("M"));
assert.ok(mexChart.areaPath.endsWith("Z"));
assert.ok(mexChart.points.length >= 24);
assert.equal(parseRelationTimelineYear("1942–1964"), 1942);
assert.equal(parseRelationTimelineYear("1822"), 1822);
assert.ok(mexChart.maxYear <= 2030 && mexChart.minYear >= 1800, "chart years stay in human range");
assert.match(
  stateUrl("https://plotmaniac.com/", { view: "relation", plot: "united-states", country: "mexico" }, ""),
  /view=relation.*country=mexico/,
);
assert.match(appSource, /renderRelationPage/, "full-page bilateral timeline view");
assert.match(appSource, /function paintPolicySelection/, "topic plots open a policy side panel");
assert.match(appSource, /policy-drawer/, "policy panel reuses the drawer chrome");
assert.match(appSource, /usesPolicyPanel/, "topic-plot clicks stay on the board");
assert.match(appSource, /renderRelationRide/, "full page scrolls a rising and falling relationship");
assert.match(appSource, /relation-ride-links/, "ride readout can show beat sources");
assert.match(appSource, /relation-ride-identity/, "full timeline shows the partner flag");
assert.match(appSource, /rider-flag-partner/, "ride rider uses the partner country flag");
assert.match(appSource, /dataset\.partner/, "ride rider stamps the partner slug");
assert.doesNotMatch(appSource, /rider-mx/, "ride rider is not hard-coded to Mexico");
assert.doesNotMatch(appSource, /#006847/, "ride rider does not paint Mexico green stripes");
const ride = relationRideLayout(mexico.timeline);
assert.ok(ride.width > 4000, "ride is wide enough to scroll");
assert.equal(ride.samples.length > ride.points.length, true);
assert.ok(ride.samples.every((sample, index) => !index || sample.x >= ride.samples[index - 1].x - 0.01));
const high = ride.points.find((point) => point.tone === 2);
const low = ride.points.find((point) => point.tone === -2);
assert.ok(high.y < ride.zeroY && low.y > ride.zeroY);
const mid = relationRideAt(ride, (high.x + low.x) / 2);
assert.ok(mid.y > Math.min(high.y, low.y) && mid.y < Math.max(high.y, low.y));
assert.equal(relationMoodLabel(2), "Warm");
assert.equal(relationMoodLabel(-2), "Hostile");
assert.match(
  mexico.timeline[0].event,
  /recognizes independent Mexico/,
  "mexico narrative beats stay intact while sources are added",
);

const russia = usCountries.find((country) => country.slug === "russia");
assert.ok(russia, "russia country record");
assert.equal(russia.status, "foe");
assert.equal(russia.outline, "red");
assert.equal(russia.first_load, true);
assert.ok(relationTimelineHasTone(russia.timeline), "russia timeline carries warmth scores");
assert.ok(russia.timeline.length >= 20, "russia timeline is detailed");
assert.ok(russia.timeline.length <= 40, "russia timeline stays a readable country drawer, not an encyclopedia");
const rusSeries = relationToneSeries(russia.timeline);
assert.equal(rusSeries.length, russia.timeline.length);
assert.ok(rusSeries.every((point) => point.year >= 1800 && point.year <= 2030));
assert.ok(rusSeries.every((point) => point.tone >= -2 && point.tone <= 2));
const rusChart = relationSentimentChart(russia.timeline);
assert.ok(rusChart.linePath.startsWith("M"));
assert.ok(rusChart.points.length >= 20);
assert.match(russia.notes_summary, /Cold War/);
assert.match(russia.notes_summary, /Ukraine/);
const rusYears = russia.timeline.map((beat) => String(beat.year));
["1809", "1867", "1933", "1941", "1962", "1991", "2014", "2016", "2022"].forEach((year) => {
  assert.ok(rusYears.includes(year), `russia timeline covers ${year}`);
});

const iran = usCountries.find((country) => country.slug === "iran");
assert.ok(iran, "iran country record");
assert.equal(iran.status, "foe");
assert.equal(iran.outline, "red");
assert.equal(iran.first_load, true);
assert.equal(iran.formal_relations, false);
assert.ok(relationTimelineHasTone(iran.timeline), "iran timeline carries warmth scores");
assert.ok(iran.timeline.length >= 25, "iran timeline is detailed");
assert.ok(iran.timeline.length <= 40, "iran timeline stays a readable country drawer, not an encyclopedia");
const iranSeries = relationToneSeries(iran.timeline);
assert.equal(iranSeries.length, iran.timeline.length);
assert.ok(iranSeries.every((point) => point.year >= 1850 && point.year <= 2030));
assert.ok(iranSeries.every((point) => point.tone >= -2 && point.tone <= 2));
const iranChart = relationSentimentChart(iran.timeline);
assert.ok(iranChart.linePath.startsWith("M"));
assert.ok(iranChart.points.length >= 25);
assert.match(iran.notes_summary, /hostage|1979/);
assert.match(iran.notes_summary, /nuclear/);
const iranYears = iran.timeline.map((beat) => String(beat.year));
["1850", "1883", "1953", "1979", "1980", "2015", "2018", "2020", "2025", "2026"].forEach((year) => {
  assert.ok(iranYears.includes(year), `iran timeline covers ${year}`);
});
assert.ok(iran.timeline.some((beat) => beat.tone === 2), "iran timeline includes a warm peak");
assert.ok(iran.timeline.some((beat) => beat.tone === -2), "iran timeline includes a hostile trough");

const usPeopleById = new Map(usPeople.map((person) => [person.id, person]));
const rusFlags = relationRiderFlags(russia, usPeopleById, { centerId: us.centerId });
assert.equal(rusFlags.partner.slug, "russia");
assert.match(rusFlags.partner.src, /Flag_of_Russia\.svg/, "russia ride uses the Russian flag");
assert.match(rusFlags.center.src, /Flag_of_the_United_States\.svg/, "russia ride still holds the U.S. flag");
const rusFallback = relationRiderFlags({ slug: "russia", country: "Russia" }, new Map(), { centerId: us.centerId });
assert.match(rusFallback.partner.src, /Flag_of_Russia\.svg/, "russia flag FilePath works without a portrait lookup");
assert.match(commonsFlagSrc("Russia"), /Flag_of_Russia\.svg/);
assert.notEqual(rusFlags.partner.src, rusFlags.center.src);
const mexFlags = relationRiderFlags(mexico, usPeopleById, { centerId: us.centerId });
assert.equal(mexFlags.partner.slug, "mexico");
assert.match(mexFlags.partner.src, /Flag_of_Mexico\.svg/, "mexico ride keeps the Mexican flag");
assert.match(mexFlags.center.src, /Flag_of_the_United_States\.svg/);
assert.equal(usPeopleById.get("russia")?.portrait?.frame, "flag");
const iranFlags = relationRiderFlags(iran, usPeopleById, { centerId: us.centerId });
assert.match(iranFlags.partner.src, /Flag_of_Iran\.svg/, "iran ride uses the Iranian flag");
assert.match(iranFlags.center.src, /Flag_of_the_United_States\.svg/, "iran ride still holds the U.S. flag");
assert.equal(usPeopleById.get("iran")?.portrait?.frame, "flag");

const assertCountrySourceLinks = (country, { minShare = 0.5 } = {}) => {
  assert.ok(Array.isArray(country.links) && country.links.length, `${country.slug} needs country-level sources`);
  country.links.forEach((link) => {
    assert.match(link.url, /^https:\/\//, `${country.slug} country source must use https`);
    assert.ok(link.label, `${country.slug} country source needs a label`);
  });
  const beats = country.timeline || [];
  const withLinks = beats.filter((beat) => Array.isArray(beat.links) && beat.links.length);
  assert.ok(withLinks.length / beats.length >= minShare, `${country.slug} should source most beats`);
  beats.forEach((beat, index) => {
    assert.equal(typeof beat.tone, "number", `${country.slug} beat ${index} needs a tone`);
    assert.ok(beat.year && beat.event, `${country.slug} beat ${index} needs year and event`);
    (beat.links || []).forEach((link) => {
      assert.match(link.url, /^https:\/\//, `${country.slug} ${beat.year} source must use https`);
      assert.ok(link.label, `${country.slug} ${beat.year} source needs a label`);
    });
  });
};
assertCountrySourceLinks(mexico);
assertCountrySourceLinks(russia);
assertCountrySourceLinks(iran);

const afghanistan = usCountries.find((country) => country.slug === "afghanistan");
assert.equal(afghanistan.links, undefined, "thin country records may omit links");
assert.equal(
  afghanistan.timeline.every((beat) => !beat.links),
  true,
  "plots without beat links still have valid timelines",
);
assert.equal(httpsSourceLinks(afghanistan.timeline[0]?.links).length, 0);

const obamaPeople = readJson("../data/barack-obama/people.json");
const obamaEvents = readJson("../data/barack-obama/events.json");
const obamaRelations = readJson("../data/barack-obama/relations.json");
const obama = plots.plots.find((item) => item.id === "barack-obama");
const obamaIds = new Set(obamaPeople.map((person) => person.id));
assert.ok(obama, "barack obama plot is registered");
assert.equal(obama.centerId, "barack-obama");
assert.equal(obama.arrangement, "topics");
assert.equal(obama.images, "bubbles");
assert.ok(obama.topics?.length >= 5);
const obamaTopicIds = new Set(obama.topics.map((topic) => topic.id));
assert.deepEqual(obama.friendKinds, ["supported"]);
assert.deepEqual(obama.enemyKinds, ["opposed"]);
assert.equal(obama.year.min, 1996);
assert.equal(obama.year.max, 2017);
assert.equal(obama.year.initial, 2012);
assert.equal(obamaIds.size, obamaPeople.length);
assert.ok(obamaEvents.length >= 35, `obama timeline should be dense, got ${obamaEvents.length}`);
assert.equal(new Set(obamaEvents.map((event) => event.id)).size, obamaEvents.length);

const obamaById = new Map(obamaPeople.map((person) => [person.id, person]));
for (const person of obamaPeople) {
  assert.ok(person.name && person.role, `${person.id} needs a name and role`);
  assert.ok(Array.isArray(person.tags) && person.tags.length, `${person.id} needs filter tags`);
  if (person.id !== "barack-obama") {
    assert.ok(obamaTopicIds.has(person.topic), `${person.id} needs a known topic`);
  }
}
const obamaPortrait = obamaById.get("barack-obama").portrait;
assert.match(obamaPortrait.src, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//);
assert.equal(obamaPortrait.license, "Public domain");
assert.ok(obamaPortrait.author && obamaPortrait.licenseUrl);

for (const event of obamaEvents) {
  assert.match(event.date, /^\d{4}-\d{2}-\d{2}$/, event.id);
  assert.ok(event.title && event.summary && event.era, event.id);
  assert.ok(event.people.includes("barack-obama"), event.id);
  event.people.forEach((id) => assert.ok(obamaIds.has(id), `${event.id} references ${id}`));
  assert.ok(event.links?.length, event.id);
  event.links.forEach((link) => {
    assert.match(link.url, /^https:\/\//, event.id);
    assert.ok(link.label && link.type, event.id);
  });
  assert.ok(eventTease(event).length <= 140, `${event.id} tease is too long`);
}

const obamaEras = new Set(obamaEvents.map((event) => event.era));
["illinois", "senate", "first-term", "second-term"].forEach((era) => {
  assert.ok(obamaEras.has(era), era);
});

for (const relation of obamaRelations) {
  assert.ok(obamaIds.has(relation.from) && obamaIds.has(relation.to), `${relation.from}→${relation.to}`);
  assert.ok(relation.kind && relation.label, "obama relations need kind and label");
  assert.ok(["supported", "opposed"].includes(relation.kind), relation.kind);
}
for (const person of obamaPeople.filter((person) => person.id !== "barack-obama")) {
  assert.ok(
    obamaRelations.some((relation) =>
      [relation.from, relation.to].includes("barack-obama") &&
      [relation.from, relation.to].includes(person.id)),
    `${person.id} needs an Obama stance`,
  );
  assert.ok(
    obamaEvents.some((event) => event.people.includes(person.id)),
    `${person.id} needs a timeline beat`,
  );
}

const obamaStance = (id, year) => campOf(id, obamaRelations, obama.centerId, obama.friendKinds, obama.enemyKinds, year);
assert.equal(obamaStance("same-sex-marriage", 1996), "friend");
assert.equal(obamaStance("same-sex-marriage", 2008), "enemy");
assert.equal(obamaStance("same-sex-marriage", 2011), "enemy");
assert.equal(obamaStance("same-sex-marriage", 2012), "friend");
assert.equal(obamaStance("individual-mandate", 2008), "enemy");
assert.equal(obamaStance("individual-mandate", 2010), "friend");
assert.equal(obamaStance("nsa-surveillance", 2007), "enemy");
assert.equal(obamaStance("nsa-surveillance", 2009), "friend");
assert.equal(obamaStance("daca", 2011), "enemy");
assert.equal(obamaStance("daca", 2012), "friend");
assert.equal(obamaStance("cuba-relations", 2010), "enemy");
assert.equal(obamaStance("cuba-relations", 2015), "friend");
assert.equal(obamaStance("medical-marijuana", 2008), "friend");
assert.equal(obamaStance("medical-marijuana", 2012), "enemy");
assert.equal(obamaStance("medical-marijuana", 2014), "friend");
assert.equal(obamaStance("afghanistan-surge", 2009), "friend");
assert.equal(obamaStance("afghanistan-surge", 2014), "enemy");
assert.equal(obamaStance("iraq-war", 2008), "enemy");
assert.equal(obamaStance("iraq-war", 2011), "enemy");
assert.equal(obamaStance("affordable-care-act", 2010), "friend");
assert.equal(obamaStance("keystone-xl", 2015), "enemy");
assert.equal(obamaStance("trans-pacific-partnership", 2008), "orbit");
assert.equal(obamaStance("syria-strike", 2012), "friend");
assert.equal(obamaStance("syria-strike", 2014), "enemy");
assert.equal(obamaStance("abortion-rights", 2008), "friend");

const obamaLayoutOpts = {
  centerId: obama.centerId,
  friendKinds: obama.friendKinds,
  enemyKinds: obama.enemyKinds,
  arrangement: "topics",
  topics: obama.topics,
  events: obamaEvents,
  width: 1100,
  height: 800,
};
const obama2008 = webLayout(obamaPeople, obamaRelations, { ...obamaLayoutOpts, year: 2008 });
const obama2012 = webLayout(obamaPeople, obamaRelations, { ...obamaLayoutOpts, year: 2012 });
const obamaEconomy = webLayout(obamaPeople, obamaRelations, { ...obamaLayoutOpts, year: 2012, topicId: "economy" });
const obamaCompact = webLayout(obamaPeople, obamaRelations, {
  ...obamaLayoutOpts,
  year: 2012,
  width: 390,
  height: 720,
});
const obamaViewport = webLayout(obamaPeople, obamaRelations, {
  ...obamaLayoutOpts,
  year: 2012,
  width: 1280,
  height: 500,
});
const assertNoTopicOverlap = (layout, label) => {
  for (let i = 0; i < layout.nodes.length; i += 1) {
    for (let j = i + 1; j < layout.nodes.length; j += 1) {
      const a = layout.nodes[i];
      const b = layout.nodes[j];
      const overlapX = (a.boxWidth + b.boxWidth) / 2 + 2 - Math.abs(a.x - b.x);
      const overlapY = (a.boxHeight + b.boxHeight) / 2 + 2 - Math.abs(a.y - b.y);
      assert.ok(overlapX <= 0 || overlapY <= 0, `${label}: ${a.id} overlaps ${b.id}`);
    }
  }
};
assert.equal(
  obama2012.nodes.length,
  obamaPeople.length + obama.topics.length,
  "policies and topic hubs sit on the board",
);
const obamaHubs = obama2012.nodes.filter((node) => node.camp === "topic");
assert.equal(obamaHubs.length, obama.topics.length, "each topic category is a hub on the web");
assert.ok(
  obama2012.edges.some((edge) => edge.from === "barack-obama" && edge.to === "topic:economy"),
  "center links to topic hubs",
);
assert.ok(
  obama2012.edges.some((edge) => edge.from === "topic:social" && edge.to === "same-sex-marriage"),
  "policies branch from their topic hub",
);
assert.equal(obamaEconomy.nodes.every((node) => node.camp === "center" || node.camp === "topic" || node.topic === "economy"), true);
assert.ok(obamaEconomy.nodes.length < obama2012.nodes.length);
assert.ok(obamaEconomy.nodes.length > 5);
const marriage2008 = obama2008.nodes.find((node) => node.id === "same-sex-marriage");
const marriage2012 = obama2012.nodes.find((node) => node.id === "same-sex-marriage");
const mandate2008 = obama2008.nodes.find((node) => node.id === "individual-mandate");
const mandate2012 = obama2012.nodes.find((node) => node.id === "individual-mandate");
const iraq2008 = obama2008.nodes.find((node) => node.id === "iraq-war");
const center2008 = obama2008.nodes.find((node) => node.id === "barack-obama");
assert.equal(marriage2008.camp, "enemy");
assert.equal(marriage2012.camp, "friend");
assert.equal(mandate2008.camp, "enemy");
assert.equal(mandate2012.camp, "friend");
assert.equal(iraq2008.camp, "enemy");
const around2008 = obama2008.nodes.filter((node) => node.camp !== "center");
assert.ok(around2008.some((node) => node.x < center2008.x) && around2008.some((node) => node.x > center2008.x));
assert.ok(around2008.some((node) => node.y < center2008.y) && around2008.some((node) => node.y > center2008.y));
const social2012 = obama2012.nodes.filter((node) => node.topic === "social");
const foreign2012 = obama2012.nodes.filter((node) => node.topic === "foreign");
const meanAngle = (list) => {
  const mid = obama2012.nodes.find((node) => node.camp === "center");
  return list.reduce((sum, node) => sum + Math.atan2(node.y - mid.y, node.x - mid.x), 0) / list.length;
};
assert.ok(Math.abs(meanAngle(social2012) - meanAngle(foreign2012)) > 0.4, "topics occupy different wedges");
assert.ok(obama2012.nodes.every((node) => node.x > 8 && node.x < 1092 && node.y > 8 && node.y < 792));
assertNoTopicOverlap(obama2012, "desktop topic layout");
assertNoTopicOverlap(obamaViewport, "desktop viewport topic layout");
assertNoTopicOverlap(obamaEconomy, "focused topic layout");
assertNoTopicOverlap(obamaCompact, "compact topic layout");
assert.ok(obamaCompact.height > 720, "compact topic layout grows vertically instead of stacking bubbles");
assert.ok(
  obamaCompact.nodes.every((node) =>
    node.x - node.boxWidth / 2 >= 0 &&
    node.x + node.boxWidth / 2 <= obamaCompact.width &&
    node.y - node.boxHeight / 2 >= 0 &&
    node.y + node.boxHeight / 2 <= obamaCompact.height),
  "compact topic bubbles stay inside the field",
);
assert.match(
  stateUrl("https://plotmaniac.com/", { view: "web", plot: "barack-obama", year: 2012 }, ""),
  /plot=barack-obama/,
);
assert.match(
  stateUrl("https://plotmaniac.com/", { view: "web", plot: "barack-obama", year: 2012 }, ""),
  /year=2012/,
);

const vancePeople = readJson("../data/jd-vance/people.json");
const vanceEvents = readJson("../data/jd-vance/events.json");
const vanceRelations = readJson("../data/jd-vance/relations.json");
const vance = plots.plots.find((item) => item.id === "jd-vance");
const vanceIds = new Set(vancePeople.map((person) => person.id));
assert.ok(vance, "jd vance plot is registered");
assert.equal(vance.centerId, "jd-vance");
assert.equal(vance.arrangement, "topics");
assert.equal(vance.images, "bubbles");
assert.ok(vance.topics?.length >= 5);
const vanceTopicIds = new Set(vance.topics.map((topic) => topic.id));
assert.deepEqual(vance.friendKinds, ["supported"]);
assert.deepEqual(vance.enemyKinds, ["opposed"]);
assert.equal(vance.friendLabel, "Supported");
assert.equal(vance.enemyLabel, "Opposed");
assert.equal(vance.orbitLabel, "No stance yet");
assert.equal(vance.year.min, 2012);
assert.equal(vance.year.max, 2026);
assert.equal(vance.year.initial, 2024);
assert.deepEqual(vance.year.marks, [2012, 2016, 2021, 2024, 2026]);
assert.equal(vanceIds.size, vancePeople.length);
assert.ok(vanceEvents.length >= 35, `vance timeline should be dense, got ${vanceEvents.length}`);
assert.equal(new Set(vanceEvents.map((event) => event.id)).size, vanceEvents.length);

const vanceById = new Map(vancePeople.map((person) => [person.id, person]));
for (const person of vancePeople) {
  assert.ok(person.name && person.role, `${person.id} needs a name and role`);
  assert.ok(Array.isArray(person.tags) && person.tags.length, `${person.id} needs filter tags`);
  if (person.id !== "jd-vance") {
    assert.ok(vanceTopicIds.has(person.topic), `${person.id} needs a known topic`);
    assert.ok(person.links?.length, `${person.id} needs at least one source`);
    person.links.forEach((link) => {
      assert.match(link.url, /^https:\/\//, person.id);
      assert.ok(link.label, person.id);
    });
  }
}
const vancePortrait = vanceById.get("jd-vance").portrait;
assert.match(vancePortrait.src, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//);
assert.equal(vancePortrait.license, "Public domain");
assert.ok(vancePortrait.author && vancePortrait.licenseUrl);
assert.match(vance.cardImage, /VancePortrait/);

for (const event of vanceEvents) {
  assert.match(event.date, /^\d{4}-\d{2}-\d{2}$/, event.id);
  assert.ok(event.title && event.summary && event.era, event.id);
  assert.ok(event.people.includes("jd-vance"), event.id);
  event.people.forEach((id) => assert.ok(vanceIds.has(id), `${event.id} references ${id}`));
  assert.ok(event.links?.length, event.id);
  event.links.forEach((link) => {
    assert.match(link.url, /^https:\/\//, event.id);
    assert.ok(link.label && link.type, event.id);
  });
  assert.ok(eventTease(event).length <= 140, `${event.id} tease is too long`);
}

const vanceEras = new Set(vanceEvents.map((event) => event.era));
["yale", "author", "campaign", "senate", "vice-president"].forEach((era) => {
  assert.ok(vanceEras.has(era), era);
});
assert.ok(vanceEvents.some((event) => event.date.startsWith("2012-")), "needs 2012 coverage");
assert.ok(vanceEvents.some((event) => event.date.startsWith("2026-")), "needs 2026 coverage");

for (const relation of vanceRelations) {
  assert.ok(vanceIds.has(relation.from) && vanceIds.has(relation.to), `${relation.from}→${relation.to}`);
  assert.ok(relation.kind && relation.label, "vance relations need kind and label");
  assert.ok(["supported", "opposed"].includes(relation.kind), relation.kind);
  assert.ok(relation.start, `${relation.to} needs a start year`);
}
for (const person of vancePeople.filter((person) => person.id !== "jd-vance")) {
  assert.ok(
    vanceRelations.some((relation) =>
      [relation.from, relation.to].includes("jd-vance") &&
      [relation.from, relation.to].includes(person.id)),
    `${person.id} needs a Vance stance`,
  );
  assert.ok(
    vanceEvents.some((event) => event.people.includes(person.id)),
    `${person.id} needs a timeline beat`,
  );
}

const vanceStance = (id, year) => campOf(id, vanceRelations, vance.centerId, vance.friendKinds, vance.enemyKinds, year);
assert.equal(vanceStance("immigration-restriction", 2012), "enemy");
assert.equal(vanceStance("immigration-restriction", 2020), "enemy");
assert.equal(vanceStance("immigration-restriction", 2021), "friend");
assert.equal(vanceStance("immigration-restriction", 2024), "friend");
assert.equal(vanceStance("donald-trump", 2016), "enemy");
assert.equal(vanceStance("donald-trump", 2020), "enemy");
assert.equal(vanceStance("donald-trump", 2021), "friend");
assert.equal(vanceStance("donald-trump", 2024), "friend");
assert.equal(vanceStance("climate-action", 2020), "friend");
assert.equal(vanceStance("climate-action", 2021), "orbit");
assert.equal(vanceStance("climate-action", 2024), "enemy");
assert.equal(vanceStance("national-abortion-ban", 2022), "friend");
assert.equal(vanceStance("national-abortion-ban", 2024), "enemy");
assert.equal(vanceStance("universities", 2017), "friend");
assert.equal(vanceStance("universities", 2024), "enemy");
assert.equal(vanceStance("iran-military-action", 2023), "enemy");
assert.equal(vanceStance("iran-military-action", 2024), "enemy");
assert.equal(vanceStance("iran-military-action", 2026), "friend");
assert.equal(vanceStance("red-flag-laws", 2018), "friend");
assert.equal(vanceStance("red-flag-laws", 2024), "enemy");
assert.equal(vanceStance("social-security-cuts", 2021), "friend");
assert.equal(vanceStance("social-security-cuts", 2024), "enemy");
assert.equal(vanceStance("parental-voting", 2021), "friend");
assert.equal(vanceStance("parental-voting", 2024), "enemy");
assert.equal(vanceStance("ukraine-aid", 2024), "enemy");
assert.equal(vanceStance("israel-support", 2024), "friend");
assert.equal(vanceStance("china-threat", 2024), "friend");
assert.equal(vanceStance("iraq-war", 2016), "orbit");
assert.equal(vanceStance("iraq-war", 2024), "enemy");
assert.equal(vanceStance("gun-rights", 2024), "friend");
assert.equal(vanceStance("lgbtq-rights", 2024), "enemy");

const vanceLayoutOpts = {
  centerId: vance.centerId,
  friendKinds: vance.friendKinds,
  enemyKinds: vance.enemyKinds,
  arrangement: "topics",
  topics: vance.topics,
  events: vanceEvents,
  width: 1100,
  height: 800,
};
const vance2016 = webLayout(vancePeople, vanceRelations, { ...vanceLayoutOpts, year: 2016 });
const vance2024 = webLayout(vancePeople, vanceRelations, { ...vanceLayoutOpts, year: 2024 });
const vanceForeign = webLayout(vancePeople, vanceRelations, { ...vanceLayoutOpts, year: 2024, topicId: "foreign" });
assert.equal(
  vance2024.nodes.length,
  vancePeople.length + vance.topics.length,
  "policies and topic hubs sit on the board",
);
const vanceHubs = vance2024.nodes.filter((node) => node.camp === "topic");
assert.equal(vanceHubs.length, vance.topics.length, "each topic category is a hub on the web");
assert.ok(
  vance2024.edges.some((edge) => edge.from === "jd-vance" && edge.to === "topic:economy"),
  "center links to topic hubs",
);
assert.ok(
  vance2024.edges.some((edge) => edge.from === "topic:immigration" && edge.to === "immigration-restriction"),
  "policies branch from their topic hub",
);
assert.equal(vanceForeign.nodes.every((node) => node.camp === "center" || node.camp === "topic" || node.topic === "foreign"), true);
assert.ok(vanceForeign.nodes.length < vance2024.nodes.length);
assert.ok(vanceForeign.nodes.length > 5);
const trump2016 = vance2016.nodes.find((node) => node.id === "donald-trump");
const trump2024 = vance2024.nodes.find((node) => node.id === "donald-trump");
const immigration2016 = vance2016.nodes.find((node) => node.id === "immigration-restriction");
const immigration2024 = vance2024.nodes.find((node) => node.id === "immigration-restriction");
const iran2024 = vance2024.nodes.find((node) => node.id === "iran-military-action");
const center2016 = vance2016.nodes.find((node) => node.id === "jd-vance");
assert.equal(trump2016.camp, "enemy");
assert.equal(trump2024.camp, "friend");
assert.equal(immigration2016.camp, "enemy");
assert.equal(immigration2024.camp, "friend");
assert.equal(iran2024.camp, "enemy");
const around2016 = vance2016.nodes.filter((node) => node.camp !== "center");
assert.ok(around2016.some((node) => node.x < center2016.x) && around2016.some((node) => node.x > center2016.x));
assert.ok(around2016.some((node) => node.y < center2016.y) && around2016.some((node) => node.y > center2016.y));
const social2024 = vance2024.nodes.filter((node) => node.topic === "social");
const foreign2024 = vance2024.nodes.filter((node) => node.topic === "foreign");
const vanceMeanAngle = (list) => {
  const mid = vance2024.nodes.find((node) => node.camp === "center");
  return list.reduce((sum, node) => sum + Math.atan2(node.y - mid.y, node.x - mid.x), 0) / list.length;
};
assert.ok(Math.abs(vanceMeanAngle(social2024) - vanceMeanAngle(foreign2024)) > 0.4, "topics occupy different wedges");
assert.ok(vance2024.nodes.every((node) => node.x > 8 && node.x < 1092 && node.y > 8 && node.y < 792));
const vanceCompact = webLayout(vancePeople, vanceRelations, {
  ...vanceLayoutOpts,
  year: 2024,
  width: 390,
  height: 720,
});
const vanceViewport = webLayout(vancePeople, vanceRelations, {
  ...vanceLayoutOpts,
  year: 2024,
  width: 1280,
  height: 500,
});
assertNoTopicOverlap(vance2024, "vance desktop topic layout");
assertNoTopicOverlap(vanceViewport, "vance desktop viewport topic layout");
assertNoTopicOverlap(vanceForeign, "vance focused topic layout");
assertNoTopicOverlap(vanceCompact, "vance compact topic layout");
assert.ok(vanceCompact.height > 720, "vance compact topic layout grows vertically instead of stacking bubbles");
assert.ok(
  vanceCompact.nodes.every((node) =>
    node.x - node.boxWidth / 2 >= 0 &&
    node.x + node.boxWidth / 2 <= vanceCompact.width &&
    node.y - node.boxHeight / 2 >= 0 &&
    node.y + node.boxHeight / 2 <= vanceCompact.height),
  "vance compact topic bubbles stay inside the field",
);
assert.match(
  stateUrl("https://plotmaniac.com/", { view: "web", plot: "jd-vance", year: 2024 }, ""),
  /plot=jd-vance/,
);
assert.match(
  stateUrl("https://plotmaniac.com/", { view: "web", plot: "jd-vance", year: 2024 }, ""),
  /year=2024/,
);

assert.equal(usesPolicyPanel(obama), true);
assert.equal(usesPolicyPanel(vance), true);
assert.equal(usesPolicyPanel(youtubers), false);

const marvelPeople = readJson("../data/marvel-universe/people.json");
const marvelEvents = readJson("../data/marvel-universe/events.json");
const marvelRelations = readJson("../data/marvel-universe/relations.json");
const marvel = plots.plots.find((item) => item.id === "marvel-universe");
const marvelIds = new Set(marvelPeople.map((person) => person.id));
const marvelHubIds = new Set(marvel.hubs.map((hub) => hub.id));
const marvelCenterIds = marvel.hubs.map((hub) => hub.centerId);
assert.ok(marvel, "Marvel plot is registered");
assert.equal(marvel.title, "Marvel Cinematic Universe");
assert.equal(marvel.defaultHub, "all");
assert.equal(marvel.hubAllLabel, "All");
assert.equal(
  parseState("https://plotmaniac.com/?plot=marvel-universe", {
    hubs: new Set(marvel.hubs.map((hub) => hub.id)),
    defaultHub: marvel.defaultHub,
  }).hub,
  "all",
);
assert.equal(
  parseState("https://plotmaniac.com/?plot=marvel-universe&hub=shared", {
    hubs: new Set(marvel.hubs.map((hub) => hub.id)),
    defaultHub: marvel.defaultHub,
  }).hub,
  "",
);
assert.match(
  stateUrl("https://plotmaniac.com/", { view: "web", plot: "marvel-universe", hub: "", defaultHub: "all" }, ""),
  /hub=shared/,
);
assert.ok(marvelPeople.length >= 95 && marvelPeople.length <= 105, `Marvel cast should stay around 100, got ${marvelPeople.length}`);
assert.ok(marvelEvents.length >= 40 && marvelEvents.length <= 70, `Marvel timeline should contain 40–70 beats, got ${marvelEvents.length}`);
assert.equal(marvel.minBeats, 1);
assert.equal(marvel.hubs.length, 7);
assert.deepEqual(
  marvel.hubs.map((hub) => hub.id),
  ["mcu-main", "raimi", "webb", "fox", "earth-838", "first-steps", "venom"],
);
const marvelPortraitLicenses = new Set(["Public domain", "CC0", "CC BY 2.0", "CC BY 3.0", "CC BY 4.0", "CC BY-SA 2.0", "CC BY-SA 3.0", "CC BY-SA 4.0"]);
let marvelPortraits = 0;
for (const person of marvelPeople) {
  assert.ok(person.name && person.role && person.tags?.length, `${person.id} needs core Marvel fields`);
  assert.ok(person.universes?.length && person.universes.every((id) => marvelHubIds.has(id)), `${person.id} needs known universe membership`);
  if (!person.portrait) continue;
  marvelPortraits += 1;
  assert.match(person.portrait.src, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//, person.id);
  assert.match(person.portrait.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, person.id);
  assert.ok(marvelPortraitLicenses.has(person.portrait.license), `${person.id} portrait license`);
  assert.ok(person.portrait.author && person.portrait.licenseUrl, `${person.id} portrait credit`);
}
assert.ok(marvelPortraits >= 95, `Marvel should have Commons portraits for almost every character, got ${marvelPortraits}`);
assert.equal(marvelPeople.find((person) => person.id === "maya-lopez")?.portrait, undefined, "Echo has no free Commons still");
for (const event of marvelEvents) {
  assert.match(event.date, /^\d{4}-\d{2}-\d{2}$/, event.id);
  assert.ok(event.title && event.summary && event.era, event.id);
  assert.ok(event.people?.length && event.people.every((id) => marvelIds.has(id)), `${event.id} has known people`);
  assert.ok(event.hubs?.length && event.hubs.every((id) => marvelHubIds.has(id)), `${event.id} has known hubs`);
  assert.ok(event.links?.length, `${event.id} needs a source`);
  event.links.forEach((link) => assert.match(link.url, /^https:\/\//, event.id));
  assert.ok(eventTease(event).length <= 140, `${event.id} tease is too long`);
}
for (const relation of marvelRelations) {
  assert.ok(marvelIds.has(relation.from) && marvelIds.has(relation.to), `${relation.from}→${relation.to}`);
  assert.ok(relation.kind && relation.label, "Marvel relations need kind and label");
}
for (const hub of marvel.hubs) {
  assert.ok(marvelIds.has(hub.centerId), `${hub.id} needs a character anchor`);
  marvelPeople.filter((person) => person.universes.includes(hub.id) && person.id !== hub.centerId).forEach((person) => {
    assert.ok(
      marvelRelations.some((relation) =>
        relation.kind === "universe-member"
        && ((relation.from === hub.centerId && relation.to === person.id)
          || (relation.to === hub.centerId && relation.from === person.id))),
      `${person.id} needs a ${hub.id} membership edge`,
    );
  });
}
assert.equal(hubsForPerson("norman-osborn-raimi", marvelRelations, marvelCenterIds).join(), "peter-parker-raimi");
assert.equal(campOf("steve-rogers", marvelRelations, marvel.centerId, marvel.friendKinds, marvel.enemyKinds), "enemy");
assert.equal(campOf("thanos", marvelRelations, marvel.centerId, marvel.friendKinds, marvel.enemyKinds), "enemy");
const marvelLayoutOptions = {
  centerId: marvel.centerId,
  friendKinds: marvel.friendKinds,
  enemyKinds: marvel.enemyKinds,
  includeOrbit: true,
  minBeats: marvel.minBeats,
  hubIds: marvelCenterIds,
  hubs: marvel.hubs,
  events: marvelEvents,
  width: 1400,
  height: 980,
};
const marvelShared = webLayout(marvelPeople, marvelRelations, marvelLayoutOptions);
const marvelRaimi = webLayout(marvelPeople, marvelRelations, { ...marvelLayoutOptions, centerId: "peter-parker-raimi" });
const marvelAll = webLayout(marvelPeople, marvelRelations, { ...marvelLayoutOptions, centerId: "", revealAll: true });
assert.ok(marvelShared.nodes.length > 0, "seven Marvel hubs produce a web");
assert.equal(marvelShared.nodes.find((node) => node.id === "tony-stark").plotHub, true);
assert.equal(marvelRaimi.nodes.find((node) => node.id === "norman-osborn-raimi").ring, "exclusive");
assert.equal(marvelRaimi.nodes.find((node) => node.id === "otto-octavius-raimi").ring, "exclusive");
assert.ok(marvelAll.nodes.length > marvelShared.nodes.length, "Marvel All reveals exclusive universe members");

assert.equal(boardViewForPerson(obama, "person"), "web");
assert.equal(boardViewForPerson(vance, "person"), "web");
assert.equal(boardViewForPerson(obama, "timeline"), "timeline");
assert.equal(boardViewForPerson(youtubers, "person"), "person");
assert.equal(boardViewForPerson(youtubers, "web"), "web");

const oldObamaPerson = parseState(
  "https://plotmaniac.com/?plot=barack-obama&view=person&person=same-sex-marriage",
  { people: obamaIds },
);
assert.equal(oldObamaPerson.view, "person");
assert.equal(oldObamaPerson.person, "same-sex-marriage");
assert.equal(boardViewForPerson(obama, oldObamaPerson.view), "web");
const policyPanelUrl = stateUrl(
  "https://plotmaniac.com/",
  { view: "web", plot: "barack-obama", person: "same-sex-marriage", year: 2012 },
  "",
);
assert.match(policyPanelUrl, /plot=barack-obama/);
assert.match(policyPanelUrl, /person=same-sex-marriage/);
assert.match(policyPanelUrl, /view=web/);
assert.equal(/view=person/.test(policyPanelUrl), false);

const marriageStances = stanceHistory("same-sex-marriage", obamaRelations, obama.centerId);
assert.equal(marriageStances.length, 3);
assert.equal(marriageStances[0].kind, "supported");
assert.equal(marriageStances[0].start, "1996");
assert.equal(marriageStances[1].kind, "opposed");
assert.equal(marriageStances.at(-1).kind, "supported");
assert.equal(marriageStances.at(-1).start, "2012");
const immigrationStances = stanceHistory("immigration-restriction", vanceRelations, vance.centerId);
assert.equal(immigrationStances.length, 2);
assert.equal(immigrationStances[0].kind, "opposed");
assert.equal(immigrationStances[1].kind, "supported");
assert.ok(obamaEvents.filter((event) => event.people.includes("same-sex-marriage")).length >= 2);
assert.ok(vanceEvents.filter((event) => event.people.includes("donald-trump")).length >= 2);

const partition = plots.plots.find((item) => item.id === "partition-of-india");
assert.equal(partition.arrangement, "historical-map");
assert.match(partition.lede, /Click a region.*year slider/i);
const partitionRef = readJson("../data/partition-of-india/reference.json");
assert.equal(partitionRef.schemaVersion, "1.1.0");
assert.equal(partitionRef.keyPlayers.length, 36);
assert.equal(partitionRef.timeline.length, 29);
const partitionPlayers = new Set(partitionRef.keyPlayers.map((player) => player.id));
const nameEvent = partitionRef.timeline.find((event) => event.id === "evt-1933-pakistan-name");
assert.equal(nameEvent.sortKey, 193301);
assert.ok(chronoKey(19400323) < chronoKey(194203));
assert.ok(chronoKey(19400323) > chronoKey(193909));
for (const event of partitionRef.timeline) {
  event.playerIds.forEach((id) => assert.ok(partitionPlayers.has(id), `${event.id} player ${id}`));
  event.sourceIds.forEach((id) => assert.ok(partitionRef.sourcesCatalog[id], `${event.id} source ${id}`));
  assert.equal(sourceRecords(partitionRef.sourcesCatalog, event.sourceIds).length, event.sourceIds.length);
}
const partitionFrames = buildFrames(partitionRef);
assert.equal(new Set(partitionFrames.map((frame) => frame.id)).size, partitionFrames.length);
const frameIndex = (id) => partitionFrames.findIndex((frame) => frame.id === id);
assert.ok(frameIndex("evt-1932-award") < frameIndex("evt-1933-pakistan-name"));
assert.ok(frameIndex("evt-1939-war") < frameIndex("evt-1940-lahore"));
assert.ok(frameIndex("evt-1940-lahore") < frameIndex("evt-1942-cripps"));
assert.ok(frameIndex("evt-1946-nehru-speech") < frameIndex("evt-1946-direct-action"));
assert.ok(frameIndex("evt-1947-radcliffe-published") < frameIndex("frame-kashmir"));
assert.ok(frameIndex("frame-kashmir") < frameIndex("evt-1948-gandhi-fast"));
assert.ok(frameIndex("frame-bangladesh") < frameIndex("frame-present"));
const radcliffe = partitionFrames.find((frame) => frame.id === "evt-1947-radcliffe-published");
assert.equal(radcliffe.visual.seams.punjab, "set");
assert.equal(radcliffe.visual.seams.bengal, "set");
assert.equal(radcliffe.visual.fills["punjab-west"], "pakistan");
assert.equal(radcliffe.visual.fills["bengal-east"], "eastpak");
assert.ok(radcliffe.visual.flows.includes("meo"));
const kashmir = partitionFrames.find((frame) => frame.id === "frame-kashmir");
assert.equal(kashmir.visual.fills["kashmir-ind"], "india");
assert.equal(kashmir.visual.fills["kashmir-pak"], "pakistan");
assert.equal(kashmir.visual.seams.kashmir, "set");
const bangladesh = partitionFrames.find((frame) => frame.id === "frame-bangladesh");
assert.equal(bangladesh.visual.fills["bengal-east"], "bangladesh");
for (const frame of partitionFrames) {
  Object.keys(frame.visual.fills).forEach((id) => assert.ok(regions.some((region) => region.id === id), id));
  Object.keys(frame.visual.seams).forEach((id) => assert.ok(seams[id], id));
  frame.visual.flows.forEach((id) => assert.ok(flows[id], id));
  frame.visual.markers.forEach((id) => assert.ok(markers[id], id));
  frame.playerIds.forEach((id) => assert.ok(partitionPlayers.has(id), `${frame.id} ${id}`));
  frame.sourceIds.forEach((id) => assert.ok(partitionRef.sourcesCatalog[id], `${frame.id} ${id}`));
}
const june = partitionFrames.find((frame) => frame.id === "evt-1947-june-plan");
assert.equal(june.visual.seams.punjab, "proposed");
const reunited = partitionFrames.find((frame) => frame.id === "evt-1911-bengal-reunite");
assert.equal(reunited.visual.seams.bengal, "off");
assert.equal(reunited.visual.fills["bengal-east"], "raj");
assert.equal(partitionFrames.every((frame) => frame.visual.camera === "all"), true);
const curzon = partitionRef.keyPlayers.find((player) => player.id === "curzon");
const jinnah = partitionRef.keyPlayers.find((player) => player.id === "jinnah");
const decisionIds = decisionMakers(partitionRef, partitionRef.keyPlayers);
assert.deepEqual(decisionIds, ["mountbatten", "patel", "nehru", "jinnah", "radcliffe", "tara"]);
assert.ok(playerAgreements(partitionRef.keyPlayers.find((player) => player.id === "patel"), partitionRef.keyPlayers)
  .some((person) => person.id === "nehru"), "Patel should show an aligned Congress colleague");
assert.equal(playerDisplayName(curzon), "George Nathaniel Curzon");
assert.equal(playerAllegiance(curzon).faction, "British Raj");
assert.match(playerAllegiance(curzon).line, /British Raj/);
assert.equal(playerIncentives(curzon).wanted.includes("Administrative reform"), true);
assert.equal(statedPositions(curzon).some((row) => /N\/A/i.test(row.value)), false);
assert.ok(statedPositions(curzon).some((row) => row.key === "punjabAndBengalDivision"));
const bengal = partitionFrames.find((frame) => frame.id === "evt-1905-bengal");
const playersById = new Map(partitionRef.keyPlayers.map((player) => [player.id, player]));
const bengalCast = eventCast(bengal, playersById, "curzon");
assert.equal(bengalCast[0].id, "curzon");
assert.equal(bengalCast[0].focus, true);
assert.match(bengalCast[0].action, /Eastern Bengal/);
assert.match(playerIncentives(jinnah).line, /\S/);

function ringSpan(polygons) {
  const points = polygons.flat(2);
  const lons = points.map((point) => point[0]);
  const lats = points.map((point) => point[1]);
  return [Math.max(...lons) - Math.min(...lons), Math.max(...lats) - Math.min(...lats)];
}
const [pakistanWidth, pakistanHeight] = ringSpan(outlines.pakistan);
const [bangladeshWidth, bangladeshHeight] = ringSpan(outlines.bangladesh);
assert.ok(pakistanWidth > 12 && pakistanHeight > 8, "Pakistan outline keeps the full west wing");
assert.ok(bangladeshWidth > 3 && bangladeshHeight > 4, "Bangladesh outline keeps the full east wing");
for (const region of regions) {
  assert.ok(region.polygons?.length, `${region.id} has a coastline`);
  assert.ok(region.polygons[0][0].length >= 3, `${region.id} ring`);
}

const portraits = readJson("../data/partition-of-india/portraits.json");
const portraitLicenses = new Set(["Public domain", "CC0", "CC BY 3.0", "CC BY-SA 3.0", "GODL-India"]);
assert.ok(Object.keys(portraits).length >= 30, "most partition figures have a free portrait");
for (const [id, portrait] of Object.entries(portraits)) {
  assert.ok(partitionPlayers.has(id), `${id} portrait is not a researched player`);
  assert.match(portrait.src, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//, id);
  assert.match(portrait.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, id);
  assert.ok(portrait.author && portraitLicenses.has(portrait.license), `${id} license`);
  assert.match(portrait.licenseUrl, /^https:\/\//, id);
}
["mudie", "vp-menon", "rajagopalachari"].forEach((id) => {
  assert.equal(portraits[id], undefined, `${id} has no freely licensed solo portrait`);
});

const warsPlot = plots.plots.find((item) => item.id === "wars");
const warArchive = readJson("../data/wars/conflicts.json");
const world = readJson("../data/world-countries.json");
assert.equal(warsPlot.arrangement, "wars");
assert.equal(warsPlot.year.min, 1900);
assert.equal(warsPlot.year.max, 2026);
assert.equal(warsPlot.sources.length, 5);
assert.equal(boardViewForPerson(warsPlot, "timeline"), "web");
assert.equal(new Set(warArchive.conflicts.map((war) => war.id)).size, warArchive.conflicts.length);
const mapIsos = new Set(world.features.map((feature) => feature.properties.iso));
for (const war of warArchive.conflicts) {
  assert.match(war.wikipedia, /^https:\/\/en\.wikipedia\.org\/wiki\//, war.name);
  assert.ok(war.start >= 1900, war.name);
  assert.ok(war.end == null || war.end >= war.start, war.name);
  for (const side of war.sides) {
    for (const iso of side.states) assert.ok(warArchive.countries[iso], `${war.name} ${iso}`);
  }
}
const iraq = warArchive.conflicts.find((war) => war.name === "Iraq War");
const iraqPairs = opposingPairs(iraq);
assert.ok(iraqPairs.some(([left, right]) => left === "IQ" && right === "US"));
assert.equal(iraqPairs.some(([left, right]) => [left, right].includes("US") && [left, right].includes("GB")), false);
assert.equal(warActive(iraq, 2003), true);
assert.equal(warActive(iraq, 2011), true);
assert.equal(warActive(iraq, 2012), false);
assert.equal(warOverlapsSpan(iraq, 2010, 2014), true);
assert.equal(warOverlapsSpan(iraq, 2015, 2018), false);
assert.deepEqual(parseWarSpan("2014", "2008", warsPlot.year, 2026), { from: 2008, to: 2014 });
assert.deepEqual(parseWarSpan(null, null, warsPlot.year, ""), { from: 2026, to: 2026 });
const early = warsInSpan(warArchive.conflicts, 2003, 2011);
assert.ok(early.wars.some((war) => war.id === iraq.id));
assert.equal(early.wars.some((war) => war.name === "Russian invasion of Ukraine"), false);
const listed = early.wars.slice().sort(compareWarsByStart);
assert.ok(listed.every((war, index) => index === 0 || war.start <= listed[index - 1].start));
assert.deepEqual(
  [{ name: "Beta", start: 2004 }, { name: "Alpha", start: 2004 }, { name: "Zed", start: 2008 }]
    .sort(compareWarsByStart)
    .map((war) => war.name),
  ["Zed", "Alpha", "Beta"],
);
const american = warsForCountry(early.wars, "US");
assert.ok(american.some((war) => war.id === iraq.id));
assert.match(warCountryNote(iraq, "US", warArchive.countries), /Against Iraq/);
const spanUrl = stateUrl("https://plotmaniac.com/", { view: "web", plot: "wars", year: 2011, from: 2003, to: 2011 }, "");
assert.match(spanUrl, /from=2003/);
assert.match(spanUrl, /to=2011/);
const firstWar = warArchive.conflicts.find((war) => war.name === "World War I");
const secondWar = warArchive.conflicts.find((war) => war.name === "World War II");
const korean = warArchive.conflicts.find((war) => war.name === "Korean War");
const vietnam = warArchive.conflicts.find((war) => war.name === "Vietnam War");
assert.ok(opposingPairs(firstWar).some(([left, right]) => left === "DE" && right === "GB"));
assert.ok(opposingPairs(secondWar).some(([left, right]) => left === "DE" && right === "US"));
assert.ok(opposingPairs(secondWar).some(([left, right]) => left === "JP" && right === "US"));
assert.equal(opposingPairs(secondWar).some(([left, right]) => left === "DE" && right === "JP"), false);
assert.ok(opposingPairs(korean).some(([left, right]) => left === "KP" && right === "US"));
assert.ok(opposingPairs(vietnam).some(([left, right]) => left === "US" && right === "VN"));
const greatWar = warsInSpan(warArchive.conflicts, 1914, 1918);
assert.ok(greatWar.wars.some((war) => war.id === firstWar.id));
assert.equal(greatWar.wars.some((war) => war.name === "World War II"), false);
const invasion = warArchive.conflicts.find((war) => war.name === "Russian invasion of Ukraine");
assert.ok(opposingPairs(invasion).some(([left, right]) => left === "RU" && right === "UA"));
assert.match(invasion.wikipedia, /Russian_invasion_of_Ukraine/);
const gaza = warArchive.conflicts.find((war) => war.name === "Gaza war");
assert.ok(opposingPairs(gaza).some(([left, right]) => left === "IL" && right === "PS"));
assert.match(warPartyLine(iraq, warArchive.countries), /United States/);
assert.match(warPartyLine(iraq, warArchive.countries), /against/);
assert.equal(warMatchesFocus(gaza, "country:IL"), true);
assert.equal(warMatchesFocus(gaza, "iraq-war"), false);
const year2022 = warsInYear(warArchive.conflicts, 2022);
assert.ok(year2022.wars.some((war) => war.id === invasion.id));
assert.ok(year2022.pairs.length > 5 && year2022.pairs.length < 80);
const frame = warMapSize();
assert.ok(frame.width / frame.height > 2.3 && frame.width / frame.height < 2.7);
const origin = projectWarPoint(0, 0);
assert.ok(origin.x > frame.width * 0.45 && origin.x < frame.width * 0.55);
const anchors = countryAnchors(world);
assert.ok(anchors.has("US") && anchors.has("FR") && anchors.has("UA"));
const moscow = anchors.get("RU");
assert.ok(moscow.lon > 30 && moscow.lon < 45 && moscow.lat > 50 && moscow.lat < 60);
assert.ok(mapIsos.has("PS") && mapIsos.has("TW"));
assert.ok(anchors.has("BH"));

console.log("never-ending internet lore tests passed");
