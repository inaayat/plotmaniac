import { COMPACT_MAX_WIDTH, initials } from "./engine.js";
import { buildLaneChrome, laneYear, layoutLane, queueLaneFocus } from "./lane.js";
import {
  cameraBox,
  claimsRing,
  flows,
  labelAnchors,
  linePath,
  markers,
  multiPath,
  outlines,
  project,
  regions,
  ringPath,
  seams,
} from "./partition-geography.js";
import {
  buildFrames,
  chronoKey,
  eventCast,
  kashmirClaimsNote,
  playerAllegiance,
  playerDisplayName,
  playerIncentives,
  regionCaption,
  sourceRecords,
  statedPositions,
  playerAgreements,
  decisionMakers,
} from "./partition-model.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const POLICY_STATES = new Set(["ps-mountbatten-advice", "ps-patel-menon-integration"]);
const TICKS = [
  ["evt-1905-bengal", "1905"],
  ["evt-1911-bengal-reunite", "1911"],
  ["evt-1937-elections", "1937"],
  ["evt-1940-lahore", "1940"],
  ["evt-1946-direct-action", "1946"],
  ["evt-1947-june-plan", "Jun 1947"],
  ["evt-1947-radcliffe-published", "Borders"],
  ["frame-kashmir", "Kashmir"],
  ["evt-1948-gandhi-fast", "1948"],
  ["frame-bangladesh", "1971"],
  ["frame-present", "Now"],
];

function isCompactLayout() {
  return window.matchMedia(`(max-width: ${COMPACT_MAX_WIDTH}px)`).matches;
}

function el(name, className, text) {
  const node = document.createElement(name);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function svgEl(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
}

export function mountPartition(root, reference, {
  frameId = "",
  view = "web",
  personId = "",
  onFrame,
  onOpenPlayer,
  onOpenTimeline,
  onShowMap,
  portraits = {},
} = {}) {
  const frames = buildFrames(reference);
  const players = new Map(reference.keyPlayers.map((player) => [player.id, player]));
  const princes = reference.princelyStateActors.filter((entry) => !POLICY_STATES.has(entry.id));
  let index = Math.max(0, frames.findIndex((frame) => frame.id === frameId));
  let selectedRegion = "";
  let claimsOn = false;
  let query = "";
  const shell = el("section", "partition");
  shell.setAttribute("aria-label", "Partition of India");
  root.appendChild(shell);

  if (view === "person" && players.has(personId)) {
    renderPerson(players.get(personId));
    revealPersonTop();
  }
  else if (view === "timeline") renderTimeline();
  else renderOverview();

  function onKey(event) {
    if (view !== "web") return;
    if (event.target.closest("input, textarea, select, a, button")) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToIndex(index + 1, { historyMode: "push" });
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToIndex(index - 1, { historyMode: "push" });
    }
  }
  window.addEventListener("keydown", onKey);

  return {
    modeKey: () => `${view}:${isCompactLayout() ? "compact" : "wide"}`,
    goTo(id) {
      const next = frames.findIndex((item) => item.id === id);
      if (next < 0) return;
      index = next;
      if (view === "web") shell.paintOverview?.();
      if (view === "timeline") shell.paintTimelineSelection?.();
    },
    showPerson(id) {
      const person = players.get(id);
      if (!person || view !== "person") return;
      const swap = () => {
        paintPerson(person);
        revealPersonTop();
      };
      if (typeof document.startViewTransition === "function") {
        document.startViewTransition(swap);
        return;
      }
      shell.classList.add("is-person-swap");
      requestAnimationFrame(() => {
        swap();
        requestAnimationFrame(() => shell.classList.remove("is-person-swap"));
      });
    },
    destroy() {
      window.removeEventListener("keydown", onKey);
    },
  };

  function frame() {
    return frames[index];
  }

  function renderOverview() {
    const figure = el("div", "partition-figure");
    const mapWrap = el("div", "partition-map-wrap");
    const svg = buildMap();
    const legend = buildLegend();
    const instruction = el("p", "partition-map-instruction", "Click a region to inspect it. Use the year slider to replay the map; the people and decisions are below.");
    const note = el("p", "partition-legend-note", "Coastlines follow the modern outlines of India, Pakistan, and Bangladesh. Nepal and Bhutan stay on the map so the land does not look broken.");
    mapWrap.append(svg, instruction, legend, note);

    const beat = el("div", "partition-beat");
    const scrubber = buildScrubber();
    figure.append(mapWrap, beat);
    const cast = el("div", "partition-cast-wrap");
    const princesBlock = el("div", "partition-princes");
    shell.append(figure, scrubber, cast, princesBlock, imageCredits(portraits, players));
    paintCast(cast);
    paintPrinces(princesBlock);
    paintOverview();

    function paintOverview() {
      paintMap(svg);
      paintBeat(beat);
      paintActing(cast);
      paintScrubber(scrubber);
    }
    shell.paintOverview = paintOverview;
  }

  function paintBeat(beat) {
    const current = frame();
    beat.replaceChildren();
    beat.appendChild(el("p", "eyebrow", current.kind === "aftermath" ? "Aftermath" : "This moment"));
    beat.appendChild(el("h2", "", current.title));
    beat.appendChild(el("p", "partition-date", current.dateDisplay));
    beat.appendChild(el("p", "", current.summary));
    if (current.consequences.length) {
      const list = el("ul", "partition-points");
      current.consequences.slice(0, 3).forEach((item) => list.appendChild(el("li", "", item)));
      beat.appendChild(list);
    }
    const timelineButton = el("button", "partition-text-button", "Open the full timeline");
    timelineButton.type = "button";
    timelineButton.addEventListener("click", () => onOpenTimeline?.(current.id));
    beat.appendChild(timelineButton);
    if (selectedRegion) beat.appendChild(el("p", "partition-region", regionCaption(selectedRegion, current)));
    if (claimsOn) beat.appendChild(el("p", "partition-extra", kashmirClaimsNote(current)));
  }

  function paintCast(cast) {
    cast.replaceChildren();
    cast.appendChild(el("p", "eyebrow", "The decision"));
    cast.appendChild(el("h2", "", "Who wanted what — and who made the call"));
    cast.appendChild(el("p", "rail-note", "There was no single decider. These six actors set, accepted, negotiated, or drew the June–August 1947 settlement. Open a person for their full record."));
    const decisionIds = decisionMakers(reference, players);
    const decisionSet = new Set(decisionIds);
    const rest = [...players.keys()].filter((id) => !decisionSet.has(id));
    rest.sort((a, b) => players.get(a).name.localeCompare(players.get(b).name, "en"));
    cast.appendChild(playerBlock("Who made the call", decisionIds, { showWanted: true }));
    cast.appendChild(playerBlock("Other voices in the record", rest));
  }

  function playerBlock(heading, ids, { showWanted = false } = {}) {
    const block = el("section", "partition-player-block");
    block.classList.toggle("has-wants", showWanted);
    block.appendChild(el("h3", "", heading));
    const grid = el("ul", "partition-cast");
    const acting = new Set(frame().playerIds);
    ids.forEach((id) => {
      const person = players.get(id);
      if (!person) return;
      const item = el("li");
      const button = el("button", `partition-card${acting.has(id) ? " is-acting" : ""}`);
      button.type = "button";
      button.dataset.player = id;
      const copy = el("span", "partition-card-copy");
      copy.append(
        el("strong", "", person.name),
        el("em", "", person.faction || person.roles?.[0] || ""),
      );
      if (showWanted) {
        const wanted = playerIncentives(person).wanted[0] || "No separate aim is recorded.";
        copy.appendChild(el("span", "partition-card-want", `Wanted: ${wanted}`));
      }
      button.append(
        portraitMark(person.name, portraits[id]),
        copy,
      );
      button.addEventListener("click", () => onOpenPlayer?.(id));
      item.appendChild(button);
      grid.appendChild(item);
    });
    block.appendChild(grid);
    return block;
  }

  function paintActing(cast) {
    const acting = new Set(frame().playerIds);
    cast.querySelectorAll(".partition-card").forEach((button) => {
      button.classList.toggle("is-acting", acting.has(button.dataset.player));
    });
  }

  function paintPrinces(block) {
    block.replaceChildren();
    block.appendChild(el("p", "eyebrow", "Princely states"));
    block.appendChild(el("h2", "", "The accessions beside the provincial border"));
    block.appendChild(el("p", "rail-note", "These states were not the Radcliffe provinces. Each outcome is the one recorded in the research."));
    const groups = [
      ["Disputed or delayed", princes.filter((entry) => /disputed|plebiscite|forced|Operation/i.test(entry.accessionOutcome || ""))],
      ["Pakistan", princes.filter((entry) => /^Pakistan/i.test(entry.accessionOutcome || "") && !/disputed|plebiscite|forced|Operation/i.test(entry.accessionOutcome || ""))],
      ["India", princes.filter((entry) => /^India/i.test(entry.accessionOutcome || "") && !/disputed|plebiscite|forced|Operation/i.test(entry.accessionOutcome || ""))],
    ];
    groups.forEach(([label, entries]) => {
      if (!entries.length) return;
      const group = el("section", "partition-prince-group");
      group.appendChild(el("h3", "", label));
      const list = el("ul", "partition-prince-list");
      entries.forEach((entry) => {
        const item = el("li");
        const button = el("button", "partition-prince");
        button.type = "button";
        button.append(el("strong", "", entry.stateName), el("span", "", entry.accessionOutcome));
        const detail = el("p", "partition-prince-detail", `${entry.rulerName}. ${entry.oneLineRole}`);
        detail.hidden = true;
        button.addEventListener("click", () => {
          detail.hidden = !detail.hidden;
          button.setAttribute("aria-expanded", String(!detail.hidden));
        });
        button.setAttribute("aria-expanded", "false");
        item.append(button, detail);
        list.appendChild(item);
      });
      group.appendChild(list);
      block.appendChild(group);
    });
    const casualty = el("p", "partition-casualty", reference.scope?.casualtyNote || "");
    block.appendChild(casualty);
  }

  function renderTimeline() {
    shell.classList.add("partition-record", "lane-page");
    const head = el("div", "timeline-head");
    const copy = el("div");
    copy.append(el("p", "eyebrow", "Full timeline"), el("h2", "", "Across the years"));
    const search = el("label", "search");
    search.append(el("span", "", "Search"));
    const input = document.createElement("input");
    input.type = "search";
    input.placeholder = "Search players, decisions, places…";
    input.addEventListener("input", () => {
      query = input.value;
      paintTimelineList();
    });
    search.appendChild(input);
    head.append(copy, search);
    const host = el("div", "partition-timeline-host");
    shell.append(head, host);
    let openId = frame().id;
    paintTimelineList();

    function timelineNote() {
      return isCompactLayout()
        ? "Every researched decision, oldest at the top. Open a beat for what changed, then open a person for their own actions."
        : "Every researched decision, oldest on the left. Open a beat for what changed, then open a person for their own actions.";
    }

    function paintTimelineList() {
      const shown = frames.filter((item) => frameMatches(item, query, players));
      host.replaceChildren();
      if (!shown.length) {
        host.appendChild(el("p", "empty", "Nothing in this timeline matches that search."));
        return;
      }
      if (!shown.some((item) => item.id === openId)) openId = "";
      if (isCompactLayout()) {
        const listWrap = el("div", "spine-view");
        const hint = el("p", "rail-note", timelineNote());
        const rail = el("ol", "spine");
        rail.setAttribute("aria-label", "Partition timeline, oldest at the top.");
        let year = "";
        shown.forEach((item) => {
          const nextYear = String(item.sortKey).slice(0, 4);
          if (nextYear !== year) {
            year = nextYear;
            const stone = el("li", "spine-year");
            stone.appendChild(el("span", "", year));
            rail.appendChild(stone);
          }
          rail.appendChild(timelineBeat(item, openId));
        });
        listWrap.append(hint, rail);
        host.appendChild(listWrap);
        const selected = listWrap.querySelector(".spine-event.is-selected");
        selected?.scrollIntoView({ block: "nearest" });
        return;
      }
      const { view, rail } = buildLaneChrome(timelineNote(), {
        ariaLabel: "Partition timeline, oldest on the left. Drag to move. Hold Control and scroll to zoom.",
      });
      rail.setAttribute("aria-label", "Partition timeline, oldest on the left.");
      let year = "";
      let step = 0;
      shown.forEach((item) => {
        const nextYear = String(item.sortKey).slice(0, 4);
        if (nextYear !== year) {
          year = nextYear;
          rail.appendChild(laneYear(year));
        }
        const side = step % 2 === 0 ? "above" : "below";
        step += 1;
        rail.appendChild(laneBeat(item, side, openId));
      });
      host.appendChild(view);
      if (openId) queueLaneFocus(openId);
      requestAnimationFrame(() => layoutLane(view));
    }

    function toggleBeat(item) {
      openId = openId === item.id ? "" : item.id;
      if (openId) {
        index = frames.findIndex((candidate) => candidate.id === item.id);
        onFrame?.(item.id, { historyMode: "replace" });
      }
      paintTimelineList();
    }

    function timelineBeat(item, selectedId) {
      const row = el("li", "spine-event");
      row.id = `beat-${item.id}`;
      const open = item.id === selectedId;
      row.classList.toggle("is-selected", open);
      const mark = el("button", "spine-mark");
      mark.type = "button";
      const lead = leadPlayer(item);
      mark.appendChild(portraitMark(lead.name, lead.portrait));
      mark.setAttribute("aria-label", `${item.dateDisplay}. ${item.title}`);
      const copy = el("div", "spine-copy");
      const hit = el("button", "spine-hit");
      hit.type = "button";
      hit.append(el("time", "", item.dateDisplay), el("strong", "", item.title));
      if (!open) hit.appendChild(el("span", "beat-tease", clip(item.summary, 140)));
      const more = el("div", "spine-more");
      if (open) fillBeatMore(more, item);
      else more.hidden = true;
      mark.addEventListener("click", () => toggleBeat(item));
      hit.addEventListener("click", () => toggleBeat(item));
      copy.append(hit, more);
      row.append(mark, copy);
      return row;
    }

    function laneBeat(item, side, selectedId) {
      const row = el("li", `lane-event side-${side}`);
      row.id = `beat-${item.id}`;
      const open = item.id === selectedId;
      row.classList.toggle("is-selected", open);
      const card = el("div", "lane-card");
      const mark = el("button", "lane-mark");
      mark.type = "button";
      const lead = leadPlayer(item);
      mark.appendChild(portraitMark(lead.name, lead.portrait));
      mark.setAttribute("aria-label", `${item.dateDisplay}. ${item.title}`);
      const hit = el("button", "lane-hit");
      hit.type = "button";
      hit.append(el("time", "", item.dateDisplay), el("span", "lane-rule"), el("strong", "", item.title));
      if (!open) hit.appendChild(el("span", "beat-tease", clip(item.summary, 140)));
      mark.addEventListener("click", () => toggleBeat(item));
      hit.addEventListener("click", () => toggleBeat(item));
      card.append(mark, hit);
      if (open) {
        const more = el("div", "lane-more");
        fillBeatMore(more, item);
        card.appendChild(more);
      }
      const dot = el("span", "lane-dot");
      dot.setAttribute("aria-hidden", "true");
      row.append(card, dot);
      return row;
    }

    function leadPlayer(item) {
      const leadId = item.playerIds.find((id) => portraits[id]) || item.playerIds[0];
      const lead = players.get(leadId);
      return {
        name: playerDisplayName(lead) || item.dateDisplay,
        portrait: portraits[leadId],
      };
    }

    function fillBeatMore(more, item) {
      more.appendChild(el("p", "", item.summary));
      if (item.consequences.length) {
        const list = el("ul", "partition-points");
        item.consequences.forEach((point) => list.appendChild(el("li", "", point)));
        more.appendChild(list);
      }
      if (item.actions.length) {
        const list = el("ul", "partition-actions");
        item.actions.forEach((action) => {
          const person = players.get(action.playerId);
          const line = el("li");
          line.append(
            el("strong", "", playerDisplayName(person) || action.playerId),
            document.createTextNode(` ${action.description}`),
          );
          list.appendChild(line);
        });
        more.appendChild(list);
      }
      const cast = eventCast(item, players);
      if (cast.length) more.appendChild(castList(cast));
      const mapButton = el("button", "partition-text-button", "Show this moment on the map");
      mapButton.type = "button";
      mapButton.addEventListener("click", () => onShowMap?.(item.id));
      more.appendChild(mapButton);
      const sources = sourceRecords(reference.sourcesCatalog, item.sourceIds);
      if (sources.length) more.appendChild(sourceList(sources));
    }

    function paintTimelineSelection() {
      const next = frame().id;
      if (openId === next) return;
      openId = next;
      paintTimelineList();
    }

    shell.paintTimelineList = paintTimelineList;
    shell.paintTimelineSelection = paintTimelineSelection;
  }

  function revealPersonTop() {
    const html = document.documentElement;
    const previous = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    html.scrollTop = 0;
    document.body.scrollTop = 0;
    html.style.scrollBehavior = previous;
    requestAnimationFrame(() => {
      html.style.scrollBehavior = "auto";
      window.scrollTo(0, 0);
      html.style.scrollBehavior = previous;
    });
  }

  function renderPerson(person) {
    shell.classList.add("partition-record", "partition-person-page");
    const back = el("button", "back", "Back to map & people");
    back.type = "button";
    back.addEventListener("click", () => onShowMap?.(frame().id));
    const stage = el("div", "partition-person-stage");
    shell.append(back, stage);
    paintPerson(person);
  }

  function paintPerson(person) {
    const stage = shell.querySelector(".partition-person-stage") || shell;
    const allegiance = playerAllegiance(person);
    const incentives = playerIncentives(person);
    const shortName = playerDisplayName(person);
    const head = el("header", "partition-person-head");
    const face = el("div", "partition-person-face");
    const portrait = portraits[person.id];
    if (portrait?.src) {
      const image = document.createElement("img");
      image.className = "partition-chip-photo";
      image.src = portrait.src;
      image.alt = `Portrait of ${person.name}`;
      face.appendChild(image);
    } else {
      face.appendChild(portraitMark(person.name));
    }
    head.appendChild(face);
    const identity = el("div", "partition-person-identity");
    const title = el("h2", "", shortName);
    title.title = person.name;
    identity.append(
      el("p", "eyebrow", allegiance.faction),
      title,
    );
    const roleLine = person.roles?.length ? person.roles.join(" · ") : "Role not separately recorded";
    const role = el("p", "partition-person-role", roleLine);
    role.title = roleLine;
    identity.appendChild(role);
    const allegianceLine = [allegiance.nationality, allegiance.community].filter(Boolean).join(" · ") || "Standing not separately recorded";
    const note = el("p", "partition-person-allegiance", allegianceLine);
    note.title = allegianceLine;
    identity.appendChild(note);
    head.appendChild(identity);

    const allies = playerAgreements(person, [...players.values()]).slice(0, 8);
    if (allies.length) {
      head.classList.add("has-allies");
      head.appendChild(allySection(allies));
    }

    const brief = el("div", "partition-person-brief");
    if (person.pointOfView) {
      const saw = el("section", "partition-read");
      saw.append(el("h3", "", "How they saw it"), el("p", "", person.pointOfView));
      brief.appendChild(saw);
    }
    if (person.impactSummary) {
      const changed = el("section", "partition-read");
      changed.append(el("h3", "", "What changed because of them"), el("p", "", person.impactSummary));
      brief.appendChild(changed);
    }
    brief.appendChild(stancePair(incentives));
    const stances = statedPositions(person);
    if (stances.length) brief.appendChild(settlementList(stances));

    const actions = playerActions(person);
    const record = el("section", "partition-person-timeline");
    record.appendChild(el("h3", "", "What they did"));
    if (!actions.length) {
      record.appendChild(el("p", "rail-note", "The research names this person, and does not give them a separate list of actions."));
    } else {
      record.appendChild(el("p", "rail-note", "Oldest first."));
      const rail = el("ol", "partition-person-beats");
      actions.forEach((action) => rail.appendChild(actionBeat(person, action)));
      record.appendChild(rail);
    }
    const sources = sourceRecords(reference.sourcesCatalog, person.sourceIds);
    const extras = [head, brief, record];
    if (sources.length) extras.push(sourceList(sources));
    if (portrait) extras.push(personCredit(person, portrait));
    stage.replaceChildren(...extras);
  }

  function allySection(allies) {
    const block = el("section", "partition-allies");
    block.appendChild(el("p", "eyebrow", "Agreed with them"));
    const list = el("ul", "partition-ally-list");
    allies.forEach((ally) => {
      const item = el("li");
      const button = el("button", "partition-ally");
      button.type = "button";
      button.append(
        portraitMark(ally.fullName, portraits[ally.id]),
        el("strong", "", ally.name),
        el("span", "", ally.reasons[0] || ally.faction),
      );
      button.addEventListener("click", () => onOpenPlayer?.(ally.id));
      item.appendChild(button);
      list.appendChild(item);
    });
    block.appendChild(list);
    return block;
  }

  function settlementList(stances) {
    const block = el("section", "partition-stances");
    block.appendChild(el("h3", "", "On the settlement"));
    const list = el("ol", "partition-stance-list");
    stances.forEach((row) => {
      const item = el("li");
      item.append(el("h4", "", row.label), el("p", "", row.value));
      list.appendChild(item);
    });
    block.appendChild(list);
    return block;
  }

  function stancePair(incentives) {
    const pair = el("div", "partition-stance-pair");
    pair.appendChild(stanceCard("Wanted", "What they were working toward.", incentives.wanted, "wanted"));
    pair.appendChild(stanceCard("Feared or opposed", "What they were working against.", incentives.opposed, "opposed"));
    return pair;
  }

  function stanceCard(title, hint, items, kind) {
    const card = el("section", `partition-stance-card is-${kind}`);
    card.append(el("h3", "", title), el("p", "partition-stance-hint", hint));
    if (!items.length) {
      card.appendChild(el("p", "partition-empty-stance", "Nothing separate is written down."));
      return card;
    }
    const list = el("ul", "partition-points");
    items.forEach((item) => list.appendChild(el("li", "", item)));
    card.appendChild(list);
    return card;
  }

  function actionBeat(person, action) {
    const row = el("li", "partition-person-beat");
    const copy = el("article", "partition-beat-card");
    copy.append(el("time", "", action.dateDisplay), el("strong", "", action.title));
    if (action.summary) copy.appendChild(el("p", "partition-beat-summary", action.summary));
    const lines = action.playerSpecificActions?.filter(Boolean) || [];
    if (lines.length) {
      const own = el("div", "partition-own-action");
      own.appendChild(el("p", "eyebrow", "Their move"));
      const list = el("ul", "partition-points");
      lines.forEach((line) => list.appendChild(el("li", "", line)));
      own.appendChild(list);
      copy.appendChild(own);
    }
    if (action.consequences?.length) {
      addList(copy, "What followed", action.consequences, "h4");
    }
    if (action.cast?.some((member) => member.id !== person.id)) {
      copy.appendChild(el("h4", "", "Who was involved"));
      copy.appendChild(castList(action.cast, person.id));
    }
    if (action.eventId && frames.some((item) => item.id === action.eventId)) {
      const mapButton = el("button", "partition-text-button", "Show this moment on the map");
      mapButton.type = "button";
      mapButton.addEventListener("click", () => onShowMap?.(action.eventId));
      copy.appendChild(mapButton);
    }
    row.appendChild(copy);
    return row;
  }

  function castList(cast, focusId = "") {
    const list = el("ul", "partition-cast-list");
    cast.forEach((member) => {
      const item = el("li", `partition-cast-card${member.id === focusId ? " is-self" : ""}`);
      if (member.id === focusId || !onOpenPlayer) {
        const body = el("div", "partition-cast-body");
        body.appendChild(castFace(member));
        body.appendChild(castCopy(member, focusId));
        item.appendChild(body);
      } else {
        const button = el("button", "partition-cast-hit");
        button.type = "button";
        button.append(castFace(member), castCopy(member, focusId));
        button.addEventListener("click", () => onOpenPlayer(member.id));
        item.appendChild(button);
      }
      list.appendChild(item);
    });
    return list;
  }

  function castFace(member) {
    const face = el("div", "partition-cast-face");
    face.appendChild(portraitMark(member.fullName, portraits[member.id]));
    return face;
  }

  function castCopy(member, focusId) {
    const copy = el("div", "partition-cast-copy");
    copy.appendChild(el("strong", "", member.id === focusId ? `${member.name} · this person` : member.name));
    copy.appendChild(el("p", "partition-cast-allegiance", member.allegiance.line));
    if (member.incentive) copy.appendChild(el("p", "partition-cast-incentive", `Standing aim: ${member.incentive}`));
    if (member.action && member.id !== focusId) copy.appendChild(el("p", "partition-cast-action", member.action));
    return copy;
  }

  function playerActions(person) {
    const enrich = (action, event) => ({
      ...action,
      summary: event?.summary || action.summary || "",
      consequences: event?.consequences || action.consequences || [],
      cast: event ? eventCast(event, players, person.id) : action.cast || [],
    });
    const own = (person.timelineActions || []).map((action) => {
      const event = frames.find((item) => item.id === action.eventId);
      return enrich(action, event);
    });
    if (own.length) return own.slice().sort((a, b) => chronoKey(a.sortKey) - chronoKey(b.sortKey));
    return frames
      .filter((item) => item.playerIds.includes(person.id))
      .map((item) => enrich({
        eventId: item.id,
        sortKey: item.sortKey,
        dateDisplay: item.dateDisplay,
        title: item.title,
        playerSpecificActions: item.actions
          .filter((action) => action.playerId === person.id)
          .map((action) => action.description),
      }, item));
  }

  function buildMap() {
    const svg = svgEl("svg", { class: "partition-map", role: "img" });
    const box = cameraBox();
    svg.setAttribute("viewBox", box.join(" "));
    svg.appendChild(svgEl("rect", {
      class: "partition-ocean",
      x: box[0],
      y: box[1],
      width: box[2],
      height: box[3],
    }));
    const regionPaths = new Map();
    regions.forEach((region) => {
      const path = svgEl("path", {
        class: "region",
        d: multiPath(region.polygons),
        "fill-rule": "evenodd",
      });
      path.dataset.region = region.id;
      path.addEventListener("click", () => {
        selectedRegion = selectedRegion === region.id ? "" : region.id;
        shell.paintOverview?.();
      });
      svg.appendChild(path);
      regionPaths.set(region.id, path);
    });
    const outlinePaths = new Map();
    ["india", "pakistan", "bangladesh"].forEach((id) => {
      const path = svgEl("path", { class: `country-outline is-${id}`, d: multiPath(outlines[id]) });
      svg.appendChild(path);
      outlinePaths.set(id, path);
    });
    const seamPaths = new Map();
    Object.entries(seams).forEach(([id, line]) => {
      const path = svgEl("path", { class: "decision", d: linePath(line), pathLength: 1 });
      svg.appendChild(path);
      seamPaths.set(id, path);
    });
    const claims = svgEl("path", { class: "claims", d: ringPath(claimsRing), pathLength: 1 });
    svg.appendChild(claims);
    const flowPaths = new Map();
    Object.entries(flows).forEach(([id, line]) => {
      const path = svgEl("path", { class: "flow", d: linePath(line), pathLength: 1 });
      svg.appendChild(path);
      flowPaths.set(id, path);
    });
    const markerNodes = new Map();
    Object.entries(markers).forEach(([id, marker]) => {
      const [x, y] = project(marker.lon, marker.lat);
      const group = svgEl("g", { class: "map-marker" });
      group.appendChild(svgEl("circle", { cx: x, cy: y, r: 0.18 }));
      const text = svgEl("text", { x: x + 0.28, y: y - 0.22 });
      text.textContent = marker.label;
      group.appendChild(text);
      svg.appendChild(group);
      markerNodes.set(id, group);
    });
    const labelLayer = svgEl("g", { class: "map-labels" });
    svg.appendChild(labelLayer);
    svg.partitionMap = { regionPaths, outlinePaths, seamPaths, flowPaths, markerNodes, claims, labelLayer };
    return svg;
  }

  function paintMap(svg) {
    const visual = frame().visual;
    const parts = svg.partitionMap;
    parts.regionPaths.forEach((path, id) => {
      const fill = visual.fills[id] || "raj";
      path.setAttribute("class", `region fill-${fill}${visual.emphasis.includes(id) ? " is-emphasis" : ""}`);
    });
    const pakistanOn = Object.entries(visual.fills).some(([id, fill]) => fill === "pakistan" && id !== "bengal-east");
    const eastOn = visual.fills["bengal-east"] === "eastpak" || visual.fills["bengal-east"] === "bangladesh";
    const indiaOn = Object.values(visual.fills).includes("india");
    parts.outlinePaths.get("pakistan").setAttribute("class", `country-outline is-pakistan${pakistanOn ? " is-set" : " is-ahead"}`);
    parts.outlinePaths.get("bangladesh").setAttribute("class", `country-outline is-bangladesh${eastOn ? " is-set" : " is-ahead"}`);
    parts.outlinePaths.get("india").setAttribute("class", `country-outline is-india${indiaOn ? " is-set" : " is-ahead"}`);
    parts.seamPaths.forEach((path, id) => {
      path.setAttribute("class", `decision is-${visual.seams[id] || "off"}`);
    });
    parts.flowPaths.forEach((path, id) => path.classList.toggle("is-on", visual.flows.includes(id)));
    parts.markerNodes.forEach((node, id) => node.classList.toggle("is-on", visual.markers.includes(id)));
    parts.claims.classList.toggle("is-on", claimsOn);
    svg.setAttribute("aria-label", `${frame().dateDisplay}. ${frame().title}`);
    paintLabels(parts.labelLayer, visual);
  }

  function paintLabels(layer, visual) {
    layer.replaceChildren();
    const placed = [];
    const add = (text, lon, lat, className) => {
      const [x, y] = project(lon, lat);
      const node = svgEl("text", { class: className, x, y, "text-anchor": "middle" });
      node.textContent = text;
      layer.appendChild(node);
      placed.push(node);
    };
    add("Nepal", labelAnchors.nepal[0], labelAnchors.nepal[1], "region-label");
    add("Bhutan", labelAnchors.bhutan[0], labelAnchors.bhutan[1], "region-label");
    if (Object.values(visual.fills).includes("india")) add("India", labelAnchors.india[0], labelAnchors.india[1], "country-label");
    if (Object.entries(visual.fills).some(([, fill]) => fill === "pakistan")) add("Pakistan", labelAnchors.pakistan[0], labelAnchors.pakistan[1], "country-label");
    if (visual.fills["bengal-east"] === "eastpak") add("East Pakistan", labelAnchors.bangladesh[0], labelAnchors.bangladesh[1], "country-label");
    if (visual.fills["bengal-east"] === "bangladesh") add("Bangladesh", labelAnchors.bangladesh[0], labelAnchors.bangladesh[1], "country-label");
    visual.emphasis.forEach((id) => {
      if (["kashmir-ind", "kashmir-pak", "bengal-east"].includes(id) && visual.fills["bengal-east"] === "bangladesh" && id === "bengal-east") return;
      const region = regions.find((item) => item.id === id);
      if (!region) return;
      const [lon, lat] = centroid(region.polygons);
      add(region.name, lon, lat, "region-label");
    });
    return placed;
  }

  function buildLegend() {
    const legend = el("ul", "partition-legend");
    [
      ["raj", "British province"],
      ["princely", "Princely state"],
      ["india", "India"],
      ["pakistan", "Pakistan"],
      ["eastpak", "East Pakistan"],
      ["bangladesh", "Bangladesh"],
      ["pending", "Award pending"],
      ["neighbor", "Nepal and Bhutan"],
    ].forEach(([kind, label]) => {
      const item = el("li");
      item.append(el("i", `swatch fill-${kind}`), document.createTextNode(label));
      legend.appendChild(item);
    });
    return legend;
  }

  function buildScrubber() {
    const scrubber = el("div", "partition-scrubber");
    const now = el("div", "partition-now");
    const kicker = el("p", "kicker");
    const title = el("h2");
    const controls = el("div", "partition-controls");
    const claimsLabel = el("label", "partition-claims");
    const claimsInput = document.createElement("input");
    claimsInput.type = "checkbox";
    claimsLabel.append(claimsInput, document.createTextNode("Show Kashmir claims overlay"));
    controls.appendChild(claimsLabel);
    now.append(kicker, title, controls);
    const range = document.createElement("input");
    range.type = "range";
    range.className = "partition-range";
    range.min = "0";
    range.max = String(frames.length - 1);
    range.step = "1";
    range.setAttribute("aria-label", "Partition timeline");
    const ticks = el("div", "partition-ticks");
    TICKS.forEach(([id, label]) => {
      const at = frames.findIndex((item) => item.id === id);
      if (at < 0) return;
      const button = el("button", "", label);
      button.type = "button";
      button.dataset.frame = id;
      button.style.left = `${(at / (frames.length - 1)) * 100}%`;
      button.addEventListener("click", () => goToIndex(at, { historyMode: "push" }));
      ticks.appendChild(button);
    });
    scrubber.append(now, range, ticks);
    range.addEventListener("input", () => goToIndex(Number(range.value), { historyMode: "replace" }));
    range.addEventListener("change", () => goToIndex(Number(range.value), { historyMode: "push" }));
    claimsInput.addEventListener("change", () => {
      claimsOn = claimsInput.checked;
      shell.paintOverview?.();
    });
    scrubber.partitionScrub = { kicker, title, range, ticks, claimsInput };
    return scrubber;
  }

  function paintScrubber(scrubber) {
    const current = frame();
    const bits = scrubber.partitionScrub;
    bits.kicker.textContent = `${current.dateDisplay} · ${index + 1} of ${frames.length}`;
    bits.title.textContent = current.title;
    bits.range.value = String(index);
    bits.range.setAttribute("aria-valuetext", `${current.dateDisplay}. ${current.title}`);
    bits.ticks.querySelectorAll("button").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.frame === current.id);
    });
  }

  function goToIndex(next, { historyMode = "replace" } = {}) {
    index = Math.max(0, Math.min(frames.length - 1, next));
    shell.paintOverview?.();
    onFrame?.(frames[index].id, { historyMode });
  }
}

function frameMatches(item, query, players) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  const names = item.playerIds.map((id) => players.get(id)?.name || id);
  return [item.title, item.summary, item.dateDisplay, ...item.consequences, ...names]
    .join(" ")
    .toLocaleLowerCase()
    .includes(needle);
}

function clip(text, max) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function portraitMark(name, portrait) {
  if (portrait?.src) {
    const image = document.createElement("img");
    image.className = "partition-chip-photo";
    image.src = portrait.src;
    image.alt = "";
    return image;
  }
  return el("span", "partition-monogram", initials(name));
}

function personCredit(person, portrait) {
  const note = el("p", "partition-person-credit");
  note.append(document.createTextNode(`${person.name}: ${portrait.author} · `));
  const license = el("a", "", portrait.license);
  license.href = portrait.licenseUrl;
  const source = el("a", "", "Wikimedia Commons");
  source.href = portrait.page;
  [license, source].forEach((link) => {
    link.target = "_blank";
    link.rel = "noreferrer";
  });
  note.append(license, document.createTextNode(" · "), source);
  return note;
}

function imageCredits(portraits, players) {
  const credits = el("details", "partition-credits");
  credits.appendChild(el("summary", "", "Image credits"));
  const list = el("ul");
  Object.entries(portraits).forEach(([id, portrait]) => {
    const person = players.get(id);
    if (!person || !portrait?.src) return;
    const item = el("li");
    item.append(document.createTextNode(`${person.name}: ${portrait.author} · `));
    const license = el("a", "", portrait.license);
    license.href = portrait.licenseUrl;
    const source = el("a", "", "Wikimedia Commons");
    source.href = portrait.page;
    [license, source].forEach((link) => {
      link.target = "_blank";
      link.rel = "noreferrer";
    });
    item.append(license, document.createTextNode(" · "), source);
    list.appendChild(item);
  });
  credits.appendChild(list);
  return credits;
}

function centroid(polygons) {
  const ring = polygons[0]?.[0] || [];
  const totals = ring.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0]);
  if (!ring.length) return [0, 0];
  return [totals[0] / ring.length, totals[1] / ring.length];
}

function sourceList(sources) {
  const list = el("ul", "partition-sources");
  sources.forEach((source) => {
    const item = el("li");
    const link = el("a", "", source.title);
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    item.appendChild(link);
    list.appendChild(item);
  });
  return list;
}

function addList(parent, heading, items = [], headingTag = "h3") {
  if (!items?.length) return;
  parent.appendChild(el(headingTag, "", heading));
  const list = el("ul", "partition-points");
  items.forEach((item) => list.appendChild(el("li", "", item)));
  parent.appendChild(list);
}
