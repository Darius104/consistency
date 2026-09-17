// A simple preselected avatar grid (like Netflix profile icons) - one flat
// pick from a fixed set, grouped into sections so a much bigger set of
// options stays easy to scan. Each avatar is emoji + a background color for
// visual variety - no external image assets, so nothing to fetch/license.

export interface AvatarOption {
  id: string;
  emoji: string;
}

export interface AvatarSection {
  label: string;
  options: AvatarOption[];
}

export const AVATAR_SECTIONS: AvatarSection[] = [
  {
    label: "Animals",
    options: [
      { id: "fox", emoji: "🦊" },
      { id: "panda", emoji: "🐼" },
      { id: "koala", emoji: "🐨" },
      { id: "lion", emoji: "🦁" },
      { id: "owl", emoji: "🦉" },
      { id: "otter", emoji: "🦦" },
      { id: "penguin", emoji: "🐧" },
      { id: "dragon", emoji: "🐲" },
      { id: "cat", emoji: "🐱" },
      { id: "dog", emoji: "🐶" },
      { id: "rabbit", emoji: "🐰" },
      { id: "tiger", emoji: "🐯" },
      { id: "wolf", emoji: "🐺" },
      { id: "dolphin", emoji: "🐬" },
      { id: "bear", emoji: "🐻" },
      { id: "monkey", emoji: "🐵" },
      { id: "frog", emoji: "🐸" },
      { id: "turtle", emoji: "🐢" },
      { id: "octopus", emoji: "🐙" },
      { id: "unicorn", emoji: "🦄" },
      { id: "elephant", emoji: "🐘" },
      { id: "giraffe", emoji: "🦒" },
      { id: "zebra", emoji: "🦓" },
      { id: "horse", emoji: "🐴" },
      { id: "cow", emoji: "🐮" },
      { id: "pig", emoji: "🐷" },
      { id: "sheep", emoji: "🐑" },
      { id: "chicken", emoji: "🐔" },
      { id: "duck", emoji: "🦆" },
      { id: "eagle", emoji: "🦅" },
      { id: "bat", emoji: "🦇" },
      { id: "snake", emoji: "🐍" },
      { id: "lizard", emoji: "🦎" },
      { id: "crab", emoji: "🦀" },
      { id: "shrimp", emoji: "🦐" },
      { id: "whale", emoji: "🐳" },
      { id: "shark", emoji: "🦈" },
      { id: "seal", emoji: "🦭" },
      { id: "camel", emoji: "🐫" },
      { id: "kangaroo", emoji: "🦘" },
      { id: "sloth", emoji: "🦥" },
      { id: "hedgehog", emoji: "🦔" },
      { id: "mouse", emoji: "🐭" },
      { id: "hamster", emoji: "🐹" },
      { id: "squirrel", emoji: "🐿️" },
      { id: "raccoon", emoji: "🦝" },
      { id: "bee", emoji: "🐝" },
      { id: "butterfly", emoji: "🦋" },
      { id: "ladybug", emoji: "🐞" },
      { id: "snail", emoji: "🐌" },
      { id: "parrot", emoji: "🦜" },
      { id: "peacock", emoji: "🦚" },
      { id: "flamingo", emoji: "🦩" },
      { id: "swan", emoji: "🦢" },
      { id: "rooster", emoji: "🐓" },
      { id: "boar", emoji: "🐗" },
      { id: "deer", emoji: "🦌" },
      { id: "bison", emoji: "🦬" },
      { id: "trex", emoji: "🦖" },
    ],
  },
  {
    label: "Faces",
    options: [
      { id: "grin", emoji: "😀" },
      { id: "cool", emoji: "😎" },
      { id: "starstruck", emoji: "🤩" },
      { id: "party", emoji: "🥳" },
      { id: "cowboy", emoji: "🤠" },
      { id: "nerd", emoji: "🤓" },
      { id: "monocle", emoji: "🧐" },
      { id: "disguise", emoji: "🥸" },
      { id: "clown", emoji: "🤡" },
      { id: "alien", emoji: "👽" },
      { id: "ghost", emoji: "👻" },
      { id: "robot", emoji: "🤖" },
      { id: "skull", emoji: "💀" },
      { id: "pumpkin", emoji: "🎃" },
      { id: "smiling", emoji: "😊" },
      { id: "laughing", emoji: "😂" },
      { id: "wink", emoji: "😉" },
      { id: "heart-eyes", emoji: "😍" },
      { id: "kissing", emoji: "😘" },
      { id: "halo", emoji: "😇" },
      { id: "thinking", emoji: "🤔" },
      { id: "shush", emoji: "🤫" },
      { id: "zany", emoji: "🤪" },
      { id: "sleepy", emoji: "😴" },
      { id: "dizzy", emoji: "😵" },
      { id: "hot", emoji: "🥵" },
      { id: "cold", emoji: "🥶" },
      { id: "mind-blown", emoji: "🤯" },
      { id: "shocked", emoji: "😱" },
      { id: "crying-laughing", emoji: "😭" },
      { id: "angry", emoji: "😠" },
      { id: "devil", emoji: "😈" },
      { id: "poop", emoji: "💩" },
      { id: "ogre", emoji: "👹" },
      { id: "goblin", emoji: "👺" },
      { id: "zombie", emoji: "🧟" },
      { id: "vampire", emoji: "🧛" },
      { id: "mage", emoji: "🧙" },
      { id: "superhero", emoji: "🦸" },
      { id: "supervillain", emoji: "🦹" },
      { id: "fairy", emoji: "🧚" },
      { id: "mermaid", emoji: "🧜" },
      { id: "elf", emoji: "🧝" },
      { id: "genie", emoji: "🧞" },
      { id: "santa", emoji: "🎅" },
    ],
  },
  {
    label: "Nature",
    options: [
      { id: "cactus", emoji: "🌵" },
      { id: "palm", emoji: "🌴" },
      { id: "blossom", emoji: "🌸" },
      { id: "rainbow", emoji: "🌈" },
      { id: "star", emoji: "⭐" },
      { id: "moon", emoji: "🌙" },
      { id: "sun", emoji: "☀️" },
      { id: "snowflake", emoji: "❄️" },
      { id: "fire", emoji: "🔥" },
      { id: "wave", emoji: "🌊" },
      { id: "clover", emoji: "🍀" },
      { id: "sunflower", emoji: "🌻" },
      { id: "tree", emoji: "🌳" },
      { id: "evergreen", emoji: "🌲" },
      { id: "seedling", emoji: "🌱" },
      { id: "herb", emoji: "🌿" },
      { id: "maple-leaf", emoji: "🍁" },
      { id: "mushroom", emoji: "🍄" },
      { id: "tulip", emoji: "🌷" },
      { id: "rose", emoji: "🌹" },
      { id: "hibiscus", emoji: "🌺" },
      { id: "bouquet", emoji: "💐" },
      { id: "volcano", emoji: "🌋" },
      { id: "mountain", emoji: "⛰️" },
      { id: "desert-island", emoji: "🏝️" },
      { id: "droplet", emoji: "💧" },
      { id: "tornado", emoji: "🌪️" },
      { id: "earth", emoji: "🌍" },
    ],
  },
  {
    label: "Food",
    options: [
      { id: "pizza", emoji: "🍕" },
      { id: "burger", emoji: "🍔" },
      { id: "donut", emoji: "🍩" },
      { id: "cookie", emoji: "🍪" },
      { id: "apple", emoji: "🍎" },
      { id: "watermelon", emoji: "🍉" },
      { id: "cherries", emoji: "🍒" },
      { id: "strawberry", emoji: "🍓" },
      { id: "avocado", emoji: "🥑" },
      { id: "taco", emoji: "🌮" },
      { id: "hotdog", emoji: "🌭" },
      { id: "fries", emoji: "🍟" },
      { id: "popcorn", emoji: "🍿" },
      { id: "icecream", emoji: "🍦" },
      { id: "cake", emoji: "🎂" },
      { id: "cupcake", emoji: "🧁" },
      { id: "candy", emoji: "🍬" },
      { id: "chocolate", emoji: "🍫" },
      { id: "lollipop", emoji: "🍭" },
      { id: "honey", emoji: "🍯" },
      { id: "sushi", emoji: "🍣" },
      { id: "ramen", emoji: "🍜" },
      { id: "bento", emoji: "🍱" },
      { id: "curry", emoji: "🍛" },
      { id: "dumpling", emoji: "🥟" },
      { id: "croissant", emoji: "🥐" },
      { id: "bread", emoji: "🍞" },
      { id: "cheese", emoji: "🧀" },
      { id: "bacon", emoji: "🥓" },
      { id: "grapes", emoji: "🍇" },
      { id: "banana", emoji: "🍌" },
      { id: "pineapple", emoji: "🍍" },
      { id: "peach", emoji: "🍑" },
      { id: "coconut", emoji: "🥥" },
      { id: "kiwi", emoji: "🥝" },
      { id: "mango", emoji: "🥭" },
      { id: "lemon", emoji: "🍋" },
      { id: "carrot", emoji: "🥕" },
      { id: "corn", emoji: "🌽" },
    ],
  },
  {
    label: "Sports",
    options: [
      { id: "soccer", emoji: "⚽" },
      { id: "basketball", emoji: "🏀" },
      { id: "football", emoji: "🏈" },
      { id: "baseball", emoji: "⚾" },
      { id: "tennis", emoji: "🎾" },
      { id: "volleyball", emoji: "🏐" },
      { id: "rugby", emoji: "🏉" },
      { id: "eight-ball", emoji: "🎱" },
      { id: "bowling", emoji: "🎳" },
      { id: "ping-pong", emoji: "🏓" },
      { id: "badminton", emoji: "🏸" },
      { id: "hockey", emoji: "🏒" },
      { id: "cricket", emoji: "🏏" },
      { id: "golf", emoji: "⛳" },
      { id: "skateboard", emoji: "🛹" },
      { id: "surfing", emoji: "🏄" },
      { id: "skiing", emoji: "🎿" },
      { id: "medal", emoji: "🥇" },
      { id: "trophy", emoji: "🏆" },
    ],
  },
  {
    label: "Space & Sky",
    options: [
      { id: "rocket", emoji: "🚀" },
      { id: "satellite", emoji: "🛰️" },
      { id: "ufo", emoji: "🛸" },
      { id: "glowing-star", emoji: "🌟" },
      { id: "shooting-star", emoji: "💫" },
      { id: "comet", emoji: "☄️" },
      { id: "ringed-planet", emoji: "🪐" },
      { id: "crescent-moon", emoji: "🌜" },
      { id: "cloud", emoji: "☁️" },
      { id: "lightning", emoji: "⚡" },
    ],
  },
  {
    label: "Objects & Symbols",
    options: [
      { id: "gem", emoji: "💎" },
      { id: "crystal", emoji: "🔮" },
      { id: "headphones", emoji: "🎧" },
      { id: "palette", emoji: "🎨" },
      { id: "controller", emoji: "🎮" },
      { id: "camera", emoji: "📷" },
      { id: "guitar", emoji: "🎸" },
      { id: "drum", emoji: "🥁" },
      { id: "microphone", emoji: "🎤" },
      { id: "book", emoji: "📚" },
      { id: "light-bulb", emoji: "💡" },
      { id: "key", emoji: "🔑" },
      { id: "magnet", emoji: "🧲" },
      { id: "hourglass", emoji: "⏳" },
      { id: "compass", emoji: "🧭" },
      { id: "anchor", emoji: "⚓" },
      { id: "umbrella", emoji: "☂️" },
      { id: "balloon", emoji: "🎈" },
      { id: "gift", emoji: "🎁" },
      { id: "crown", emoji: "👑" },
      { id: "ring", emoji: "💍" },
      { id: "money", emoji: "💰" },
      { id: "heart", emoji: "❤️" },
      { id: "sparkling-heart", emoji: "💖" },
      { id: "target", emoji: "🎯" },
    ],
  },
];

export type AvatarId = string;

export const AVATAR_IDS: AvatarId[] = AVATAR_SECTIONS.flatMap((section) =>
  section.options.map((option) => option.id),
);

const EMOJI_BY_ID: Record<string, string> = Object.fromEntries(
  AVATAR_SECTIONS.flatMap((section) => section.options.map((option) => [option.id, option.emoji])),
);

// Cycled across the flat id list (not per-section) so adjacent avatars in
// the same section don't repeat the same couple of colors.
const AVATAR_COLOR_PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

const BG_BY_ID: Record<string, string> = Object.fromEntries(
  AVATAR_IDS.map((id, i) => [id, AVATAR_COLOR_PALETTE[i % AVATAR_COLOR_PALETTE.length]]),
);

export const DEFAULT_AVATAR_ID: AvatarId = "fox";

export function avatarEmoji(id: AvatarId): string {
  return EMOJI_BY_ID[id] ?? EMOJI_BY_ID[DEFAULT_AVATAR_ID];
}

export function avatarBg(id: AvatarId): string {
  return BG_BY_ID[id] ?? BG_BY_ID[DEFAULT_AVATAR_ID];
}

const VALID_AVATAR_IDS = new Set(AVATAR_IDS);

export function parseAvatarId(raw: string | null): AvatarId {
  return raw && VALID_AVATAR_IDS.has(raw) ? raw : DEFAULT_AVATAR_ID;
}

export const MAX_BIO_LENGTH = 140;
