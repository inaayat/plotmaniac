import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ALL,
  campOf,
  countriesByRegion,
  coversYear,
  eventTease,
  filterEvents,
  firstLoadCountries,
  graphLayout,
  initials,
  outlineFor,
  parseState,
  parseYear,
  relationEvents,
  RELATION_REGIONS,
  stateUrl,
  neighborhood,
  webLayout,
  youtubeId,
} from "../engine.js";

const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const plots = readJson("../data/plots.json");
const people = readJson("../data/h3/people.json");
const events = readJson("../data/h3/events.json");
const relations = readJson("../data/h3/relations.json");
const ids = new Set(people.map((person) => person.id));
const peopleById = new Map(people.map((person) => [person.id, person]));

assert.equal(ids.size, people.length, "person ids must be unique");
assert.ok(events.length >= 35 && events.length <= 45, "timeline should contain 35–45 events");
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

assert.equal(stateUrl("https://plotmaniac.com/", { view: "pick" }, ""), "/");
assert.match(stateUrl("https://plotmaniac.com/", { view: "web", plot: "united-states", year: 1942 }, ""), /plot=united-states/);
assert.match(stateUrl("https://plotmaniac.com/", { view: "web", plot: "united-states", year: 1942 }, ""), /year=1942/);

console.log("never-ending internet lore tests passed");
