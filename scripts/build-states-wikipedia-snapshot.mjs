#!/usr/bin/env node
/**
 * Parse Wikipedia "Gun laws in the United States by state" state tables into
 * Plotmaniac checklist-shaped snapshot JSON for map/filter work.
 *
 * Usage:
 *   node scripts/build-states-wikipedia-snapshot.mjs
 *   node scripts/build-states-wikipedia-snapshot.mjs --input /path/to/wiki.txt
 *
 * Default: fetch HTML via MediaWiki API, strip to text-like markdown from WebFetch,
 * or use bundled cache under scripts/.cache/ when --input omitted and fetch fails.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "data/gun-laws-by-state/states-snapshot.json");
const DOC_OUT = path.join(ROOT, "docs/gun-laws-by-state-table.md");
const CACHE = path.join(__dirname, ".cache/gun-laws-wikipedia.txt");
const WIKI_PAGE = "Gun_laws_in_the_United_States_by_state";
const WIKI_URL = `https://en.wikipedia.org/wiki/${WIKI_PAGE}`;

/** @type {Record<string, { postal: string, name: string }>} */
const STATE_BY_NAME = {
  Alabama: { postal: "AL", id: "al" },
  Alaska: { postal: "AK", id: "ak" },
  Arizona: { postal: "AZ", id: "az" },
  Arkansas: { postal: "AR", id: "ar" },
  California: { postal: "CA", id: "ca" },
  Colorado: { postal: "CO", id: "co" },
  Connecticut: { postal: "CT", id: "ct" },
  Delaware: { postal: "DE", id: "de" },
  "District of Columbia": { postal: "DC", id: "dc" },
  Florida: { postal: "FL", id: "fl" },
  Georgia: { postal: "GA", id: "ga" },
  Hawaii: { postal: "HI", id: "hi" },
  Idaho: { postal: "ID", id: "id" },
  Illinois: { postal: "IL", id: "il" },
  Indiana: { postal: "IN", id: "in" },
  Iowa: { postal: "IA", id: "ia" },
  Kansas: { postal: "KS", id: "ks" },
  Kentucky: { postal: "KY", id: "ky" },
  Louisiana: { postal: "LA", id: "la" },
  Maine: { postal: "ME", id: "me" },
  Maryland: { postal: "MD", id: "md" },
  Massachusetts: { postal: "MA", id: "ma" },
  Michigan: { postal: "MI", id: "mi" },
  Minnesota: { postal: "MN", id: "mn" },
  Mississippi: { postal: "MS", id: "ms" },
  Missouri: { postal: "MO", id: "mo" },
  Montana: { postal: "MT", id: "mt" },
  Nebraska: { postal: "NE", id: "ne" },
  Nevada: { postal: "NV", id: "nv" },
  "New Hampshire": { postal: "NH", id: "nh" },
  "New Jersey": { postal: "NJ", id: "nj" },
  "New Mexico": { postal: "NM", id: "nm" },
  "New York": { postal: "NY", id: "ny" },
  "North Carolina": { postal: "NC", id: "nc" },
  "North Dakota": { postal: "ND", id: "nd" },
  Ohio: { postal: "OH", id: "oh" },
  Oklahoma: { postal: "OK", id: "ok" },
  Oregon: { postal: "OR", id: "or" },
  Pennsylvania: { postal: "PA", id: "pa" },
  "Rhode Island": { postal: "RI", id: "ri" },
  "South Carolina": { postal: "SC", id: "sc" },
  "South Dakota": { postal: "SD", id: "sd" },
  Tennessee: { postal: "TN", id: "tn" },
  Texas: { postal: "TX", id: "tx" },
  Utah: { postal: "UT", id: "ut" },
  Vermont: { postal: "VT", id: "vt" },
  Virginia: { postal: "VA", id: "va" },
  Washington: { postal: "WA", id: "wa" },
  "West Virginia": { postal: "WV", id: "wv" },
  Wisconsin: { postal: "WI", id: "wi" },
  Wyoming: { postal: "WY", id: "wy" },
};

/** Wikipedia row label → Plotmaniac checklist row id (when mappable). */
const SUBJECT_TO_CRITERION = {
  "State permit required to purchase?": "purchase-permit",
  "Firearm registration?": "handgun-registration",
  "Assault weapon law?": "assault-weapons-restriction",
  "Magazine capacity restriction?": "magazine-capacity-limit",
  "Permit required for concealed carry?": "carry-permit",
  "Background checks required for private sales?": "private-sale-check",
  "Waiting period?": "waiting-period",
  "NFA weapons restricted?": "nfa-item-registration",
  "Home-built firearms restriction?": "ghost-gun-rules",
};

/**
 * Alternate Wikipedia headings. `invert` rows ask whether something is allowed;
 * Yes means the restriction is not required.
 */
const SUBJECT_ALIASES = [
  { pattern: /^(state )?permit required to purchase\?$|^owner permit required\?$/i, id: "purchase-permit", bucket: "checklist" },
  { pattern: /^firearm registration\?$/i, id: "handgun-registration", bucket: "checklist" },
  { pattern: /assault/i, id: "assault-weapons-restriction", bucket: "checklist" },
  { pattern: /magazine/i, id: "magazine-capacity-limit", bucket: "checklist" },
  { pattern: /^background checks required for private sales\?$/i, id: "private-sale-check", bucket: "checklist" },
  { pattern: /waiting period/i, id: "waiting-period", bucket: "checklist" },
  { pattern: /^nfa weapons restricted\?$/i, id: "nfa-item-registration", bucket: "checklist" },
  { pattern: /home-built|ghost/i, id: "ghost-gun-rules", bucket: "checklist" },
  { pattern: /(permit|license) required for concealed carry\?$/i, id: "carry-permit", bucket: "checklist" },
  { pattern: /^concealed carry allowed\?$/i, id: "carry-permit", bucket: "checklist", invert: true },
  { pattern: /(permit|license) required for open carry\?$/i, id: "open-carry-permit", bucket: "extra" },
  { pattern: /^open carry allowed\?$/i, id: "open-carry-permit", bucket: "extra", invert: true },
];

/** Extra wiki rows useful for map filters but not in the 15-row checklist. */
const SUBJECT_TO_EXTRA = {
  "Permit required for open carry?": "open-carry-permit",
  "Owner license required?": "owner-license",
  "Red flag law?": "red-flag-law",
  "Castle Doctrine/Stand Your Ground law?": "stand-your-ground",
  "Castle Doctrine / Stand your ground law?": "stand-your-ground",
  "Castle Doctrine law?": "stand-your-ground",
  "State preemption of local restrictions?": "state-preemption",
};

function matchSubject(subject) {
  const directCriterion = SUBJECT_TO_CRITERION[subject];
  const directExtra = SUBJECT_TO_EXTRA[subject];
  if (directCriterion) return { id: directCriterion, bucket: "checklist", invert: false, rank: 2 };
  if (directExtra) return { id: directExtra, bucket: "extra", invert: false, rank: 2 };
  const alias = SUBJECT_ALIASES.find((row) => row.pattern.test(subject));
  if (!alias) return null;
  return { id: alias.id, bucket: alias.bucket, invert: Boolean(alias.invert), rank: alias.invert ? 1 : 2 };
}

function invertStatus(status) {
  if (status === "required") return "not_required";
  if (status === "not_required") return "required";
  return status;
}

function invertedCell(cell) {
  const status = invertStatus(wikiCellToStatus(cell));
  if (status === "required") return "Yes";
  if (status === "not_required") return "No";
  if (status === "partial") return "Partial";
  if (status === "not_applicable") return "N/A";
  return cell;
}

function normalizeSubject(label) {
  return label.replace(/\s+/g, " ").trim();
}

function wikiCellToStatus(cell) {
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

/** Combine long-gun and handgun wiki cells into one checklist status. */
function combineCells(longGun, handgun, { preferHandgun = false } = {}) {
  const lg = wikiCellToStatus(longGun);
  const hg = wikiCellToStatus(handgun);
  if (preferHandgun && hg !== "not_applicable" && hg !== "unknown") return hg;
  const rank = { required: 3, partial: 2, unknown: 1, not_applicable: 0, not_required: 0 };
  if (rank[lg] > rank[hg]) return lg;
  if (rank[hg] > rank[lg]) return hg;
  if (lg === hg) return lg;
  if (lg === "partial" || hg === "partial") return "partial";
  if (lg === "required" || hg === "required") return "required";
  return hg !== "unknown" ? hg : lg;
}

function parseTableRow(line) {
  if (!line.startsWith("|") || line.startsWith("| ---")) return null;
  const parts = line
    .split("|")
    .slice(1, -1)
    .map((p) => p.trim());
  if (parts.length < 3) return null;
  const subject = normalizeSubject(parts[0]);
  const longGun = parts[1];
  const handgun = parts[2];
  const statutes = parts[3] || "";
  const notes = parts[4] || "";
  return { subject, longGun, handgun, statutes, notes };
}

function parseStatesFromText(text) {
  const lines = text.split("\n");
  /** @type {Record<string, { rows: ReturnType<typeof parseTableRow>[] }>} */
  const byName = {};
  let current = null;

  for (const line of lines) {
    const heading = line.match(/^## (.+)$/);
    if (heading) {
      const name = heading[1].trim();
      if (STATE_BY_NAME[name]) current = name;
      else if (name === "References") current = null;
      continue;
    }
    if (!current) continue;
    const row = parseTableRow(line);
    if (row) {
      if (!byName[current]) byName[current] = { rows: [] };
      byName[current].rows.push(row);
    }
  }
  return byName;
}

function buildStateRecord(name, { rows }) {
  const meta = STATE_BY_NAME[name];
  /** @type {Record<string, unknown>} */
  const wikiSubjects = {};
  /** @type {Record<string, { status: string, plainEnglish: string, wiki: object }>} */
  const checklist = {};
  /** @type {Record<string, { status: string, plainEnglish: string }>} */
  const extras = {};

  for (const row of rows) {
    wikiSubjects[row.subject] = {
      longGun: row.longGun,
      handgun: row.handgun,
      statutes: row.statutes,
      notes: row.notes,
    };
    const match = matchSubject(row.subject);
    const preferHandgun =
      match?.id === "carry-permit"
      || match?.id === "open-carry-permit"
      || match?.id === "handgun-registration";
    let status = combineCells(row.longGun, row.handgun, { preferHandgun });
    let longGun = row.longGun;
    let handgun = row.handgun;
    if (match?.invert) {
      status = invertStatus(status);
      longGun = invertedCell(row.longGun);
      handgun = invertedCell(row.handgun);
    }
    const plainEnglish = [row.notes, row.statutes].filter(Boolean).join(" ").slice(0, 500);
    const cell = {
      status,
      plainEnglish: plainEnglish || `${row.subject} — long guns: ${row.longGun}; handguns: ${row.handgun}.`,
      wiki: { longGun, handgun },
      sourceSubject: row.subject,
    };
    const target = match?.bucket === "checklist" ? checklist : match?.bucket === "extra" ? extras : null;
    if (target && (!target[match.id] || (target[match.id].rank || 0) < match.rank)) {
      target[match.id] = { ...cell, rank: match.rank };
    }
  }

  return {
    id: meta.id,
    postal: meta.postal,
    name,
    coverage: "wikipedia-seed",
    checklist: stripRank(checklist),
    extras: stripRank(extras),
    wikiSubjects,
  };
}

function stripRank(map) {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => {
    const { rank, ...rest } = value;
    return [key, rest];
  }));
}

async function loadWikiText(inputPath) {
  if (inputPath) {
    return fs.readFileSync(inputPath, "utf8");
  }
  try {
    const api = new URL("https://en.wikipedia.org/w/api.php");
    api.searchParams.set("action", "query");
    api.searchParams.set("prop", "extracts");
    api.searchParams.set("explaintext", "1");
    api.searchParams.set("titles", WIKI_PAGE.replace(/_/g, " "));
    api.searchParams.set("format", "json");
    const res = await fetch(api, { headers: { "User-Agent": "PlotmaniacBot/1.0 (gun-law snapshot build)" } });
    const json = await res.json();
    const pages = json.query?.pages || {};
    const page = Object.values(pages)[0];
    const extract = page?.extract;
    if (typeof extract === "string" && extract.length > 10000) {
      fs.mkdirSync(path.dirname(CACHE), { recursive: true });
      fs.writeFileSync(CACHE, extract);
      return extract;
    }
  } catch {
    /* fall through */
  }
  if (fs.existsSync(CACHE)) return fs.readFileSync(CACHE, "utf8");
  throw new Error(
    "Could not fetch Wikipedia extract. Pass --input with a WebFetch/markdown dump of the wiki page.",
  );
}

/** Plain-text Wikipedia extracts use different formatting; convert rough sections to markdown tables if needed. */
function textToParseable(raw, fromMarkdownTables) {
  if (fromMarkdownTables) return raw;
  return raw;
}

function main() {
  const args = process.argv.slice(2);
  let inputPath = "";
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--input" && args[i + 1]) {
      inputPath = path.resolve(args[i + 1]);
      i += 1;
    }
  }

  const run = async () => {
    const raw = await loadWikiText(inputPath);
    const fromMarkdown = Boolean(inputPath) || raw.includes("| Subject / law |");
    const text = textToParseable(raw, fromMarkdown);
    const parsed = parseStatesFromText(text);
    const missing = Object.keys(STATE_BY_NAME).filter((n) => !parsed[n]?.rows?.length);
    if (missing.length) {
      console.warn("States with no parsed table rows:", missing.join(", "));
    }

    const states = Object.keys(STATE_BY_NAME)
      .filter((n) => parsed[n]?.rows?.length)
      .sort((a, b) => STATE_BY_NAME[a].postal.localeCompare(STATE_BY_NAME[b].postal))
      .map((n) => buildStateRecord(n, parsed[n]));

    const payload = {
      schema: "plotmaniac-gun-state-wikipedia-snapshot",
      schemaVersion: 1,
      disclaimer:
        "Seed data parsed from Wikipedia state tables. Not legal advice. Verify against official state code before publishing as fact on Plotmaniac.",
      source: {
        title: "Gun laws in the United States by state",
        url: WIKI_URL,
        retrieved: new Date().toISOString().slice(0, 10),
        parser: "scripts/build-states-wikipedia-snapshot.mjs",
      },
      subjectToCriterion: SUBJECT_TO_CRITERION,
      subjectToExtra: SUBJECT_TO_EXTRA,
      federalBaselineNote:
        "Federal dealer checks, minimum ages (18/21 from FFLs), felony/DV/mental prohibitions, and NFA tax/registration apply nationwide but are not repeated in Wikipedia per-state tables. Map filters should layer federal checklist rows from data/gun-regulation/checklist.json at the selected year.",
      checklistRowIds: [
        "min-age-long-gun",
        "min-age-handgun",
        "dealer-background-check",
        "private-sale-check",
        "waiting-period",
        "purchase-permit",
        "carry-permit",
        "felony-prohibition",
        "dv-prohibition",
        "mental-health-prohibition",
        "handgun-registration",
        "assault-weapons-restriction",
        "magazine-capacity-limit",
        "nfa-item-registration",
        "ghost-gun-rules",
      ],
      states,
    };

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
    fs.mkdirSync(path.dirname(DOC_OUT), { recursive: true });
    fs.writeFileSync(DOC_OUT, renderMarkdownTable(payload));
    console.log(`Wrote ${states.length} states → ${OUT}`);
    console.log(`Wrote summary table → ${DOC_OUT}`);
    if (missing.length) process.exitCode = 1;
  };

  run().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

function renderMarkdownTable(payload) {
  const columns = [
    ["purchase-permit", "Purchase permit"],
    ["private-sale-check", "Private check"],
    ["waiting-period", "Waiting period"],
    ["carry-permit", "Carry license"],
    ["assault-weapons-restriction", "AW ban"],
    ["magazine-capacity-limit", "Mag limit"],
    ["handgun-registration", "Registration"],
  ];
  const label = (status) => {
    const map = { not_required: "No", required: "Yes", partial: "Partial", not_applicable: "N/A", unknown: "?" };
    return map[status] || status;
  };
  const lines = [
    "# Gun laws by state — Wikipedia seed table",
    "",
    "Auto-generated by `scripts/build-states-wikipedia-snapshot.mjs`. **Not legal advice.**",
    "",
    `Source: [${payload.source.title}](${payload.source.url}) · retrieved ${payload.source.retrieved}`,
    "",
    "This plot is **`gun-laws-by-state`** (separate from the SCOTUS gun-regulation timeline board).",
    "",
    "| State | " + columns.map(([, h]) => h).join(" | ") + " |",
    "| --- | " + columns.map(() => "---").join(" | ") + " |",
  ];
  (payload.states || []).forEach((state) => {
    const cells = columns.map(([id]) => label(state.checklist?.[id]?.status || "unknown"));
    lines.push(`| ${state.postal} ${state.name} | ${cells.join(" | ")} |`);
  });
  lines.push("", "## Wikipedia row → filter criterion", "");
  Object.entries(payload.subjectToCriterion || {}).forEach(([wiki, id]) => {
    lines.push(`- **${wiki}** → \`${id}\``);
  });
  lines.push("");
  return `${lines.join("\n")}\n`;
}

main();
