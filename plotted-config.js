/** Display name and copy live here so a rename is one edit. */
export const GAME_NAME = "Plotted";

export const GAME_TAGLINE = "A daily logic grid. Same puzzle for everyone.";

export const SITE_URL = "https://plotmaniac.com";

/** First published puzzle date (local calendar, YYYY-MM-DD). Puzzle #1. */
export const LAUNCH_DATE = "2026-10-13";

export const THEME_STORAGE_KEY = "plotted-theme";
export const STREAK_STORAGE_KEY = "plotted-streak";
export const NOTES_STORAGE_KEY = "plotted-notes";
export const PROGRESS_STORAGE_KEY = "plotted-progress";
export const PRACTICE_PROGRESS_KEY = "plotted-practice";
export const PRACTICE_NOTES_KEY = "plotted-practice-notes";

export const PRACTICE_GROUPS = [
  { id: "easy", label: "Easy" },
  { id: "easy-medium", label: "Easy–medium" },
  { id: "medium", label: "Medium" },
  { id: "medium-hard", label: "Medium–hard" },
  { id: "hard", label: "Hard" },
  { id: "expert", label: "Expert" },
];

export const PRACTICE_PUZZLES = [
  { id: "easy", title: "Pets and drinks", group: "easy" },
  { id: "quiet-chapter", title: "Quiet chapter", group: "easy" },
  { id: "late-watering", title: "Late watering", group: "easy" },
  { id: "short-stack", title: "Short stack", group: "easy" },
  { id: "easy-medium", title: "Garden row", group: "easy-medium" },
  { id: "medium", title: "Music night", group: "medium" },
  { id: "whos-pouring", title: "Who's pouring", group: "medium" },
  { id: "ribbon-aisle", title: "Ribbon aisle", group: "medium" },
  { id: "walk-away", title: "Walk away", group: "medium" },
  { id: "medium-hard", title: "Brunch table", group: "medium-hard" },
  { id: "parked-pets", title: "Parked pets", group: "medium-hard" },
  { id: "last-lantern", title: "Last lantern", group: "medium-hard" },
  { id: "night-set", title: "Night set", group: "medium-hard" },
  { id: "hard", title: "The block", group: "hard" },
  { id: "five-copies", title: "Five copies", group: "hard" },
  { id: "parcel-row", title: "Parcel row", group: "hard" },
  { id: "four-plates", title: "Four plates", group: "hard" },
  { id: "long-street", title: "The long street", group: "expert" },
  { id: "five-trades", title: "Five trades", group: "expert" },
  { id: "five-cities", title: "Five cities", group: "expert" },
  { id: "hobby-houses", title: "Hobby houses", group: "expert" },
  { id: "five-plates", title: "Five plates", group: "expert" },
];

export function practiceGroupLabel(groupId) {
  return PRACTICE_GROUPS.find((group) => group.id === groupId)?.label || groupId;
}

export const ARCHIVE_HREF = "./archive/";

export const KEYCAP_DIGITS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
export const HOUSE_EMOJI = "🏠";
