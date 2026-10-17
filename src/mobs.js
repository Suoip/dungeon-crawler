import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BALANCE } from "./balance.js";
import { subDepthScale } from "./stats.js";
import { sleep, during, animate, puffDust, addShadow, addSpawnHole, sparks } from "./effects.js";
import { playSound } from "./sound.js";
import { setupBoss } from "./boss.js";
import { keepInRoom } from "./room.js";
import { popNumber } from "./hud.js";

// How the monsters look and move. `feet` is the size of the box at their
// feet that collides (like the hero's), `speed` is in pixels per second, and
// `size` is how tall the sprite is. Their hp, gold and XP come from
// src/balance.js, grown by how deep the room is. A boss's `favorite` is the
// move it casts most often, and `minions` are what it raises (boss.js).
export const MOB_TYPES = {
  tiny_zombie: { speed: 26, feet: [10, 6], size: 16 },
  skeleton:    { speed: 30, feet: [10, 6], size: 16, rusher: true }, // winds up, then charges in a line
  slug:        { speed: 16, feet: [12, 6], size: 23 },               // splits into tiny slugs (balance.js)
  tiny_slug:   { speed: 34, feet: [8, 5], size: 16 },
  mimic:       { speed: 40, feet: [12, 6], size: 16, rusher: true },  // a chest that woke up (crypt.js): lunges like a skeleton
  // Other depths' monsters (not in balance.js yet), for the other bosses' minions.
  goblin:      { speed: 52, feet: [10, 6], size: 16, hp: 3 },
  orc_warrior: { speed: 36, feet: [10, 6], size: 23, hp: 5 },
  big_demon:   { speed: 28, feet: [22, 8], size: 36, boss: true, name: "BIG DEMON", favorite: "dash", hp: 24 },
  ogre:        { speed: 30, feet: [22, 8], size: 36, boss: true, name: "OGRE", favorite: "vomit", knockback: 3, hp: 42 },
  big_zombie:  { speed: 16, feet: [22, 8], size: 36, boss: true, name: "BIG ZOMBIE", favorite: "spawn", minions: ["tiny_zombie"] },
};

// A monster's hp, gold and XP in sub-depth `sub`. The depth's boss has its
// own numbers in balance.js; anything else not in balance.js has a fixed hp.
function numbersFor(type, sub) {
  if (type === BALANCE.boss.type) return { hp: BALANCE.boss.hp, gold: BALANCE.boss.gold, xp: 0 };
  const data = BALANCE.mobs[type];
  if (!data) return { hp: MOB_TYPES[type].hp, gold: 1, xp: 1 };
  const scale = subDepthScale(sub);
  return { hp: Math.ceil(data.hp * scale.hp), gold: data.gold * scale.gold, xp: data.xp };
}

// ---- Spawning ------------------------------------------------------------------

// Fills a room with monsters (DESIGN.md section 3): `onEnter` of them rise as
// he lands, a horde of `horde` more every `hordeEvery` seconds, whether or not
// the room is clear, and one more whenever the room is empty, so there's
// always something to fight. Each picks a type from `spawns` (weights). It
// all stops once `room.full` is set (the room's XP bar is full). Returns
// { raise(count) }, for anything else that calls up monsters (Death calls).
export function startSpawning(room, { spawns, onEnter, horde, hordeEvery }) {
  const pool = Object.entries(spawns);
  const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
  const pick = () => {
    let roll = rand(0, total);
    for (const [type, weight] of pool) if ((roll -= weight) <= 0) return type;
    return pool.at(-1)[0];
  };
  const raise = (count) => {
    for (let i = 0; i < count; i++) raiseMob(pick(), room, { delay: i * 0.12, untilFull: true });
  };

  raise(onEnter);
  let elapsed = 0; // seconds in this room (the horde timer starts over in each room)
  let nextHorde = hordeEvery;
  onUpdate(() => {
    if (room.full || room.over || room.frozen) return;
    elapsed += dt();
    if (elapsed >= nextHorde) {
      nextHorde += hordeEvery;
      raise(horde);
    }
    if (room.alive === 0 && room.rising === 0) raise(1);
  });
  return { raise };
}

// Where a depth's boss rises: the middle of the room.
export const bossSpot = () => vec2(GAME_WIDTH / 2, TOP + 6 * TILE);

// A random spot on the floor, not too close to the player (so a mob never
// appears right on top of them), and not on a solid tile of the room's
// layout (`room.solid`: the middles of its pillars, breakables and chest).
export function spawnSpot(room) {
  const clear = (spot) => (room.solid ?? []).every((tile) => Math.abs(spot.x - tile.x) > 14 || Math.abs(spot.y - 4 - tile.y) > 12);
  for (let tries = 0; tries < 50; tries++) {
    const spot = vec2(rand(32, GAME_WIDTH - 32), rand(TOP + 3 * TILE + 8, GAME_HEIGHT - 20));
    if (spot.dist(room.player.pos) > 70 && clear(spot)) return spot;
  }
  return vec2(40, TOP + 5 * TILE);
}

// Raises a mob out of the floor: first some dust swirls on the spot as a
// warning, then it pops up. It can't hurt anyone until it's fully up.
// `room` is the room scene's fight: { player, sub, rising, over,
// onSpawn(mob), onDeath(mob) }. `room.rising` counts mobs still on their way
// up (or waiting to start, after `delay` seconds), so the room doesn't think
// it's empty while one is still appearing. `onDeath` is called when this mob
// is beaten. With `quick`, it skips the dust and just pops out (a slug's
// tiny slugs).
// `untilFull`: it's one of the room's own spawns, which stop when the XP bar
// fills, even the ones already on their way up.
export async function raiseMob(type, room, { at = null, delay = 0, onDeath = null, quick = false, untilFull = false } = {}) {
  const def = MOB_TYPES[type];
  const called = () => room.over || room.frozen || (untilFull && room.full); // not wanted any more
  room.rising++;
  await sleep(delay);
  if (called()) {
    room.rising--;
    return null;
  }
  const spot = at ?? (def.boss ? bossSpot() : spawnSpot(room));

  const closeHole = quick ? () => {} : addSpawnHole(spot, def.feet[0]);
  if (!quick) {
    // The warning dust, which stops early if it's not wanted any more.
    const dust = loop(0.12, () => puffDust(spot.x, spot.y, 2, def.boss ? 14 : 6, 9));
    await during(0.8, () => {}, () => !called());
    dust.cancel();
  }
  room.rising--;
  if (called()) {
    closeHole();
    return null; // the room ended, froze or filled while we waited
  }

  if (!quick) playSound("spawn");
  const mob = addMob(type, spot, room, onDeath);
  await animate(0, 1, quick ? 0.12 : 0.25, (t) => (mob.scale = vec2(1, t)), easings.easeOutBack);
  closeHole();
  // If the room froze while it was coming up (the boss arriving or falling),
  // it's already crumbling: it never gets to move.
  if (!room.frozen && !room.over) mob.active = true;
  return mob;
}

// A chest that was a mimic has snapped open (crypt.js): the monster is
// there, mouth open. It shakes in gold for a moment first (like a skeleton
// winding up), so he has time to back off before it can bite, and then it
// comes after him.
const MIMIC_WAKE_UP = 0.4; // seconds
export function wakeMimic(at, room) {
  const mob = addMob("mimic", at, room, null);
  mob.scale = vec2(1);
  during(MIMIC_WAKE_UP, () => {
    mob.color = Math.floor(time() * 16) % 2 ? rgb(255, 205, 70) : mob.tint;
    mob.angle = Math.sin(time() * 60) * 6;
  }, () => mob.exists()).then(() => {
    if (!mob.exists()) return;
    mob.color = mob.tint;
    mob.angle = 0;
    if (!room.frozen && !room.over) mob.active = true;
  });
  return mob;
}

// A monster in the room, not moving yet (`active` false) and squashed flat
// (scale 0 tall), for raiseMob or wakeMimic to bring to life.
function addMob(type, spot, room, onDeath) {
  const def = MOB_TYPES[type];
  const numbers = numbersFor(type, room.sub);
  const mob = add([
    sprite(type, { anim: "idle" }),
    pos(spot),
    anchor("bot"),
    area({ shape: new Rect(vec2(0), def.feet[0], def.feet[1]) }),
    body(),
    scale(vec2(1, 0)),
    rotate(0), // for a skeleton's (or a mimic's) shake before it lunges
    color(255, 255, 255),
    z(10),
    "mob",
    {
      type, def, onBeaten: onDeath,
      hp: numbers.hp, maxHp: numbers.hp, gold: numbers.gold, xp: numbers.xp,
      speed: def.speed,
      tint: rgb(255, 255, 255), // its normal color, to go back to after a flash
      active: false,            // false while rising, dying or frozen
      knockVel: vec2(0), knockTime: 0,
    },
  ]);
  room.onSpawn(mob);
  addShadow(mob, def.feet[0] + 4);
  if (def.boss) {
    setupBoss(mob, room);
    setupHealthBar(mob);
  }
  setupBrain(mob, room);
  return mob;
}

// Hits a mob for `damage`: it flashes, gets knocked back, and the number pops
// up over it. Returns true if that hit beat it.
export function hurtMob(mob, from, room, damage = 1) {
  if (!mob.active) return false;
  mob.hp -= damage;
  playSound("mobHit");
  popNumber(mob.pos.add(rand(-3, 3), -mob.def.size - 2), damage);
  // Sparks on the side of the mob that got hit.
  const middle = mob.pos.sub(0, mob.def.size / 2);
  const toward = from.sub(0, 10).sub(middle).unit().scale(Math.min(8, mob.def.size / 3));
  sparks(middle.x + toward.x, middle.y + toward.y);
  mob.color = rgb(255, 110, 110);
  wait(0.1, () => mob.exists() && (mob.color = mob.tint));

  // Pushed away from whoever hit it. Bosses barely budge, and not at all in
  // the middle of a move; a charging skeleton isn't stopped either.
  if (!(mob.def.boss && mob.busy) && !mob.charging) {
    const away = mob.pos.sub(from).unit();
    mob.knockVel = away.scale(mob.def.boss ? 60 : 220);
    mob.knockTime = 0.12;
  }

  if (mob.hp > 0) return false;
  mob.active = false;
  mob.dead = true; // beaten: already counted out, already on its way down
  playSound("mobDie");
  puffDust(mob.pos.x, mob.pos.y - mob.def.size / 2, 10, 14, 11);
  // A slug splits: its tiny slugs pop out where it fell.
  for (const [i, child] of (BALANCE.mobs[mob.type]?.splitsInto ?? []).entries()) {
    const side = i % 2 ? 1 : -1;
    raiseMob(child, room, { at: mob.pos.add(side * 7, rand(-2, 2)), quick: true });
  }
  room.onDeath(mob);
  animate(1, 0, 0.2, (t) => (mob.scale = vec2(1 + (1 - t) * 0.5, t))).then(() => {
    destroy(mob);
    mob.onBeaten?.();
  });
  return true;
}

// What a mob does every frame: get knocked back, or chase the player, or
// (for bosses) their special move, or (for skeletons) charge.
function setupBrain(mob, room) {
  const rush = mob.def.rusher ? setupRush(mob, room) : null;
  mob.onUpdate(() => {
    mob.z = 10 + mob.pos.y / 1000; // lower on screen = drawn in front
    if (!mob.active || room.frozen) {
      if (mob.getCurAnim()?.name !== "idle") mob.play("idle");
      return;
    }

    if (mob.knockTime > 0) {
      mob.knockTime -= dt();
      mob.move(mob.knockVel);
      keepInRoom(mob, mob.def.feet);
      return;
    }

    if (mob.def.boss && mob.bossTurn()) return; // busy casting a move
    if (rush && rush()) return;                 // winding up or charging
    const toPlayer = room.player.pos.sub(mob.pos);
    if (toPlayer.len() > 2) {
      mob.move(toPlayer.unit().scale(mob.speed));
      keepInRoom(mob, mob.def.feet);
      mob.flipX = toPlayer.x < 0;
      if (mob.getCurAnim()?.name !== "run") mob.play("run");
    }
  });
}

// A skeleton walks at you slowly, and once it's close enough it stops,
// rattles (shaking, tinted gold, as a warning), then charges in a straight
// line at where you were, fast, until it's gone its distance or hits a
// wall. Then it stands still for a moment before walking again. Returns the
// function the brain calls every frame: true while it's busy charging.
const RUSH = {
  range: 80,      // px: closer than this, it gets ready to charge
  windUp: 0.5,    // seconds of rattling before it goes
  speed: 170,     // px per second while charging
  time: 0.55,     // seconds a charge lasts at most
  rest: 0.7,      // seconds standing still afterwards
  cooldown: 1.6,  // seconds before it can charge again
};
function setupRush(mob, room) {
  let state = "walk";
  let until = 0;
  let readyAt = time() + rand(0.5, 1.5); // they don't all charge the moment they're up
  let way = vec2(0);
  return () => {
    const now = time();
    if (state === "walk") {
      if (now < readyAt || room.player.pos.dist(mob.pos) > RUSH.range) return false;
      state = "windUp";
      until = now + RUSH.windUp;
      mob.play("idle");
      playSound("charge");
    }
    if (state === "windUp") {
      // Shaking on the spot, in gold, says "here it comes".
      mob.color = Math.floor(now * 16) % 2 ? rgb(255, 205, 70) : mob.tint;
      mob.angle = Math.sin(now * 60) * 6;
      if (now < until) return true;
      mob.color = mob.tint;
      mob.angle = 0;
      way = room.player.pos.sub(mob.pos).unit();
      mob.flipX = way.x < 0;
      state = "charge";
      mob.charging = true;
      until = now + RUSH.time;
      mob.play("run");
      playSound("dash");
    }
    if (state === "charge") {
      const before = mob.pos.clone();
      mob.move(way.scale(RUSH.speed));
      keepInRoom(mob, mob.def.feet);
      if (Math.random() < 0.3) puffDust(mob.pos.x, mob.pos.y, 1, 4, 9);
      const blocked = mob.pos.dist(before) < RUSH.speed * dt() * 0.3; // ran into a wall
      if (now < until && !blocked) return true;
      state = "rest";
      mob.charging = false;
      until = now + RUSH.rest;
      mob.play("idle");
    }
    if (state === "rest") {
      if (now < until) return true;
      state = "walk";
      readyAt = now + RUSH.cooldown;
    }
    return false;
  };
}

// A small health bar above a boss, with a notch at half: that's where it
// becomes enraged.
function setupHealthBar(mob) {
  mob.onDraw(() => {
    const width = 30;
    const y = -mob.def.size - 6;
    drawRect({ pos: vec2(-width / 2 - 1, y - 1), width: width + 2, height: 5, color: rgb(24, 20, 37) });
    drawRect({
      pos: vec2(-width / 2, y), width: (width * Math.max(0, mob.hp)) / mob.maxHp, height: 3,
      color: mob.raging ? rgb(255, 40, 40) : rgb(230, 72, 46),
    });
    drawRect({ pos: vec2(-0.5, y - 1), width: 1, height: 5, color: rgb(24, 20, 37) });
  });
}
