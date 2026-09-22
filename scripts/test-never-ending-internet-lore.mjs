import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ALL,
  campOf,
  countriesByRegion,
  coversYear,
  eventTease,
  expandedSummary,
  filterEvents,
  firstLoadCountries,
  graphLayout,
  groupCountriesByStatus,
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
  relationSentimentChart,
  relationTimelineHasTone,
  relationToneSeries,
  RELATION_REGIONS,
  stateUrl,
  neighborhood,
  visibleRelationCountries,
  webLayout,
  youtubeId,
  COMPACT_MAX_WIDTH,
} from "../engine.js";

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const plots = readJson("../data/plots.json");
const people = readJson("../data/h3/people.json");
const events = readJson("../data/h3/events.json");
const relations = readJson("../data/h3/relations.json");
const ids = new Set(people.map((person) => person.id));
const peopleById = new Map(people.map((person) => [person.id, person]));

assert.equal(ids.size, people.length, "person ids must be unique");
assert.ok(events.length >= 35 && events.length <= 50, "timeline should contain 35–50 events");
assert.equal(new Set(events.map((event) => event.id)).size, events.length, "event ids must be unique");

for (const person of people) {
  assert.ok(person.name && person.role, `${person.id} needs a name and role`);
  assert.ok(Array.isArray(person.tags) && person.tags.length, `${person.id} needs filter tags`);
}

for (const event of events) {
  assert.match(event.date, /^\d{4}-\d{2}-\d{2}$/, `${event.id} needs an ISO date`);
  assert.ok(event.title && event.summary && event.era, `${event.id} is missing core copy`);
  assert.ok(event.people.length >= 1, `${event.id} needs people`);
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

for (const person of people.filter((person) => person.id !== "ethan-klein")) {
  assert.ok(
    relations.some((relation) =>
      [relation.from, relation.to].includes("ethan-klein") &&
      [relation.from, relation.to].includes(person.id)),
    `${person.id} needs an Ethan relationship`,
  );
}

const frenemies = filterEvents(events, { person: "trisha-paytas", era: "frenemies" }, peopleById);
assert.ok(frenemies.length >= 2);
assert.deepEqual(filterEvents(events, { person: ALL, era: ALL }, peopleById), events);
assert.ok(filterEvents(events, { query: "fair use" }, peopleById).length >= 2);

const firstRelation = relations[0];
assert.ok(relationEvents(firstRelation, events).every((event) =>
  event.people.includes(firstRelation.from) && event.people.includes(firstRelation.to)));

const h3 = plots.plots.find((item) => item.id === "h3");
assert.ok(h3, "h3 plot is registered for further plots to sit beside");
assert.equal(h3.centerId, "ethan-klein");
assert.equal(initials("Hila Klein"), "HK");
assert.equal(initials("xQc"), "XQ");
assert.equal(campOf("hila-klein", relations, h3.centerId, h3.friendKinds, h3.enemyKinds), "friend");
assert.equal(campOf("trisha-paytas", relations, h3.centerId, h3.friendKinds, h3.enemyKinds), "enemy");
assert.equal(campOf("david-dobrik", relations, h3.centerId, h3.friendKinds, h3.enemyKinds), "orbit");

const allowedLicenses = new Set(["CC BY 2.0", "CC BY 3.0", "CC BY 4.0", "CC BY-SA 2.0", "CC BY-SA 3.0", "Public domain"]);
for (const person of people) {
  if (!person.portrait) continue;
  assert.match(person.portrait.src, /^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//, person.id);
  assert.match(person.portrait.page, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, person.id);
  assert.ok(allowedLicenses.has(person.portrait.license), `${person.id} portrait license`);
  assert.ok(person.portrait.author && person.portrait.licenseUrl, `${person.id} portrait credit`);
}

const layout = webLayout(people, relations, {
  centerId: h3.centerId,
  friendKinds: h3.friendKinds,
  enemyKinds: h3.enemyKinds,
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
["ethan-klein", "hila-klein", "moses-hacmon"].forEach((id) => assert.ok(trisha.has(id), id));
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
  centerId: h3.centerId,
  friendKinds: h3.friendKinds,
  enemyKinds: h3.enemyKinds,
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
  centerId: h3.centerId,
  friendKinds: h3.friendKinds,
  enemyKinds: h3.enemyKinds,
  events,
});
assert.ok(centerDistance(weighted.nodes, "hila-klein") < centerDistance(weighted.nodes, "moses-hacmon"));
assert.ok(centerDistance(weighted.nodes, "hasan-piker") < centerDistance(weighted.nodes, "philip-de-franco"));
assert.ok(centerDistance(weighted.nodes, "trisha-paytas") < centerDistance(weighted.nodes, "james-charles"));
for (const size of [{ width: 1100, height: 980 }, { width: 1400, height: 720 }, { width: 700, height: 420 }]) {
  const sample = webLayout(people, relations, {
    centerId: h3.centerId,
    friendKinds: h3.friendKinds,
    enemyKinds: h3.enemyKinds,
    events,
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
  centerId: h3.centerId,
  friendKinds: h3.friendKinds,
  enemyKinds: h3.enemyKinds,
  events,
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
  centerId: h3.centerId,
  friendKinds: h3.friendKinds,
  enemyKinds: h3.enemyKinds,
  events,
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
const css = fs.readFileSync(new URL("../lore.css", import.meta.url), "utf8");
assert.match(css, /max-width: 768px/, "compact layout breakpoint");
assert.match(css, /\.spine-event/, "vertical timeline cards");
const appSource = fs.readFileSync(new URL("../app.js", import.meta.url), "utf8");
assert.match(appSource, /function renderSpine/, "compact timeline renders a vertical spine");
assert.match(appSource, /relations-lists/, "compact country web uses a list layout");
assert.match(appSource, /renderRelationSentimentChart/, "country drawer can chart bilateral warmth");
assert.match(css, /\.relation-sentiment/, "relationship warmth chart styles");

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

console.log("never-ending internet lore tests passed");
