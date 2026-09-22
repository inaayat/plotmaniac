export const GUN_STATE_FILTER_ANY = "any";
export const GUN_STATE_FILTER_STATUSES = [
  GUN_STATE_FILTER_ANY,
  "not_required",
  "required",
  "partial",
  "not_applicable",
];

export const GUN_TYPE_HANDGUN = "handgun";
export const GUN_TYPE_LONG_GUN = "longgun";

const CARRY_CRITERIA = new Set(["carry-permit", "open-carry-permit"]);

export function usesGunStateLawsPlot(plot) {
  return plot?.arrangement === "gun-state-laws";
}

export function gunTypeLabel(gunType) {
  return gunType === GUN_TYPE_LONG_GUN ? "Long gun" : "Handgun";
}

export function parseGunType(urlLike) {
  const url = new URL(urlLike, "https://plotmaniac.com/");
  const gun = (url.searchParams.get("gun") || "").trim().toLowerCase();
  if (gun === "longgun" || gun === "long-gun" || gun === "long") return GUN_TYPE_LONG_GUN;
  return GUN_TYPE_HANDGUN;
}

export function statusLabel(status) {
  const map = {
    not_required: "No",
    required: "Yes",
    partial: "Partial",
    not_applicable: "N/A",
    unknown: "Unknown",
  };
  return map[status] || status;
}

export function wikiCellToStatus(cell) {
  const v = (cell || "").trim();
  if (!v) return "unknown";
  const lower = v.toLowerCase();
  if (lower === "yes") return "required";
  if (lower === "no") return "not_required";
  if (lower === "partial") return "partial";
  if (lower === "n/a") return "not_applicable";
  if (lower === "illegal") return "required";
  if (lower.startsWith("no*") || lower.includes("no*")) return "partial";
  return "unknown";
}

export function getStateCriterionCell(state, criterionId) {
  return state?.checklist?.[criterionId] || state?.extras?.[criterionId] || null;
}

/**
 * Resolve Wikipedia long-gun / handgun column for the selected firearm type.
 */
export function resolveStatusForGunType(cell, gunType, criterionId) {
  if (!cell) return "unknown";
  if (!cell.wiki) return cell.status || "unknown";
  const raw =
    gunType === GUN_TYPE_LONG_GUN ? cell.wiki.longGun : cell.wiki.handgun;
  const status = wikiCellToStatus(raw);
  if (
    CARRY_CRITERIA.has(criterionId)
    && gunType === GUN_TYPE_LONG_GUN
    && wikiCellToStatus(raw) === "not_applicable"
  ) {
    return "not_applicable";
  }
  if (status !== "unknown") return status;
  return cell.status || "unknown";
}

export function parseGunStateLawFilters(urlLike, validCriteria) {
  const url = new URL(urlLike, "https://plotmaniac.com/");
  const raw = url.searchParams.get("criteria") || url.searchParams.get("filter") || "";
  /** @type {Record<string, string>} */
  const filters = {};
  if (!raw) return filters;
  raw.split(",").forEach((chunk) => {
    const [id, want] = chunk.split(":").map((part) => part.trim());
    if (!id || !validCriteria?.has(id)) return;
    if (GUN_STATE_FILTER_STATUSES.includes(want)) filters[id] = want;
  });
  return filters;
}

export function serializeGunStateLawFilters(filters) {
  return Object.entries(filters || {})
    .filter(([, want]) => want && want !== GUN_STATE_FILTER_ANY)
    .map(([id, want]) => `${id}:${want}`)
    .join(",");
}

function matchesFilter(state, criterionId, want, gunType) {
  const cell = getStateCriterionCell(state, criterionId);
  const status = resolveStatusForGunType(cell, gunType, criterionId);
  if (status === "unknown") {
    return want === "not_required" || want === "not_applicable";
  }
  if (want === "partial") return status === "partial" || status === "required";
  if (want === "not_applicable") return status === "not_applicable";
  return status === want;
}

/**
 * @param {Array<object>} states
 * @param {Record<string, string>} filters criterionId → desired status
 * @param {string} gunType handgun | longgun
 */
export function filterStatesByCriteria(states, filters, gunType = GUN_TYPE_HANDGUN) {
  const active = Object.entries(filters || {}).filter(
    ([, want]) => want && want !== GUN_STATE_FILTER_ANY,
  );
  if (!active.length) return states.slice();
  return (states || []).filter((state) =>
    active.every(([criterionId, want]) => matchesFilter(state, criterionId, want, gunType)),
  );
}

export function validateGunStateSnapshot(snapshot) {
  const errors = [];
  if (snapshot?.schema !== "plotmaniac-gun-state-wikipedia-snapshot") {
    errors.push("unexpected snapshot schema");
  }
  const states = snapshot?.states || [];
  if (states.length !== 51) errors.push(`expected 51 jurisdictions (50 states + DC), got ${states.length}`);
  const ids = new Set(states.map((row) => row.id));
  if (ids.size !== states.length) errors.push("duplicate state ids in snapshot");
  states.forEach((state) => {
    if (!state.id || !state.postal) errors.push(`state missing id/postal: ${state.name || "?"}`);
  });
  return errors;
}
