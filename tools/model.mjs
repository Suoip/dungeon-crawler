// The model behind the pacing simulator: what a player gets done in one run,
// given the numbers in src/balance.js and the upgrades they've bought. It
// isn't the game: there's no map and no movement. It steps through each room
// one swing at a time, keeping count of the monsters that are rising and the
// ones up close, and rolls dice for luck: who spawns, when a hit lands (a
// hit costs a whole heart), and what drops. That's why it can play all of
// depth 1 hundreds of times in seconds.
//
// Its guesses about players (how long walking takes, how many monsters one
// swing hits in a crowd) are in MODEL and PLAYERS below, kept apart from the
// game's own numbers, so they can be checked against real play-testing.

import { BALANCE } from "../src/balance.js";

export const MODEL = {
  riseTime: 1.05,       // seconds a spawned monster spends rising (dust 0.8 s, then 0.25 s popping up)
  approach: 1.0,        // seconds until a risen monster is up close, at the starting reach
  doorWalk: 2.0,        // walking to the door once the bar is full
  collectPerRoom: 1.2,  // gathering the room's coins on the way, with the starting magnet
  perBreakable: 0.5,    // walking over to a breakable (on top of the swings it takes)
  cutscenePerRoom: 2.0, // through the door, the fade, and falling into the next room
  hubPerRun: 12,        // after a run: dragged down, the underworld, the tree, the ladder, the fall
  dodgeTime: 1.3,       // only 1 in this many swings lands on the boss: the rest of the time you're dodging
  bossRaiseEvery: 6.5,  // seconds between the boss's raises (boss.js: a cast every 1.5-3 s, raising half the time)
  bossFightLimit: 600,  // a boss fight that lasts longer than this counts as one you can't win yet
  hitsPerSwing: 1.15,   // monsters one swing hits, on average, with one or two up close
  crowd: 0.15,          // each more monster up close adds this share to the monsters a swing hits...
  crowdCap: 4,          // ...up to this many, at the starting reach and arc
  dashSafety: 0.8,      // having a dash at all leaves this share of the danger...
  dashOverhead: 0.85,   // ...and this share of the walking time
  chargeSafety: 0.9,    // a second dash charge leaves this share of the danger
};

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

// ---- Upgrades -> the hero's stats ------------------------------------------

// What the hero is like with these upgrades. `levels` is { nodeId: level }.
export function heroStats(levels) {
  const { hero, run, drops, spawning } = BALANCE;
  const stats = {
    hearts: hero.hearts,
    damage: hero.damage,
    swingEvery: hero.swingEvery,
    reach: hero.reach,
    arc: hero.arc,
    invincibleFor: hero.invincibleFor,
    magnetRange: hero.magnetRange,
    startTime: run.startTime,
    timePerSubDepth: 0,
    heartChance: drops.heart.chance,
    timeOrbChance: drops.timeOrb.chance,
    timeOrbSeconds: drops.timeOrb.seconds,
    dashCooldown: hero.dash.cooldown,
    dashCharges: 1,
    goldBonus: 0,
    breakableBonus: 0,
    onEnter: spawning.onEnter,
    horde: spawning.horde,
    hordeEvery: spawning.hordeEvery,
    deathCall: 0,
    xpBonus: 0,
    unlocked: new Set(),
  };
  for (const node of BALANCE.tree) {
    const level = levels[node.id] ?? 0;
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

// What level `level` (counting from 0) of a node costs, rounded to a tidy
// number: whole gold under 100, then two significant figures (130, 2100...).
export function costOf(node, level) {
  const raw = node.cost * node.growth ** level;
  if (raw < 100) return Math.round(raw);
  const step = 10 ** (Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / step) * step;
}

// ---- The hero in a fight ---------------------------------------------------------

const subDepthScale = (sub) => ({
  hp: BALANCE.growth.hp ** (sub - 1),
  gold: BALANCE.growth.gold ** (sub - 1),
});

// The game drops whole coins: a monster's gold (with Greed) is rounded to the
// nearest coin, at least 1. The game must round the same way (src/balance.js).
const coins = (gold) => Math.max(1, Math.round(gold));

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

// One run from sub-depth 1 with these stats, rolled with `dice`: rooms in
// order until the clock runs out, the last heart is lost, or the boss is
// beaten.
//   deepest  how far it got: 3.4 = cleared 3 rooms and 40% of the 4th's bar
//   ending   "time", "died", "boss" (the boss was beaten) or "stuck" (a boss
//            fight that can't be won yet)
//   gold     whole coins earned. When a run ends, every coin still on the
//            floor is collected (DESIGN.md section 6); coins a typical player
//            leaves behind in an earlier room are lost.
//   wall     real-world seconds it took (with cutscenes, without the hub)
export function simulateRun(stats, dice, player = PLAYERS.efficient) {
  const { step } = BALANCE.drops.heart;
  const walk = walking(stats);
  const danger = safety(stats) * player.danger;
  const swing = stats.swingEvery * player.clearTime; // seconds between swings that count
  const orbs = stats.unlocked.has("timeOrbs");
  let clock = stats.startTime; // seconds left on the run's clock
  let hearts = stats.hearts;
  let dryKills = 0;            // kills in a row without a heart (the bad-luck counter)
  let wall = 0;
  let gold = 0;

  for (let sub = 1; sub <= 10; sub++) {
    const room = BALANCE.rooms[sub - 1];
    const scale = subDepthScale(sub);
    const isBossRoom = sub === 10;
    let t = 0;              // seconds since landing in this room
    let xp = 0;
    let full = false;       // the bar is full: spawning has stopped
    let leaveAt = Infinity; // when he's out of the door (once the bar is full)
    let clockStopped = false;
    let boss = null;        // { left, nextRaise } once it has appeared
    let roomGold = 0;
    let invincibleUntil = 0;
    let threat = 0;         // the threats of the monsters up close, added up
    const rising = [];      // { at, type }: spawned, not up close yet, in the order they arrive
    let close = [];         // { left, type }: up close, being fought; `left` = swings to beat it
    const breakables = (room.breakables ?? []).map((name) => ({ name, left: null }));
    let nextHorde = stats.hordeEvery;

    // The rise is the game's own animation; only getting to the monster takes a typical player longer.
    const arriveIn = MODEL.riseTime + MODEL.approach * (BALANCE.hero.reach / stats.reach) * walk * player.clearTime;
    const spawn = (count, type = null) => {
      for (let i = 0; i < count; i++) rising.push({ at: t + arriveIn + 0.1 * i, type: type ?? pick(room.spawns, dice) });
    };
    const swingsFor = (type) => Math.ceil((BALANCE.mobs[type].hp * scale.hp) / stats.damage);
    const comeClose = (type) => {
      close.push({ left: swingsFor(type), type });
      threat += BALANCE.mobs[type].threat;
    };
    const end = (ending, at) => {
      gold += roomGold; // the coins on the floor are collected as the run ends
      wall += at;
      const progress = isBossRoom && full ? 1 : Math.min(1, xp / room.xp);
      return { deepest: ending === "boss" ? 10 : sub - 1 + Math.min(progress, 0.999), ending, gold, wall };
    };
    // The bar fills: spawning stops at once. In the boss room, the boss
    // appears and the clock stops; in the others, the door opens and he
    // heads for it.
    const fill = () => {
      full = true;
      if (isBossRoom) {
        clockStopped = true;
        rising.push({ at: t + MODEL.riseTime, type: "boss" });
        rising.sort((a, b) => a.at - b.at); // it rises quicker than the last spawns arrive
      } else {
        const gather = MODEL.collectPerRoom * (BALANCE.hero.magnetRange / stats.magnetRange) ** 0.7;
        leaveAt = t + (MODEL.doorWalk + gather) * walk * player.clearTime;
      }
    };
    const kill = (type) => {
      const def = BALANCE.mobs[type];
      xp += def.xp * (1 + stats.xpBonus);
      if (!full && xp >= room.xp) fill();
      roomGold += coins(def.gold * scale.gold * (1 + stats.goldBonus));
      for (const child of def.splitsInto ?? []) comeClose(child); // a slug's tiny slugs, right there
      if (hearts < stats.hearts) {
        if (dice() < stats.heartChance + step * dryKills) {
          hearts++;
          dryKills = 0;
        } else dryKills++;
      }
      if (orbs && !clockStopped && dice() < stats.timeOrbChance) clock += stats.timeOrbSeconds;
      if (!full && stats.deathCall > 0 && dice() < stats.deathCall) spawn(1);
    };

    spawn(stats.onEnter);
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
        const { type } = rising[arrived++];
        if (type === "boss") boss = { left: Math.ceil(BALANCE.boss.hp / stats.damage), nextRaise: t + MODEL.bossRaiseEvery };
        else comeClose(type);
      }
      if (arrived) rising.splice(0, arrived);
      while (!full && t >= nextHorde) {
        spawn(stats.horde);
        nextHorde += stats.hordeEvery;
      }
      // The boss raises 3 minions now and then, but not while more than one
      // is still up (boss.js).
      if (boss && t >= boss.nextRaise) {
        boss.nextRaise = t + MODEL.bossRaiseEvery;
        if (close.length <= 1) spawn(3, BALANCE.boss.minion);
      }

      // The danger since the last swing: everything up close (and spikes)
      // can land a hit, but not while he's still invincible from the last
      // one, so only the part of the swing after that counts.
      const perSecond = (threat + (boss ? BALANCE.boss.threat : 0) + (room.hazard ?? 0)) * danger;
      const exposed = Math.min(swing, t - invincibleUntil);
      if (exposed > 0 && perSecond > 0 && dice() < 1 - Math.exp(-perSecond * exposed)) {
        hearts--;
        invincibleUntil = t + stats.invincibleFor;
        if (hearts <= 0) return end("died", t);
      }

      // The swing: it hits the monsters up close, oldest first.
      if (close.length) {
        const share = hitsPerSwing(stats, close.length);
        const hits = Math.floor(share) + (dice() < share % 1 ? 1 : 0);
        const beaten = [];
        for (let i = 0; i < hits && i < close.length; i++) if (--close[i].left <= 0) beaten.push(close[i]);
        if (beaten.length) {
          close = close.filter((mob) => mob.left > 0);
          for (const { type } of beaten) {
            threat -= BALANCE.mobs[type].threat;
            kill(type);
          }
        }
      } else if (!full && !boss) {
        // Nobody to fight yet: smash a breakable while waiting.
        const next = breakables.find((b) => b.left === null || b.left > 0);
        if (next) {
          const thing = BALANCE.breakables[next.name];
          if (next.left === null) {
            next.left = Math.ceil((thing.hp * scale.hp) / stats.damage);
            t += MODEL.perBreakable * walk * player.clearTime;
          }
          if (--next.left <= 0) roomGold += coins(thing.gold * scale.gold * (1 + stats.breakableBonus));
        }
      }
      // The boss takes a hit when a swing gets through its moves.
      if (boss && dice() < 1 / MODEL.dodgeTime && --boss.left <= 0) {
        roomGold += coins(BALANCE.boss.gold * (1 + stats.goldBonus)); // its pile of coins
        return end("boss", t);
      }

      // Never an empty room: one more rises when the last one falls.
      if (!full && !close.length && !rising.length) spawn(1);
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
