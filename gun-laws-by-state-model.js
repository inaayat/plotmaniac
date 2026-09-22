export const GUN_STATE_FILTER_ANY = "any";
export const GUN_STATE_FILTER_STATUSES = [
  GUN_STATE_FILTER_ANY,
  "not_required",
  "required",
  "partial",
  "not_applicable",
];

export function usesGunStateLawsPlot(plot) {
  return plot?.arrangement === "gun-state-laws";
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

/**
 * @param {Array<{ checklist: Record<string, { status: string }> }>} states
 * @param {Record<string, string>} filters criterionId → desired status (omit or "any" = don't care)
 */
export function filterStatesByCriteria(states, filters) {
  const active = Object.entries(filters || {}).filter(
    ([, want]) => want && want !== GUN_STATE_FILTER_ANY,
  );
  if (!active.length) return states.slice();
  return (states || []).filter((state) =>
    active.every(([criterionId, want]) => {
      const cell = state.checklist?.[criterionId];
      if (!cell) {
        return want === "not_required" || want === "not_applicable";
      }
      if (want === "partial") return cell.status === "partial" || cell.status === "required";
      return cell.status === want;
    }),
  );
}

export function validateGunStateSnapshot(snapshot) {
  const errors = [];
  if (snapshot?.schema !== "plotmaniac-gun-state-wikipedia-snapshot") {
    errors.push("unexpected snapshot schema");
  }
  const states = snapshot?.states || [];
  if (states.length < 50) errors.push(`expected at least 50 states, got ${states.length}`);
  states.forEach((state) => {
    if (!state.id || !state.postal) errors.push(`state missing id/postal: ${state.name || "?"}`);
  });
  return errors;
}
