import { BALANCE } from "./balance.js";
import { getSave, workForge, workCounter, putOnCounter } from "./save.js";
import { playSound } from "./sound.js";

// Crafting's rules (DESIGN.md section 6): monsters drop parts, the forge in
// the underworld makes gear out of them (forge.js is its page), worn gear
// makes the hero a share stronger (stats.js withGear), and the merchant
// sells the spares for gold (merchant.js). The forge and the merchant work
// only while the game is open, in a run too, so their clock lives here
// rather than in a room.

const { crafting } = BALANCE;
export const recipeOf = (id) => crafting.recipes.find((recipe) => recipe.id === id);

// The forge's and the merchant's upgrades, as bought (balance.js
// crafting.upgrades, levels in save.js workshop): what they're working
// with now.
const UPGRADES = [...crafting.upgrades.forge, ...crafting.upgrades.merchant];
export const upgradeLevel = (upgrade) => getSave().workshop[upgrade.id] ?? 0;
export const upgradeCost = (upgrade) => upgrade.costs[upgradeLevel(upgrade)] ?? null; // null once it's maxed
export function workshop(levels = getSave().workshop) {
  const shop = { forgeTime: 1, anvils: 1, rolls: 1, recipes: new Set(), sellTime: 1, counter: crafting.counter, haggle: 1, autoSell: false };
  for (const upgrade of UPGRADES) {
    const level = levels[upgrade.id] ?? 0;
    if (!level) continue;
    const [[kind, by]] = Object.entries(upgrade.effect);
    if (kind === "forgeTime" || kind === "sellTime") shop[kind] *= by ** level;
    else if (kind === "recipe") shop.recipes.add(by);
    else if (kind === "autoSell") shop.autoSell = true;
    else shop[kind] += by * level;
  }
  return shop;
}
// Whether a recipe can be made: the ones no upgrade teaches are known from
// the start.
const taught = new Set(UPGRADES.map((upgrade) => upgrade.effect.recipe).filter(Boolean));
export const knowsRecipe = (recipe) => !taught.has(recipe.id) || workshop().recipes.has(recipe.id);

// How many of each part it still needs, beyond what's saved: { part: missing }.
export function partsShort(recipe) {
  const short = {};
  for (const [part, count] of Object.entries(recipe.parts)) {
    const have = getSave().parts[part] ?? 0;
    if (have < count) short[part] = count - have;
  }
  return short;
}
// Whether the forge has room for one more: its anvils and its queue.
export const forgeFull = () => getSave().forge.length >= workshop().anvils + crafting.queue;
export const canCraft = (recipe) => knowsRecipe(recipe) && !forgeFull() && !Object.keys(partsShort(recipe)).length;

// A finished piece's bonuses: between its recipe's fewest and most, each a
// different one picked at random, each a size in its range (smaller for one
// with a `scale`), in whole percents, at least 1%. With Better rolls, each
// size is rolled more than once and the biggest kept.
export function rollBonuses(recipeId) {
  const recipe = recipeOf(recipeId);
  const kinds = Object.keys(crafting.bonuses);
  const [fewest, most] = recipe.bonuses;
  const count = fewest + Math.floor(Math.random() * (most - fewest + 1));
  const bonuses = {};
  while (Object.keys(bonuses).length < count) {
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    if (kind in bonuses) continue;
    const [small, big] = recipe.size;
    const roll = Math.max(...Array.from({ length: workshop().rolls }, Math.random));
    const size = (small + roll * (big - small)) * (crafting.bonuses[kind].scale ?? 1);
    bonuses[kind] = Math.max(1, Math.round(size * 100)) / 100;
  }
  return bonuses;
}

// What a piece sells for: its recipe's price, more for a better roll. Each
// bonus's place in its range (0 the smallest, 1 the biggest), averaged,
// makes it 0.6 to 1.4 times that, times how many bonuses it has over the
// recipe's fewest. Always at least 1 gold.
export function priceOf(piece) {
  const recipe = recipeOf(piece.recipe);
  const [small, big] = recipe.size;
  const places = Object.entries(piece.bonuses).map(([kind, size]) => {
    const full = size / (crafting.bonuses[kind].scale ?? 1);
    return Math.max(0, Math.min(1, (full - small) / (big - small)));
  });
  const place = places.reduce((sum, p) => sum + p, 0) / places.length;
  return Math.max(1, Math.round(recipe.price * (0.6 + 0.8 * place) * places.length / recipe.bonuses[0]));
}

// The pieces in the gear chest that aren't worn, newest first.
export const spareGear = () => {
  const worn = Object.values(getSave().worn);
  return getSave().gear.filter((piece) => !worn.includes(piece.id)).reverse();
};
export const counterFull = () => getSave().counter.length >= workshop().counter;
// What a price comes to with Haggling.
export const haggled = (price) => Math.round(price * workshop().haggle);
// Seconds as the forge or the merchant take them now (`kind`: forgeTime or
// sellTime), for seconds at the start.
export const takes = (seconds, kind) => seconds * workshop()[kind];

// The pieces he's wearing, one per slot.
export const wornGear = () => {
  const { gear, worn } = getSave();
  return Object.values(worn).map((id) => gear.find((piece) => piece.id === id)).filter(Boolean);
};

// The forge's and the merchant's clock: once a second, they work for
// however long it's been (at most a minute, so a computer waking from sleep
// doesn't count the night). A piece coming out of the forge rings; a piece
// sold jingles.
export function startForge() {
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const seconds = Math.min(60, (now - last) / 1000);
    last = now;
    const shop = workshop();
    const made = workForge(seconds / shop.forgeTime, rollBonuses, shop.anvils);
    if (made.length) playSound("forged");
    if (shop.autoSell) made.forEach(autoSell);
    if (workCounter(seconds / shop.sellTime, shop.haggle).length) playSound("sold");
  }, 1000);
}

// Auto-sell: a new piece worth less than the one worn in its slot goes
// straight onto the counter, if there's room. (Nothing worn: it's kept.)
function autoSell(piece) {
  const slot = recipeOf(piece.recipe).slot;
  const worn = wornGear().find((other) => recipeOf(other.recipe).slot === slot);
  if (!worn || counterFull() || priceOf(piece) >= priceOf(worn)) return;
  putOnCounter(piece, priceOf(piece), recipeOf(piece.recipe).sells);
}

// A bonus as the pages show it: "DAMAGE +7%".
export const bonusText = (kind, size) => `${crafting.bonuses[kind].name} +${Math.round(size * 100)}%`;

// ---- Drawing -----------------------------------------------------------------
// Parts and gear aren't in the tileset, so they're drawn: [x, y, w, h, color]
// around their middle, outlined in dark.
const INK = [24, 20, 37];
const BONE = [232, 224, 208];
const SHAPES = {
  // Parts: a blob of slug goo, a lump of rotten flesh, a skull, and the Big
  // Zombie's heart.
  goo: [[-3, -2, 6, 1, [214, 222, 140]], [-4, -1, 8, 3, [176, 190, 92]], [-5, 1, 10, 2, [132, 148, 64]], [-2, -1, 2, 1, [246, 248, 210]]],
  flesh: [[-3, -3, 6, 2, [196, 112, 112]], [-4, -1, 8, 3, [160, 82, 88]], [-3, 2, 6, 1, [122, 60, 70]], [-2, -2, 2, 1, [226, 160, 150]], [1, 0, 2, 1, [116, 150, 80]]],
  skull: [[-3, -4, 6, 1, BONE], [-4, -3, 8, 4, BONE], [-3, 1, 6, 2, BONE], [-3, -2, 2, 2, INK], [1, -2, 2, 2, INK], [-1, 2, 1, 1, INK], [1, 2, 1, 1, INK]],
  heart: [[-4, -3, 3, 2, [150, 40, 60]], [1, -3, 3, 2, [150, 40, 60]], [-4, -1, 8, 2, [128, 32, 52]], [-3, 1, 6, 1, [108, 26, 46]], [-2, 2, 4, 1, [96, 22, 40]], [-1, 3, 2, 1, [96, 22, 40]], [-3, -3, 1, 1, [210, 120, 120]], [-1, -1, 1, 1, [110, 160, 80]]],
  // The forge's and merchant's upgrades: an hourglass, an anvil, a die, a
  // stall's counter with a coin on it, a stack of coins, and a sack.
  hourglass: [[-4, -6, 8, 1, [140, 92, 52]], [-3, -5, 6, 2, [237, 201, 120]], [-2, -3, 4, 1, [237, 201, 120]], [-1, -2, 2, 2, [220, 240, 255]], [-2, 0, 4, 1, [220, 240, 255]], [-3, 1, 6, 3, [237, 201, 120]], [-4, 4, 8, 1, [140, 92, 52]]],
  anvil: [[-6, -3, 2, 1, [120, 120, 136]], [-4, -4, 10, 3, [120, 120, 136]], [-4, -4, 10, 1, [180, 180, 196]], [-1, -1, 4, 2, [84, 84, 100]], [-4, 1, 10, 3, [84, 84, 100]]],
  dice: [[-5, -5, 10, 10, [240, 230, 210]], [-3, -3, 2, 2, [24, 20, 37]], [1, 1, 2, 2, [24, 20, 37]], [1, -3, 2, 2, [24, 20, 37]], [-3, 1, 2, 2, [24, 20, 37]], [-5, -5, 10, 1, [255, 255, 255]]],
  counter: [[-6, -1, 12, 2, [184, 111, 60]], [-6, 1, 12, 4, [138, 75, 43]], [-4, 2, 1, 3, [59, 30, 20]], [3, 2, 1, 3, [59, 30, 20]], [-2, -5, 4, 4, [255, 205, 70]], [-1, -4, 1, 1, [255, 240, 170]]],
  coins: [[-4, 2, 8, 2, [230, 160, 40]], [-5, 0, 8, 2, [255, 205, 70]], [-3, -2, 8, 2, [230, 160, 40]], [-4, -4, 8, 2, [255, 205, 70]], [-3, -4, 3, 1, [255, 240, 170]]],
  sack: [[-2, -6, 4, 2, [150, 120, 80]], [-1, -4, 2, 1, [255, 205, 70]], [-4, -3, 8, 7, [190, 160, 110]], [-5, -1, 10, 4, [190, 160, 110]], [-1, -1, 2, 3, [150, 120, 80]]],
  // Gear: a ragged hood, a helm with a skull's face, and a crown of the dead.
  rag_hood: [[-3, -6, 6, 2, [150, 112, 76]], [-5, -4, 10, 6, [126, 92, 60]], [-6, 2, 12, 3, [126, 92, 60]], [-2, -2, 4, 3, [40, 28, 30]], [-2, 1, 4, 1, [150, 112, 76]], [-3, -5, 2, 1, [186, 146, 100]], [-4, 4, 1, 1, [96, 70, 46]], [3, 4, 1, 1, [96, 70, 46]]],
  skull_helm: [[-6, -8, 2, 3, BONE], [4, -8, 2, 3, BONE], [-4, -6, 8, 2, BONE], [-5, -4, 10, 6, BONE], [-4, 2, 8, 3, [196, 186, 170]], [-3, -2, 2, 2, INK], [1, -2, 2, 2, INK], [-1, 0, 2, 1, INK], [-3, 3, 1, 1, INK], [-1, 3, 1, 1, INK], [1, 3, 1, 1, INK], [-4, -5, 3, 1, [255, 250, 236]]],
  zombie_crown: [[-5, -5, 2, 3, [255, 205, 70]], [-1, -6, 2, 4, [255, 205, 70]], [3, -5, 2, 3, [255, 205, 70]], [-5, -2, 10, 4, [230, 160, 40]], [-5, 2, 10, 1, [170, 110, 30]], [-1, -1, 2, 2, [99, 199, 77]], [-4, -1, 1, 1, [230, 72, 46]], [3, -1, 1, 1, [230, 72, 46]], [-5, -2, 10, 1, [255, 230, 140]]],
};

// Draws a part or a piece of gear (by its recipe's id) around `at`, `scale`
// times its size.
export function drawCrafted(kind, at, scale = 1, opacity = 1) {
  const shape = SHAPES[kind];
  if (!shape) return;
  for (const [x, y, w, h] of shape) {
    drawRect({ pos: at.add((x - 1) * scale, (y - 1) * scale), width: (w + 2) * scale, height: (h + 2) * scale, color: rgb(...INK), opacity });
  }
  for (const [x, y, w, h, c] of shape) drawRect({ pos: at.add(x * scale, y * scale), width: w * scale, height: h * scale, color: rgb(...c), opacity });
}
// A part lying on the floor, like a piece of material.
export const drawPart = (part, at) => drawCrafted(part, at);
