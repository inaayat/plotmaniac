import { GAME_NAME, HOUSE_EMOJI, KEYCAP_DIGITS, LAUNCH_DATE, SITE_URL } from "./plotted-config.js";
import { ATTRIBUTES, HOLIDAY_THEME_BY_MD, THEMES, rolesForTheme, themeById } from "./plotted-themes.js";
import { humanDifficulty, solveByHuman } from "./plotted-human-solver.js";

export function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngFromSeed(seed) {
  return mulberry32(typeof seed === "number" ? seed : hashString(String(seed)));
}

export function shuffle(list, rng) {
  const next = list.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function pickN(list, n, rng) {
  return shuffle(list, rng).slice(0, n);
}

export function parseIsoDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

export function weekdayUtc(iso) {
  const { year, month, day } = parseIsoDate(iso);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDaysIso(iso, days) {
  const { year, month, day } = parseIsoDate(iso);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function diffDays(fromIso, toIso) {
  const a = parseIsoDate(fromIso);
  const b = parseIsoDate(toIso);
  const ms =
    Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day);
  return Math.round(ms / 86400000);
}

export function puzzleNumber(iso, launchDate = LAUNCH_DATE) {
  return diffDays(launchDate, iso) + 1;
}

export function localIsoDate(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatTime(elapsedMs) {
  const total = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function isLastSundayOfMonth(iso) {
  const { year, month, day } = parseIsoDate(iso);
  if (weekdayUtc(iso) !== 0) return false;
  const next = new Date(Date.UTC(year, month - 1, day + 7));
  return next.getUTCMonth() !== month - 1;
}

export function specForDate(iso) {
  const dow = weekdayUtc(iso);
  const md = iso.slice(5);
  const holidayTheme = HOLIDAY_THEME_BY_MD[md] || "";
  const lastSunday = isLastSundayOfMonth(iso);
  if (dow === 1) {
    return {
      houseCount: 3,
      types: ["at", "same"],
      minClues: 5,
      maxClues: 7,
      minSteps: 1,
      maxSteps: 8,
      label: "monday-direct",
    };
  }
  if (dow === 0) {
    return {
      houseCount: lastSunday ? 5 : 4,
      types: ["at", "same", "next_to", "left_of", "not_next_to", "either_house", "not_at"],
      minClues: 6,
      maxClues: 8,
      minSteps: 4,
      maxSteps: 28,
      label: lastSunday ? "sunday-five" : "sunday-tricky",
      holidayTheme,
    };
  }
  if (dow === 6) {
    return {
      houseCount: 3,
      types: ["same", "next_to", "left_of", "not_at", "either_house"],
      minClues: 5,
      maxClues: 8,
      minSteps: 4,
      maxSteps: 18,
      label: "saturday",
      holidayTheme,
    };
  }
  if (dow === 5) {
    return {
      houseCount: 3,
      types: ["at", "same", "next_to", "left_of"],
      minClues: 5,
      maxClues: 8,
      minSteps: 3,
      maxSteps: 14,
      label: "friday",
      holidayTheme,
    };
  }
  if (dow === 2 || dow === 3) {
    return {
      houseCount: 3,
      types: ["at", "same", "next_to"],
      minClues: 5,
      maxClues: 7,
      minSteps: 2,
      maxSteps: 10,
      label: dow === 2 ? "tuesday" : "wednesday",
      holidayTheme,
    };
  }
  return {
    houseCount: 3,
    types: ["at", "same", "next_to", "left_of", "not_at"],
    minClues: 5,
    maxClues: 8,
    minSteps: 3,
    maxSteps: 12,
    label: "thursday",
    holidayTheme,
  };
}

export function emptyDomains(houseCount, attributes, items) {
  const domains = {};
  for (const attr of attributes) {
    domains[attr] = Array.from({ length: houseCount }, () => new Set(items[attr]));
  }
  return domains;
}

export function cloneDomains(domains) {
  const next = {};
  for (const attr of Object.keys(domains)) {
    next[attr] = domains[attr].map((set) => new Set(set));
  }
  return next;
}

export function possibleHouses(domains, attr, item) {
  const houses = [];
  for (let house = 0; house < domains[attr].length; house += 1) {
    if (domains[attr][house].has(item)) houses.push(house);
  }
  return houses;
}

function domainsValid(domains) {
  for (const attr of Object.keys(domains)) {
    const seen = new Map();
    for (let house = 0; house < domains[attr].length; house += 1) {
      if (domains[attr][house].size === 0) return false;
      for (const item of domains[attr][house]) {
        seen.set(item, (seen.get(item) || 0) + 1);
      }
    }
    for (const item of domains[attr][0]) {
      /* items may not all be present in house 0 */
    }
    const allItems = new Set();
    domains[attr].forEach((set) => set.forEach((item) => allItems.add(item)));
    for (const item of allItems) {
      if (![...domains[attr]].some((set) => set.has(item))) return false;
    }
  }
  return true;
}

export function isSolved(domains) {
  return Object.values(domains).every((houses) => houses.every((set) => set.size === 1));
}

export function readSolution(domains) {
  const attributes = Object.keys(domains);
  const houseCount = domains[attributes[0]].length;
  return Array.from({ length: houseCount }, (_, house) => {
    const row = {};
    for (const attr of attributes) {
      row[attr] = [...domains[attr][house]][0];
    }
    return row;
  });
}

function propagateAllDiff(domains) {
  let changed = false;
  for (const attr of Object.keys(domains)) {
    const n = domains[attr].length;
    for (let house = 0; house < n; house += 1) {
      if (domains[attr][house].size === 1) {
        const item = [...domains[attr][house]][0];
        for (let other = 0; other < n; other += 1) {
          if (other !== house && domains[attr][other].delete(item)) changed = true;
        }
      }
    }
    const items = new Set();
    domains[attr].forEach((set) => set.forEach((item) => items.add(item)));
    for (const item of items) {
      const houses = possibleHouses(domains, attr, item);
      if (houses.length === 0) return { ok: false, changed };
      if (houses.length === 1 && domains[attr][houses[0]].size !== 1) {
        domains[attr][houses[0]] = new Set([item]);
        changed = true;
      }
    }
    if (domains[attr].some((set) => set.size === 0)) return { ok: false, changed };
  }
  return { ok: true, changed };
}

function restrictHouses(domains, attr, item, allowed, changedRef) {
  const allow = allowed instanceof Set ? allowed : new Set(allowed);
  for (let house = 0; house < domains[attr].length; house += 1) {
    if (!allow.has(house) && domains[attr][house].delete(item)) changedRef.value = true;
  }
}

export function applyClue(domains, clue) {
  const changedRef = { value: false };
  const n = Object.values(domains)[0].length;
  switch (clue.type) {
    case "at": {
      if (!domains[clue.attr][clue.house].has(clue.item)) return { ok: false, changed: false };
      const current = domains[clue.attr][clue.house];
      if (current.size !== 1 || [...current][0] !== clue.item) {
        domains[clue.attr][clue.house] = new Set([clue.item]);
        changedRef.value = true;
      }
      break;
    }
    case "not_at": {
      if (domains[clue.attr][clue.house].delete(clue.item)) changedRef.value = true;
      break;
    }
    case "either_house": {
      restrictHouses(domains, clue.attr, clue.item, clue.houses, changedRef);
      break;
    }
    case "same": {
      for (let house = 0; house < n; house += 1) {
        const hasLeft = domains[clue.left.attr][house].has(clue.left.item);
        const hasRight = domains[clue.right.attr][house].has(clue.right.item);
        if (hasLeft && !hasRight) {
          domains[clue.left.attr][house].delete(clue.left.item);
          changedRef.value = true;
        }
        if (hasRight && !hasLeft) {
          domains[clue.right.attr][house].delete(clue.right.item);
          changedRef.value = true;
        }
      }
      break;
    }
    case "next_to": {
      const leftH = possibleHouses(domains, clue.left.attr, clue.left.item);
      const rightH = possibleHouses(domains, clue.right.attr, clue.right.item);
      const leftOk = new Set();
      const rightOk = new Set();
      for (const left of leftH) {
        if (rightH.some((right) => Math.abs(right - left) === 1)) leftOk.add(left);
      }
      for (const right of rightH) {
        if (leftH.some((left) => Math.abs(left - right) === 1)) rightOk.add(right);
      }
      restrictHouses(domains, clue.left.attr, clue.left.item, leftOk, changedRef);
      restrictHouses(domains, clue.right.attr, clue.right.item, rightOk, changedRef);
      break;
    }
    case "left_of": {
      const leftH = possibleHouses(domains, clue.left.attr, clue.left.item);
      const rightH = possibleHouses(domains, clue.right.attr, clue.right.item);
      const leftOk = new Set();
      const rightOk = new Set();
      for (const left of leftH) {
        for (const right of rightH) {
          const ok = clue.immediate ? left === right - 1 : left < right;
          if (ok) {
            leftOk.add(left);
            rightOk.add(right);
          }
        }
      }
      restrictHouses(domains, clue.left.attr, clue.left.item, leftOk, changedRef);
      restrictHouses(domains, clue.right.attr, clue.right.item, rightOk, changedRef);
      break;
    }
    case "not_next_to": {
      const leftH = possibleHouses(domains, clue.left.attr, clue.left.item);
      const rightH = possibleHouses(domains, clue.right.attr, clue.right.item);
      if (leftH.length === 1) {
        const house = leftH[0];
        for (const adj of [house - 1, house + 1]) {
          if (adj >= 0 && adj < n && domains[clue.right.attr][adj].delete(clue.right.item)) {
            changedRef.value = true;
          }
        }
      }
      if (rightH.length === 1) {
        const house = rightH[0];
        for (const adj of [house - 1, house + 1]) {
          if (adj >= 0 && adj < n && domains[clue.left.attr][adj].delete(clue.left.item)) {
            changedRef.value = true;
          }
        }
      }
      break;
    }
    default:
      return { ok: false, changed: false };
  }
  return { ok: domainsValid(domains), changed: changedRef.value };
}

export function propagate(domains, clues) {
  let steps = 0;
  for (;;) {
    let changed = false;
    const allDiff = propagateAllDiff(domains);
    if (!allDiff.ok) return { ok: false, steps, solved: false };
    changed = changed || allDiff.changed;
    for (const clue of clues) {
      const result = applyClue(domains, clue);
      if (!result.ok) return { ok: false, steps, solved: false };
      changed = changed || result.changed;
    }
    steps += 1;
    if (!changed) break;
    if (steps > 80) break;
  }
  return { ok: true, steps, solved: isSolved(domains) };
}

export function countSolutions(houseCount, attributes, items, clues, limit = 2) {
  const domains = emptyDomains(houseCount, attributes, items);
  return searchSolutions(domains, clues, limit);
}

function searchSolutions(domains, clues, limit) {
  const prop = propagate(domains, clues);
  if (!prop.ok) return { count: 0, steps: prop.steps, neededSearch: false };
  if (prop.solved) {
    return { count: 1, steps: prop.steps, neededSearch: false, solution: readSolution(domains) };
  }
  let best = null;
  for (const attr of Object.keys(domains)) {
    for (let house = 0; house < domains[attr].length; house += 1) {
      const size = domains[attr][house].size;
      if (size > 1 && (!best || size < best.size)) best = { attr, house, size };
    }
  }
  if (!best) {
    return { count: 1, steps: prop.steps, neededSearch: false, solution: readSolution(domains) };
  }
  let count = 0;
  let solution = null;
  let childSteps = prop.steps;
  for (const item of domains[best.attr][best.house]) {
    const next = cloneDomains(domains);
    next[best.attr][best.house] = new Set([item]);
    const sub = searchSolutions(next, clues, limit - count);
    count += sub.count;
    childSteps = Math.max(childSteps, sub.steps);
    if (sub.solution) solution = sub.solution;
    if (count >= limit) break;
  }
  return { count, steps: childSteps, neededSearch: true, solution };
}

export function houseOf(assignment, attr, item) {
  return assignment.findIndex((house) => house[attr] === item);
}

export function clueHolds(clue, assignment) {
  const loc = (side) => houseOf(assignment, side.attr, side.item);
  switch (clue.type) {
    case "at":
      return houseOf(assignment, clue.attr, clue.item) === clue.house;
    case "not_at":
      return houseOf(assignment, clue.attr, clue.item) !== clue.house;
    case "either_house":
      return clue.houses.includes(houseOf(assignment, clue.attr, clue.item));
    case "same":
      return loc(clue.left) === loc(clue.right) && loc(clue.left) >= 0;
    case "next_to":
      return Math.abs(loc(clue.left) - loc(clue.right)) === 1;
    case "left_of": {
      const left = loc(clue.left);
      const right = loc(clue.right);
      return clue.immediate ? left === right - 1 : left < right && left >= 0;
    }
    case "not_next_to":
      return Math.abs(loc(clue.left) - loc(clue.right)) !== 1;
    default:
      return false;
  }
}

export function randomSolution(houseCount, attributes, items, rng) {
  const perms = {};
  for (const attr of attributes) {
    perms[attr] = shuffle(items[attr].slice(), rng);
  }
  return Array.from({ length: houseCount }, (_, house) => {
    const row = {};
    for (const attr of attributes) row[attr] = perms[attr][house];
    return row;
  });
}

function itemRef(attr, item) {
  return { attr, item };
}

export function trueCluesFor(solution, types, rng) {
  const houseCount = solution.length;
  const attributes = Object.keys(solution[0]);
  const clues = [];
  if (types.includes("at")) {
    for (const attr of attributes) {
      for (let house = 0; house < houseCount; house += 1) {
        clues.push({ type: "at", attr, item: solution[house][attr], house });
      }
    }
  }
  if (types.includes("not_at")) {
    for (const attr of attributes) {
      for (let house = 0; house < houseCount; house += 1) {
        const item = solution[house][attr];
        for (let other = 0; other < houseCount; other += 1) {
          if (other !== house) clues.push({ type: "not_at", attr, item, house: other });
        }
      }
    }
  }
  if (types.includes("either_house")) {
    for (const attr of attributes) {
      for (let house = 0; house < houseCount; house += 1) {
        const item = solution[house][attr];
        const others = [];
        for (let other = 0; other < houseCount; other += 1) {
          if (other !== house) others.push(other);
        }
        const extra = others[Math.floor(rng() * others.length)];
        const houses = [house, extra].sort((a, b) => a - b);
        clues.push({ type: "either_house", attr, item, houses });
      }
    }
  }
  if (types.includes("same")) {
    for (let house = 0; house < houseCount; house += 1) {
      for (let i = 0; i < attributes.length; i += 1) {
        for (let j = i + 1; j < attributes.length; j += 1) {
          clues.push({
            type: "same",
            left: itemRef(attributes[i], solution[house][attributes[i]]),
            right: itemRef(attributes[j], solution[house][attributes[j]]),
          });
        }
      }
    }
  }
  const pairClues = (type, predicate, extra = {}) => {
    for (let a = 0; a < houseCount; a += 1) {
      for (let b = 0; b < houseCount; b += 1) {
        if (a === b) continue;
        if (!predicate(a, b)) continue;
        for (const leftAttr of attributes) {
          for (const rightAttr of attributes) {
            if (leftAttr === rightAttr) continue;
            clues.push({
              type,
              left: itemRef(leftAttr, solution[a][leftAttr]),
              right: itemRef(rightAttr, solution[b][rightAttr]),
              ...extra,
            });
          }
        }
      }
    }
  };
  if (types.includes("next_to")) pairClues("next_to", (a, b) => Math.abs(a - b) === 1);
  if (types.includes("not_next_to")) pairClues("not_next_to", (a, b) => Math.abs(a - b) !== 1);
  if (types.includes("left_of")) {
    pairClues("left_of", (a, b) => a < b, { immediate: false });
    pairClues("left_of", (a, b) => a === b - 1, { immediate: true });
  }
  return shuffle(clues, rng);
}

function labelOf(catalog, attr, itemId) {
  return catalog[attr].find((item) => item.id === itemId)?.label || itemId;
}

export function capitalizeClue(text) {
  return String(text).replace(/^(\s*)(\S)/, (_, space, ch) => space + ch.toUpperCase());
}

function isActorAttr(attr) {
  return attr === "person" || attr === "nationality" || attr === "job";
}

function occupantPhrase(catalog, roles, attr, itemId) {
  const label = labelOf(catalog, attr, itemId);
  const role = roles[attr] || ATTRIBUTES[attr];
  return role.occupant(label);
}

function actorLabel(catalog, roles, ref) {
  if (ref.attr === "person") return labelOf(catalog, "person", ref.item);
  return occupantPhrase(catalog, roles, ref.attr, ref.item);
}

function neighborPhrase(catalog, roles, ref) {
  const label = labelOf(catalog, ref.attr, ref.item);
  const role = roles[ref.attr] || ATTRIBUTES[ref.attr];
  if (typeof role.neighbor === "function") return role.neighbor(label);
  if (isActorAttr(ref.attr)) return actorLabel(catalog, roles, ref);
  return occupantPhrase(catalog, roles, ref.attr, ref.item);
}

function samePhrase(catalog, roles, left, right) {
  const personSide = isActorAttr(left.attr) ? left : isActorAttr(right.attr) ? right : null;
  const otherSide = personSide === left ? right : personSide === right ? left : null;
  if (personSide && otherSide) {
    const person = actorLabel(catalog, roles, personSide);
    const otherLabel = labelOf(catalog, otherSide.attr, otherSide.item);
    const role = roles[otherSide.attr] || ATTRIBUTES[otherSide.attr];
    return role.personSame(person, otherLabel);
  }
  const leftWho = occupantPhrase(catalog, roles, left.attr, left.item);
  const rightLabel = labelOf(catalog, right.attr, right.item);
  const rightRole = roles[right.attr] || ATTRIBUTES[right.attr];
  if (typeof rightRole.personSame === "function") {
    return rightRole.personSame(leftWho, rightLabel);
  }
  return `${leftWho} is ${occupantPhrase(catalog, roles, right.attr, right.item)}`;
}

const HOUSE_COUNT_WORDS = ["one", "two", "three", "four", "five"];

/** Einstein: first / center / last house, otherwise “house N”. */
export function housePlaceName(house, houseCount) {
  const n = Number(houseCount) || 0;
  const index = Number(house);
  if (n > 0 && index === 0) return "the first house";
  if (n > 1 && index === n - 1) return "the last house";
  if (n >= 3 && n % 2 === 1 && index === Math.floor(n / 2)) return "the center house";
  return `house ${index + 1}`;
}

function joinEnglish(items) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list[0] || "";
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
}

const SETUP_NOUNS = {
  person: "owner",
  nationality: "nationality",
  color: "color",
  pet: "pet",
  drink: "drink",
  beverage: "beverage",
  cigar: "cigar",
  loot: "possession",
  getaway: "ride",
  prize: "prize",
  plant: "plant",
  vehicle: "ride",
  instrument: "instrument",
  book: "book",
  treat: "treat",
  gift: "gift",
  food: "meal",
  job: "job",
  hobby: "hobby",
  city: "city",
};

export function defaultPuzzleSetup(puzzle) {
  const n = Number(puzzle?.houseCount) || 3;
  const word = HOUSE_COUNT_WORDS[n - 1] || String(n);
  const ids = (puzzle?.attributes || []).map((attr) => attr.id || attr);
  const rest = ids
    .filter((id) => id !== "person" && id !== "nationality" && id !== "color")
    .map((id) => SETUP_NOUNS[id] || id);
  if (ids.includes("color")) {
    const extra = rest.length
      ? `. Each house has a different owner and a different ${joinEnglish(rest)}`
      : ". Each house has a different owner";
    return `There are ${word} houses in a row, each a different color${extra}.`;
  }
  return `There are ${word} houses in a row. Each house has a different ${joinEnglish(["owner", ...rest])}.`;
}

export function puzzleSetup(puzzle) {
  if (puzzle?.setup) return puzzle.setup;
  return defaultPuzzleSetup(puzzle);
}

export function clueText(clue, catalog, themeId = "", houseCount = 0) {
  const roles = rolesForTheme(themeId);
  const who = (attr, item) => occupantPhrase(catalog, roles, attr, item);
  const beside = (ref) => neighborPhrase(catalog, roles, ref);
  const place = (house) => housePlaceName(house, houseCount);
  const houseNo = (house) => house + 1;
  let text = "";
  switch (clue.type) {
    case "at":
      text = `${who(clue.attr, clue.item)} lives in ${place(clue.house)}.`;
      break;
    case "not_at":
      text = `${who(clue.attr, clue.item)} does not live in ${place(clue.house)}.`;
      break;
    case "either_house":
      text = `${who(clue.attr, clue.item)} lives in either house ${houseNo(clue.houses[0])} or house ${houseNo(clue.houses[1])}.`;
      break;
    case "same":
      text = `${samePhrase(catalog, roles, clue.left, clue.right)}.`;
      break;
    case "next_to":
      text = `${who(clue.left.attr, clue.left.item)} lives next to ${beside(clue.right)}.`;
      break;
    case "left_of":
      if (clue.left?.attr === "color" && clue.right?.attr === "color") {
        const leftColor = labelOf(catalog, "color", clue.left.item);
        const rightColor = labelOf(catalog, "color", clue.right.item);
        text = clue.immediate
          ? `The ${leftColor} house is directly left of the ${rightColor} house.`
          : `The ${leftColor} house is somewhere left of the ${rightColor} house.`;
      } else {
        text = clue.immediate
          ? `${who(clue.left.attr, clue.left.item)} lives directly left of ${beside(clue.right)}.`
          : `${who(clue.left.attr, clue.left.item)} lives somewhere left of ${beside(clue.right)}.`;
      }
      break;
    case "not_next_to":
      text = `${who(clue.left.attr, clue.left.item)} does not live next to ${beside(clue.right)}.`;
      break;
    default:
      return "";
  }
  return capitalizeClue(text);
}

/** Live clue copy. Einstein keeps its classic wording; everything else is rendered. */
export function displayClueText(puzzle, clue) {
  if (puzzle?.theme?.id === "einstein" && clue?.text) return clue.text;
  return clueText(clue, puzzle.items, puzzle.theme?.id || "", puzzle.houseCount || 0);
}

const EINSTEIN_BAD_PATTERNS = [
  [/\bleft by\b/i, "left by"],
  [/\btook the\b/i, "took the"],
  [/\bis with the\b/i, "is with the"],
  [/\bnext door\b/i, "next door"],
  [/\bimmediately left\b/i, "immediately left"],
  [/\bbrought the\b/i, "brought the"],
  [/\bordered the\b/i, "ordered the"],
  [/\bwon the\b/i, "won the"],
  [/\bhas the\b/i, "has the"],
  [/\btends the\b/i, "tends the"],
];

/** Odd item words. Skipped when a dated catalog still stores that label. */
export const EINSTEIN_BANNED_VOCAB = [
  [/\bcharts\b/i, "charts"],
  [/\bscore\b/i, "score"],
  [/\bfolio\b/i, "folio"],
  [/\bmelody\b/i, "melody"],
  [/\bharmony\b/i, "harmony"],
  [/\bbowl\b/i, "bowl"],
  [/\bstew\b/i, "stew"],
  [/\bleaf\b/i, "leaf"],
  [/\bpotted plant\b/i, "potted plant"],
  [/\bfield guide\b/i, "field guide"],
  [/\bopen book\b/i, "open book"],
  [/\bnotes\b/i, "notes"],
  [/\bdiary\b/i, "diary"],
  [/\bnovel\b/i, "novel"],
  [/\bcrown\b/i, "crown"],
  [/\bballoon\b/i, "balloon"],
  [/\bevergreen\b/i, "evergreen"],
  [/\bparcel\b/i, "parcel"],
  [/\bcookpot\b/i, "cookpot"],
  [/\bgift\b/i, "gift"],
  [/\bcookie\b/i, "cookie"],
];

const EINSTEIN_TYPE_PATTERNS = {
  at: /\blives in (?:the (?:first|center|last) house|house \d+)\.?$/i,
  not_at: /\bdoes not live in (?:the (?:first|center|last) house|house \d+)\.?$/i,
  either_house: /\blives in either house \d+ or house \d+\.?$/i,
  next_to: /\blives next to\b/i,
  not_next_to: /\bdoes not live next to\b/i,
  left_of: /\b(?:lives directly left of|lives somewhere left of|is directly left of|is somewhere left of)\b/i,
  same: /\b(?:lives in the|keeps|drinks|smokes|drives|rides|flies|sails|plays|is a |likes|eats|loves|grows|reads|is from|is on foot|owns)\b/i,
};

const ACTOR_ATTRS = new Set(["person", "nationality"]);
export const GENERIC_HAS_ATTRS = new Set(["loot", "prize", "gift", "treat", "getaway"]);

function catalogLabels(puzzle) {
  return flattenPuzzleItems(puzzle?.items || {}).map((item) => String(item.label || ""));
}

function lintEinsteinClue(puzzle, clue, text) {
  const reasons = [];
  if (!text) reasons.push("empty");
  if (text && !/^[A-Z]/.test(text)) reasons.push("must start with a capital");
  if (livesSubjectIsBareObject(text, puzzle.items)) reasons.push("bare object as subject");
  for (const [re, name] of EINSTEIN_BAD_PATTERNS) {
    if (re.test(text)) reasons.push(`bad pattern: ${name}`);
  }
  const labels = catalogLabels(puzzle);
  for (const [re, name] of EINSTEIN_BANNED_VOCAB) {
    if (labels.some((label) => re.test(label))) continue;
    if (re.test(text)) reasons.push(`banned vocab: ${name}`);
  }
  for (const person of puzzle.items?.person || []) {
    if (new RegExp(`\\bthe ${escapeRegExp(person.label)}\\b`, "i").test(text)) {
      reasons.push(`the ${person.label}`);
    }
  }
  const classic = puzzle?.theme?.id === "einstein";
  if (!classic) {
    const typeRe = EINSTEIN_TYPE_PATTERNS[clue.type];
    if (typeRe && !typeRe.test(text)) reasons.push(`not an approved ${clue.type} template`);
    const rendered = clueText(clue, puzzle.items, puzzle.theme?.id || "", puzzle.houseCount || 0);
    if (text !== rendered) reasons.push("not produced by the Einstein renderer");
  }
  return reasons;
}

function lintEinsteinCategories(puzzle) {
  const failures = [];
  for (const attr of puzzle?.attributes || []) {
    const id = attr.id || attr;
    if (ACTOR_ATTRS.has(id)) continue;
    const def = ATTRIBUTES[id];
    if (!def?.verb) {
      failures.push({
        id: `attr:${id}`,
        text: id,
        reasons: ["category must have a curated verb"],
      });
    }
  }
  return failures;
}

function lintEinsteinItemVocab(puzzle) {
  if (puzzle?.theme?.id === "einstein") return [];
  const failures = [];
  for (const item of flattenPuzzleItems(puzzle?.items || {})) {
    const label = String(item.label || "");
    for (const [re, name] of EINSTEIN_BANNED_VOCAB) {
      if (re.test(label)) {
        failures.push({
          id: `item:${item.id || label}`,
          text: label,
          reasons: [`banned vocab: ${name}`],
        });
      }
    }
  }
  return failures;
}

/** Publish check: every clue must read like Einstein’s riddle. */
export function validateEinsteinStyle(puzzle) {
  const failures = [];
  const setup = puzzleSetup(puzzle);
  if (!setup || !/^There are /i.test(setup) || !/house/i.test(setup)) {
    failures.push({
      id: "setup",
      text: setup || "",
      reasons: ["setup must start with 'There are' and mention houses"],
    });
  }
  failures.push(...lintEinsteinCategories(puzzle));
  const classic = puzzle?.theme?.id === "einstein";
  const enforceItemVocab = Boolean(puzzle?.practice) || (!puzzle?.date && !classic);
  if (enforceItemVocab) failures.push(...lintEinsteinItemVocab(puzzle));
  for (const clue of puzzle?.clues || []) {
    const text = displayClueText(puzzle, clue);
    const reasons = lintEinsteinClue(puzzle, clue, text);
    if (reasons.length) failures.push({ id: clue.id, type: clue.type, text, reasons });
  }
  return { ok: failures.length === 0, setup, failures };
}

export function flattenPuzzleItems(items = {}) {
  return Object.values(items).flat();
}

export function puzzleOptionRows(puzzle) {
  return (puzzle?.attributes || []).map((attr) => ({
    attr: attr.id,
    label: attr.label || attr.id,
    items: puzzle.items?.[attr.id] || [],
  }));
}

export function copyMentionsLabel(copy, item) {
  const needles = [item.label, ...(item.aliases || [])].filter(Boolean);
  return needles.some((needle) => new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i").test(copy));
}

export function puzzleCopyText(puzzle) {
  return [
    puzzleSetup(puzzle),
    puzzle?.question?.text,
    ...(puzzle?.clues || []).map((clue) => displayClueText(puzzle, clue)),
  ]
    .filter(Boolean)
    .join("\n");
}

/** Labels a person would never learn from clues, setup, or the question. */
export function labelsMissingFromCopy(puzzle) {
  const copy = puzzleCopyText(puzzle);
  const missing = [];
  for (const row of puzzleOptionRows(puzzle)) {
    for (const item of row.items) {
      if (!copyMentionsLabel(copy, item)) {
        missing.push({ attr: row.attr, id: item.id, label: item.label });
      }
    }
  }
  return missing;
}

export function normalizeGuess(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function itemNeedles(item) {
  return [item.label, item.id, ...(item.aliases || [])].filter(Boolean).map(normalizeGuess);
}

function compactGuess(value) {
  return normalizeGuess(value).replace(/[\s'-]+/g, "");
}

export function matchTypedItem(items, value) {
  const list = items || [];
  const needle = normalizeGuess(value);
  if (!needle) return { status: "empty", item: null, suggestions: list };
  const compact = compactGuess(needle);
  const exact = list.find((item) => {
    const needles = itemNeedles(item);
    return needles.includes(needle) || needles.map(compactGuess).includes(compact);
  });
  if (exact) return { status: "match", item: exact, suggestions: list };
  const suggestions = list.filter((item) =>
    itemNeedles(item).some(
      (label) =>
        label.startsWith(needle) ||
        compactGuess(label).startsWith(compact) ||
        label.split(" ").some((word) => word.startsWith(needle)),
    ),
  );
  if (suggestions.length) return { status: "partial", item: null, suggestions };
  return { status: "unknown", item: null, suggestions: [] };
}

export function completionRest(label, typed) {
  const body = String(typed || "").replace(/^\s+/, "");
  if (!label || !body) return "";
  const lowerLabel = label.toLowerCase();
  const lowerBody = body.toLowerCase();
  if (lowerLabel.startsWith(lowerBody)) return label.slice(body.length);
  const compactT = compactGuess(body);
  if (!compactT) return "";
  let consumed = 0;
  let index = 0;
  while (index < label.length && consumed < compactT.length) {
    const ch = label[index];
    if (/[\s'-]/.test(ch)) {
      index += 1;
      continue;
    }
    if (ch.toLowerCase() === compactT[consumed]) {
      consumed += 1;
      index += 1;
      continue;
    }
    return "";
  }
  return consumed === compactT.length ? label.slice(index) : "";
}

export function bestTypedCompletion(items, value) {
  const list = items || [];
  const raw = String(value || "");
  const needle = normalizeGuess(raw);
  if (!needle) return { status: "empty", item: null, rest: "" };
  const compact = compactGuess(needle);
  const exact = list.find((item) => {
    const needles = itemNeedles(item);
    return needles.includes(needle) || needles.map(compactGuess).includes(compact);
  });
  if (exact) return { status: "match", item: exact, rest: "" };
  const ranked = [];
  for (const item of list) {
    const sources = [item.label, item.id, ...(item.aliases || [])].filter(Boolean);
    const hit = sources.some((source) => {
      const n = normalizeGuess(source);
      return n.startsWith(needle) || compactGuess(n).startsWith(compact);
    });
    if (!hit) continue;
    const rest = completionRest(item.label, raw);
    ranked.push({ item, rest, len: item.label.length });
  }
  if (!ranked.length) return { status: "unknown", item: null, rest: "" };
  ranked.sort((a, b) => {
    const aPrefix = a.item.label.toLowerCase().startsWith(needle) ? 0 : 1;
    const bPrefix = b.item.label.toLowerCase().startsWith(needle) ? 0 : 1;
    if (aPrefix !== bPrefix) return aPrefix - bPrefix;
    if (a.len !== b.len) return a.len - b.len;
    return a.item.label.localeCompare(b.item.label);
  });
  const best = ranked[0];
  return { status: "partial", item: best.item, rest: best.rest };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightItemWordsHtml(text, items) {
  const source = String(text || "");
  const labels = [
    ...new Set(
      (items || []).flatMap((item) => [item.label, ...(item.aliases || [])].filter(Boolean)),
    ),
  ].sort((a, b) => b.length - a.length);
  if (!labels.length) return escapeHtml(source);
  const ranges = [];
  for (const label of labels) {
    const re = new RegExp(`\\b${escapeRegExp(label)}\\b`, "gi");
    let match;
    while ((match = re.exec(source))) {
      const start = match.index;
      const end = start + match[0].length;
      if (ranges.some((range) => start < range.end && end > range.start)) continue;
      ranges.push({ start, end, text: match[0] });
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  let html = "";
  let cursor = 0;
  for (const range of ranges) {
    html += escapeHtml(source.slice(cursor, range.start));
    html += `<strong>${escapeHtml(range.text)}</strong>`;
    cursor = range.end;
  }
  html += escapeHtml(source.slice(cursor));
  return html;
}

export function livesSubjectIsBareObject(text, itemsByAttr) {
  const match = String(text || "").match(/^(.+?)\s+(?:does not live|lives)\b/i);
  if (!match) return false;
  const subject = match[1].replace(/^the\s+/i, "").trim().toLowerCase();
  for (const [attr, items] of Object.entries(itemsByAttr || {})) {
    if (isActorAttr(attr)) continue;
    for (const item of items) {
      if (normalizeGuess(item.label) === subject || normalizeGuess(item.id) === subject) return true;
    }
  }
  return false;
}

export function pruneClues(houseCount, attributes, items, clues) {
  const keep = clues.slice();
  for (let i = keep.length - 1; i >= 0; i -= 1) {
    const trial = keep.filter((_, index) => index !== i);
    const result = countSolutions(houseCount, attributes, items, trial, 2);
    if (result.count === 1) keep.splice(i, 1);
  }
  return keep;
}

function solutionSignature(solution) {
  return JSON.stringify(solution);
}

function cluePattern(clues) {
  return clues.map((clue) => clue.type + (clue.immediate ? "-imm" : "")).sort().join(",");
}

export function buildQuestion(theme, solution, catalog, rng) {
  const givenAttr = theme.questionGiven;
  const answerAttr = theme.questionAnswer;
  const house = Math.floor(rng() * solution.length);
  const givenItem = catalog[givenAttr].find((item) => item.id === solution[house][givenAttr]);
  const answerItem = catalog[answerAttr].find((item) => item.id === solution[house][answerAttr]);
  return {
    text: theme.question(givenItem, answerItem),
    givenAttr,
    givenItem: givenItem.id,
    answerAttr,
    answerItem: answerItem.id,
  };
}

function itemCatalog(theme, attributes, chosen) {
  const catalog = {};
  for (const attr of attributes) {
    catalog[attr] = chosen[attr].map((id) => theme.items[attr].find((item) => item.id === id));
  }
  return catalog;
}

export function generatePuzzle(iso, options = {}) {
  const spec = options.spec || specForDate(iso);
  const rng = options.rng || rngFromSeed(`${iso}:${GAME_NAME}:${spec.label}:${options.salt || 0}`);
  const used = options.used || { solutions: new Set(), patterns: new Set() };
  const holidayId = spec.holidayTheme;
  const themePool = holidayId ? [themeById(holidayId), ...THEMES] : THEMES;
  const maxTries = options.maxTries || (spec.houseCount >= 5 ? 180 : 80);
  const requireHuman = options.requireHuman !== false;

  for (let attempt = 0; attempt < maxTries; attempt += 1) {
    const theme =
      (options.themeId && themeById(options.themeId)) ||
      themePool[Math.floor(rng() * (holidayId && attempt === 0 ? 1 : themePool.length))];
    const houseCount = spec.houseCount;
    const attributes = theme.attributes;
    const chosen = {};
    const items = {};
    let tooSmall = false;
    for (const attr of attributes) {
      const pool = theme.items[attr];
      if (pool.length < houseCount) {
        tooSmall = true;
        break;
      }
      chosen[attr] = pickN(pool, houseCount, rng).map((item) => item.id);
      items[attr] = chosen[attr];
    }
    if (tooSmall) continue;
    const solution = randomSolution(houseCount, attributes, items, rng);
    const sig = solutionSignature(solution);
    if (used.solutions.has(sig)) continue;
    const maxAtClues = spec.maxAtClues ?? (spec.types.includes("at") ? (houseCount >= 5 ? 3 : 4) : 0);
    const clueTypes = maxAtClues > 0 && !spec.types.includes("at") ? [...spec.types, "at"] : spec.types;
    const rawPool = trueCluesFor(solution, clueTypes, rng);
    const byType = new Map();
    for (const clue of rawPool) {
      if (!byType.has(clue.type)) byType.set(clue.type, []);
      byType.get(clue.type).push(clue);
    }
    const take = (type, n) => shuffle(byType.get(type) || [], rng).slice(0, n);
    const wide = houseCount >= 5 || attributes.length >= 4;
    const atBudget = spec.types.includes("at") ? maxAtClues : 0;
    const minClues = spec.minClues || 5;
    const maxClues = spec.maxClues || 8;
    const hardMix = Boolean(spec.preferHardTypes);
    const pool = hardMix
      ? shuffle(
          [
            ...take("same", 12),
            ...take("next_to", 10),
            ...take("left_of", 12),
            ...take("either_house", 8),
            ...take("not_next_to", 8),
            ...take("not_at", 6),
            ...take("at", atBudget),
          ],
          rng,
        )
      : [
          ...take("same", wide ? 20 : 12),
          ...take("next_to", wide ? 16 : 10),
          ...take("left_of", wide ? 16 : 10),
          ...take("at", atBudget),
          ...take("either_house", wide ? 10 : 6),
          ...take("not_at", wide ? 10 : 6),
          ...take("not_next_to", wide ? 12 : 8),
        ];
    const clues = [];
    let unique = null;
    const atCount = (list) => list.filter((clue) => clue.type === "at").length;
    const gatherCap = Math.max(maxClues + 8, 16);
    for (const clue of pool) {
      clues.push(clue);
      unique = countSolutions(houseCount, attributes, items, clues, 2);
      if (unique.count === 1) break;
      if (clues.length >= gatherCap) break;
    }
    if (!unique || unique.count !== 1) {
      for (const clue of take("at", 15)) {
        if (atCount(clues) >= maxAtClues) break;
        clues.push(clue);
        unique = countSolutions(houseCount, attributes, items, clues, 2);
        if (unique.count === 1) break;
        if (clues.length >= gatherCap) break;
      }
    }
    if (!unique || unique.count !== 1) continue;
    let pruned = pruneClues(houseCount, attributes, items, clues);
    const late = attempt >= maxTries - 15;
    if (pruned.length < minClues) {
      if (clues.length >= minClues && clues.length <= Math.max(10, maxClues)) {
        pruned = clues.slice(0, Math.min(maxClues, clues.length));
      } else if (!late) continue;
    }
    if (pruned.length > maxClues || pruned.length < minClues) continue;
    if (atCount(pruned) > maxAtClues) continue;
    const rated = countSolutions(houseCount, attributes, items, pruned, 2);
    if (rated.count !== 1) continue;
    const numbered = pruned.map((clue, index) => ({ id: `c${index + 1}`, ...clue }));
    const human = requireHuman
      ? solveByHuman(houseCount, attributes, items, numbered, { maxContradiction: spec.maxContradiction ?? 2 })
      : { solvedByHuman: true, steps: [], hardest: "direct", hardestTier: 1, score: rated.steps };
    if (requireHuman && !human.solvedByHuman) {
      const fallback = solveByHuman(houseCount, attributes, items, clues.map((clue, index) => ({ id: `c${index + 1}`, ...clue })), {
        maxContradiction: spec.maxContradiction ?? 2,
      });
      if (!fallback.solvedByHuman || clues.length > maxClues || clues.length < minClues) continue;
      if (atCount(clues) > maxAtClues) continue;
      pruned = clues;
      numbered.splice(0, numbered.length, ...pruned.map((clue, index) => ({ id: `c${index + 1}`, ...clue })));
      Object.assign(human, fallback);
    }
    const humanInfo = humanDifficulty(human);
    const steps = humanInfo.solvedByHuman ? humanInfo.steps : rated.neededSearch ? rated.steps + 10 : rated.steps;
    if (!late && spec.minHumanSteps && steps < spec.minHumanSteps) continue;
    if (!late && spec.maxHumanSteps && steps > spec.maxHumanSteps) continue;
    if (spec.minHumanTier && humanInfo.hardestTier < spec.minHumanTier) continue;
    if (spec.maxHumanTier && humanInfo.hardestTier > spec.maxHumanTier) continue;
    if (!late && !humanInfo.solvedByHuman) continue;
    if (!late && steps < spec.minSteps && !humanInfo.solvedByHuman) continue;
    if (!late && steps > spec.maxSteps && !requireHuman) continue;
    const pattern = `${houseCount}:${theme.id}:${cluePattern(pruned)}`;
    const catalog = itemCatalog(theme, attributes, chosen);
    const withText = numbered.map((clue) => ({
      ...clue,
      text: clueText(clue, catalog, theme.id, houseCount),
    }));
    const packedAttrs = attributes.map((id) => ({ id, label: ATTRIBUTES[id]?.label || id }));
    const draft = {
      date: iso,
      number: puzzleNumber(iso),
      theme: {
        id: theme.id,
        title: theme.title,
        blurb: theme.blurb,
        story: theme.story,
      },
      setup: defaultPuzzleSetup({ houseCount, attributes: packedAttrs, items: catalog, theme }),
      houseCount,
      attributes: packedAttrs,
      items: catalog,
      clues: withText,
      question: buildQuestion(theme, solution, catalog, rng),
      solution,
      difficulty: {
        label: humanInfo.label || spec.label,
        steps,
        neededSearch: Boolean(rated.neededSearch),
        weekday: weekdayUtc(iso),
        solvedByHuman: Boolean(humanInfo.solvedByHuman),
        hardest: humanInfo.hardest,
        hardestTier: humanInfo.hardestTier,
        score: humanInfo.score,
      },
    };
    const style = validateEinsteinStyle(draft);
    if (!style.ok) continue;
    used.solutions.add(sig);
    used.patterns.add(pattern);
    return draft;
  }
  throw new Error(`Could not generate a unique puzzle for ${iso}`);
}

export function placementComplete(grid, houseCount, attributes) {
  for (let house = 0; house < houseCount; house += 1) {
    for (const attr of attributes) {
      if (!grid[house]?.[attr]) return false;
    }
  }
  return true;
}

export function gridMatchesSolution(grid, solution) {
  return solution.every((row, house) =>
    Object.keys(row).every((attr) => grid[house]?.[attr] === row[attr]),
  );
}

export function houseIsCompleteAndCorrect(grid, solution, house) {
  const row = solution[house];
  return Object.keys(row).every((attr) => grid[house]?.[attr] === row[attr]);
}

export function clueSatisfiedByGrid(clue, grid, houseCount, attributes) {
  const assignment = [];
  for (let house = 0; house < houseCount; house += 1) {
    const row = {};
    for (const attr of attributes) {
      const value = grid[house]?.[attr];
      if (!value) return false;
      row[attr] = value;
    }
    assignment.push(row);
  }
  return clueHolds(clue, assignment);
}

export function firstHintCell(grid, solution, attributes) {
  for (let house = 0; house < solution.length; house += 1) {
    for (const attr of attributes) {
      if (!grid[house]?.[attr]) {
        return { house, attr, item: solution[house][attr] };
      }
    }
  }
  return null;
}

export function formatShare({
  gameName = GAME_NAME,
  number,
  heading,
  houseCount,
  completionOrder,
  elapsedMs,
  siteUrl = SITE_URL,
} = {}) {
  const houses = HOUSE_EMOJI.repeat(houseCount);
  const order = (completionOrder || []).map((rank) => KEYCAP_DIGITS[rank - 1] || "?").join("");
  const title = heading || `${gameName} #${number}`;
  return [title, houses, order, `Solved in ${formatTime(elapsedMs)}`, siteUrl].join("\n");
}

export function scoreFor({ elapsedMs, mistakes, hints }) {
  const seconds = Math.floor(elapsedMs / 1000);
  return Math.max(0, 1000 - seconds - 50 * mistakes - 120 * hints);
}

export const EINSTEIN_SETUP =
  "There are five houses, each painted a different color. In each house lives a person with a different nationality. These five owners drink a certain type of beverage, smoke a certain brand of cigar, and keep a certain pet. No owners have the same pet, smoke the same cigar, or drink the same beverage.";

const EINSTEIN_ITEMS = {
  color: [
    { id: "red", label: "red", icon: "paint-brush" },
    { id: "green", label: "green", icon: "leaf" },
    { id: "white", label: "white", icon: "house" },
    { id: "yellow", label: "yellow", icon: "sun" },
    { id: "blue", label: "blue", icon: "house-simple" },
  ],
  nationality: [
    { id: "brit", label: "Brit", icon: "user" },
    { id: "swede", label: "Swede", icon: "user-circle" },
    { id: "dane", label: "Dane", icon: "student" },
    { id: "norwegian", label: "Norwegian", icon: "detective" },
    { id: "german", label: "German", icon: "identification-badge" },
  ],
  beverage: [
    { id: "tea", label: "tea", icon: "tea-bag" },
    { id: "coffee", label: "coffee", icon: "coffee" },
    { id: "milk", label: "milk", icon: "brandy" },
    { id: "beer", label: "beer", icon: "beer-stein" },
    { id: "water", label: "water", icon: "wine" },
  ],
  cigar: [
    { id: "pall-mall", label: "Pall Mall", aliases: ["pall mall", "pallmall", "pall-mall"], icon: "leaf" },
    { id: "dunhill", label: "Dunhill", icon: "pencil-simple" },
    { id: "blends", label: "Blends", aliases: ["blend", "blends"], icon: "note-pencil" },
    { id: "bluemaster", label: "BlueMaster", aliases: ["blue master", "bluemaster", "blue-master"], icon: "briefcase" },
    { id: "prince", label: "Prince", icon: "crown" },
  ],
  pet: [
    { id: "dogs", label: "dogs", icon: "dog" },
    { id: "birds", label: "birds", icon: "bird" },
    { id: "cats", label: "cats", icon: "cat" },
    { id: "horses", label: "horses", icon: "horse" },
    { id: "fish", label: "fish", icon: "fish" },
  ],
};

const EINSTEIN_CLUE_SPECS = [
  {
    type: "same",
    left: { attr: "nationality", item: "brit" },
    right: { attr: "color", item: "red" },
    text: "The Brit lives in the red house",
  },
  {
    type: "same",
    left: { attr: "nationality", item: "swede" },
    right: { attr: "pet", item: "dogs" },
    text: "The Swede keeps dogs as pets",
  },
  {
    type: "same",
    left: { attr: "nationality", item: "dane" },
    right: { attr: "beverage", item: "tea" },
    text: "The Dane drinks tea",
  },
  {
    type: "left_of",
    immediate: true,
    left: { attr: "color", item: "green" },
    right: { attr: "color", item: "white" },
    text: "The green house is on the left of the white house",
  },
  {
    type: "same",
    left: { attr: "color", item: "green" },
    right: { attr: "beverage", item: "coffee" },
    text: "The green house's owner drinks coffee",
  },
  {
    type: "same",
    left: { attr: "cigar", item: "pall-mall" },
    right: { attr: "pet", item: "birds" },
    text: "The person who smokes Pall Mall rears birds",
  },
  {
    type: "same",
    left: { attr: "color", item: "yellow" },
    right: { attr: "cigar", item: "dunhill" },
    text: "The owner of the yellow house smokes Dunhill",
  },
  {
    type: "at",
    attr: "beverage",
    item: "milk",
    house: 2,
    text: "The man living in the center house drinks milk",
  },
  {
    type: "at",
    attr: "nationality",
    item: "norwegian",
    house: 0,
    text: "The Norwegian lives in the first house",
  },
  {
    type: "next_to",
    left: { attr: "cigar", item: "blends" },
    right: { attr: "pet", item: "cats" },
    text: "The man who smokes blends lives next to the one who keeps cats",
  },
  {
    type: "next_to",
    left: { attr: "pet", item: "horses" },
    right: { attr: "cigar", item: "dunhill" },
    text: "The man who keeps horses lives next to the man who smokes Dunhill",
  },
  {
    type: "same",
    left: { attr: "cigar", item: "bluemaster" },
    right: { attr: "beverage", item: "beer" },
    text: "The owner who smokes BlueMaster drinks beer",
  },
  {
    type: "same",
    left: { attr: "nationality", item: "german" },
    right: { attr: "cigar", item: "prince" },
    text: "The German smokes Prince",
  },
  {
    type: "next_to",
    left: { attr: "nationality", item: "norwegian" },
    right: { attr: "color", item: "blue" },
    text: "The Norwegian lives next to the blue house",
  },
  {
    type: "next_to",
    left: { attr: "cigar", item: "blends" },
    right: { attr: "beverage", item: "water" },
    text: "The man who smokes blend has a neighbor who drinks water",
  },
];

export const EINSTEIN_SOLUTION = [
  { color: "yellow", nationality: "norwegian", beverage: "water", cigar: "dunhill", pet: "cats" },
  { color: "blue", nationality: "dane", beverage: "tea", cigar: "blends", pet: "horses" },
  { color: "red", nationality: "brit", beverage: "milk", cigar: "pall-mall", pet: "birds" },
  { color: "green", nationality: "german", beverage: "coffee", cigar: "prince", pet: "fish" },
  { color: "white", nationality: "swede", beverage: "beer", cigar: "bluemaster", pet: "dogs" },
];

export function einsteinPuzzle(date = LAUNCH_DATE) {
  const attributes = ["color", "nationality", "beverage", "cigar", "pet"];
  return {
    date,
    number: puzzleNumber(date),
    theme: {
      id: "einstein",
      title: "Einstein's riddle",
      blurb: "Five houses, five owners. Who owns the fish?",
      story: "The classic street. Fifteen clues. One fish.",
    },
    setup: EINSTEIN_SETUP,
    houseCount: 5,
    attributes: attributes.map((id) => ({ id, label: ATTRIBUTES[id].label })),
    items: EINSTEIN_ITEMS,
    clues: EINSTEIN_CLUE_SPECS.map((clue, index) => ({ id: `c${index + 1}`, ...clue })),
    question: {
      text: "Who owns the fish?",
      givenAttr: "pet",
      givenItem: "fish",
      answerAttr: "nationality",
      answerItem: "german",
    },
    solution: EINSTEIN_SOLUTION,
    difficulty: {
      label: "einstein-classic",
      steps: 0,
      neededSearch: false,
      weekday: weekdayUtc(date),
    },
  };
}
