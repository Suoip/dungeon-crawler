import { BALANCE } from "./balance.js";
import { byId } from "./nodes.js";

// The skill tree's rules, shared by the game and the pacing simulator
// (tools/model.mjs), so the two can never disagree about what an upgrade
// does or what it costs.

// What the hero is like with these upgrades, in a run in `depth`. `levels`
// is { nodeId: level } (see save.js; every node has one level). Every node's
// effect is applied once per level bought, except a `perDepth` node's
// outside its own depth.
export function heroStats(levels, depth = 1) {
  const { hero, run, drops, spawning } = BALANCE;
  const stats = {
    hearts: hero.hearts,
    damage: hero.damage,
    swingEvery: hero.swingEvery,
    reach: hero.reach,
    arc: hero.arc,
    invincibleFor: hero.invincibleFor,
    critChance: hero.critChance,
    critDamage: hero.critDamage,
    magnetRange: hero.magnetRange,
    startTime: run.startTime,
    timePerSubDepth: 0,
    heartChance: drops.heart.chance,
    timeOrbChance: drops.timeOrb.chance,
    timeOrbSeconds: drops.timeOrb.seconds,
    dashCooldown: hero.dash.cooldown,
    dashCharges: 1,
    goldBonus: 0,
    goldPerKill: 0,      // flat gold on every kill, in the room's gold (scenes.js)
    timePerKill: 0,      // seconds every kill adds to the clock
    healOnClear: 0,      // the chance of a heart back when a room's bar fills
    breakableBonus: 0,
    onEnter: spawning.onEnter,
    horde: spawning.horde,
    hordeEvery: spawning.hordeEvery,
    deathCall: 0,
    xpBonus: 0,
    unlocked: new Set(),
  };
  for (const [id, level] of Object.entries(levels)) {
    const node = byId[id];
    if (!node) continue; // a node the map doesn't have (any more)
    if (node.perDepth && node.depth !== depth) continue; // it only works in its own depth
    for (let i = 0; i < level; i++) {
      const { stat, add, mul, unlock } = node.effect;
      if (unlock) stats.unlocked.add(unlock);
      else if (add !== undefined) stats[stat] += add;
      else stats[stat] *= mul;
    }
  }
  stats.hordeEvery = Math.max(spawning.hordeEveryAtLeast, stats.hordeEvery);
  return stats;
}

// What level `level` (counting from 0) of a node costs (nodes.js works out
// each node's price), rounded to a tidy number: whole gold under 100, then
// two significant figures (130, 2100...).
// `early`: it's for a depth not reached yet, so it costs BALANCE.earlyPrice
// times as much.
export function costOf(node, level, early = false) {
  const raw = node.cost * node.growth ** level * (early ? BALANCE.earlyPrice : 1);
  if (raw < 100) return Math.round(raw);
  const step = 10 ** (Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / step) * step;
}

// Whether a node is for a depth not reached yet, with `cleared` depths
// beaten so far (save.js): depth 2's nodes, until depth 1's boss falls.
export const isEarly = (node, cleared) => node.depth > cleared + 1;

// How much tougher and richer monsters and breakables are in sub-depth `sub`
// (1 to 10) of `depth`: grown by the sub-depth (balance.js `growth`, or the
// depth's own), times the depth's own `scale`.
export const roomScale = (depth, sub) => {
  const { scale, growth: own } = BALANCE.depths[depth - 1];
  const growth = { ...BALANCE.growth, ...own };
  return {
    hp: scale.hp * growth.hp ** (sub - 1),
    gold: scale.gold * growth.gold ** (sub - 1),
  };
};

// The game drops whole coins: gold is rounded to the nearest coin, at least 1.
export const coins = (gold) => Math.max(1, Math.round(gold));
