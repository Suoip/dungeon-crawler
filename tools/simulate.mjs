// The pacing simulator: plays depth 1 by the numbers in src/balance.js, run
// after run, buying upgrades between runs, until the boss is beaten. Luck is
// rolled with dice (tools/model.mjs), so it plays the whole depth many times
// and reports the average and the spread. It checks two things from
// DESIGN.md section 8:
//
//   The pace: about 40 minutes per depth for a typical player.
//   The golden rule: a typical careful run always earns enough to buy
//   something. "Typical" means average luck: the run is rolled many times
//   and the median (middle) result is the one checked. The player is the
//   efficient one, who plays well.
//
// It plays with two kinds of shopper, because real players fall somewhere in
// between:
//   value     buys whatever helps most for its price (it tries each one out)
//   cheapest  always buys the cheapest thing it can afford
//
// Run it from the repo's folder:
//   node tools/simulate.mjs                 the summary
//   node tools/simulate.mjs --runs          ...and the golden-rule path, run by run
//   node tools/simulate.mjs --seeds 300     ...playing each case 300 times (default 100)
//   node tools/simulate.mjs --json out.json ...and save it all, for charts

import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { BALANCE } from "../src/balance.js";
import { MODEL, PLAYERS, heroStats, costOf, simulateRun, makeDice } from "./model.mjs";
import { isEarly } from "../src/stats.js";

const DEPTH = 1;            // the depth being played (deeper depths' nodes cost BALANCE.earlyPrice times as much)
const TARGET_MINUTES = 40;  // DESIGN.md section 8: about 40 minutes per depth, typical player
const MARGIN = 1.3;         // warn when a golden-rule run earns less than this × the cheapest offer
const MAX_RUNS = 400;       // if it's not done by then, it's stuck
const MEDIAN_OF = 101;      // dice rolls per golden-rule check (an odd number has a middle)
const WORTH_OF = 10;        // dice rolls when a shopper tries an upgrade out

const startingLevels = () => Object.fromEntries(BALANCE.tree.filter((n) => n.owned).map((n) => [n.id, 1]));

// The nodes you could buy a level of right now (their parent is owned and
// they aren't maxed), each with its next level's price. A deeper depth's
// nodes are on sale too, at the early price (this depth's boss isn't beaten
// yet: that's what ends the playthrough).
function forSale(levels) {
  return BALANCE.tree
    .filter((node) => (levels[node.id] ?? 0) < node.levels)
    .filter((node) => !node.parent || (levels[node.parent] ?? 0) > 0)
    .map((node) => ({ node, price: costOf(node, levels[node.id] ?? 0, isEarly(node, DEPTH - 1)) }));
}

// Plays the same upgrades `count` times with the dice seeded 1, 2, 3...
// Using the same seeds everywhere means two sets of upgrades are compared
// on the same luck.
function rollRuns(levels, player, count) {
  const stats = heroStats(levels);
  return Array.from({ length: count }, (_, i) => simulateRun(stats, makeDice(i + 1), player));
}

// How good a set of upgrades is, on average: gold per real-world second
// (runs that earn more per second fill the tree faster), with a big bonus
// for the chance of beating the boss, since that's the goal.
const worthCache = new Map();
export const forgetWorth = () => worthCache.clear(); // after changing BALANCE or MODEL (e.g. while tuning)
function worth(levels, player) {
  const key = JSON.stringify([player, Object.entries(levels).filter(([, l]) => l > 0).sort()]); // the same build, in any order
  if (!worthCache.has(key)) {
    const runs = rollRuns(levels, player, WORTH_OF);
    const mean = (f) => runs.reduce((sum, run) => sum + f(run), 0) / runs.length;
    worthCache.set(key, mean((r) => r.gold / (r.wall + MODEL.hubPerRun) + (r.ending === "boss" ? 1000 : 0) + r.deepest * 0.01));
  }
  return worthCache.get(key);
}

const SHOPPERS = {
  value(levels, gold, player) {
    const now = worth(levels, player);
    let best = null;
    for (const offer of forSale(levels).filter((o) => o.price <= gold)) {
      const gain = worth({ ...levels, [offer.node.id]: (levels[offer.node.id] ?? 0) + 1 }, player) - now;
      const score = gain / Math.max(1, offer.price);
      if (!best || score > best.score) best = { ...offer, score };
    }
    return best;
  },
  cheapest(levels, gold) {
    const offers = forSale(levels).filter((o) => o.price <= gold).sort((a, b) => a.price - b.price);
    return offers[0] ?? null;
  },
};

// Plays depth 1 from scratch: one run after another, shopping in between,
// until the boss is beaten. `nextRun(levels)` says how each run goes: one
// roll of the dice for a playthrough, or the median of many for the golden
// rule's path.
function playDepth(shopperName, player, nextRun) {
  const shop = SHOPPERS[shopperName];
  const levels = startingLevels();
  let bank = 0;
  let minutes = 0;
  const runs = [];

  for (let n = 1; n <= MAX_RUNS; n++) {
    const run = nextRun(levels);
    minutes += (run.wall + MODEL.hubPerRun) / 60;
    bank += run.gold;

    // The golden rule, checked strictly: this run's gold alone (not savings)
    // must cover the cheapest thing on sale.
    const offers = forSale(levels);
    const cheapest = offers.length ? Math.min(...offers.map((o) => o.price)) : null;

    const bought = [];
    for (let pick = shop(levels, bank, player); pick; pick = shop(levels, bank, player)) {
      bank -= pick.price;
      levels[pick.node.id] = (levels[pick.node.id] ?? 0) + 1;
      bought.push(`${pick.node.name} ${levels[pick.node.id]}`);
    }
    runs.push({ n, minutes, deepest: run.deepest, ending: run.ending, gold: run.gold, bank, cheapest, bought });
    if (run.ending === "boss") break;
  }
  return { runs, levels };
}

// The golden rule's path: every run is the median run of its upgrades
// (sorted by gold, the middle one of MEDIAN_OF rolls).
export function goldenPath(shopperName, player = PLAYERS.efficient) {
  return playDepth(shopperName, player, (levels) =>
    rollRuns(levels, player, MEDIAN_OF).sort((a, b) => a.gold - b.gold)[(MEDIAN_OF - 1) / 2]);
}

// One playthrough with its own dice, from seed `seed`.
export function playthrough(shopperName, player, seed) {
  const dice = makeDice(1_000_003 * seed);
  return playDepth(shopperName, player, (levels) => simulateRun(heroStats(levels), dice, player));
}

// ---- The report ------------------------------------------------------------

const fmt = (x, digits = 0) => x.toFixed(digits);
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
    if (run.deepest > best + 0.1) {
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

// The purchase rhythm (DESIGN.md section 8), over some playthroughs (each a
// list of runs): the share of runs whose gold bought nothing, 1 upgrade, 2-4,
// and 5 or more; how often 5 or more happens before the last fifth of a
// playthrough (where a cleanup spree is fine); and the biggest spree, on
// average over the playthroughs. Runs after the tree is bought out don't
// count.
const LAST_STRETCH = 0.2;
export function rhythm(playthroughs) {
  const counted = playthroughs.flatMap((runs) => runs.filter((r) => r.cheapest !== null));
  const share = (list, test) => (list.length ? list.filter((r) => test(r.bought.length)).length / list.length : 0);
  const early = playthroughs.flatMap((runs) => runs.slice(0, Math.ceil(runs.length * (1 - LAST_STRETCH))).filter((r) => r.cheapest !== null));
  const sprees = playthroughs.map((runs) => Math.max(...runs.map((r) => r.bought.length)));
  return {
    none: share(counted, (b) => b === 0),
    one: share(counted, (b) => b === 1),
    few: share(counted, (b) => b >= 2 && b <= 4),
    many: share(counted, (b) => b >= 5),
    manyEarly: share(early, (b) => b >= 5),
    spree: sprees.reduce((a, b) => a + b, 0) / sprees.length,
  };
}

// Many playthroughs of one shopper and player: how long they take, and how
// often a run (with that playthrough's luck) can't buy anything.
export function spread(shopperName, player, seeds) {
  const plays = Array.from({ length: seeds }, (_, i) => playthrough(shopperName, player, i + 1));
  const minutes = plays.map((p) => p.runs.at(-1).minutes).sort((a, b) => a - b);
  const runs = plays.map((p) => p.runs.length).sort((a, b) => a - b);
  const allRuns = plays.flatMap((p) => p.runs).filter((r) => r.cheapest !== null);
  return {
    minutes: { mean: minutes.reduce((a, b) => a + b, 0) / seeds, p10: percentile(minutes, 0.1), p90: percentile(minutes, 0.9), all: minutes },
    runs: { median: percentile(runs, 0.5) },
    unfinished: plays.filter((p) => p.runs.at(-1).ending !== "boss").length,
    buysNothing: allRuns.filter((r) => r.gold < r.cheapest).length / allRuns.length,
    maxBuys: Math.max(...plays.flatMap((p) => p.runs.map((r) => r.bought.length))),
    rhythm: rhythm(plays.map((p) => p.runs)),
  };
}

function summarize(shopperName, path, typical, efficient) {
  const last = path.runs.at(-1);
  const check = golden(path.runs);
  const ratio = (r) => fmt(r.gold / r.cheapest, 2);
  // Levels of this depth's nodes, and of deeper ones bought early.
  const levelsOf = (test) => Object.entries(path.levels).reduce((sum, [id, l]) => {
    const node = BALANCE.tree.find((n) => n.id === id);
    return sum + (!node.owned && test(node.depth ?? 1) ? l : 0);
  }, 0);
  const boughtLevels = levelsOf((depth) => depth <= DEPTH);
  const earlyLevels = levelsOf((depth) => depth > DEPTH);
  const allLevels = BALANCE.tree.filter((n) => !n.owned && (n.depth ?? 1) <= DEPTH).reduce((sum, n) => sum + n.levels, 0);
  const span = (s) => `${fmt(s.minutes.mean, 1)} min on average (10% of players faster than ${fmt(s.minutes.p10, 1)}, 10% slower than ${fmt(s.minutes.p90, 1)}), ${s.runs.median} runs`
    + (s.unfinished ? `, ${s.unfinished} NEVER beat the boss` : "");
  const lines = [
    `=== ${shopperName} shopper ===`,
    `  typical player:   ${span(typical)}  [target ${TARGET_MINUTES}]`,
    `  efficient player: ${span(efficient)}`,
    `  golden rule (efficient player, median luck): ${last.ending === "boss" ? "" : "NEVER beat the boss; "}`
      + (check.broken.length
        ? `BROKEN in ${check.broken.length} runs (first: run ${check.broken[0].n} earned ${check.broken[0].gold}, cheapest was ${check.broken[0].cheapest})`
        : `held in all ${path.runs.length} runs`)
      + (check.closest ? `; closest: run ${check.closest.n} earned ${check.closest.gold} = ${ratio(check.closest)}x the cheapest (${check.closest.cheapest})` : ""),
  ];
  if (check.thin.length) lines.push(`  thin margin (under ${MARGIN}x) in runs ${check.thin.map((r) => r.n).join(", ")}`);
  lines.push(`  runs that buy nothing, with real luck: ${fmt(100 * typical.buysNothing)}% (typical player), ${fmt(100 * efficient.buysNothing)}% (efficient)`);
  const beat = (r) => `${fmt(100 * r.none)}% none, ${fmt(100 * r.one)}% one, ${fmt(100 * r.few)}% 2-4, ${fmt(100 * r.many)}% 5+`
    + ` (5+ before the last stretch: ${fmt(100 * r.manyEarly)}%; biggest spree ${fmt(r.spree, 1)} on average, ${typical.maxBuys} at most)`;
  lines.push(`  upgrades bought per run (typical player): ${beat(typical.rhythm)}`);
  lines.push(`  first run: reached ${fmt(path.runs[0].deepest, 1)}, earned ${path.runs[0].gold} gold, bought ${path.runs[0].bought.join(", ") || "nothing"}`);
  lines.push(`  tree bought when the boss fell: ${boughtLevels} of ${allLevels} levels`
    + (earlyLevels ? `, plus ${earlyLevels} of the next depth's, bought early` : ""));
  const stuck = walls(path.runs);
  lines.push(stuck.length
    ? `  walls: ${stuck.map((w) => `runs ${w.from}-${w.to} ${w.open ? "still stuck at the end" : "stuck"} at ${fmt(w.at, 1)} (${fmt(w.minutes, 1)} min)`).join("; ")}`
    : "  walls: none longer than 3 runs");
  const unbought = BALANCE.tree.filter((n) => (n.depth ?? 1) <= DEPTH && (path.levels[n.id] ?? 0) === 0).map((n) => n.name);
  if (unbought.length) lines.push(`  never bought: ${unbought.join(", ")}`);
  return lines.join("\n");
}

function runTable(runs) {
  return runs.map((r) =>
    `  ${String(r.n).padStart(3)}  ${fmt(r.minutes, 1).padStart(5)} min  deepest ${fmt(r.deepest, 2).padStart(5)}  ${r.ending.padEnd(4)}  `
    + `+${String(r.gold).padStart(4)} gold  ${r.cheapest !== null && r.gold < r.cheapest ? "!" : " "} bought: ${r.bought.join(", ") || "-"}`).join("\n");
}

// Only when it's run from the command line (other scripts can import the
// functions above without printing anything).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));

function main(args) {
  const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
  const seeds = Number(option("--seeds", 100));
  const results = Object.keys(SHOPPERS).map((shopper) => ({
    shopper,
    path: goldenPath(shopper),
    typical: spread(shopper, PLAYERS.typical, seeds),
    efficient: spread(shopper, PLAYERS.efficient, seeds),
  }));
  for (const r of results) {
    console.log(summarize(r.shopper, r.path, r.typical, r.efficient));
    if (args.includes("--runs")) console.log(`  the golden-rule path, run by run:\n${runTable(r.path.runs)}`);
    console.log();
  }
  const file = option("--json", null);
  if (file) {
    writeFileSync(file, JSON.stringify(results, null, 1));
    console.log(`saved ${file}`);
  }
  // Exit with an error if the golden rule broke, so it can't be missed.
  if (results.some((r) => golden(r.path.runs).broken.length)) process.exitCode = 1;
}
