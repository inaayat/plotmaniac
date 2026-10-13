/**
 * Human-style zebra/logic-grid solver.
 *
 * Inspired by the technique names in antonstefer/logic-grid (MIT) and by
 * Simon Tatham's puzzle-grading idea (MIT): only publish what a person can
 * finish with named deductions, never by searching the remaining tree.
 * Implementation is original, in this repo's clue types, with no SAT/CSP search.
 */
import {
  applyClue,
  cloneDomains,
  emptyDomains,
  isSolved,
  possibleHouses,
  readSolution,
} from "./plotted-engine.js";

export const TECHNIQUE_TIER = {
  direct: 1,
  elimination: 2,
  hidden_single: 3,
  naked_single: 4,
  same_house: 5,
  next_to: 5,
  left_of: 5,
  not_next_to: 5,
  either_house: 5,
  next_to_edge: 6,
  left_of_edge: 6,
  naked_pair: 7,
  hidden_pair: 7,
  contradiction: 8,
  contradiction_2: 9,
};

export function puzzleItemIds(puzzle) {
  const attributes = puzzle.attributes.map((entry) => entry.id);
  const items = {};
  for (const attr of attributes) {
    items[attr] = puzzle.items[attr].map((item) => item.id);
  }
  return { houseCount: puzzle.houseCount, attributes, items };
}

export function solvePuzzleByHuman(puzzle, options = {}) {
  const { houseCount, attributes, items } = puzzleItemIds(puzzle);
  return solveByHuman(houseCount, attributes, items, puzzle.clues, options);
}

function domainsOk(domains) {
  for (const attr of Object.keys(domains)) {
    const houses = domains[attr];
    for (const set of houses) {
      if (set.size === 0) return false;
    }
    const items = new Set();
    houses.forEach((set) => set.forEach((item) => items.add(item)));
    for (const item of items) {
      if (!houses.some((set) => set.has(item))) return false;
    }
  }
  return true;
}

function snapshot(domains) {
  const rows = [];
  for (const attr of Object.keys(domains)) {
    domains[attr].forEach((set, house) => {
      for (const item of set) rows.push(`${attr}:${house}:${item}`);
    });
  }
  return rows.sort().join("|");
}

function techniqueForClue(clue, domains) {
  if (clue.type === "at") return "direct";
  if (clue.type === "not_at") return "elimination";
  if (clue.type === "either_house") return "either_house";
  if (clue.type === "same") return "same_house";
  if (clue.type === "not_next_to") return "not_next_to";
  if (clue.type === "next_to") {
    const leftN = possibleHouses(domains, clue.left.attr, clue.left.item).length;
    const rightN = possibleHouses(domains, clue.right.attr, clue.right.item).length;
    return leftN === 1 || rightN === 1 ? "next_to_edge" : "next_to";
  }
  if (clue.type === "left_of") {
    const leftN = possibleHouses(domains, clue.left.attr, clue.left.item).length;
    const rightN = possibleHouses(domains, clue.right.attr, clue.right.item).length;
    return leftN === 1 || rightN === 1 ? "left_of_edge" : "left_of";
  }
  return clue.type;
}

function applyNakedSingles(domains) {
  let changed = false;
  for (const attr of Object.keys(domains)) {
    const n = domains[attr].length;
    for (let house = 0; house < n; house += 1) {
      if (domains[attr][house].size !== 1) continue;
      const item = [...domains[attr][house]][0];
      for (let other = 0; other < n; other += 1) {
        if (other !== house && domains[attr][other].delete(item)) changed = true;
      }
    }
  }
  return changed;
}

function applyHiddenSingles(domains) {
  let changed = false;
  for (const attr of Object.keys(domains)) {
    const items = new Set();
    domains[attr].forEach((set) => set.forEach((item) => items.add(item)));
    for (const item of items) {
      const houses = possibleHouses(domains, attr, item);
      if (houses.length === 1 && domains[attr][houses[0]].size !== 1) {
        domains[attr][houses[0]] = new Set([item]);
        changed = true;
      }
    }
  }
  return changed;
}

function applyNakedPairs(domains) {
  let changed = false;
  for (const attr of Object.keys(domains)) {
    const n = domains[attr].length;
    for (let a = 0; a < n; a += 1) {
      if (domains[attr][a].size !== 2) continue;
      const key = [...domains[attr][a]].sort().join(",");
      for (let b = a + 1; b < n; b += 1) {
        if (domains[attr][b].size !== 2) continue;
        if ([...domains[attr][b]].sort().join(",") !== key) continue;
        const pair = new Set(domains[attr][a]);
        for (let other = 0; other < n; other += 1) {
          if (other === a || other === b) continue;
          for (const item of pair) {
            if (domains[attr][other].delete(item)) changed = true;
          }
        }
      }
    }
  }
  return changed;
}

function applyHiddenPairs(domains) {
  let changed = false;
  for (const attr of Object.keys(domains)) {
    const items = [...new Set(domains[attr].flatMap((set) => [...set]))];
    for (let i = 0; i < items.length; i += 1) {
      const housesA = possibleHouses(domains, attr, items[i]);
      if (housesA.length !== 2) continue;
      for (let j = i + 1; j < items.length; j += 1) {
        const housesB = possibleHouses(domains, attr, items[j]);
        if (housesB.length !== 2) continue;
        if (housesA[0] !== housesB[0] || housesA[1] !== housesB[1]) continue;
        const keep = new Set([items[i], items[j]]);
        for (const house of housesA) {
          for (const item of [...domains[attr][house]]) {
            if (!keep.has(item)) {
              domains[attr][house].delete(item);
              changed = true;
            }
          }
        }
      }
    }
  }
  return changed;
}

function basicRound(domains, clues) {
  let changed = false;
  for (const clue of clues) {
    const result = applyClue(domains, clue);
    if (!result.ok) return { ok: false, changed };
    changed = changed || result.changed;
  }
  if (applyNakedSingles(domains)) changed = true;
  if (applyHiddenSingles(domains)) changed = true;
  if (applyNakedPairs(domains)) changed = true;
  if (applyHiddenPairs(domains)) changed = true;
  if (!domainsOk(domains)) return { ok: false, changed };
  return { ok: true, changed };
}

function deduceUntilStuck(domains, clues, contradictionDepth) {
  for (let round = 0; round < 80; round += 1) {
    const basic = basicRound(domains, clues);
    if (!basic.ok) return { ok: false };
    let changed = basic.changed;
    if (contradictionDepth >= 1) {
      const contra = tryContradiction(domains, clues, contradictionDepth);
      if (!contra.ok) return { ok: false };
      changed = changed || contra.changed;
    }
    if (!changed) return { ok: true };
    if (!domainsOk(domains)) return { ok: false };
  }
  return { ok: domainsOk(domains) };
}

function tryContradiction(domains, clues, depth) {
  let changed = false;
  for (const attr of Object.keys(domains)) {
    for (let house = 0; house < domains[attr].length; house += 1) {
      if (domains[attr][house].size < 2) continue;
      const candidates = [...domains[attr][house]];
      for (const item of candidates) {
        if (!domains[attr][house].has(item)) continue;
        const trial = cloneDomains(domains);
        trial[attr][house] = new Set([item]);
        const inner = deduceUntilStuck(trial, clues, depth - 1);
        if (!inner.ok) {
          domains[attr][house].delete(item);
          changed = true;
          if (domains[attr][house].size === 0) return { ok: false, changed: true };
        }
      }
    }
  }
  return { ok: domainsOk(domains), changed };
}

export function solveByHuman(houseCount, attributes, items, clues, options = {}) {
  const maxContradiction = options.maxContradiction ?? 2;
  const domains = emptyDomains(houseCount, attributes, items);
  const steps = [];
  let hardest = "direct";
  let hardestTier = 0;

  const record = (technique, clue = null, detail = "") => {
    const tier = TECHNIQUE_TIER[technique] || 0;
    if (tier > hardestTier) {
      hardestTier = tier;
      hardest = technique;
    }
    steps.push({
      technique,
      clueId: clue?.id || null,
      clueType: clue?.type || null,
      detail,
    });
  };

  for (let round = 0; round < 120; round += 1) {
    if (isSolved(domains)) break;
    const before = snapshot(domains);
    let progressed = false;

    for (const clue of clues) {
      const beforeClue = snapshot(domains);
      const named = techniqueForClue(clue, domains);
      const result = applyClue(domains, clue);
      if (!result.ok) {
        return {
          solvedByHuman: false,
          steps,
          hardest,
          hardestTier,
          score: 0,
          solution: null,
        };
      }
      if (snapshot(domains) !== beforeClue) {
        record(named, clue);
        progressed = true;
      }
    }

    const beforeSingles = snapshot(domains);
    if (applyNakedSingles(domains) && snapshot(domains) !== beforeSingles) {
      record("naked_single");
      progressed = true;
    }
    const beforeHidden = snapshot(domains);
    if (applyHiddenSingles(domains) && snapshot(domains) !== beforeHidden) {
      record("hidden_single");
      progressed = true;
    }
    const beforePair = snapshot(domains);
    if (applyNakedPairs(domains) && snapshot(domains) !== beforePair) {
      record("naked_pair");
      progressed = true;
    }
    const beforeHiddenPair = snapshot(domains);
    if (applyHiddenPairs(domains) && snapshot(domains) !== beforeHiddenPair) {
      record("hidden_pair");
      progressed = true;
    }

    if (!progressed && maxContradiction >= 1 && !isSolved(domains)) {
      const depth = snapshot(domains);
      const contra1 = tryContradiction(domains, clues, 1);
      if (!contra1.ok) {
        return {
          solvedByHuman: false,
          steps,
          hardest,
          hardestTier,
          score: 0,
          solution: null,
        };
      }
      if (contra1.changed && snapshot(domains) !== depth) {
        record("contradiction");
        progressed = true;
      } else if (maxContradiction >= 2) {
        const contra2 = tryContradiction(domains, clues, 2);
        if (!contra2.ok) {
          return {
            solvedByHuman: false,
            steps,
            hardest,
            hardestTier,
            score: 0,
            solution: null,
          };
        }
        if (contra2.changed) {
          record("contradiction_2");
          progressed = true;
        }
      }
    }

    if (!progressed || snapshot(domains) === before) break;
    if (!domainsOk(domains)) {
      return {
        solvedByHuman: false,
        steps,
        hardest,
        hardestTier,
        score: 0,
        solution: null,
      };
    }
  }

  const solved = isSolved(domains) && domainsOk(domains);
  return {
    solvedByHuman: solved,
    steps,
    hardest: solved ? hardest : hardest,
    hardestTier,
    score: solved ? steps.length + hardestTier * 5 : 0,
    solution: solved ? readSolution(domains) : null,
  };
}

export function humanDifficulty(result) {
  if (!result?.solvedByHuman) {
    return {
      solvedByHuman: false,
      label: "unsolved",
      steps: result?.steps?.length || 0,
      hardest: result?.hardest || "",
      hardestTier: result?.hardestTier || 0,
      score: 0,
    };
  }
  const tier = result.hardestTier;
  let label = "easy";
  if (tier >= 8) label = "hard";
  else if (tier >= 7) label = "medium-hard";
  else if (tier >= 5) label = "medium";
  else if (tier >= 3) label = "easy-medium";
  if (result.steps.length >= 28 && label !== "hard") label = "medium-hard";
  if (result.steps.length >= 40) label = "hard";
  return {
    solvedByHuman: true,
    label,
    steps: result.steps.length,
    hardest: result.hardest,
    hardestTier: tier,
    score: result.score,
  };
}
