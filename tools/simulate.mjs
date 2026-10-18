// The pacing simulator: plays the game by the numbers in src/balance.js,
// depth after depth, run after run, buying upgrades between runs. Each depth
// ends when its boss is beaten, and the next one starts with everything
// bought so far and the gold left over. Luck is rolled with dice
// (tools/model.mjs), so it plays the whole game many times and reports the
// average and the spread, for each depth. It checks these from DESIGN.md
// section 8:
//
//   The pace: about 40 minutes per depth for a typical player, spread over
//   the rooms rather than piled up in one.
//   The golden rule: a typical careful run always earns enough to buy
//   something. "Typical" means average luck: the run is rolled many times
//   and the median (middle) result is the one checked. The player is the
//   efficient one, who plays well.
//
// And how each depth's start feels: in depth 1, with no upgrades, room 1
// must be out of reach, even for a sharp player (with a margin: how much
// more time he'd need); it should open after about 6-8 upgrades. Each deeper
// depth starts the climb over, so its first room should be a struggle with
// only the earlier depths' upgrades.
//
// It plays with two kinds of shopper, because real players fall somewhere in
// between:
//   value     buys whatever helps most for its price (it tries each one out)
//   cheapest  always buys the cheapest thing it can afford
//
// Run it from the repo's folder:
//   node tools/simulate.mjs                 the summary, every depth
//   node tools/simulate.mjs --depths 2      ...only up to depth 2
//   node tools/simulate.mjs --runs          ...and the golden-rule path, run by run
//   node tools/simulate.mjs --seeds 300     ...playing each case 300 times (default 100)
//   node tools/simulate.mjs --json out.json ...and save it all, for charts

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { BALANCE } from "../src/balance.js";
import { MODEL, PLAYERS, heroStats, costOf, simulateRun, makeDice } from "./model.mjs";
import { isEarly } from "../src/stats.js";

export const DEPTHS = BALANCE.depths.length;
const TARGET_MINUTES = 40;  // DESIGN.md section 8: about 40 minutes per depth, typical player
const MARGIN = 1.3;         // warn when a golden-rule run earns less than this × the cheapest offer
const MAX_RUNS = 400;       // if a depth isn't done by then, it's stuck
const MEDIAN_OF = 101;      // dice rolls per golden-rule check (an odd number has a middle)
const WORTH_OF = 10;        // dice rolls when a shopper tries an upgrade out
const BARE_RUNS = 1000;     // dice rolls for the no-upgrades check
// A player sharper than the efficient one, for that check: he walks and
// dodges better (nobody swings faster than the swing's timer).
const SHARP = { clearTime: 0.8, gold: 1, danger: 0.8 };

export const startingLevels = () => Object.fromEntries(BALANCE.tree.filter((n) => n.owned).map((n) => [n.id, 1]));

// Whether a node does anything in `depth`: a per-depth node only works in
// its own depth (stats.js), so nobody buys another depth's for itself.
const useful = (node, depth) => !node.perDepth || (node.depth ?? 1) === depth;
// Whether buying `node` leads to something that works in `depth` (and passes
// `want`), through a chain of nodes that don't: an "opener".
const opens = (node, depth, want = () => true) => BALANCE.tree.some((c) => c.parent === node.id
  && ((useful(c, depth) && want(c)) || (!useful(c, depth) && opens(c, depth, want))));

// The nodes you could buy a level of right now, playing `depth` (their parent
// is owned, they aren't maxed, and they do something here, or their first
// level opens the way to something that does), each with its next level's
// price. A deeper depth's nodes are on sale too, at the early price (this
// depth's boss isn't beaten yet). `usefulOnly`: just the ones that work here.
function forSale(levels, depth, usefulOnly = false, want = () => true) {
  return BALANCE.tree
    .filter((node) => (levels[node.id] ?? 0) < node.levels)
    .filter((node) => !node.parent || (levels[node.parent] ?? 0) > 0)
    .filter((node) => (useful(node, depth) && want(node)) || (!usefulOnly && !(levels[node.id] ?? 0) && opens(node, depth, want)))
    .map((node) => ({ node, price: costOf(node, levels[node.id] ?? 0, isEarly(node, depth - 1)) }));
}

// Plays the same upgrades `count` times in `depth`, with the dice seeded 1,
// 2, 3... Using the same seeds everywhere means two sets of upgrades are
// compared on the same luck.
function rollRuns(levels, player, count, depth) {
  const stats = heroStats(levels, depth);
  return Array.from({ length: count }, (_, i) => simulateRun(stats, makeDice(i + 1), player, depth));
}

// How good a set of upgrades is in `depth`, on average: gold per real-world
// second (runs that earn more per second fill the tree faster), with a big
// bonus for the chance of beating the boss, since that's the goal.
const worthCache = new Map();
export const forgetWorth = () => worthCache.clear(); // after changing BALANCE or MODEL (e.g. while tuning)
function worth(levels, player, depth) {
  const key = JSON.stringify([player, depth, Object.entries(levels).filter(([, l]) => l > 0).sort()]); // the same build, in any order
  if (!worthCache.has(key)) {
    const runs = rollRuns(levels, player, WORTH_OF, depth);
    const mean = (f) => runs.reduce((sum, run) => sum + f(run), 0) / runs.length;
    // Gold per second, in the depth's own terms: a deeper depth pays its
    // `scale` times as much, and its prices are that much higher too.
    const scale = BALANCE.depths[depth - 1].scale.gold;
    worthCache.set(key, mean((r) => r.gold / scale / (r.wall + MODEL.hubPerRun) + (r.ending === "boss" ? 1000 : 0) + r.deepest * 0.01));
  }
  return worthCache.get(key);
}

// The cheapest level on sale that adds time to this depth's clock, if he can
// afford it.
const TIME_STATS = new Set(["startTime", "timePerSubDepth"]);
function moreTime(levels, gold, depth) {
  const offers = forSale(levels, depth, false, (n) => TIME_STATS.has(n.effect?.stat)).filter((o) => o.price <= gold);
  return offers.sort((a, b) => a.price - b.price)[0] ?? null;
}
// The same for damage.
function moreDamage(levels, gold, depth) {
  const offers = forSale(levels, depth, false, (n) => n.effect?.stat === "damage").filter((o) => o.price <= gold);
  return offers.sort((a, b) => a.price - b.price)[0] ?? null;
}

const SHOPPERS = {
  value(levels, gold, player, depth) {
    const now = worth(levels, player, depth);
    let best = null;
    for (const offer of forSale(levels, depth).filter((o) => o.price <= gold)) {
      const gain = worth({ ...levels, [offer.node.id]: (levels[offer.node.id] ?? 0) + 1 }, player, depth) - now;
      const score = gain / Math.max(1, offer.price);
      if (!best || score > best.score) best = { ...offer, score };
    }
    return best;
  },
  cheapest(levels, gold, player, depth) {
    const offers = forSale(levels, depth).filter((o) => o.price <= gold).sort((a, b) => a.price - b.price);
    return offers[0] ?? null;
  },
};
export const SHOPPER_NAMES = Object.keys(SHOPPERS);

// Plays one depth: one run after another, shopping in between, until its
// boss is beaten. `start` is what's carried in from the depths before:
// { levels, bank, minutes } (minutes so far, over the whole game).
// `nextRun(levels, depth)` says how each run goes: one roll of the dice for
// a playthrough, or the median of many for the golden rule's path. Each run
// records `minutes` since this depth began.
//
// A player stuck at a deeper depth's start (three runs in a row that didn't
// get through its first room, each earning less than the cheapest thing on
// sale that works there) goes back up a depth for a run, to earn gold (the
// underworld's signpost lets him): a "farm" run. It counts toward this
// depth's time, but not its progress, and he tries the depth again after
// it. (Further in, the depth pays better than the one above: he saves up
// instead.)
//
// The boss run's payout isn't spent until the next depth begins, at that
// depth's prices (its nodes aren't early any more): `opening` is what that
// buys, before the first run, and `startLevels` the hero it starts with.
const FARM_AFTER = 3;
export function playDepth(shopperName, player, nextRun, depth, start = { levels: startingLevels(), bank: 0, minutes: 0 }) {
  const shop = SHOPPERS[shopperName];
  const levels = { ...start.levels };
  let bank = start.bank;
  let minutes = 0;
  const runs = [];
  const opening = [];
  if (bank > 0) {
    for (let pick = shop(levels, bank, player, depth); pick; pick = shop(levels, bank, player, depth)) {
      bank -= pick.price;
      levels[pick.node.id] = (levels[pick.node.id] ?? 0) + 1;
      opening.push(`${pick.node.name} ${levels[pick.node.id]}`);
    }
  }
  const startLevels = { ...levels };

  for (let n = 1; n <= MAX_RUNS; n++) {
    const farm = depth > 1 && runs.length >= FARM_AFTER
      && runs.slice(-FARM_AFTER).every((r) => r.ending !== "farm" && r.deepest < 1 && r.cheapest !== null && r.gold < r.cheapest);
    const played = nextRun(levels, farm ? depth - 1 : depth);
    const run = farm ? { ...played, deepest: 0, ending: "farm" } : played;
    minutes += (run.wall + MODEL.hubPerRun) / 60;
    bank += run.gold;

    // The golden rule, checked strictly: this run's gold alone (not savings)
    // must cover the cheapest thing on sale that helps here.
    const offers = forSale(levels, depth, true);
    const cheapest = offers.length ? Math.min(...offers.map((o) => o.price)) : null;
    if (run.ending === "boss") {
      runs.push({ n, minutes, deepest: run.deepest, ending: run.ending, gold: run.gold, bank, cheapest, bought: [] });
      break; // its gold is spent at the next depth's prices (`opening`)
    }

    const bought = [];
    // The clock stopped him again where it stopped him before (no deeper
    // than his best run, by a tenth of a room): anyone would buy more time
    // first. (The value shopper can't see it: a few seconds more often don't
    // pay until they get him well into the next room.)
    const stuck = run.ending === "time" && runs.length && run.deepest < Math.max(...runs.map((r) => r.deepest)) + 0.1;
    // In a deeper depth, a run that didn't get him through the first room
    // (or a farm run, to get through it) sends him for damage first: he's
    // been through a depth before, and knows its edge is what opens it. If
    // he can't afford any, the clock rule above still holds.
    const atDoor = depth > 1 && run.deepest < 1;
    const first = (atDoor ? moreDamage(levels, bank, depth) : null) ?? (stuck ? moreTime(levels, bank, depth) : null);
    for (let pick = first ?? shop(levels, bank, player, depth); pick; pick = shop(levels, bank, player, depth)) {
      bank -= pick.price;
      levels[pick.node.id] = (levels[pick.node.id] ?? 0) + 1;
      bought.push(`${pick.node.name} ${levels[pick.node.id]}`);
    }
    runs.push({ n, minutes, deepest: run.deepest, ending: run.ending, gold: run.gold, bank, cheapest, bought });
  }
  return { depth, runs, levels, bank, minutes: start.minutes + minutes, opening, startLevels };
}

// Plays depths 1 to `upTo` in order, each starting from where the last
// ended. `nextRunFor(depth)` gives the depth's nextRun. Returns the depths'
// results, in order (it stops early at a depth whose boss never fell).
function playGame(shopperName, player, nextRunFor, upTo) {
  const depths = [];
  let start = { levels: startingLevels(), bank: 0, minutes: 0 };
  for (let depth = 1; depth <= upTo; depth++) {
    const result = playDepth(shopperName, player, nextRunFor(depth), depth, start);
    depths.push(result);
    if (result.runs.at(-1).ending !== "boss") break;
    start = { levels: result.levels, bank: result.bank, minutes: result.minutes };
  }
  return depths;
}

// The golden rule's path: every run is the median run of its upgrades
// (sorted by gold, the middle one of MEDIAN_OF rolls).
const medianRun = (player) => (levels, depth) =>
  rollRuns(levels, player, MEDIAN_OF, depth).sort((a, b) => a.gold - b.gold)[(MEDIAN_OF - 1) / 2];
export function goldenPath(shopperName, player = PLAYERS.efficient, upTo = DEPTHS) {
  return playGame(shopperName, player, () => medianRun(player), upTo);
}

// One playthrough with its own dice, from seed `seed`.
export function playthrough(shopperName, player, seed, upTo = DEPTHS) {
  const dice = makeDice(1_000_003 * seed);
  return playGame(shopperName, player, () => (levels, depth) => simulateRun(heroStats(levels, depth), dice, player, depth), upTo);
}

// ---- The report ------------------------------------------------------------

const fmt = (x, digits = 0) => (Number.isFinite(x) ? x.toFixed(digits) : x === Infinity ? "never" : "-");
// The value with a share `p` of a sorted list below it (and 1 - p above it).
const percentile = (sorted, p) =>
  sorted[p <= 0.5 ? Math.floor(p * sorted.length) : sorted.length - 1 - Math.floor((1 - p) * sorted.length)];

// Stretches of runs that didn't get any deeper than the best run so far (by
// at least a tenth of a room): where a player would feel stuck. A stretch
// still going at the end counts too.
function walls(runs) {
  const found = [];
  let best = 0;
  let since = null;
  for (const run of runs) {
    if (run.deepest > best + 0.1 || run.ending === "boss") { // (a boss kill ends a stretch at the boss)
      if (since && run.n - since.n >= 4) found.push({ from: since.n, to: run.n - 1, at: best, minutes: run.minutes - since.minutes });
      best = run.deepest;
      since = run;
    }
  }
  const last = runs.at(-1);
  if (since && last.ending !== "boss" && last.n - since.n >= 3) found.push({ from: since.n, to: last.n, at: best, minutes: last.minutes - since.minutes, open: true });
  return found;
}

// The golden rule on a path: the runs whose gold didn't cover the cheapest
// offer, and the ones with less than MARGIN to spare.
export function golden(runs) {
  const checked = runs.filter((r) => r.cheapest !== null);
  const ratio = (r) => r.gold / r.cheapest;
  return {
    broken: checked.filter((r) => ratio(r) < 1),
    thin: checked.filter((r) => ratio(r) >= 1 && ratio(r) < MARGIN),
    closest: checked.reduce((a, r) => (!a || ratio(r) < ratio(a) ? r : a), null),
  };
}

// The purchase rhythm (DESIGN.md section 8), over some playthroughs of a
// depth (each a list of runs): the share of runs whose gold bought nothing,
// 1 upgrade, 2-4, and 5 or more; how often 5 or more happens before the last
// fifth of the depth (where a cleanup spree is fine); and the biggest spree,
// on average over the playthroughs. Runs with nothing left to buy don't
// count, and nor does the boss run (its gold is spent at the next depth's
// start).
const LAST_STRETCH = 0.2;
export function rhythm(playthroughs) {
  const counts = (r) => r.cheapest !== null && r.ending !== "boss";
  const counted = playthroughs.flatMap((runs) => runs.filter(counts));
  const share = (list, test) => (list.length ? list.filter((r) => test(r.bought.length)).length / list.length : 0);
  const early = playthroughs.flatMap((runs) => runs.slice(0, Math.ceil(runs.length * (1 - LAST_STRETCH))).filter(counts));
  const sprees = playthroughs.map((runs) => Math.max(...runs.map((r) => r.bought.length)));
  return {
    none: share(counted, (b) => b === 0),
    one: share(counted, (b) => b === 1),
    few: share(counted, (b) => b >= 2 && b <= 4),
    many: share(counted, (b) => b >= 5),
    manyEarly: share(early, (b) => b >= 5),
    spree: sprees.length ? sprees.reduce((a, b) => a + b, 0) / sprees.length : 0,
  };
}

// One depth's numbers over many playthroughs (each a list of that depth's
// runs, or nothing if the playthrough never got there): how long it takes,
// how often a run can't buy anything, the rhythm, when room 1 first opens,
// walls, and the minute each room is first cleared.
export function depthStats(plays, seeds) {
  const done = plays.filter(Boolean);
  const minutes = done.map((runs) => runs.at(-1).minutes).sort((a, b) => a - b);
  const runCounts = done.map((runs) => runs.length).sort((a, b) => a - b);
  const allRuns = done.flat().filter((r) => r.cheapest !== null);
  // The first run that got through room 1, and the upgrades bought before it.
  const opens = done.map((runs) => {
    const at = runs.findIndex((r) => r.deepest >= 1);
    if (at < 0) return { run: Infinity, upgrades: Infinity };
    return { run: at + 1, upgrades: runs.slice(0, at).reduce((sum, r) => sum + r.bought.length, 0) };
  });
  const sortedBy = (f) => opens.map(f).sort((a, b) => a - b);
  const longest = done.map((runs) => Math.max(0, ...walls(runs).map((w) => w.to - w.from + 1)));
  // The minute each room is first cleared (room 10: the boss beaten), median.
  const firstClear = (runs, room) => runs.find((r) => r.deepest >= room && (room < 10 || r.ending === "boss"))?.minutes ?? Infinity;
  const clears = Array.from({ length: 10 }, (_, i) => percentile(done.map((runs) => firstClear(runs, i + 1)).sort((a, b) => a - b), 0.5));
  return {
    reached: done.length,
    minutes: { mean: minutes.reduce((a, b) => a + b, 0) / Math.max(1, minutes.length), p10: percentile(minutes, 0.1), p90: percentile(minutes, 0.9), all: minutes },
    runs: { median: percentile(runCounts, 0.5) },
    unfinished: done.filter((runs) => runs.at(-1).ending !== "boss").length, // got here, never beat the boss
    neverReached: seeds - done.length,                                      // stuck in an earlier depth
    buysNothing: allRuns.length ? allRuns.filter((r) => r.gold < r.cheapest).length / allRuns.length : 0,
    maxBuys: Math.max(0, ...done.flatMap((runs) => runs.map((r) => r.bought.length))),
    farm: done.flat().filter((r) => r.ending === "farm").length / Math.max(1, done.flat().length), // runs spent back up a depth
    rhythm: rhythm(done),
    roomOne: { run: percentile(sortedBy((o) => o.run), 0.5), upgrades: percentile(sortedBy((o) => o.upgrades), 0.5) },
    walls: { share: longest.filter((l) => l > 0).length / Math.max(1, done.length), longest: Math.max(0, ...longest) },
    clears,
  };
}

// Many playthroughs of one shopper and player, up to depth `upTo`: each
// depth's numbers (depthStats), in order, and the whole game's time (over
// the playthroughs that finished it).
export function spread(shopperName, player, seeds, upTo = DEPTHS) {
  const games = Array.from({ length: seeds }, (_, i) => playthrough(shopperName, player, i + 1, upTo));
  const finished = games.filter((g) => g.length === upTo && g.at(-1).runs.at(-1).ending === "boss");
  return {
    depths: Array.from({ length: upTo }, (_, d) => depthStats(games.map((game) => game[d]?.runs), seeds)),
    whole: { mean: finished.reduce((a, g) => a + g.at(-1).minutes, 0) / Math.max(1, finished.length), finished: finished.length },
  };
}

// Depth 1 with no upgrades at all (and `extra` more seconds on the clock):
// the share of runs that get through room 1.
export function bareRoomOne(player, extra = 0, count = BARE_RUNS) {
  const stats = { ...heroStats(startingLevels()) };
  stats.startTime += extra;
  const runs = Array.from({ length: count }, (_, i) => simulateRun(stats, makeDice(7_000_001 + i), player));
  return runs.filter((r) => r.deepest >= 1).length / runs.length;
}

// The margin: how many more seconds on the first clock it would take for a
// player with no upgrades to get through room 1 now and then (1 run in 100).
export function bareMargin(player) {
  for (let extra = 0; extra <= 60; extra++) if (bareRoomOne(player, extra, 300) >= 0.01) return extra;
  return Infinity;
}

// A deeper depth's start: the share of runs that get through its room 1 with
// only `levels` (what the depths before it left him with).
export function freshRoomOne(levels, depth, player = PLAYERS.efficient, count = 300) {
  const stats = heroStats(levels, depth);
  const runs = Array.from({ length: count }, (_, i) => simulateRun(stats, makeDice(8_000_001 + i), player, depth));
  return runs.filter((r) => r.deepest >= 1).length / runs.length;
}

function summarize(shopperName, depth, path, typical, efficient, before) {
  const last = path.runs.at(-1);
  const check = golden(path.runs);
  const ratio = (r) => fmt(r.gold / r.cheapest, 2);
  // Levels of this depth's nodes, and of deeper ones bought early.
  const levelsOf = (test) => Object.entries(path.levels).reduce((sum, [id, l]) => {
    const node = BALANCE.tree.find((n) => n.id === id);
    return sum + (!node.owned && test(node.depth ?? 1) ? l : 0);
  }, 0);
  const boughtLevels = levelsOf((d) => d === depth);
  const earlyLevels = levelsOf((d) => d > depth);
  const allLevels = BALANCE.tree.filter((n) => !n.owned && (n.depth ?? 1) === depth).reduce((sum, n) => sum + n.levels, 0);
  const span = (s) => (!s.reached ? "no playthrough got this far"
    : `${fmt(s.minutes.mean, 1)} min on average (10% of players faster than ${fmt(s.minutes.p10, 1)}, 10% slower than ${fmt(s.minutes.p90, 1)}), ${s.runs.median} runs`
      + (s.unfinished ? `, ${s.unfinished} NEVER beat the boss` : "") + (s.neverReached ? `, ${s.neverReached} never got here` : ""));
  const lines = [
    `--- depth ${depth} (${BALANCE.depths[depth - 1].name}), ${shopperName} shopper ---`,
    `  typical player:   ${span(typical)}  [target ${TARGET_MINUTES}]`,
    `  efficient player: ${span(efficient)}`,
    `  golden rule (efficient player, median luck): ${last.ending === "boss" ? "" : "NEVER beat the boss; "}`
      + (check.broken.length
        ? `BROKEN in ${check.broken.length} runs (first: run ${check.broken[0].n} earned ${check.broken[0].gold}, cheapest was ${check.broken[0].cheapest})`
        : `held in all ${path.runs.length} runs`)
      + (check.closest ? `; closest: run ${check.closest.n} earned ${check.closest.gold} = ${ratio(check.closest)}x the cheapest (${check.closest.cheapest})` : ""),
  ];
  if (check.thin.length) lines.push(`  thin margin (under ${MARGIN}x) in runs ${check.thin.map((r) => r.n).join(", ")}`);
  lines.push(`  runs that buy nothing, with real luck: ${fmt(100 * typical.buysNothing)}% (typical player), ${fmt(100 * efficient.buysNothing)}% (efficient)`
    + (typical.farm || efficient.farm ? `; runs spent farming the depth before: ${fmt(100 * typical.farm)}% (typical), ${fmt(100 * efficient.farm)}% (efficient)` : ""));
  const beat = (r) => `${fmt(100 * r.none)}% none, ${fmt(100 * r.one)}% one, ${fmt(100 * r.few)}% 2-4, ${fmt(100 * r.many)}% 5+`
    + ` (5+ before the last stretch: ${fmt(100 * r.manyEarly)}%; biggest spree ${fmt(r.spree, 1)} on average, ${typical.maxBuys} at most)`;
  lines.push(`  upgrades bought per run (typical player): ${beat(typical.rhythm)}`);
  lines.push(`  room 1 first cleared (median): run ${typical.roomOne.run} after ${typical.roomOne.upgrades} upgrades (typical player), `
    + `run ${efficient.roomOne.run} after ${efficient.roomOne.upgrades} (efficient)` + (depth === 1 ? "  [target 6-8 upgrades]" : ""));
  if (before !== null) lines.push(`  room 1 with only the depths before it: cleared in ${fmt(100 * before)}% of runs (efficient player, golden path)`);
  if (path.opening?.length) lines.push(`  bought before the first run (with the last boss's gold): ${path.opening.join(", ")}`);
  lines.push(`  first run: reached ${fmt(path.runs[0].deepest, 1)}, earned ${path.runs[0].gold} gold, bought ${path.runs[0].bought.join(", ") || "nothing"}`);
  lines.push(`  ring bought when the boss fell: ${boughtLevels} of ${allLevels} levels`
    + (earlyLevels ? `, plus ${earlyLevels} of deeper depths', bought early` : ""));
  const stuck = walls(path.runs);
  const where = (w) => (w.at >= 9.99 ? "at the boss" : `at ${fmt(w.at, 1)}`); // (9.999: the boss room's bar is full)
  lines.push(stuck.length
    ? `  walls: ${stuck.map((w) => `runs ${w.from}-${w.to} ${w.open ? "still stuck at the end" : "stuck"} ${where(w)} (${fmt(w.minutes, 1)} min)`).join("; ")}`
    : "  walls: none longer than 3 runs");
  const took = typical.clears.map((m, i) => m - (i ? typical.clears[i - 1] : 0));
  const slowest = took.slice(0, 9).reduce((best, m, i) => (m > took[best] ? i : best), 0);
  lines.push(`  minutes each room takes to first clear (typical player, median): ${took.map((m) => fmt(m, 1)).join(", ")}`
    + `  (the slowest before the boss: room ${slowest + 1}, ${fmt(took[slowest], 1)} min)`);
  lines.push(`  walls with real luck (typical player): in ${fmt(100 * typical.walls.share)}% of playthroughs, the longest ${typical.walls.longest} runs`);
  const unbought = BALANCE.tree.filter((n) => (n.depth ?? 1) === depth && (path.levels[n.id] ?? 0) === 0).map((n) => n.name);
  if (unbought.length) lines.push(`  never bought: ${unbought.join(", ")}`);
  return lines.join("\n");
}

function runTable(runs) {
  return runs.map((r) =>
    `  ${String(r.n).padStart(3)}  ${fmt(r.minutes, 1).padStart(5)} min  deepest ${fmt(r.deepest, 2).padStart(5)}  ${r.ending.padEnd(4)}  `
    + `+${String(r.gold).padStart(8)} gold  ${r.cheapest !== null && r.gold < r.cheapest ? "!" : " "} bought: ${r.bought.join(", ") || "-"}`).join("\n");
}

// Only when it's run from the command line (other scripts can import the
// functions above without printing anything).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));

function main(args) {
  const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const seeds = Number(option("--seeds", 100));
  const upTo = Math.min(DEPTHS, Number(option("--depths", DEPTHS)));
  const results = SHOPPER_NAMES.map((shopper) => ({
    shopper,
    path: goldenPath(shopper, PLAYERS.efficient, upTo),
    typical: spread(shopper, PLAYERS.typical, seeds, upTo),
    efficient: spread(shopper, PLAYERS.efficient, seeds, upTo),
  }));
  const file = option("--json", null);
  if (file) {
    writeFileSync(file, JSON.stringify(results, null, 1));
    console.log(`saved ${file}`);
  }
  const bare = { efficient: bareRoomOne(PLAYERS.efficient), sharp: bareRoomOne(SHARP), margin: bareMargin(SHARP) };
  console.log(`no upgrades: room 1 cleared in ${fmt(100 * bare.efficient, 1)}% of runs (efficient player), ${fmt(100 * bare.sharp, 1)}% (a sharp player)`
    + (bare.sharp > 0 ? "  <- should be 0" : `; a sharp player would need ${bare.margin} s more on the first clock`));
  console.log();
  for (const r of results) {
    const { whole } = r.typical;
    console.log(`=== ${r.shopper} shopper: ${fmt(whole.mean, 0)} min for the whole game, typical player`
      + (whole.finished < seeds ? ` (${seeds - whole.finished} of ${seeds} playthroughs never finished)` : "") + " ===");
    r.path.forEach((path, d) => {
      // Only the earlier depths' nodes: the opening can buy this depth's own ring.
      const earlier = Object.fromEntries(Object.entries(path.startLevels)
        .map(([id, level]) => [id, (BALANCE.tree.find((n) => n.id === id).depth ?? 1) < d + 1 ? level : 0]));
      const before = d > 0 ? freshRoomOne(earlier, d + 1) : null;
      console.log(summarize(r.shopper, d + 1, path, r.typical.depths[d], r.efficient.depths[d], before));
      if (args.includes("--runs")) console.log(`  the golden-rule path, run by run:\n${runTable(path.runs)}`);
    });
    console.log();
  }
  // Exit with an error if the golden rule broke, so it can't be missed.
  if (results.some((r) => r.path.some((p) => golden(p.runs).broken.length))) process.exitCode = 1;
  if (bare.sharp > 0) process.exitCode = 1;
}
