/** Themes are built only from Phosphor duotone icons in plotted-icons.js. */

function onFoot(label) {
  return label === "on foot";
}

function an(label) {
  const word = String(label || "").trim();
  if (!word || onFoot(word)) return word;
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}

/** Einstein says “keeps dogs”; generated pets are usually singular. */
function keepPet(label) {
  const word = String(label || "").trim();
  if (!word) return word;
  if (/s$/i.test(word) && !/(ss|us|is)$/i.test(word)) return word;
  return an(word);
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

function hasItem(label) {
  return `has the ${label}`;
}

function eatFood(label) {
  if (label === "ice cream" || label === "stew") return label;
  return an(label);
}

const PLAYED_HOBBIES = new Set(["guitar"]);

/**
 * Einstein-style noun + verb for every category.
 * occupant = person-first noun (“the dog owner”, “the owner of the red house”).
 * personSame = verb (“Ada keeps a dog”, “Ada lives in the red house”).
 * neighbor = how they appear after “lives next to”.
 */
export const ATTRIBUTES = {
  person: {
    id: "person",
    label: "Who",
    icon: "user",
    occupant: (x) => x,
    personSame: (person) => person,
    neighbor: (x) => x,
  },
  pet: {
    id: "pet",
    label: "Pet",
    icon: "paw-print",
    occupant: (x) => `the ${x} owner`,
    personSame: (person, x) => `${person} keeps ${keepPet(x)}`,
    neighbor: (x) => `the one who keeps ${keepPet(x)}`,
  },
  drink: {
    id: "drink",
    label: "Drink",
    icon: "coffee",
    occupant: (x) => `the ${x} drinker`,
    personSame: (person, x) => `${person} drinks ${x}`,
    neighbor: (x) => `the one who drinks ${x}`,
  },
  loot: {
    id: "loot",
    label: "Loot",
    icon: "diamond",
    occupant: (x) => `the person who ${hasItem(x)}`,
    personSame: (person, x) => `${person} ${hasItem(x)}`,
    neighbor: (x) => `the one who ${hasItem(x)}`,
  },
  getaway: {
    id: "getaway",
    label: "Getaway",
    icon: "car",
    occupant: vehicleNoun,
    personSame: (person, x) => `${person} ${vehicleVerb(x)}`,
    neighbor: (x) => (onFoot(x) ? "the one on foot" : `the one who ${vehicleVerb(x)}`),
  },
  prize: {
    id: "prize",
    label: "Prize",
    icon: "trophy",
    occupant: (x) => `the person who ${hasItem(x)}`,
    personSame: (person, x) => `${person} ${hasItem(x)}`,
    neighbor: (x) => `the one who ${hasItem(x)}`,
  },
  plant: {
    id: "plant",
    label: "Plant",
    icon: "flower",
    occupant: (x) => `the person who tends the ${x}`,
    personSame: (person, x) => `${person} tends the ${x}`,
    neighbor: (x) => `the one who tends the ${x}`,
  },
  vehicle: {
    id: "vehicle",
    label: "Ride",
    icon: "bicycle",
    occupant: vehicleNoun,
    personSame: (person, x) => `${person} ${vehicleVerb(x)}`,
    neighbor: (x) => (onFoot(x) ? "the one on foot" : `the one who ${vehicleVerb(x)}`),
  },
  instrument: {
    id: "instrument",
    label: "Music",
    icon: "music-note",
    occupant: (x) => `the ${x} player`,
    personSame: (person, x) => `${person} plays the ${x}`,
    neighbor: (x) => `the one who plays the ${x}`,
  },
  book: {
    id: "book",
    label: "Book",
    icon: "book",
    occupant: (x) => `the person who ${hasItem(x)}`,
    personSame: (person, x) => `${person} ${hasItem(x)}`,
    neighbor: (x) => `the one who ${hasItem(x)}`,
  },
  treat: {
    id: "treat",
    label: "Treat",
    icon: "cookie",
    occupant: (x) => `the person who ${hasItem(x)}`,
    personSame: (person, x) => `${person} ${hasItem(x)}`,
    neighbor: (x) => `the one who ${hasItem(x)}`,
  },
  gift: {
    id: "gift",
    label: "Gift",
    icon: "gift",
    occupant: (x) => `the person who ${hasItem(x)}`,
    personSame: (person, x) => `${person} ${hasItem(x)}`,
    neighbor: (x) => `the one who ${hasItem(x)}`,
  },
  food: {
    id: "food",
    label: "Plate",
    icon: "fork-knife",
    occupant: (x) => `the person who eats ${eatFood(x)}`,
    personSame: (person, x) => `${person} eats ${eatFood(x)}`,
    neighbor: (x) => `the one who eats ${eatFood(x)}`,
  },
  color: {
    id: "color",
    label: "Color",
    icon: "paint-brush",
    occupant: (x) => `the owner of the ${x} house`,
    personSame: (person, x) => `${person} lives in the ${x} house`,
    neighbor: (x) => `the ${x} house`,
  },
  nationality: {
    id: "nationality",
    label: "Who",
    icon: "identification-badge",
    occupant: (x) => `the ${x}`,
    personSame: (person) => person,
    neighbor: (x) => `the ${x}`,
  },
  beverage: {
    id: "beverage",
    label: "Drink",
    icon: "coffee",
    occupant: (x) => `the ${x} drinker`,
    personSame: (person, x) => `${person} drinks ${x}`,
    neighbor: (x) => `the one who drinks ${x}`,
  },
  cigar: {
    id: "cigar",
    label: "Cigar",
    icon: "leaf",
    occupant: (x) => `the person who smokes ${x}`,
    personSame: (person, x) => `${person} smokes ${x}`,
    neighbor: (x) => `the one who smokes ${x}`,
  },
  job: {
    id: "job",
    label: "Job",
    icon: "briefcase",
    occupant: (x) => `the ${x}`,
    personSame: (person, x) => `${person} is a ${x}`,
    neighbor: (x) => `the ${x}`,
  },
  hobby: {
    id: "hobby",
    label: "Hobby",
    icon: "lightbulb",
    occupant: (x) => (PLAYED_HOBBIES.has(x) ? `the ${x} player` : `the person who likes ${x}`),
    personSame: (person, x) => (PLAYED_HOBBIES.has(x) ? `${person} plays ${x}` : `${person} likes ${x}`),
    neighbor: (x) => (PLAYED_HOBBIES.has(x) ? `the one who plays ${x}` : `the one who likes ${x}`),
  },
  city: {
    id: "city",
    label: "City",
    icon: "house",
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
  { id: "cat", label: "cat", icon: "cat" },
  { id: "dog", label: "dog", icon: "dog" },
  { id: "bird", label: "bird", icon: "bird" },
  { id: "fish", label: "fish", icon: "fish" },
  { id: "rabbit", label: "rabbit", icon: "rabbit" },
  { id: "horse", label: "horse", icon: "horse" },
  { id: "butterfly", label: "butterfly", icon: "butterfly" },
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
  { id: "bike", label: "bicycle", icon: "bicycle" },
  { id: "moto", label: "motorcycle", icon: "motorcycle" },
  { id: "plane", label: "plane", icon: "airplane" },
  { id: "boat", label: "sailboat", icon: "sailboat" },
  { id: "walk", label: "on foot", icon: "person-simple-walk" },
];

const TREATS = [
  { id: "cookie", label: "cookie", icon: "cookie" },
  { id: "cake", label: "cake", icon: "cake" },
  { id: "ice", label: "ice cream", icon: "ice-cream" },
  { id: "pizza", label: "pizza", icon: "pizza" },
  { id: "burger", label: "burger", icon: "hamburger" },
  { id: "carrot", label: "carrot", icon: "carrot" },
];

const FOODS = [
  { id: "pizza", label: "pizza", icon: "pizza" },
  { id: "burger", label: "burger", icon: "hamburger" },
  { id: "bowl", label: "bowl", icon: "bowl-food" },
  { id: "cake", label: "cake", icon: "cake" },
  { id: "ice", label: "ice cream", icon: "ice-cream" },
  { id: "carrot", label: "carrot", icon: "carrot" },
  { id: "pot", label: "stew", icon: "cooking-pot" },
];

export const THEMES = [
  {
    id: "dinner-party",
    title: "Dinner party",
    blurb: "Three neighbors cooked, poured, and brought a guest. Match the table.",
    story: "A small dinner. Someone still has to claim the fish.",
    attributes: ["person", "pet", "drink"],
    items: { person: PEOPLE, pet: PETS, drink: DRINKS },
    question: (given, answer) => `Who owns the ${given.label}?`,
    questionGiven: "pet",
    questionAnswer: "person",
  },
  {
    id: "heist",
    title: "The heist",
    blurb: "A quiet job on one street. Who took what, and how did they leave?",
    story: "One crew, one night, one getaway each.",
    attributes: ["person", "loot", "getaway"],
    items: {
      person: PEOPLE,
      loot: [
        { id: "diamond", label: "diamond", icon: "diamond" },
        { id: "coins", label: "coins", icon: "coins" },
        { id: "key", label: "key", icon: "key" },
        { id: "crown", label: "crown", icon: "crown" },
        { id: "lockbox", label: "lock", icon: "lock" },
        { id: "medal", label: "medal", icon: "medal" },
      ],
      getaway: [
        { id: "car", label: "car", icon: "car" },
        { id: "bike", label: "bicycle", icon: "bicycle" },
        { id: "moto", label: "motorcycle", icon: "motorcycle" },
        { id: "plane", label: "plane", icon: "airplane" },
        { id: "boat", label: "sailboat", icon: "sailboat" },
        { id: "walk", label: "on foot", icon: "person-simple-walk" },
      ],
    },
    question: (given, answer) => `Who has the ${given.label}?`,
    questionGiven: "loot",
    questionAnswer: "person",
  },
  {
    id: "pet-show",
    title: "Pet show",
    blurb: "Ribbons, paws, and a packed aisle. Who won which prize?",
    story: "Judging is over. The chart is not.",
    attributes: ["person", "pet", "prize"],
    items: {
      person: PEOPLE,
      pet: PETS,
      prize: [
        { id: "trophy", label: "trophy", icon: "trophy" },
        { id: "crown", label: "crown", icon: "crown" },
        { id: "medal", label: "medal", icon: "medal" },
        { id: "gift", label: "gift", icon: "gift" },
        { id: "balloon", label: "balloon", icon: "balloon" },
        { id: "cookie", label: "cookie", icon: "cookie" },
      ],
    },
    question: (given, answer) => `Who showed the ${given.label}?`,
    questionGiven: "pet",
    questionAnswer: "person",
  },
  {
    id: "garden",
    title: "Garden row",
    blurb: "Each plot has a gardener, a plant, and a drink in the dirt.",
    story: "Late light. Someone is watering the cactus.",
    attributes: ["person", "plant", "drink"],
    items: {
      person: PEOPLE,
      plant: [
        { id: "flower", label: "flower", icon: "flower" },
        { id: "tulip", label: "tulip", icon: "flower-tulip" },
        { id: "tree", label: "tree", icon: "tree" },
        { id: "cactus", label: "cactus", icon: "cactus" },
        { id: "pot", label: "potted plant", icon: "potted-plant" },
        { id: "leaf", label: "leaf", icon: "leaf" },
      ],
      drink: DRINKS,
    },
    question: (given, answer) => `Who tends the ${given.label}?`,
    questionGiven: "plant",
    questionAnswer: "person",
  },
  {
    id: "book-club",
    title: "Book club",
    blurb: "Same living room, different copies. Who brought which book?",
    story: "The wine is open. The seating is not settled.",
    attributes: ["person", "book", "drink"],
    items: {
      person: PEOPLE,
      book: [
        { id: "novel", label: "novel", icon: "book" },
        { id: "open", label: "open book", icon: "book-open" },
        { id: "notes", label: "notes", icon: "note-pencil" },
        { id: "score", label: "score", icon: "music-notes" },
        { id: "map", label: "field guide", icon: "magnifying-glass" },
        { id: "diary", label: "diary", icon: "pencil-simple" },
      ],
      drink: DRINKS,
    },
    question: (given, answer) => `Who brought the ${given.label}?`,
    questionGiven: "book",
    questionAnswer: "person",
  },
  {
    id: "neighborhood",
    title: "The block",
    blurb: "Houses in a line. Match resident, ride, and animal.",
    story: "Someone parked beside the horse. That cannot be right.",
    attributes: ["person", "vehicle", "pet"],
    items: {
      person: PEOPLE,
      vehicle: [
        { id: "car", label: "car", icon: "car" },
        { id: "bike", label: "bicycle", icon: "bicycle" },
        { id: "moto", label: "motorcycle", icon: "motorcycle" },
        { id: "plane", label: "plane", icon: "airplane" },
        { id: "boat", label: "sailboat", icon: "sailboat" },
        { id: "walk", label: "on foot", icon: "person-simple-walk" },
      ],
      pet: PETS,
    },
    question: (given, answer) => `Who lives with the ${given.label}?`,
    questionGiven: "pet",
    questionAnswer: "person",
  },
  {
    id: "music-night",
    title: "Music night",
    blurb: "A short set in the front rooms. Who plays what, and what do they sip?",
    story: "The last cue is still missing.",
    attributes: ["person", "instrument", "drink"],
    items: {
      person: PEOPLE,
      instrument: [
        { id: "guitar", label: "guitar", icon: "guitar" },
        { id: "note", label: "melody", icon: "music-note" },
        { id: "notes", label: "harmony", icon: "music-notes" },
        { id: "score", label: "score", icon: "book-open" },
        { id: "charts", label: "charts", icon: "note-pencil" },
        { id: "folio", label: "folio", icon: "book" },
      ],
      drink: DRINKS,
    },
    question: (given, answer) => `Who plays the ${given.label}?`,
    questionGiven: "instrument",
    questionAnswer: "person",
  },
  {
    id: "brunch",
    title: "Brunch",
    blurb: "One table, several plates. Who ordered what?",
    story: "The check is coming. So is the question.",
    attributes: ["person", "food", "drink"],
    items: {
      person: PEOPLE,
      food: [
        { id: "pizza", label: "pizza", icon: "pizza" },
        { id: "burger", label: "burger", icon: "hamburger" },
        { id: "bowl", label: "bowl", icon: "bowl-food" },
        { id: "cake", label: "cake", icon: "cake" },
        { id: "ice", label: "ice cream", icon: "ice-cream" },
        { id: "carrot", label: "carrot", icon: "carrot" },
        { id: "pot", label: "stew", icon: "cooking-pot" },
      ],
      drink: DRINKS,
    },
    question: (given, answer) => `Who ordered the ${given.label}?`,
    questionGiven: "food",
    questionAnswer: "person",
  },
  {
    id: "holiday",
    title: "Holiday row",
    blurb: "Treats and parcels down the lane.",
    story: "Someone hid the last gift beside the tree.",
    attributes: ["person", "treat", "gift"],
    items: {
      person: PEOPLE,
      treat: [
        { id: "cookie", label: "cookie", icon: "cookie" },
        { id: "cake", label: "cake", icon: "cake" },
        { id: "ice", label: "ice cream", icon: "ice-cream" },
        { id: "orange", label: "orange", icon: "orange" },
        { id: "tea", label: "tea", icon: "tea-bag" },
        { id: "cocoa", label: "cocoa", icon: "coffee" },
      ],
      gift: [
        { id: "gift", label: "parcel", icon: "gift" },
        { id: "balloon", label: "balloon", icon: "balloon" },
        { id: "tree", label: "evergreen", icon: "tree-evergreen" },
        { id: "crown", label: "crown", icon: "crown" },
        { id: "medal", label: "medal", icon: "medal" },
        { id: "book", label: "book", icon: "book" },
      ],
    },
    question: (given, answer) => `Who brought the ${given.label}?`,
    questionGiven: "treat",
    questionAnswer: "person",
  },
  {
    id: "camp",
    title: "Camp street",
    blurb: "Tents in a line. Match camper, kit, and companion.",
    story: "The last lantern is still unclaimed.",
    attributes: ["person", "loot", "pet"],
    items: {
      person: PEOPLE,
      loot: [
        { id: "tent", label: "tent", icon: "tent" },
        { id: "key", label: "key", icon: "key" },
        { id: "lock", label: "lock", icon: "lock" },
        { id: "pot", label: "cookpot", icon: "cooking-pot" },
        { id: "book", label: "guide", icon: "book" },
        { id: "leaf", label: "leaf", icon: "leaf" },
      ],
      pet: PETS,
    },
    question: (given, answer) => `Who camped with the ${given.label}?`,
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
    question: (given, answer) => `Who owns the ${given.label}?`,
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
    question: (given, answer) => `Who is the ${given.label}?`,
    questionGiven: "job",
    questionAnswer: "person",
  },
  {
    id: "expert-cities",
    title: "Five cities",
    blurb: "Visitors, drinks, and a treat each.",
    story: "Tokyo still has not ordered dessert.",
    attributes: ["person", "city", "drink", "treat"],
    items: { person: PEOPLE, city: CITIES, drink: DRINKS, treat: TREATS },
    question: (given, answer) => `Who is from ${given.label}?`,
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
    question: (given, answer) => `Who likes ${given.label}?`,
    questionGiven: "hobby",
    questionAnswer: "person",
  },
  {
    id: "expert-table",
    title: "Five plates",
    blurb: "Colors, plates, and drinks on one street.",
    story: "The pink house still has not ordered.",
    attributes: ["person", "color", "food", "drink"],
    items: { person: PEOPLE, color: COLORS, food: FOODS, drink: DRINKS },
    question: (given, answer) => `Who ordered the ${given.label}?`,
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
