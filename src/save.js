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
  bones: 0,                  // the crypt's material: kept for later, nothing buys with it yet
  seenUnderworld: false,     // the first visit puts the well in the title room
};

let save = structuredClone(FRESH);
try {
  const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  const sameTree = stored.tree === TREE;
  save = { ...save, ...stored, tree: TREE, levels: { ...FRESH.levels, ...(sameTree ? stored.levels : {}) } };
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

// A run in `depth` is over: bank its gold and bones, and remember how deep
// it got (`cleared` is true when it beat the boss). Beating a depth's boss
// for the first time unlocks the next depth, and the next run goes there.
// Returns true when that happened.
export function endRun({ gold, deepest, depth, cleared = false, bones = 0 }) {
  save.gold += gold;
  save.bones += bones;
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

// The first time he's in the underworld, the title room gets its well.
export function seeUnderworld() {
  if (save.seenUnderworld) return;
  save.seenUnderworld = true;
  write();
}

// Starts over: no gold, no upgrades (the settings stay).
export function resetSave() {
  save = structuredClone(FRESH);
  write();
}
