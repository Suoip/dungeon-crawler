// Crafting, for the pacing simulator (tools/simulate.mjs): a player who
// picks up parts and runes as they drop, keeps the forge busy, wears the
// best piece in each slot, sells the spares at the merchant, and enchants
// what he's wearing. It plays by the game's own rules and numbers (balance.js
// crafting, src/crafting.js), with the dice instead of Math.random:
//
//   Parts and runes drop from a run's kills (balance.js drops), and a beaten
//   boss always drops its own part.
//   The forge and the merchant work while the game is open: all through each
//   run and the time in the underworld after it (MODEL.hubPerRun). Nothing
//   happens between sessions, and the simulated player never takes a break.
//   In the underworld he wears the piece worth most in each slot (the game's
//   own price, which is how good its bonuses rolled), puts every rune into
//   the piece he's wearing in the rune's slot (a failed enchant only loses
//   the rune), sets the spares on the counter (the best first), and fills
//   the forge, the best recipe he can make first. Until he's made a slot's
//   best piece, he keeps back the parts it takes: it needs the boss's part,
//   and once the boss is beaten he won't be back for more.
//   His gold (the user's choice, 2026-10-28): a forge, merchant or rune table
//   upgrade is bought when it costs less than his last run earned; the next
//   recipe he doesn't know is learned once he can afford it, and when it's
//   within a few runs' gold he saves up for it, skipping the tree meanwhile.
//   A slot's best recipe takes its boss's part, so he only learns it once
//   that boss is beaten.

import { BALANCE } from "../src/balance.js";
import { withGear } from "../src/stats.js";
import { RECIPES, recipeOf, priceOf, workshop, levelOf } from "../src/crafting.js";
import { MODEL } from "./model.mjs";

const { crafting, drops } = BALANCE;
const UPGRADES = [...crafting.upgrades.forge, ...crafting.upgrades.merchant, ...crafting.upgrades.runes];
const SAVE_RUNS = 4;  // he saves up for a recipe that's within this many runs' gold
const CHEST = 40;     // spares kept waiting for the counter (the cheapest past this are let go, to keep it quick)

// A new game's crafting: nothing found, made or learned yet. `dice` rolls
// the drops, the pieces and the enchants.
export function newCrafter(dice) {
  return { dice, parts: {}, workshop: {}, chest: [], worn: {}, forge: [], counter: [], cleared: 0, nextId: 1, sold: 0, made: new Set() };
}

// The hero's stats with the gear he's wearing on top (stats.js withGear).
// `crafter` can be null: no crafting at all.
export const wornGear = (crafter) => (crafter ? Object.values(crafter.worn) : []);
export const geared = (stats, crafter) => withGear(stats, wornGear(crafter));

const known = (crafter, recipe) => !recipe.learn || crafter.workshop[`recipe:${recipe.id}`] > 0;
const open = (crafter, recipe) => recipe.depth <= crafter.cleared + 1;
const add = (crafter, part, count) => count && (crafter.parts[part] = (crafter.parts[part] ?? 0) + count);
// How many of `count` tries come up, each with chance `p`.
function tries(dice, count, p) {
  let hits = 0;
  for (let i = 0; i < count; i++) if (dice() < p) hits++;
  return hits;
}

// A finished piece's bonuses (crafting.js rollBonuses, with the dice).
function roll(crafter, recipe, shop) {
  const { dice } = crafter;
  const kinds = Object.keys(crafting.bonuses);
  const [fewest, most] = recipe.bonuses;
  const count = fewest + Math.floor(dice() * (most - fewest + 1));
  const bonuses = {};
  while (Object.keys(bonuses).length < count) {
    const kind = kinds[Math.floor(dice() * kinds.length)];
    if (kind in bonuses) continue;
    const [small, big] = recipe.size;
    const best = Math.max(...Array.from({ length: shop.rolls }, dice));
    bonuses[kind] = Math.max(1, Math.round((small + best * (big - small)) * (crafting.bonuses[kind].scale ?? 1) * 100)) / 100;
  }
  return { id: crafter.nextId++, recipe: recipe.id, bonuses };
}

// `seconds` with the game open: the forge works through its queue (each
// anvil on one piece) and the merchant sells everything on the counter at
// once (save.js workForge, workCounter). Returns the gold the sales made.
function work(crafter, seconds, shop) {
  let forging = seconds / shop.forgeTime;
  while (crafter.forge.length && forging > 0) {
    const working = crafter.forge.slice(0, shop.anvils);
    const spent = Math.min(forging, ...working.map((job) => job.left));
    for (const job of working) job.left -= spent;
    forging -= spent;
    const done = working.filter((job) => job.left <= 0);
    if (!done.length) break;
    crafter.forge = crafter.forge.filter((job) => !done.includes(job));
    for (const job of done) crafter.chest.push(roll(crafter, recipeOf(job.recipe), shop));
  }
  let gold = 0;
  for (const sale of crafter.counter) sale.left -= seconds / shop.sellTime;
  for (const sale of crafter.counter.filter((s) => s.left <= 0)) gold += Math.round(sale.price * shop.haggle);
  crafter.counter = crafter.counter.filter((sale) => sale.left > 0);
  crafter.sold += gold;
  return gold;
}

// After a run in `depth` (its result from simulateRun): the forge and the
// merchant work through it and the time in the underworld, its parts and
// runes are banked, and he sees to his gear. Returns the gold the merchant
// made meanwhile.
export function afterRun(crafter, run, depth) {
  const { dice } = crafter;
  const shop = workshop(crafter.workshop);
  const gold = work(crafter, run.wall + MODEL.hubPerRun, shop);
  const D = BALANCE.depths[depth - 1];
  for (const [type, count] of Object.entries(run.kills ?? {})) {
    if (D.parts[type]) add(crafter, D.parts[type], tries(dice, count, drops.part.chance));
    add(crafter, D.rune, tries(dice, count, drops.rune.chance * shop.runeChance));
  }
  if (run.ending === "boss") {
    add(crafter, D.parts[D.boss.type], 1);
    add(crafter, D.rune, tries(dice, 1, drops.rune.boss * shop.runeChance));
    crafter.cleared = Math.max(crafter.cleared, depth);
  }

  // The best piece in each slot goes on; the others are spares.
  for (const piece of crafter.chest.splice(0)) {
    const slot = recipeOf(piece.recipe).slot;
    const worn = crafter.worn[slot];
    if (!worn || priceOf(piece) > priceOf(worn)) {
      if (worn) crafter.chest.push(worn);
      crafter.worn[slot] = piece;
    } else crafter.chest.push(piece);
  }
  // Every rune goes into the piece worn in its slot.
  for (const piece of Object.values(crafter.worn)) {
    const rune = BALANCE.depths[recipeOf(piece.recipe).depth - 1].rune;
    while ((crafter.parts[rune] ?? 0) > 0 && levelOf(piece) < crafting.enchant.most) {
      crafter.parts[rune]--;
      if (dice() < Math.min(1, crafting.enchant.odds[levelOf(piece)] + shop.luck)) piece.level = levelOf(piece) + 1;
    }
  }
  // The spares, the best first, onto the counter while there's room.
  crafter.chest.sort((a, b) => priceOf(b) - priceOf(a));
  while (crafter.chest.length && crafter.counter.length < shop.counter) {
    const piece = crafter.chest.shift();
    crafter.counter.push({ price: priceOf(piece), left: recipeOf(piece.recipe).sells });
  }
  crafter.chest.length = Math.min(crafter.chest.length, CHEST);
  // The forge filled: the best recipe he knows and has the parts for (a
  // lesser one only out of the parts not kept back).
  while (crafter.forge.length < shop.anvils + crafting.queue) {
    const kept = {};
    for (const best of RECIPES.filter((r) => r.tier === crafting.tiers.length - 1 && open(crafter, r) && !crafter.made.has(r.id))) {
      for (const [part, n] of Object.entries(best.parts)) kept[part] = (kept[part] ?? 0) + n;
    }
    const enough = (r) => Object.entries(r.parts).every(([part, n]) =>
      (crafter.parts[part] ?? 0) - (r.tier === crafting.tiers.length - 1 ? 0 : kept[part] ?? 0) >= n);
    const recipe = RECIPES.filter((r) => known(crafter, r) && open(crafter, r) && enough(r)).sort((a, b) => b.tier - a.tier || b.depth - a.depth)[0];
    if (!recipe) break;
    for (const [part, n] of Object.entries(recipe.parts)) crafter.parts[part] -= n;
    crafter.forge.push({ recipe: recipe.id, left: recipe.time });
    crafter.made.add(recipe.id);
  }
  return gold;
}

// His crafting purchases, out of `bank`, after a run that earned `runGold`:
// upgrades that cost under a run's gold, and recipes. Returns the gold spent,
// and whether he's saving up for a recipe (then he leaves the tree alone).
export function spend(crafter, bank, runGold) {
  let spent = 0;
  for (const upgrade of UPGRADES) {
    for (let cost = upgrade.costs[crafter.workshop[upgrade.id] ?? 0]; cost !== undefined && cost <= runGold && cost <= bank - spent;
      cost = upgrade.costs[crafter.workshop[upgrade.id]]) {
      spent += cost;
      crafter.workshop[upgrade.id] = (crafter.workshop[upgrade.id] ?? 0) + 1;
    }
  }
  const nextRecipe = () => RECIPES
    .filter((r) => !known(crafter, r) && open(crafter, r) && (r.tier < 2 || r.depth <= crafter.cleared))
    .sort((a, b) => a.learn - b.learn)[0];
  let next = nextRecipe();
  while (next && next.learn <= bank - spent) {
    spent += next.learn;
    crafter.workshop[`recipe:${next.id}`] = 1;
    next = nextRecipe();
  }
  return { spent, saving: !!next && next.learn <= bank - spent + SAVE_RUNS * runGold };
}

// What he's wearing, for the report: "Zombie crown +2 (DAMAGE +30%, GOLD +19%)".
export const describe = (crafter) => Object.values(crafter.worn).map((piece) => {
  const boost = 1 + crafting.enchant.per * levelOf(piece);
  const bonuses = Object.entries(piece.bonuses).map(([kind, size]) => `${crafting.bonuses[kind].name} +${Math.round(size * boost * 100)}%`);
  return `${recipeOf(piece.recipe).name}${levelOf(piece) ? ` +${levelOf(piece)}` : ""} (${bonuses.join(", ")})`;
});
