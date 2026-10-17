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
import { heroStats, costOf, subDepthScale, coins } from "../src/stats.js";

export { heroStats, costOf }; // the tree's rules live in the game (src/stats.js)

const CRYPT = BALANCE.depths[0]; // the depth it plays: depth 1

export const MODEL = {
  riseTime: 1.05,       // seconds a spawned monster spends rising (dust 0.8 s, then 0.25 s popping up)
  dustTime: 0.8,        // the warning dust part of that: a full bar cancels a spawn that's still in it
  bossEntrance: 2.7,    // from the full bar to the hero moving again: the crumble, the rise, the roar (3.0 s with the shove)
  approach: 1.0,        // seconds until a risen monster is up close, at the starting reach
  // Wanderers (balance.js `wanders`), measured against a bot playing room 1
  // in the game (seconds per slug with 1-hit and 3-hit slugs, at three swing
  // speeds and a longer reach, all within about 5%):
  wanderWalk: 0.9,      // seconds walking over to one, on average (reach hardly matters)...
  wanderSpread: 0.5,    // ...give or take this share (where it rose, which way it crawled)
  wanderNearest: 0,     // ...times (how many are about)^-this: with more about, the nearest is closer (the fit didn't need it)
  wanderDrift: 0.15,    // while he's fighting, the chance per swing, for each one about, that it crawls into his swing too
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
  // The swing is on a timer (combat.js): nobody swings faster, a slower
  // player just wastes some.
  const swing = stats.swingEvery * Math.max(1, player.clearTime); // seconds between swings that count
  const orbs = stats.unlocked.has("timeOrbs");
  let clock = stats.startTime; // seconds left on the run's clock
  let hearts = stats.hearts;
  let dryKills = 0;            // kills in a row without a heart (the bad-luck counter)
  let wall = 0;
  let gold = 0;

  for (let sub = 1; sub <= 10; sub++) {
    const room = CRYPT.rooms[sub - 1];
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
    const approach = MODEL.approach * (BALANCE.hero.reach / stats.reach) * walk * player.clearTime;
    const arriveIn = MODEL.riseTime + approach;
    // A chaser comes to him. A wanderer doesn't: once it's up, it waits
    // (`waiting`) until he walks over to it, one at a time, when nothing
    // else is on him, and it never crowds him with the others.
    const arriveOf = (type) => (BALANCE.mobs[type].wanders ? MODEL.riseTime : arriveIn);
    const wanderWalk = MODEL.wanderWalk * walk * player.clearTime;
    const waiting = [];     // { type, upAt }: wanderers up, in the order they got up
    let walk2 = null;       // { from, need }: the walk to the next one, once he's on his way
    const spawn = (count, type = null) => {
      // `born`: when its warning dust starts.
      for (let i = 0; i < count; i++) {
        const kind = type ?? pick(room.spawns, dice);
        rising.push({ at: t + arriveOf(kind) + 0.1 * i, born: t + 0.1 * i, type: kind });
      }
      rising.sort((a, b) => a.at - b.at); // they arrive in order of when they get close
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
    // The bar fills: spawning stops at once, even for the monsters still on
    // their way up. In the boss room, the clock stops and the boss makes its
    // entrance: everything up close crumbles (its coins drop, but it isn't a
    // kill), and the hero can't touch the boss until it has roared. In the
    // others, the door opens and he heads for it.
    const fill = () => {
      full = true;
      const crumbleCoins = (type) => coins(BALANCE.mobs[type].gold * scale.gold * (1 + stats.goldBonus));
      // Spawns still in their warning dust are cancelled; the rest are up.
      for (let i = rising.length - 1; i >= 0; i--) if (t - rising[i].born < MODEL.dustTime) rising.splice(i, 1);
      if (isBossRoom) {
        clockStopped = true;
        for (const { type } of close) {
          threat -= BALANCE.mobs[type].threat;
          roomGold += crumbleCoins(type);
        }
        close = [];
        for (const { type } of waiting.splice(0)) roomGold += crumbleCoins(type);
        // The ones up but not close yet crumble too (with coins, once they've
        // finished popping up).
        for (const r of rising) if (t - r.born >= MODEL.riseTime) roomGold += crumbleCoins(r.type);
        rising.length = 0;
        rising.push({ at: t + MODEL.bossEntrance, type: "boss" });
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
      // A splitter's children, right there (unless its kill just started the
      // boss's entrance, which cancels them).
      if (!(isBossRoom && full)) for (const child of def.splitsInto ?? []) comeClose(child);
      if (hearts < stats.hearts) {
        if (dice() < stats.heartChance + step * dryKills) {
          hearts++;
          dryKills = 0;
        } else dryKills++;
      }
      if (orbs && !clockStopped && dice() < stats.timeOrbChance) clock += stats.timeOrbSeconds;
      if (!full && stats.deathCall > 0 && dice() < stats.deathCall) spawn(1);
    };

    // A chest, sometimes (rooms 6-9): loot to smash like a breakable, or a
    // mimic that wakes as he gets to it and joins the fight.
    if (room.chest && dice() < room.chest.chance) {
      if (dice() < room.chest.mimic) rising.push({ at: arriveIn, born: -Infinity, type: "mimic" });
      else breakables.push({ name: "chest", left: null });
    }
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
        const { type, at } = rising[arrived++];
        if (type === "boss") boss = { left: Math.ceil(CRYPT.boss.hp / stats.damage), nextRaise: t + MODEL.bossRaiseEvery };
        else if (BALANCE.mobs[type].wanders) waiting.push({ type, upAt: at });
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
        if (close.length <= 1) spawn(3, CRYPT.boss.minion);
      }

      // The danger since the last swing: everything up close (and spikes)
      // can land a hit, but not while he's still invincible from the last
      // one, so only the part of the swing after that counts.
      const perSecond = (threat + (boss ? CRYPT.boss.threat : 0) + (room.hazard ?? 0)) * danger;
      const exposed = Math.min(swing, t - invincibleUntil);
      if (exposed > 0 && perSecond > 0 && dice() < 1 - Math.exp(-perSecond * exposed)) {
        hearts--;
        invincibleUntil = t + stats.invincibleFor;
        if (hearts <= 0) return end("died", t);
      }

      // Nobody on him: he walks over to the next wanderer, and the first swing
      // after he gets there hits it (the swing keeps its rhythm). How far it
      // is varies, so some walks fit between two swings and some don't. Once
      // the bar is full he heads for the door instead.
      // He sets off as soon as he's free (after the last swing) and it's up.
      let walkingOver = false;
      if (!close.length && waiting.length && !full) {
        walkingOver = true;
        walk2 ??= {
          from: Math.max(waiting[0].upAt, t - swing),
          need: wanderWalk * (1 - MODEL.wanderSpread + 2 * MODEL.wanderSpread * dice()) * waiting.length ** -MODEL.wanderNearest,
        };
        if (t >= walk2.from + walk2.need) {
          walk2 = null;
          comeClose(waiting.shift().type);
        }
      } else if (close.length && waiting.length && dice() < MODEL.wanderDrift * waiting.length) {
        // A wanderer crawls into his swing while he's busy with something else.
        comeClose(waiting.shift().type);
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
        // Nobody to fight: smash a breakable, walking over to it. On his way
        // to a wanderer, only one the swing breaks in one go (no detour).
        const swingsLeft = (b) => b.left ?? Math.ceil((BALANCE.breakables[b.name].hp * scale.hp) / stats.damage);
        const next = walkingOver
          ? breakables.find((b) => b.left === null && swingsLeft(b) === 1)
          : breakables.find((b) => swingsLeft(b) > 0);
        if (next) {
          const thing = BALANCE.breakables[next.name];
          if (next.left === null && !walkingOver) t += MODEL.perBreakable * walk * player.clearTime;
          next.left = swingsLeft(next) - 1;
          if (next.left <= 0) roomGold += coins(thing.gold * scale.gold * (1 + stats.breakableBonus));
        }
      }
      // The boss takes a hit when a swing gets through its moves.
      if (boss && dice() < 1 / MODEL.dodgeTime && --boss.left <= 0) {
        roomGold += coins(CRYPT.boss.gold * (1 + stats.goldBonus)); // its pile of coins
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
