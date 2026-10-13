/** Themes are built only from Phosphor duotone icons in plotted-icons.js. */

function onFoot(label) {
  return label === "on foot";
}

function an(label) {
  const word = String(label || "").trim();
  if (!word || onFoot(word)) return word;
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

/** Einstein says “keeps dogs”; singular labels keep an article except fish. */
function keepPet(label) {
  const word = String(label || "").trim();
  if (!word) return word;
  if (word.toLowerCase() === "fish") return word;
  if (/s$/i.test(word) && !/(ss|us|is)$/i.test(word)) return word;
  return an(word);
}

function petOccupant(label) {
  const word = String(label || "").trim();
  if (!word) return word;
  if (word.toLowerCase() === "fish" || (/s$/i.test(word) && !/(ss|us|is)$/i.test(word))) {
    return `the owner of the ${word}`;
  }
  return `the ${word} owner`;
}

function vehicleVerb(label) {
  if (onFoot(label)) return "is on foot";
  if (label === "bicycle") return "rides a bicycle";
  if (label === "motorcycle") return "rides a motorcycle";
  if (label === "plane") return "flies a plane";
  if (label === "sailboat") return "sails a sailboat";
  return `drives ${an(label)}`;
}

function vehicleNoun(label) {
  if (onFoot(label)) return "the person on foot";
  return `the person who ${vehicleVerb(label)}`;
}

const MASS_DRINKS = new Set(["tea", "coffee", "wine", "beer", "brandy", "orange juice", "water", "milk", "cocoa"]);

function drinkObject(label) {
  const word = String(label || "").trim();
  if (!word) return word;
  if (MASS_DRINKS.has(word.toLowerCase())) return word;
  if (/s$/i.test(word) && !/(ss|us|is)$/i.test(word)) return word;
  return an(word);
}

const LOVED_FOODS = new Set(["cake", "ice cream", "cookie"]);

function foodPhrase(label) {
  const word = String(label || "").trim();
  if (LOVED_FOODS.has(word.toLowerCase())) return `loves ${word}`;
  return `eats ${word}`;
}

const MASS_PLANTS = new Set(["basil"]);

function growPlant(label) {
  const word = String(label || "").trim();
  if (!word) return word;
  if (MASS_PLANTS.has(word.toLowerCase())) return word;
  if (/s$/i.test(word) && !/(ss|us|is)$/i.test(word)) return word;
  return an(word);
}

function readBook(label) {
  const word = String(label || "").trim();
  if (!word) return word;
  if (/s$/i.test(word) && !/(ss|us|is)$/i.test(word)) return word;
  if (/^(poetry|history|sci-fi)$/i.test(word)) return word;
  return an(word);
}

const INSTRUMENT_TITLES = {
  piano: "pianist",
  guitar: "guitarist",
  drums: "drummer",
  violin: "violinist",
  flute: "flutist",
  cello: "cellist",
};

function instrumentOccupant(label) {
  const title = INSTRUMENT_TITLES[label];
  return title ? `the ${title}` : `the ${label} player`;
}

const PLAYED_HOBBIES = new Set(["guitar"]);

/**
 * Einstein-style noun + verb for every category.
 * occupant = person-first noun (“the owner of the dogs”, “the pianist”).
 * personSame = verb (“Ada keeps dogs”, “Ada plays the piano”).
 * neighbor = how they appear after “lives next to”.
 * verb = curated verb; never a generic “has the”.
 */
export const ATTRIBUTES = {
  person: {
    id: "person",
    label: "Who",
    icon: "user",
    verb: null,
    occupant: (x) => x,
    personSame: (person) => person,
    neighbor: (x) => x,
  },
  pet: {
    id: "pet",
    label: "Pet",
    icon: "paw-print",
    verb: "keeps",
    occupant: petOccupant,
    personSame: (person, x) => `${person} keeps ${keepPet(x)}`,
    neighbor: (x) => `the one who keeps ${keepPet(x)}`,
  },
  drink: {
    id: "drink",
    label: "Drink",
    icon: "coffee",
    verb: "drinks",
    occupant: (x) => `the ${x} drinker`,
    personSame: (person, x) => `${person} drinks ${drinkObject(x)}`,
    neighbor: (x) => `the one who drinks ${drinkObject(x)}`,
  },
  loot: {
    id: "loot",
    label: "Loot",
    icon: "diamond",
    verb: "keeps",
    occupant: (x) => `the person who keeps ${an(x)}`,
    personSame: (person, x) => `${person} keeps ${an(x)}`,
    neighbor: (x) => `the one who keeps ${an(x)}`,
  },
  getaway: {
    id: "getaway",
    label: "Getaway",
    icon: "car",
    verb: "drives",
    occupant: vehicleNoun,
    personSame: (person, x) => `${person} ${vehicleVerb(x)}`,
    neighbor: (x) => (onFoot(x) ? "the one on foot" : `the one who ${vehicleVerb(x)}`),
  },
  prize: {
    id: "prize",
    label: "Prize",
    icon: "trophy",
    verb: "keeps",
    occupant: (x) => `the person who keeps ${an(x)}`,
    personSame: (person, x) => `${person} keeps ${an(x)}`,
    neighbor: (x) => `the one who keeps ${an(x)}`,
  },
  plant: {
    id: "plant",
    label: "Plant",
    icon: "flower",
    verb: "grows",
    occupant: (x) => `the person who grows ${growPlant(x)}`,
    personSame: (person, x) => `${person} grows ${growPlant(x)}`,
    neighbor: (x) => `the one who grows ${growPlant(x)}`,
  },
  vehicle: {
    id: "vehicle",
    label: "Ride",
    icon: "bicycle",
    verb: "drives",
    occupant: vehicleNoun,
    personSame: (person, x) => `${person} ${vehicleVerb(x)}`,
    neighbor: (x) => (onFoot(x) ? "the one on foot" : `the one who ${vehicleVerb(x)}`),
  },
  instrument: {
    id: "instrument",
    label: "Music",
    icon: "music-note",
    verb: "plays",
    occupant: instrumentOccupant,
    personSame: (person, x) => `${person} plays the ${x}`,
    neighbor: instrumentOccupant,
  },
  book: {
    id: "book",
    label: "Book",
    icon: "book",
    verb: "reads",
    occupant: (x) => `the person who reads ${readBook(x)}`,
    personSame: (person, x) => `${person} reads ${readBook(x)}`,
    neighbor: (x) => `the one who reads ${readBook(x)}`,
  },
  treat: {
    id: "treat",
    label: "Treat",
    icon: "cookie",
    verb: "loves",
    occupant: (x) => `the ${x} lover`,
    personSame: (person, x) => `${person} loves ${x}`,
    neighbor: (x) => `the ${x} lover`,
  },
  gift: {
    id: "gift",
    label: "Gift",
    icon: "gift",
    verb: "keeps",
    occupant: (x) => `the person who keeps ${an(x)}`,
    personSame: (person, x) => `${person} keeps ${an(x)}`,
    neighbor: (x) => `the one who keeps ${an(x)}`,
  },
  food: {
    id: "food",
    label: "Plate",
    icon: "fork-knife",
    verb: "eats",
    occupant: (x) => `the ${x} lover`,
    personSame: (person, x) => `${person} ${foodPhrase(x)}`,
    neighbor: (x) => `the ${x} lover`,
  },
  color: {
    id: "color",
    label: "Color",
    icon: "paint-brush",
    verb: "lives in",
    occupant: (x) => `the owner of the ${x} house`,
    personSame: (person, x) => `${person} lives in the ${x} house`,
    neighbor: (x) => `the ${x} house`,
  },
  nationality: {
    id: "nationality",
    label: "Who",
    icon: "identification-badge",
    verb: null,
    occupant: (x) => `the ${x}`,
    personSame: (person) => person,
    neighbor: (x) => `the ${x}`,
  },
  beverage: {
    id: "beverage",
    label: "Drink",
    icon: "coffee",
    verb: "drinks",
    occupant: (x) => `the ${x} drinker`,
    personSame: (person, x) => `${person} drinks ${x}`,
    neighbor: (x) => `the one who drinks ${x}`,
  },
  cigar: {
    id: "cigar",
    label: "Cigar",
    icon: "leaf",
    verb: "smokes",
    occupant: (x) => `the person who smokes ${x}`,
    personSame: (person, x) => `${person} smokes ${x}`,
    neighbor: (x) => `the one who smokes ${x}`,
  },
  job: {
    id: "job",
    label: "Job",
    icon: "briefcase",
    verb: "is a",
    occupant: (x) => `the ${x}`,
    personSame: (person, x) => `${person} is a ${x}`,
    neighbor: (x) => `the ${x}`,
  },
  hobby: {
    id: "hobby",
    label: "Hobby",
    icon: "lightbulb",
    verb: "likes",
    occupant: (x) => (PLAYED_HOBBIES.has(x) ? `the ${x} player` : `the person who likes ${x}`),
    personSame: (person, x) => (PLAYED_HOBBIES.has(x) ? `${person} plays ${x}` : `${person} likes ${x}`),
    neighbor: (x) => (PLAYED_HOBBIES.has(x) ? `the one who plays ${x}` : `the one who likes ${x}`),
  },
  city: {
    id: "city",
    label: "City",
    icon: "house",
    verb: "is from",
    occupant: (x) => `the person from ${x}`,
    personSame: (person, x) => `${person} is from ${x}`,
    neighbor: (x) => `the one from ${x}`,
  },
};

const PEOPLE = [
  { id: "ada", label: "Ada", icon: "detective" },
  { id: "bo", label: "Bo", icon: "chef-hat" },
  { id: "cam", label: "Cam", icon: "student" },
  { id: "drew", label: "Drew", icon: "paint-brush" },
  { id: "eden", label: "Eden", icon: "graduation-cap" },
  { id: "fay", label: "Fay", icon: "sunglasses" },
  { id: "gus", label: "Gus", icon: "briefcase" },
  { id: "hana", label: "Hana", icon: "user-circle" },
  { id: "io", label: "Io", icon: "user-focus" },
  { id: "jules", label: "Jules", icon: "identification-badge" },
];

const PETS = [
  { id: "cat", label: "cats", icon: "cat" },
  { id: "dog", label: "dogs", icon: "dog" },
  { id: "bird", label: "birds", icon: "bird" },
  { id: "fish", label: "fish", icon: "fish" },
  { id: "rabbit", label: "rabbits", icon: "rabbit" },
  { id: "horse", label: "horses", icon: "horse" },
];

const DRINKS = [
  { id: "tea", label: "tea", icon: "tea-bag" },
  { id: "coffee", label: "coffee", icon: "coffee" },
  { id: "wine", label: "wine", icon: "wine" },
  { id: "beer", label: "beer", icon: "beer-stein" },
  { id: "martini", label: "martini", icon: "martini" },
  { id: "brandy", label: "brandy", icon: "brandy" },
  { id: "orange", label: "orange juice", icon: "orange" },
];

const COLORS = [
  { id: "red", label: "red", icon: "paint-brush" },
  { id: "green", label: "green", icon: "leaf" },
  { id: "yellow", label: "yellow", icon: "sun" },
  { id: "blue", label: "blue", icon: "house-simple" },
  { id: "white", label: "white", icon: "house" },
  { id: "pink", label: "pink", icon: "flower" },
];

const JOBS = [
  { id: "chef", label: "chef", icon: "chef-hat" },
  { id: "detective", label: "detective", icon: "detective" },
  { id: "student", label: "student", icon: "student" },
  { id: "painter", label: "painter", icon: "paint-brush" },
  { id: "clerk", label: "clerk", icon: "briefcase" },
  { id: "scout", label: "scout", icon: "magnifying-glass" },
];

const HOBBIES = [
  { id: "guitar", label: "guitar", icon: "guitar" },
  { id: "cycling", label: "cycling", icon: "bicycle" },
  { id: "painting", label: "painting", icon: "paint-brush" },
  { id: "reading", label: "reading", icon: "book" },
  { id: "camping", label: "camping", icon: "tent" },
  { id: "baking", label: "baking", icon: "cookie" },
];

const CITIES = [
  { id: "paris", label: "Paris", icon: "house" },
  { id: "rome", label: "Rome", icon: "house-simple" },
  { id: "cairo", label: "Cairo", icon: "tent" },
  { id: "tokyo", label: "Tokyo", icon: "sun" },
  { id: "oslo", label: "Oslo", icon: "moon" },
  { id: "lima", label: "Lima", icon: "flower" },
];

const VEHICLES = [
  { id: "car", label: "car", icon: "car" },
  { id: "taxi", label: "taxi", icon: "car" },
  { id: "bus", label: "bus", icon: "car" },
  { id: "van", label: "van", icon: "car" },
  { id: "bike", label: "bicycle", icon: "bicycle" },
  { id: "moto", label: "motorcycle", icon: "motorcycle" },
];

const INSTRUMENTS = [
  { id: "guitar", label: "guitar", icon: "guitar" },
  { id: "piano", label: "piano", icon: "music-note" },
  { id: "drums", label: "drums", icon: "music-notes" },
  { id: "violin", label: "violin", icon: "guitar" },
  { id: "flute", label: "flute", icon: "music-note" },
  { id: "cello", label: "cello", icon: "music-notes" },
];

const FOODS = [
  { id: "pizza", label: "pizza", icon: "pizza" },
  { id: "tacos", label: "tacos", icon: "hamburger" },
  { id: "sushi", label: "sushi", icon: "bowl-food" },
  { id: "pasta", label: "pasta", icon: "fork-knife" },
  { id: "salad", label: "salad", icon: "leaf" },
  { id: "cake", label: "cake", icon: "cake" },
];

const PLANTS = [
  { id: "roses", label: "roses", icon: "flower" },
  { id: "tulips", label: "tulips", icon: "flower-tulip" },
  { id: "cactus", label: "cactus", icon: "cactus" },
  { id: "fern", label: "fern", icon: "leaf" },
  { id: "basil", label: "basil", icon: "potted-plant" },
  { id: "trees", label: "trees", icon: "tree" },
];

const BOOKS = [
  { id: "mystery", label: "mysteries", icon: "magnifying-glass" },
  { id: "comics", label: "comics", icon: "book-open" },
  { id: "poetry", label: "poetry", icon: "note-pencil" },
  { id: "history", label: "history", icon: "book" },
  { id: "novels", label: "novels", icon: "book" },
  { id: "travel", label: "travelogues", icon: "tent" },
];

export const THEMES = [
  {
    id: "dinner-party",
    title: "Dinner party",
    blurb: "Three neighbors cooked, poured, and brought a guest. Match the table.",
    story: "A small dinner. Someone still has to claim the fish.",
    attributes: ["person", "pet", "drink"],
    items: { person: PEOPLE, pet: PETS, drink: DRINKS },
    question: (given) => `Who keeps ${keepPet(given.label)}?`,
    questionGiven: "pet",
    questionAnswer: "person",
  },
  {
    id: "heist",
    title: "Night shift",
    blurb: "Jobs and rides on one street. Who parked where?",
    story: "One block, one job each, one ride each.",
    attributes: ["person", "job", "vehicle"],
    items: { person: PEOPLE, job: JOBS, vehicle: VEHICLES },
    question: (given) => `Who is the ${given.label}?`,
    questionGiven: "job",
    questionAnswer: "person",
  },
  {
    id: "pet-show",
    title: "Pet show",
    blurb: "Painted doors and a packed aisle. Who keeps which pet?",
    story: "Judging is over. The chart is not.",
    attributes: ["person", "pet", "color"],
    items: { person: PEOPLE, pet: PETS, color: COLORS },
    question: (given) => `Who keeps ${keepPet(given.label)}?`,
    questionGiven: "pet",
    questionAnswer: "person",
  },
  {
    id: "garden",
    title: "Garden row",
    blurb: "Each plot has a gardener, a plant, and a drink in the dirt.",
    story: "Late light. Someone is watering the cactus.",
    attributes: ["person", "plant", "drink"],
    items: { person: PEOPLE, plant: PLANTS, drink: DRINKS },
    question: (given) => `Who grows ${growPlant(given.label)}?`,
    questionGiven: "plant",
    questionAnswer: "person",
  },
  {
    id: "book-club",
    title: "Book club",
    blurb: "Same living room, different copies. Who reads what?",
    story: "The wine is open. The seating is not settled.",
    attributes: ["person", "book", "drink"],
    items: { person: PEOPLE, book: BOOKS, drink: DRINKS },
    question: (given) => `Who reads ${readBook(given.label)}?`,
    questionGiven: "book",
    questionAnswer: "person",
  },
  {
    id: "neighborhood",
    title: "The block",
    blurb: "Houses in a line. Match resident, ride, and animal.",
    story: "Someone parked beside the horses. That cannot be right.",
    attributes: ["person", "vehicle", "pet"],
    items: { person: PEOPLE, vehicle: VEHICLES, pet: PETS },
    question: (given) => `Who keeps ${keepPet(given.label)}?`,
    questionGiven: "pet",
    questionAnswer: "person",
  },
  {
    id: "music-night",
    title: "Music night",
    blurb: "A short set in the front rooms. Who plays what, and what do they sip?",
    story: "The last cue is still missing.",
    attributes: ["person", "instrument", "drink"],
    items: { person: PEOPLE, instrument: INSTRUMENTS, drink: DRINKS },
    question: (given) => `Who plays the ${given.label}?`,
    questionGiven: "instrument",
    questionAnswer: "person",
  },
  {
    id: "brunch",
    title: "Brunch",
    blurb: "One table, several plates. Who eats what?",
    story: "The check is coming. So is the question.",
    attributes: ["person", "food", "drink"],
    items: { person: PEOPLE, food: FOODS, drink: DRINKS },
    question: (given) => `Who is the ${given.label} lover?`,
    questionGiven: "food",
    questionAnswer: "person",
  },
  {
    id: "holiday",
    title: "Holiday row",
    blurb: "Painted doors and pets down the lane.",
    story: "Someone still has not claimed the pink house.",
    attributes: ["person", "color", "pet"],
    items: { person: PEOPLE, color: COLORS, pet: PETS },
    question: (given) => `Who keeps ${keepPet(given.label)}?`,
    questionGiven: "pet",
    questionAnswer: "person",
  },
  {
    id: "camp",
    title: "Camp street",
    blurb: "Tents in a line. Match camper, hobby, and companion.",
    story: "The last lantern is still unclaimed.",
    attributes: ["person", "hobby", "pet"],
    items: { person: PEOPLE, hobby: HOBBIES, pet: PETS },
    question: (given) => `Who keeps ${keepPet(given.label)}?`,
    questionGiven: "pet",
    questionAnswer: "person",
  },
];

/** Practice-only themes. Daily generation still draws from THEMES. */
export const PRACTICE_THEMES = [
  {
    id: "expert-street",
    title: "The long street",
    blurb: "Five painted houses. Who, color, pet, and drink.",
    story: "Five houses, four facts each.",
    attributes: ["person", "color", "pet", "drink"],
    items: { person: PEOPLE, color: COLORS, pet: PETS, drink: DRINKS },
    question: (given) => `Who keeps ${keepPet(given.label)}?`,
    questionGiven: "pet",
    questionAnswer: "person",
  },
  {
    id: "expert-trades",
    title: "Five trades",
    blurb: "Jobs, rides, and pets down the block.",
    story: "The clerk still has not parked.",
    attributes: ["person", "job", "vehicle", "pet"],
    items: { person: PEOPLE, job: JOBS, vehicle: VEHICLES, pet: PETS },
    question: (given) => `Who is the ${given.label}?`,
    questionGiven: "job",
    questionAnswer: "person",
  },
  {
    id: "expert-cities",
    title: "Five cities",
    blurb: "Visitors, drinks, and a plate each.",
    story: "Tokyo still has not ordered dinner.",
    attributes: ["person", "city", "drink", "food"],
    items: { person: PEOPLE, city: CITIES, drink: DRINKS, food: FOODS },
    question: (given) => `Who is from ${given.label}?`,
    questionGiven: "city",
    questionAnswer: "person",
  },
  {
    id: "expert-hobby",
    title: "Hobby houses",
    blurb: "Hobbies, colors, and a drink on the street.",
    story: "The pink house still needs a hobby.",
    attributes: ["person", "hobby", "color", "drink"],
    items: { person: PEOPLE, hobby: HOBBIES, color: COLORS, drink: DRINKS },
    question: (given) => `Who likes ${given.label}?`,
    questionGiven: "hobby",
    questionAnswer: "person",
  },
  {
    id: "expert-table",
    title: "Five plates",
    blurb: "Colors, plates, and drinks on one street.",
    story: "The pink house still has not eaten.",
    attributes: ["person", "color", "food", "drink"],
    items: { person: PEOPLE, color: COLORS, food: FOODS, drink: DRINKS },
    question: (given) => `Who is the ${given.label} lover?`,
    questionGiven: "food",
    questionAnswer: "person",
  },
];

export const HOLIDAY_THEME_BY_MD = {
  "01-01": "holiday",
  "02-14": "brunch",
  "10-31": "heist",
  "12-24": "holiday",
  "12-25": "holiday",
  "12-31": "holiday",
};

export function themeById(id) {
  return THEMES.find((theme) => theme.id === id) || PRACTICE_THEMES.find((theme) => theme.id === id) || THEMES[0];
}

export function rolesForTheme(themeId) {
  const theme = themeById(themeId);
  const roles = {};
  for (const [id, def] of Object.entries(ATTRIBUTES)) {
    roles[id] = {
      occupant: def.occupant,
      personSame: def.personSame,
      neighbor: def.neighbor || def.occupant,
      ...(theme.roles?.[id] || {}),
    };
  }
  return roles;
}
