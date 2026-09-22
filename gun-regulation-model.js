export const REGULATION_KINDS = ["constitutional", "scotus", "statute", "agency", "state"];
export const CHECKLIST_STATUSES = [
  "required",
  "not_required",
  "partial",
  "varies_by_state",
  "not_applicable",
  "unknown",
];

export function regulationToneClass(tone) {
  if (typeof tone !== "number") return "tone-reg-neutral";
  if (tone >= 2) return "tone-reg-tight-strong";
  if (tone >= 1) return "tone-reg-tight";
  if (tone <= -2) return "tone-reg-loose-strong";
  if (tone <= -1) return "tone-reg-loose";
  return "tone-reg-mixed";
}

export function regulationToneLabel(tone) {
  if (tone >= 2) return "Sharper federal tightening";
  if (tone >= 1) return "Modest tightening";
  if (tone <= -2) return "Major rights expansion";
  if (tone <= -1) return "Looser / rights expansion";
  return "Mixed or procedural";
}

export function checklistStatusLabel(status) {
  const map = {
    required: "Required",
    not_required: "Not required",
    partial: "Partial",
    varies_by_state: "Varies by state",
    not_applicable: "Not applicable",
    unknown: "Unknown",
  };
  return map[status] || status;
}

export function checklistStatusClass(status) {
  if (status === "required") return "check-required";
  if (status === "not_required") return "check-not-required";
  if (status === "partial") return "check-partial";
  if (status === "varies_by_state") return "check-varies";
  if (status === "not_applicable") return "check-na";
  return "check-unknown";
}

export function filterRegulationBeats(timeline, { kind = "", year = null } = {}) {
  return (timeline || []).filter((beat) => {
    if (kind && beat.kind !== kind) return false;
    if (Number.isFinite(year) && Number(beat.year) > year) return false;
    return true;
  });
}

function sortedKeyframes(keyframes) {
  return (keyframes || [])
    .slice()
    .sort((a, b) => Number(a.year) - Number(b.year) || String(a.effectiveDate || "").localeCompare(String(b.effectiveDate || "")));
}

export function resolveCriterionAtYear(keyframes, criterionId, year) {
  const y = Number(year);
  let latest = null;
  sortedKeyframes(keyframes).forEach((frame) => {
    if (Number(frame.year) > y) return;
    (frame.changes || []).forEach((change) => {
      if (change.criterion === criterionId) latest = change;
    });
  });
  return latest;
}

export function resolveChecklistAtYear(rows, federalKeyframes, stateRecord, year) {
  const y = Number(year);
  return (rows || []).map((row) => {
    const federal = resolveCriterionAtYear(federalKeyframes, row.id, y);
    let cell = federal;
    if (stateRecord?.checklistKeyframes?.length) {
      const stateChange = resolveCriterionAtYear(stateRecord.checklistKeyframes, row.id, y);
      if (stateChange) cell = stateChange;
    }
    return {
      row,
      cell: cell || {
        criterion: row.id,
        status: "unknown",
        plainEnglish: "Research pending for this year.",
      },
    };
  });
}

export function statsReadoutAtYear(statsSeries, year) {
  const y = Number(year);
  return (statsSeries || []).map((series) => {
    const from = series.coverage?.from;
    if (!Number.isFinite(from) || y < from) {
      return { series, value: null, missing: true };
    }
    if (series.measures?.length) {
      const measures = series.measures.map((measure) => {
        const point = (measure.points || [])
          .filter((p) => Number(p.year) <= y)
          .sort((a, b) => Number(b.year) - Number(a.year))[0];
        return { measure, point: point || null };
      });
      return { series, measures, missing: measures.every((m) => !m.point) };
    }
    const point = (series.points || [])
      .filter((p) => Number(p.year) <= y)
      .sort((a, b) => Number(b.year) - Number(a.year))[0];
    return { series, point: point || null, missing: !point };
  });
}

export function parseRegulationParams(urlLike, validStates) {
  const url = new URL(urlLike, "https://plotmaniac.com/");
  const kind = url.searchParams.get("kind") || "";
  const state = validStates?.has(url.searchParams.get("state"))
    ? url.searchParams.get("state")
    : "";
  return {
    kind: REGULATION_KINDS.includes(kind) ? kind : "",
    exemplarState: state,
  };
}

function isOfficialOpinionUrl(url) {
  return typeof url === "string"
    && /^https:\/\/www\.supremecourt\.gov\/opinions\/.+\.pdf/i.test(url);
}

function isOfficialStatuteUrl(url) {
  if (typeof url !== "string" || !url.startsWith("https://")) return false;
  return /(congress\.gov|govinfo\.gov|uscode\.house\.gov|ecfr\.gov|federalregister\.gov|law\.cornell\.edu\/uscode)/i.test(url);
}

export function validateGunBoard(board) {
  const errors = [];
  const rows = board?.checklistRows || [];
  if (rows.length !== 15) errors.push(`checklistRows expected 15, got ${rows.length}`);
  const rowIds = new Set(rows.map((row) => row.id));
  if (rowIds.size !== rows.length) errors.push("duplicate checklist row ids");

  (board?.timeline || []).forEach((beat) => {
    if (!beat.id || !beat.year || !beat.event || !beat.plainEnglish) {
      errors.push(`beat ${beat.id || beat.event} missing core fields`);
    }
    if (!REGULATION_KINDS.includes(beat.kind)) {
      errors.push(`beat ${beat.id} invalid kind ${beat.kind}`);
    }
    if (beat.kind === "scotus") {
      const links = beat.links || [];
      const official = links.find((link) => isOfficialOpinionUrl(link.url));
      if (!official) errors.push(`scotus beat ${beat.id} missing official opinion PDF`);
      if (!beat.plainEnglish.trim()) errors.push(`scotus beat ${beat.id} missing plainEnglish`);
    }
    if (beat.kind === "statute") {
      const links = beat.links || [];
      if (!links.some((link) => isOfficialStatuteUrl(link.url))) {
        errors.push(`statute beat ${beat.id} missing official statute link`);
      }
    }
    (beat.links || []).forEach((link) => {
      if (!link.url?.startsWith("https://")) errors.push(`beat ${beat.id} link not https`);
      if (/wikipedia\.org\/wiki\/[^#]+#/i.test(link.url)) {
        errors.push(`beat ${beat.id} uses Wikipedia section anchor as source`);
      }
    });
  });

  const exemplars = board?.states || {};
  ["ca", "ny", "tx"].forEach((id) => {
    if (!exemplars[id]) errors.push(`missing exemplar state ${id}`);
  });
  Object.values(exemplars).forEach((state) => {
    if (state.coverage !== "v1-exemplar") errors.push(`state ${state.id} coverage tag`);
  });

  (board?.stats || []).forEach((series) => {
    if (!series.coverage?.from) errors.push(`stats ${series.id} missing coverage.from`);
  });

  return errors;
}

export function activeRegulationBanners(banners, year) {
  const y = Number(year);
  return (banners || []).filter((banner) => y >= Number(banner.fromYear));
}
