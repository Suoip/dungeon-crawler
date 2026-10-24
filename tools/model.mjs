// The model behind the pacing simulator: what a player gets done in one run,
// given the numbers in src/balance.js and the upgrades they've bought. It
// isn't the game: there's no map and no movement. It steps through each room
// one swing at a time, keeping count of the monsters that are rising and the
// ones up close, and rolls dice for luck: who spawns, when a hit lands (a
// hit costs a whole heart), and what drops. That's why it can play the whole
// game hundreds of times in minutes.
//
// Its guesses about players (how long walking takes, how many monsters one
// swing hits in a crowd) are in MODEL and PLAYERS below, kept apart from the
// game's own numbers, so they can be checked against real play-testing.

import { BALANCE } from "../src/balance.js";
import { heroStats, costOf, roomScale, coins } from "../src/stats.js";
import { MOB_TYPES } from "../src/mobs.js";

export { heroStats, costOf }; // the tree's rules live in the game (src/stats.js)

export const MODEL = {
  riseTime: 1.05,       // seconds a spawned monster spends rising (dust 0.8 s, then 0.25 s popping up)
  dustTime: 0.8,        // the warning dust part of that: a full bar cancels a spawn that's still in it
  bossEntrance: 2.7,    // from the full bar to the hero moving again: the crumble, the rise, the roar (3.0 s with the shove)
  approach: 1.2,        // seconds until a risen monster is up close, at the starting reach
  // Wanderers (balance.js `wanders`), measured against a bot playing room 1
  // in the game (seconds per slug with 1-hit and 3-hit slugs, at three swing
  // speeds and a longer reach, all within about 5%):
  wanderWalk: 1.0,      // seconds walking over to one, on average (reach hardly matters)...
  wanderSpread: 0.5,    // ...give or take this share (where it rose, which way it crawled)
  wanderNearest: 0,     // ...times (how many are about)^-this: with more about, the nearest is closer (the fit didn't need it)
  wanderDrift: 0.15,    // while he's fighting, the chance per swing, for each one about, that it crawls into his swing too
  doorWalk: 2.0,        // walking to the door once the bar is full
  collectPerRoom: 1.2,  // gathering the room's coins on the way, with the starting magnet
  perBreakable: 0.5,    // walking over to a breakable (on top of the swings it takes)
  cutscenePerRoom: 2.0, // through the door, the fade, and falling into the next room
  stamp: 0.5,           // s to walk over and stamp a grave flat (the crypt, graves.js)
  chase: 1.0,           // s spent chasing a coin thief (the warrens, thieves.js)...
  caught: 0.6,          // ...and the share of them he catches before they reach a burrow
  drumDanger: 0.5,      // while the fort's drums beat he keeps away from the orcs: this share of their danger is left...
  arrowThreat: 0.004,   // ...and the fort's arrows (stepping on a plate in the fight) add this danger, a special hit
  wet: 0.35,            // the share of his walking done in the swamp's water (it rises as the room goes on)
  hubPerRun: 12,        // after a run: dragged down, the underworld, the tree, the ladder, the fall
  dodgeTime: 1.3,       // only 1 in this many swings lands on the boss: the rest of the time you're dodging
  bossRaiseEvery: 6.5,  // seconds between the boss's raises when raising is its favorite move (boss.js: a cast every 1.5-3 s, raising half the time); other bosses raise half as often
  bossFightLimit: 600,  // a boss fight that lasts longer than this counts as one you can't win yet
  // The swing aims at the nearest one and is narrow, and chasers spread out
  // round him (measured in the game, 60° and 22 px: about 1, 1.1, 1.3 and
  // 1.5 hits a swing with 1, 2, 4 and 6 on him):
  hitsPerSwing: 1.0,    // monsters one swing hits, on average, with one or two up close
  crowd: 0.1,           // each more monster up close adds this share to the monsters a swing hits...
  crowdCap: 4,          // ...up to this many, at the starting reach and arc
  // A swing only comes when one is in reach, and a hit knocks it back a
  // little, so with only one or two on him some swings never come (measured:
  // 66% of the timer's swings with one, 83% with two, 93-97% with more).
  landAlone: 0.66,      // the share of swings that come with one up close...
  landStep: 0.17,       // ...this much more for each more one...
  landMost: 0.95,       // ...up to this
  // The hammer (hammer.js): he steers its zone onto the ones up close this
  // often, and it catches this many of them (more with Bigger head, and in a crowd).
  hammerLands: 0.6,
  hammerHits: 1.5,
  // The boomerang (boomerang.js): a throw's flight there and back takes
  // about this long, and it passes through this many of the ones up close
  // (each twice: out and back).
  rangFlight: 1.0,
  rangHits: 1.5,
  dashSafety: 0.8,      // having a dash at all leaves this share of the danger...
  dashOverhead: 0.85,   // ...and this share of the walking time
  chargeSafety: 0.9,    // a second dash charge leaves this share of the danger
  raiseEvery: 6,        // seconds between a necromancer's raises (mobs.js: every 5-7 s)
  raiseMost: 4,         // ...while fewer than this many of its own are up
  fuse: 0.7,            // seconds from a wogol getting close to it going off (mobs.js)
  keeperAfter: 2,       // seconds a monster that keeps its distance is up before he goes after it with others on him...
  keeperClose: 2,       // ...or right away, with at most this many on him
  healEvery: 4.85,      // seconds between a shaman's pulses (mobs.js HEAL: every 3.5-5 s, plus the 0.6 s wind-up)
  healReach: 0.4,       // the share of pulses that reach a monster fighting him (a 60 px pulse, the shaman ~80 px off): a guess
  mudLife: 4,           // seconds a muddy's mud lasts after it was last up (mobs.js MUD.life)
};

// The deeper depths' monsters, played roughly. Their real behaviors are in
// src/mobs.js; these are guesses, to be checked by playing:
//   walk    it keeps its distance, so he has to go after it: like walking
//           over to a wanderer, but this many times as long, and it never
//           wanders into his swing on its own. He goes after it even with
//           others on him (keeperAfter, keeperClose), and once he's there it's
//           the one his swings hit first (imps, shamans, necromancers,
//           plague doctors)
//   ranged  its `threat` counts while it's up anywhere, not just up close:
//           it throws things at him from where it stands
//   tough   it takes this many times the swings (a masked orc's shield takes
//           most of the hits from the front)
//   heals   each of a shaman's pulses that reaches a monster fighting him
//           (healEvery, healReach) gives back this share of its health; a
//           monster that dies to its first hit never gets healed
//   raises  while one is up, it raises two of these every `raiseEvery`
//           seconds (a necromancer's ice zombies)
//   slows   for mudLife seconds after one was last up, his walking takes
//           this many times as long (a muddy's mud)
//   blast   when it goes off (its fuse runs out up close, or it's beaten),
//           the chance it catches him, before his danger and the dash. One
//           that goes off by itself is gone, with no gold or XP (a wogol)
export const BEHAVIORS = {
  imp: { walk: 1.6, ranged: true },
  orc_shaman: { walk: 1.6, heals: 0.3 },
  masked_orc: { tough: 1.8 },
  muddy: { slows: 1.25 },
  necromancer: { walk: 1.6, raises: "ice_zombie" },
  doc: { walk: 1.6, ranged: true },
  wogol: { blast: 0.35 },
};
const behavior = (type) => BEHAVIORS[type] ?? {};
// Whether he has to walk over to it: a wanderer, or one that keeps away.
const walkedTo = (type) => BALANCE.mobs[type].wanders || !!behavior(type).walk;

// Two kinds of player. The ~40 minutes per depth are aimed at the typical one
// (DESIGN.md section 8); the golden rule is checked with the efficient one.
//   clearTime  how much more time everything takes them (lost swings, walking)
//   gold       the share of a room's coins they pick up before leaving it
//   danger     how much more often they get hit
export const PLAYERS = {
  efficient: { clearTime: 1, gold: 1, danger: 1 },
  typical: { clearTime: 1.2, gold: 0.9, danger: 1.3 },
};

// ---- Dice --------------------------------------------------------------------

// A small random number generator that can be started from a seed
// (mulberry32), so the same seed always rolls the same dice. That makes a
// simulation repeatable: change one number and the difference you see comes
// from that number, not from luck.
export function makeDice(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- The hero in a fight ---------------------------------------------------------

// How many of the `close` monsters one swing hits, on average: more in a
// crowd, more with reach and arc, but never more than the swing can cover.
function hitsPerSwing(stats, close) {
  const reach = stats.reach / BALANCE.hero.reach;
  const arc = stats.arc / BALANCE.hero.arc;
  const base = MODEL.hitsPerSwing + 0.6 * (reach - 1) + 0.6 * (arc - 1);
  const cap = MODEL.crowdCap * reach * reach * arc;
  return Math.min(close, base * (1 + MODEL.crowd * (close - 1)), cap);
}

// How much of the danger is left after the dash (1 = all of it). The dash
// doesn't make you invincible, but it gets you out of the way.
function safety(stats) {
  if (!stats.unlocked.has("dash")) return 1;
  const quicker = (stats.dashCooldown / BALANCE.hero.dash.cooldown) ** 0.3;
  return MODEL.dashSafety * quicker * (stats.dashCharges > 1 ? MODEL.chargeSafety : 1);
}

// How much of the walking time is left with the dash (1 = all of it).
function walking(stats) {
  if (!stats.unlocked.has("dash")) return 1;
  const quicker = (stats.dashCooldown / BALANCE.hero.dash.cooldown) ** 0.3;
  return MODEL.dashOverhead * quicker * (stats.dashCharges > 1 ? 0.95 : 1);
}

// Picks a monster type from a room's `spawns` (weights), with the dice.
function pick(spawns, dice) {
  const entries = Object.entries(spawns);
  let roll = dice() * entries.reduce((sum, [, w]) => sum + w, 0);
  for (const [type, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return type;
  }
  return entries.at(-1)[0];
}

// ---- One run -----------------------------------------------------------------

// One run from sub-depth 1 of `depth` with these stats (heroStats for that
// depth), rolled with `dice`: rooms in order until the clock runs out, the
// last heart is lost, or the boss is beaten.
//   deepest  how far it got: 3.4 = cleared 3 rooms and 40% of the 4th's bar
//   ending   "time", "died", "boss" (the boss was beaten) or "stuck" (a boss
//            fight that can't be won yet)
//   gold     whole coins earned. When a run ends, every coin still on the
//            floor is collected (DESIGN.md section 6); coins a typical player
//            leaves behind in an earlier room are lost.
//   wall     real-world seconds it took (with cutscenes, without the hub)
export function simulateRun(stats, dice, player = PLAYERS.efficient, depth = 1) {
  const DEPTH = BALANCE.depths[depth - 1];
  const SPECIAL = BALANCE.hits.special[depth - 1]; // hearts a special attack costs
  // A boss that favors raising raises every bossRaiseEvery s; the others pick
  // it half as often (boss.js pickMove).
  const bossRaiseEvery = MODEL.bossRaiseEvery * (MOB_TYPES[DEPTH.boss.type].favorite === "spawn" ? 1 : 2);
  const { step } = BALANCE.drops.heart;
  let walk = walking(stats);
  const danger = safety(stats) * player.danger;
  // The swing is on a timer (combat.js): nobody swings faster, a slower
  // player just wastes some.
  const swing = stats.swingEvery * Math.max(1, player.clearTime); // seconds between swings that count
  // The average hit on a monster: a critical hit does critDamage times as
  // much (combat.js). Breakables and chests never take critical hits.
  let hit = stats.damage * (1 + stats.critChance * (stats.critDamage - 1));
  // The pit's pacts (pacts.js): what his hits cost on top, and what dropped gold is multiplied by.
  let pactTouch = 0, pactSpecial = 0, pactGold = 1;
  const orbs = stats.unlocked.has("timeOrbs");
  let clock = stats.startTime; // seconds left on the run's clock
  let hearts = stats.hearts;
  let dryKills = 0;            // kills in a row without a heart (the bad-luck counter)
  let wall = 0;
  let gold = 0;

  for (let sub = 1; sub <= 10; sub++) {
    // The pit offers its cards: he takes the mildest, and of those, the
    // curse that hurts least (slower, then harder hits, tougher, weaker).
    if (DEPTH.pacts) {
      const P = DEPTH.pacts;
      const tiers = Object.keys(P.tierWeights);
      const total = tiers.reduce((sum, k) => sum + P.tierWeights[k], 0);
      const tierOf = () => { let r = dice() * total; for (const k of tiers) if ((r -= P.tierWeights[k]) <= 0) return k; return tiers.at(-1); };
      const kinds = ["weaker", "slower", "tougher", "harder"].sort(() => dice() - 0.5).slice(0, 3);
      const offered = kinds.map((kind) => ({ kind, tier: tierOf() }));
      const order = ["slower", "harder", "tougher", "weaker"];
      offered.sort((a, b) => tiers.indexOf(a.tier) - tiers.indexOf(b.tier) || order.indexOf(a.kind) - order.indexOf(b.kind));
      const { kind, tier } = offered[0];
      const x = P[kind][tier];
      if (kind === "weaker") hit *= 1 - x;
      if (kind === "tougher") hit /= 1 + x;
      if (kind === "slower") walk /= 1 - x;
      if (kind === "harder") { pactTouch += x[0]; pactSpecial += x[1]; }
      pactGold += P.gold[tier];
    }
    const room = DEPTH.rooms[sub - 1];
    const scale = roomScale(depth, sub);
    const isBossRoom = sub === 10;
    let t = 0;              // seconds since landing in this room
    let xp = 0;
    let full = false;       // the bar is full: spawning has stopped
    let leaveAt = Infinity; // when he's out of the door (once the bar is full)
    let clockStopped = false;
    let boss = null;        // { left, nextRaise } once it has appeared
    let roomGold = 0;
    let invincibleUntil = 0;
    const rising = [];      // { at, type }: spawned, not up close yet, in the order they arrive
    let close = [];         // { left, type, fuseAt }: up close, being fought; `left` = swings to beat it
    let nextRaise = Infinity; // when the necromancers about raise their next ice zombies
    const breakables = (room.breakables ?? []).map((name) => ({ name, left: null }));
    let nextHorde = stats.hordeEvery;
    const hammer = stats.unlocked.has("hammer");
    const lightning = stats.unlocked.has("lightning");
    const boomerang = stats.unlocked.has("boomerang");
    let nextThrow = 0;
    // A charged one is beaten: lightning jumps through the ones up close
    // (and a charged one it beats sets off its own).
    const zap = () => {
      const blow = stats.lightningDamage / hit; // in swings
      const reached = Math.min(close.length, stats.lightningJumps);
      const beaten = [];
      for (let i = 0; i < reached; i++) if ((close[i].left -= blow) <= 0) beaten.push(close[i]);
      if (!beaten.length) return;
      close = close.filter((mob) => mob.left > 0);
      for (const { type } of beaten) kill(type);
    };
    let nextHammer = stats.hammerEvery;

    // The rise is the game's own animation; only getting to the monster takes a typical player longer.
    const approach = MODEL.approach * (BALANCE.hero.reach / stats.reach) * walk * player.clearTime;
    const arriveIn = MODEL.riseTime + approach;
    // A chaser comes to him. A wanderer, or a monster that keeps its distance,
    // doesn't: once it's up, it waits (`waiting`) until he walks over to it,
    // one at a time. He walks to a wanderer when nothing else is on him; he
    // goes after one that keeps its distance even with others on him.
    const arriveOf = (type) => (walkedTo(type) ? MODEL.riseTime : arriveIn);
    const wanderWalk = MODEL.wanderWalk * walk * player.clearTime;
    const waiting = [];     // { type, upAt }: walked-to monsters up, in the order they got up
    // The monsters up (close or waiting) with a behavior, counted.
    const up = (test) => close.filter((m) => test(behavior(m.type))).length + waiting.filter((m) => test(behavior(m.type))).length;
    // Mud: for a while after a muddy was last up, walking takes longer. So
    // does the swamp's water, for the share of the walking done in it.
    let mudUntil = -Infinity;
    const wading = DEPTH.water ? 1 - MODEL.wet + MODEL.wet / (DEPTH.water.slow + stats.waders) : 1;
    const mud = () => (t < mudUntil ? BEHAVIORS.muddy.slows : 1) * wading;
    // The danger right now: everything up close, plus the ones that throw
    // things from wherever they are.
    const rangedNow = () => [...close, ...waiting].reduce((sum, m) => sum + (behavior(m.type).ranged ? BALANCE.mobs[m.type].threat : 0), 0);
    const threatNow = () => close.reduce((sum, m) => sum + (behavior(m.type).ranged ? 0 : BALANCE.mobs[m.type].threat), 0)
      + [...close, ...waiting].reduce((sum, m) => sum + (behavior(m.type).ranged ? BALANCE.mobs[m.type].threat : 0), 0);
    let walk2 = null;       // { from, need }: the walk to the next one, once he's on his way
    const spawn = (count, type = null) => {
      // `born`: when its warning dust starts.
      for (let i = 0; i < count; i++) {
        const kind = type ?? pick(room.spawns, dice);
        rising.push({ at: t + arriveOf(kind) + 0.1 * i, born: t + 0.1 * i, type: kind });
      }
      rising.sort((a, b) => a.at - b.at); // they arrive in order of when they get close
    };
    // Swings to beat one: more behind a shield, and more while shamans heal
    // it. A pulse only heals a monster that's been hit and is still up, so a
    // one-hit kill never is.
    const roll = (v) => Math.floor(v) + (dice() < v % 1 ? 1 : 0); // rounds at random, so a small chance stays small
    const swingsFor = (type) => {
      const x = ((BALANCE.mobs[type].hp * scale.hp) / hit) * (behavior(type).tough ?? 1);
      const base = Math.ceil(x);
      if (base <= 1 || behavior(type).heals) return base;
      const healers = Math.min(2, up((b) => b.heals));
      if (!healers) return base;
      const pulses = healers * (((base - 1) * swing) / MODEL.healEvery) * MODEL.healReach; // pulses that catch it hurt
      let extra = 0;
      for (let p = roll(pulses); p > 0; p--) extra += roll(BEHAVIORS.orc_shaman.heals * x);
      return base + extra;
    };
    // Up close. One he went after (it keeps its distance), or a wogol with
    // its fuse lit, is the one his swings hit first.
    const comeClose = (type, first = false) => {
      const mob = { left: swingsFor(type), type, fuseAt: behavior(type).blast ? t + MODEL.fuse : Infinity };
      if (first || mob.fuseAt !== Infinity) close.unshift(mob);
      else close.push(mob);
    };
    // A wogol goes off: a heart, unless he's still blinking from the last hit
    // or he gets out of the way. Returns true if that was his last heart.
    const blast = (type) => {
      if (t < invincibleUntil || dice() >= Math.min(1, behavior(type).blast * danger)) return false;
      hearts -= SPECIAL + pactSpecial; // a special attack (balance.js hits)
      invincibleUntil = t + stats.invincibleFor;
      return hearts <= 0;
    };
    const end = (ending, at) => {
      gold += roomGold; // the coins on the floor are collected as the run ends
      wall += at;
      const progress = isBossRoom && full ? 1 : Math.min(1, xp / room.xp);
      return { deepest: ending === "boss" ? 10 : sub - 1 + Math.min(progress, 0.999), ending, gold, wall };
    };
    // The bar fills: spawning stops at once, even for the monsters still on
    // their way up. In the boss room, the clock stops and the boss makes its
    // entrance: everything up close crumbles (its coins drop, but it isn't a
    // kill), and the hero can't touch the boss until it has roared. In the
    // others, the door opens and he heads for it.
    const fill = () => {
      full = true;
      if (hearts < stats.hearts && dice() < stats.healOnClear) hearts++; // heal on clear
      const crumbleCoins = (type) => coins(BALANCE.mobs[type].gold * scale.gold * (1 + stats.goldBonus));
      // Spawns still in their warning dust are cancelled; the rest are up.
      for (let i = rising.length - 1; i >= 0; i--) if (t - rising[i].born < MODEL.dustTime) rising.splice(i, 1);
      if (isBossRoom) {
        clockStopped = true;
        for (const { type } of close) roomGold += crumbleCoins(type);
        close = [];
        for (const { type } of waiting.splice(0)) roomGold += crumbleCoins(type);
        // The ones up but not close yet crumble too (with coins, once they've
        // finished popping up).
        for (const r of rising) if (t - r.born >= MODEL.riseTime) roomGold += crumbleCoins(r.type);
        rising.length = 0;
        rising.push({ at: t + MODEL.bossEntrance, type: "boss" });
      } else {
        const gather = MODEL.collectPerRoom * (BALANCE.hero.magnetRange / stats.magnetRange) ** 0.7;
        leaveAt = t + (MODEL.doorWalk + gather) * walk * player.clearTime * mud();
      }
    };
    const kill = (type) => {
      const def = BALANCE.mobs[type];
      xp += def.xp * (1 + stats.xpBonus);
      if (!full && xp >= room.xp) fill();
      roomGold += coins((def.gold + stats.goldPerKill) * scale.gold * (1 + stats.goldBonus) * pactGold); // flat gold per kill on top
      if (!clockStopped) clock += stats.timePerKill; // seconds per kill
      // The crypt's restless graves: he stamps each one flat (a short walk),
      // and Gravedigger pays for it.
      if (DEPTH.graves && !full && DEPTH.graves.types.includes(type) && dice() < DEPTH.graves.chance) {
        t += MODEL.stamp * walk * player.clearTime;
        roomGold += stats.graveGold ? coins(def.gold * scale.gold * stats.graveGold * (1 + stats.goldBonus)) : 0;
        if (!clockStopped) clock += stats.graveTime;
      }
      // The warrens' coin thieves: a thief makes off with about a kill's
      // coins. He chases it; caught, it drops double (more with Sticky
      // fingers), and the rest get away with the loot.
      if (DEPTH.thieves && type === DEPTH.thieves.type && dice() < DEPTH.thieves.chance) {
        t += MODEL.chase * walk * player.clearTime;
        const loot = coins(def.gold * scale.gold * (1 + stats.goldBonus));
        roomGold += dice() < MODEL.caught ? loot * (1 + stats.thiefBonus) : -loot;
      }
      // A splitter's children, right there (unless its kill just started the
      // boss's entrance, which cancels them; in the boss fight they come).
      if (boss || !(isBossRoom && full)) for (const child of def.splitsInto ?? []) comeClose(child);
      if (hearts < stats.hearts) {
        if (dice() < stats.heartChance + step * dryKills) {
          hearts++;
          dryKills = 0;
        } else dryKills++;
      }
      if (orbs && !clockStopped && dice() < stats.timeOrbChance) clock += stats.timeOrbSeconds;
      if (!full && stats.deathCall > 0 && dice() < stats.deathCall) spawn(1);
      if (lightning && dice() < stats.chargedChance) zap();
    };
    // A necromancer has come up: it starts raising soon.
    const arrive = (type) => {
      if (behavior(type).raises && nextRaise === Infinity) nextRaise = t + MODEL.raiseEvery / 2;
    };

    // A chest, sometimes (rooms 6-9): loot to smash like a breakable, or a
    // mimic that wakes as he gets to it and joins the fight.
    if (room.chest && dice() < room.chest.chance) {
      if (dice() < room.chest.mimic) rising.push({ at: arriveIn, born: -Infinity, type: "mimic" });
      else breakables.push({ name: "chest", left: null });
    }
    spawn(stats.onEnter);
    const drums = DEPTH.drums;
    const nextDrums = (from) => (drums ? from + drums.every[0] + dice() * (drums.every[1] - drums.every[0]) : Infinity);
    let drumsAt = nextDrums(t);
    const arrows = DEPTH.plates ? MODEL.arrowThreat : 0;
    while (true) {
      t += swing;
      if (t >= leaveAt && leaveAt <= clock) {
        t = leaveAt; // through the door
        break;
      }
      if (!clockStopped && t > clock) return end("time", clock);
      if (boss && t > MODEL.bossFightLimit) return end("stuck", t);

      // Monsters arrive, and hordes come on their timer.
      let arrived = 0;
      while (arrived < rising.length && rising[arrived].at <= t) {
        const { type, at } = rising[arrived++];
        if (type === "boss") boss = { left: Math.ceil(DEPTH.boss.hp / hit), nextRaise: t + bossRaiseEvery };
        else if (walkedTo(type)) waiting.push({ type, upAt: at });
        else comeClose(type);
        if (type !== "boss") arrive(type);
      }
      if (arrived) rising.splice(0, arrived);
      if (up((b) => b.slows)) mudUntil = t + MODEL.mudLife; // its mud lingers after it's gone
      while (!full && t >= nextHorde) {
        spawn(stats.horde);
        nextHorde += stats.hordeEvery;
      }
      // The boss raises 3 minions now and then, but not while more than one
      // is still up (boss.js).
      if (boss && t >= boss.nextRaise) {
        boss.nextRaise = t + bossRaiseEvery;
        // (only its own minions count: boss.js minionsLeft)
        const minions = close.filter((m) => m.type === DEPTH.boss.minion).length + rising.filter((r) => r.type === DEPTH.boss.minion).length;
        if (minions <= 1) spawn(3, DEPTH.boss.minion);
      }
      // Necromancers raise two ice zombies each, every so often, while fewer
      // than raiseMost of them are up (and the bar isn't full).
      const raisers = up((b) => b.raises);
      if (raisers && t >= nextRaise) {
        nextRaise = t + MODEL.raiseEvery;
        const kind = BEHAVIORS.necromancer.raises;
        const already = close.filter((m) => m.type === kind).length + rising.filter((r) => r.type === kind).length;
        if (!full) spawn(Math.max(0, Math.min(2 * raisers, MODEL.raiseMost * raisers - already)), kind);
      } else if (!raisers) nextRaise = Infinity;
      // Wogols whose fuse has run out go off.
      for (const m of close.filter((c) => t >= c.fuseAt)) {
        close.splice(close.indexOf(m), 1);
        if (blast(m.type)) return end("died", t);
      }

      // The fort's war drums: while they beat, nothing hurts the orcs, so
      // he keeps away from them until they stop, and may still get caught.
      if (t >= drumsAt) {
        if (!full && !boss) {
          t += drums.warning + drums.lasts;
          const caught = threatNow() * danger * MODEL.drumDanger * drums.lasts;
          if (t > invincibleUntil && dice() < 1 - Math.exp(-caught)) {
            hearts -= SPECIAL;
            invincibleUntil = t + stats.invincibleFor;
            if (hearts <= 0) return end("died", t);
          }
        }
        drumsAt = nextDrums(t);
      }

      // The danger since the last swing: everything up close (and spikes)
      // can land a hit, but not while he's still invincible from the last
      // one, so only the part of the swing after that counts.
      const perSecond = (threatNow() + (boss ? DEPTH.boss.threat : 0) + (room.hazard ?? 0) + arrows) * danger;
      const exposed = Math.min(swing, t - invincibleUntil);
      if (exposed > 0 && perSecond > 0 && dice() < 1 - Math.exp(-perSecond * exposed)) {
        // Shots and the boss's moves are special attacks: their share of the
        // danger costs the depth's special hit; a touch (or spikes) costs one.
        const special = (rangedNow() + (boss ? DEPTH.boss.threat : 0) + arrows) * danger / perSecond;
        const shock = lightning && dice() < stats.chargedChance; // a charged one's touch
        hearts -= dice() < special || shock ? SPECIAL + pactSpecial : 1 + pactTouch;
        invincibleUntil = t + stats.invincibleFor;
        if (hearts <= 0) return end("died", t);
      }

      // Nobody on him: he walks over to the next wanderer, and the first swing
      // after he gets there hits it (the swing keeps its rhythm). How far it
      // is varies, so some walks fit between two swings and some don't. Once
      // the bar is full he heads for the door instead.
      // He sets off as soon as he's free (after the last swing) and it's up.
      let walkingOver = false;
      // One that keeps its distance: he goes after it even with others on
      // him, once it's been up a moment or if only a few are on him.
      const keeper = full ? null : waiting.find((m) => behavior(m.type).walk
        && (close.length <= MODEL.keeperClose || t - m.upAt > MODEL.keeperAfter));
      if (keeper && close.length && waiting[0] !== keeper && !walk2) {
        waiting.splice(waiting.indexOf(keeper), 1);
        waiting.unshift(keeper); // he heads for it first
      }
      if ((!close.length || keeper) && waiting.length && !full) {
        walkingOver = true;
        walk2 ??= {
          from: Math.max(waiting[0].upAt, t - swing),
          need: wanderWalk * (behavior(waiting[0].type).walk ?? 1) * mud()
            * (1 - MODEL.wanderSpread + 2 * MODEL.wanderSpread * dice()) * waiting.length ** -MODEL.wanderNearest,
        };
        if (t >= walk2.from + walk2.need) {
          walk2 = null;
          const reached = waiting.shift();
          comeClose(reached.type, !!behavior(reached.type).walk);
        }
      } else if (close.length && waiting.length) {
        // A wanderer crawls into his swing while he's busy with something else
        // (one that keeps its distance doesn't).
        const wanderers = waiting.filter((m) => BALANCE.mobs[m.type].wanders);
        if (wanderers.length && dice() < MODEL.wanderDrift * wanderers.length) {
          waiting.splice(waiting.indexOf(wanderers[0]), 1);
          comeClose(wanderers[0].type);
        }
      }

      // The hammer, once it's bought: every hammerEvery s it comes down on
      // the ones up close (or the boss), if he steered its zone onto them.
      if (hammer && t >= nextHammer) {
        nextHammer = t + stats.hammerEvery;
        const blow = stats.hammerDamage / hit; // in swings
        if (close.length && dice() < MODEL.hammerLands) {
          const size = (stats.hammerSize / BALANCE.hero.hammer.size) ** 2;
          const caught = Math.min(close.length, Math.max(1, Math.round(MODEL.hammerHits * size * (1 + MODEL.crowd * (close.length - 1)))));
          const beaten = [];
          for (let i = 0; i < caught; i++) if ((close[i].left -= blow) <= 0) beaten.push(close[i]);
          if (beaten.length) {
            close = close.filter((mob) => mob.left > 0);
            for (const { type } of beaten) kill(type);
            for (const { type } of beaten) if (behavior(type).blast && blast(type)) return end("died", t);
          }
        } else if (boss && dice() < MODEL.hammerLands) boss.left -= blow;
      }

      // The boomerang, once it's bought: thrown when there's one up close, it
      // cuts through some of them twice; then the flight and the rest.
      if (boomerang && t >= nextThrow && (close.length || boss)) {
        nextThrow = t + MODEL.rangFlight + stats.boomerangRest;
        const blow = (2 * stats.boomerangDamage) / hit; // in swings, out and back
        if (close.length) {
          const caught = Math.min(close.length, Math.max(1, Math.round(MODEL.rangHits * stats.boomerangCount * (stats.boomerangRange / BALANCE.hero.boomerang.range))));
          const beaten = [];
          for (let i = 0; i < caught; i++) if ((close[i].left -= blow) <= 0) beaten.push(close[i]);
          if (beaten.length) {
            close = close.filter((mob) => mob.left > 0);
            for (const { type } of beaten) kill(type);
            for (const { type } of beaten) if (behavior(type).blast && blast(type)) return end("died", t);
          }
        } else boss.left -= blow * stats.boomerangCount;
      }

      // The swing: it hits the monsters up close, oldest first (if one was
      // in reach when it came round).
      const lands = Math.min(MODEL.landMost, MODEL.landAlone + MODEL.landStep * (close.length - 1));
      if (close.length && dice() < lands) {
        const share = hitsPerSwing(stats, close.length);
        const hits = Math.floor(share) + (dice() < share % 1 ? 1 : 0);
        const beaten = [];
        for (let i = 0; i < hits && i < close.length; i++) if (--close[i].left <= 0) beaten.push(close[i]);
        if (beaten.length) {
          close = close.filter((mob) => mob.left > 0);
          for (const { type } of beaten) kill(type); // the whole swing's kills land at once
          for (const { type } of beaten) {
            if (behavior(type).blast && blast(type)) return end("died", t); // beaten, it still goes off
          }
        }
      } else if (!full && !boss) {
        // Nobody to fight: smash a breakable, walking over to it. On his way
        // to a wanderer, only one the swing breaks in one go (no detour).
        const swingsLeft = (b) => b.left ?? Math.ceil((BALANCE.breakables[b.name].hp * scale.hp) / stats.damage);
        const next = walkingOver
          ? breakables.find((b) => b.left === null && swingsLeft(b) === 1)
          : breakables.find((b) => swingsLeft(b) > 0);
        if (next) {
          const thing = BALANCE.breakables[next.name];
          if (next.left === null && !walkingOver) t += MODEL.perBreakable * walk * player.clearTime * mud();
          next.left = swingsLeft(next) - 1;
          if (next.left <= 0) roomGold += coins(thing.gold * scale.gold * (1 + stats.breakableBonus));
        }
      }
      // The boss takes a hit when a swing gets through its moves.
      if (boss && dice() < 1 / MODEL.dodgeTime && --boss.left <= 0) {
        roomGold += coins(DEPTH.boss.gold * (1 + stats.goldBonus)); // its pile of coins
        return end("boss", t);
      }

      // Never an empty room: one more rises when the last one falls.
      if (!full && !close.length && !rising.length && !waiting.length) spawn(1);
    }

    // Through the door.
    clock -= t;
    gold += Math.round(roomGold * player.gold);
    wall += t + MODEL.cutscenePerRoom;
    if (BALANCE.run.clockDuringCutscenes) clock -= MODEL.cutscenePerRoom; // the door and the fall-in
    if (clock <= 0) return { deepest: sub, ending: "time", gold, wall };
    clock += stats.timePerSubDepth; // reached the next sub-depth
  }
}
