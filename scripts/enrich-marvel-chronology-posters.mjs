#!/usr/bin/env node
/**
 * Fetches TMDB poster paths and writes posterPath + posterUrl into chronology.json.
 *
 * Requires TMDB_API_KEY in the environment (never commit the key).
 * Idempotent: skips titles that already have posterPath unless --force.
 *
 * Usage:
 *   TMDB_API_KEY=... node scripts/enrich-marvel-chronology-posters.mjs
 *   TMDB_API_KEY=... node scripts/enrich-marvel-chronology-posters.mjs --force
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TMDB_CHRONOLOGY_HINTS,
  defaultTmdbQuery,
  guessTmdbType,
} from "./marvel-chronology-tmdb-queries.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const chronologyPath = path.join(root, "data/marvel-universe/chronology.json");
const force = process.argv.includes("--force");
const apiKey = process.env.TMDB_API_KEY?.trim();

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w342";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function posterUrlFromPath(posterPath) {
  if (!posterPath) return "";
  return `${TMDB_IMAGE_BASE}${posterPath.startsWith("/") ? posterPath : `/${posterPath}`}`;
}

async function tmdbFetch(endpoint, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  url.searchParams.set("api_key", apiKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TMDB ${response.status} for ${endpoint}`);
  }
  return response.json();
}

async function detailsFor(type, id) {
  return tmdbFetch(`/${type}/${id}`);
}

async function search(type, query, year) {
  const params = { query, include_adult: "false" };
  if (year && type === "movie") params.year = year;
  if (year && type === "tv") params.first_air_date_year = year;
  const data = await tmdbFetch(`/search/${type}`, params);
  return data.results || [];
}

function pickResult(results, { year, type }) {
  if (!results?.length) return null;
  if (year) {
    const match = results.find((row) => {
      const y = type === "movie"
        ? row.release_date?.slice(0, 4)
        : row.first_air_date?.slice(0, 4);
      return y === String(year);
    });
    if (match?.poster_path) return match;
  }
  return results.find((row) => row.poster_path) || results[0];
}

async function resolvePoster(entry) {
  const hint = TMDB_CHRONOLOGY_HINTS[entry.id] || {};
  const type = hint.type || guessTmdbType(entry.title);
  const query = hint.query || defaultTmdbQuery(entry.title);
  const year = hint.year;

  if (hint.tmdbId) {
    const detail = await detailsFor(type, hint.tmdbId);
    return detail.poster_path || "";
  }

  let results = await search(type, query, year);
  let picked = pickResult(results, { year, type });
  if (!picked?.poster_path && type === "movie") {
    results = await search("tv", query, year);
    picked = pickResult(results, { year, type: "tv" });
  } else if (!picked?.poster_path && type === "tv") {
    results = await search("movie", query, year);
    picked = pickResult(results, { year, type: "movie" });
  }
  return picked?.poster_path || "";
}

async function main() {
  if (!apiKey) {
    console.log("TMDB_API_KEY not set — skipping poster enrich (chronology unchanged).");
    process.exit(0);
  }

  const chronology = JSON.parse(fs.readFileSync(chronologyPath, "utf8"));
  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const entry of chronology.titles) {
    if (entry.posterPath && !force) {
      skipped += 1;
      continue;
    }
    await sleep(260);
    try {
      const posterPath = await resolvePoster(entry);
      if (!posterPath) {
        missing += 1;
        if (force) {
          delete entry.posterPath;
          delete entry.posterUrl;
        }
        console.warn(`no poster: ${entry.id}`);
        continue;
      }
      entry.posterPath = posterPath;
      entry.posterUrl = posterUrlFromPath(posterPath);
      updated += 1;
    } catch (error) {
      missing += 1;
      console.warn(`failed: ${entry.id} (${error.message})`);
    }
  }

  fs.writeFileSync(chronologyPath, `${JSON.stringify(chronology, null, 2)}\n`);
  console.log(`Posters updated: ${updated}, skipped: ${skipped}, missing/failed: ${missing}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
