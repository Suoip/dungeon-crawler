import { BALANCE } from "./balance.js";
import { CENTER } from "./nodes.js";

// Your progress, remembered between visits in the browser's localStorage
// (next to the settings, see settings.js): the gold you've banked and the
// upgrades you've bought. It's saved after every run and every purchase.
// Reading or writing can fail (private windows, blocked site data), so every
// access is wrapped in try/catch, and the game carries on with what it has.

const KEY = "dungeon-crawler-save";

// The skill tree's version: saves from before the branching tree (version 3)
// had different nodes, so their tree starts over (the gold and depths stay).
const TREE = 3;

const FRESH = {
  gold: 0,                   // banked gold, to spend in the skill tree
  levels: { [CENTER]: 1 },   // the tree: node id -> 1 for each node bought (see nodes.js)
  tree: TREE,
  runs: 0,                   // runs played
  best: 0,                   // the deepest a run has got, in sub-depths from the top: 13.4 = depth 2, into room 4
  cleared: 0,                // the deepest depth whose boss has been beaten
  depth: 1,                  // the depth the next run goes to (picked in the underworld)
  materials: { bones: 0, teeth: 0, tusks: 0, slime: 0, embers: 0 }, // each depth's material, for its special upgrade
  seenUnderworld: false,     // the first visit puts the well in the title room
  parts: {},                 // monsters' parts, for the forge: part -> how many
  forge: [],                 // what the forge is making, in order: { recipe, left } (seconds left), the first on the anvil
  gear: [],                  // every piece it has made: { id, recipe, bonuses: { kind: share } } (balance.js crafting)
  worn: {},                  // slot -> the id of the piece worn there
  nextPiece: 1,              // the id the next piece gets
  newGear: 0,                // pieces made since the gear chest was last opened
  counter: [],               // the merchant's counter: { piece, price, left } (seconds left to sell)
};

let save = structuredClone(FRESH);
try {
  const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  const sameTree = stored.tree === TREE;
  save = { ...save, ...stored, tree: TREE, levels: { ...FRESH.levels, ...(sameTree ? stored.levels : {}) } };
  // Saves from before the depths had their own materials only had bones.
  save.materials = { ...FRESH.materials, ...stored.materials };
  if (stored.bones) save.materials.bones += stored.bones;
  delete save.bones;
  // Saves from before the well existed: every run ends in the underworld,
  // so anyone who has played a run has been there.
  save.seenUnderworld ||= save.runs > 0;
} catch {
  // Nothing saved yet, or storage isn't available: start fresh.
}

export const getSave = () => save;

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Can't save. Progress still counts until the page is closed.
  }
}

// A run in `depth` is over: bank its gold, material and parts, and remember how deep
// it got (`cleared` is true when it beat the boss). Beating a depth's boss
// for the first time unlocks the next depth, and the next run goes there.
// Returns true when that happened.
export function endRun({ gold, deepest, depth, cleared = false, material = 0, parts = {} }) {
  save.gold += gold;
  save.materials[BALANCE.depths[depth - 1].material] += material;
  for (const [part, count] of Object.entries(parts)) save.parts[part] = (save.parts[part] ?? 0) + count;
  save.runs++;
  save.best = Math.max(save.best, (depth - 1) * 10 + deepest);
  const unlocked = cleared && depth > save.cleared && depth < BALANCE.depths.length;
  if (cleared) save.cleared = Math.max(save.cleared, depth);
  if (unlocked) save.depth = depth + 1;
  write();
  return unlocked;
}

// Picks the depth the next run goes to.
export function chooseDepth(depth) {
  save.depth = depth;
  write();
}

// Buys a skill tree node for `price` gold.
export function buyLevel(id, price) {
  save.gold -= price;
  save.levels[id] = (save.levels[id] ?? 0) + 1;
  write();
}

// Buys a level of a special upgrade (balance.js specials) for `cost` of its
// depth's `material`.
export function buySpecial(id, material, cost) {
  save.materials[material] -= cost;
  save.levels[`special:${id}`] = (save.levels[`special:${id}`] ?? 0) + 1;
  write();
}

// Puts a recipe (balance.js crafting) in at the forge, paying its parts.
export function startCraft(recipe) {
  for (const [part, count] of Object.entries(recipe.parts)) save.parts[part] -= count;
  save.forge.push({ recipe: recipe.id, left: recipe.time });
  write();
}

// The forge works for `seconds`: on the piece on the anvil, then the next
// one with any time left over. A finished one is made by `make(recipeId)`
// (which rolls its bonuses) and goes in the gear chest. Returns the pieces
// finished.
export function workForge(seconds, make) {
  if (!save.forge.length) return [];
  const made = [];
  while (save.forge.length && seconds > 0) {
    const job = save.forge[0];
    const spent = Math.min(seconds, job.left);
    job.left -= spent;
    seconds -= spent;
    if (job.left > 0) break;
    save.forge.shift();
    const piece = { id: save.nextPiece++, recipe: job.recipe, bonuses: make(job.recipe) };
    save.gear.push(piece);
    save.newGear++;
    made.push(piece);
  }
  write();
  return made;
}

// Puts a piece on, in its slot (the one there goes back in the chest).
export function wearPiece(id, slot) {
  save.worn[slot] = id;
  write();
}

// Puts a spare piece on the merchant's counter, to sell for `price` gold in
// `seconds`. It leaves the gear chest.
export function putOnCounter(piece, price, seconds) {
  save.gear = save.gear.filter((other) => other !== piece);
  save.counter.push({ piece, price, left: seconds });
  write();
}

// Takes the counter's `i`th piece back, into the gear chest.
export function takeBack(i) {
  const [{ piece }] = save.counter.splice(i, 1);
  save.gear.push(piece);
  write();
}

// The merchant sells for `seconds`: every piece on the counter at once. A
// sold one's gold is banked. Returns the ones sold.
export function workCounter(seconds) {
  if (!save.counter.length) return [];
  for (const sale of save.counter) sale.left -= seconds;
  const sold = save.counter.filter((sale) => sale.left <= 0);
  save.counter = save.counter.filter((sale) => sale.left > 0);
  for (const sale of sold) save.gold += sale.price;
  write();
  return sold;
}

// The gear chest has been opened: nothing in it is new any more.
export function seeGear() {
  if (!save.newGear) return;
  save.newGear = 0;
  write();
}

// The first time he's in the underworld, the title room gets its well.
export function seeUnderworld() {
  if (save.seenUnderworld) return;
  save.seenUnderworld = true;
  write();
}

// Starts over: no gold, no upgrades, no parts or gear (the settings stay).
export function resetSave() {
  save = structuredClone(FRESH);
  write();
}
