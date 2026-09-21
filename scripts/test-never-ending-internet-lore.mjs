import assert from "node:assert/strict";
import fs from "node:fs";
import {
  ALL,
  campOf,
  eventTease,
  filterEvents,
  graphLayout,
  initials,
  parseState,
  relationEvents,
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

console.log("never-ending internet lore tests passed");
