// Your progress, remembered between visits in the browser's localStorage
// (next to the settings, see settings.js): the gold you've banked and the
// upgrades you've bought. It's saved after every run. Reading or writing can
// fail (private windows, blocked site data), so every access is wrapped in
// try/catch, and the game carries on with what it has.

const KEY = "dungeon-crawler-save";

const FRESH = {
  gold: 0,                   // banked gold, to spend in the skill tree
  levels: { descend: 1 },    // the tree: node id -> level bought (see balance.js)
  runs: 0,                   // runs played
  best: 0,                   // the deepest a run has got, as sub-depths: 3.4 = into room 4
};

let save = structuredClone(FRESH);
try {
  const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  save = { ...save, ...stored, levels: { ...FRESH.levels, ...stored.levels } };
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

// A run is over: bank its gold and remember how deep it got.
export function endRun(gold, deepest) {
  save.gold += gold;
  save.runs++;
  save.best = Math.max(save.best, deepest);
  write();
}
