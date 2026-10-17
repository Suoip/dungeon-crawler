import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BALANCE } from "./balance.js";
import { subDepthScale } from "./stats.js";
import { sleep, during, animate, puffDust, addShadow, addSpawnHole, sparks, shakeScreen } from "./effects.js";
import { playSound } from "./sound.js";
import { setupBoss } from "./boss.js";
import { addShot } from "./shots.js";
import { keepInRoom, roomLimits } from "./room.js";
import { popNumber } from "./hud.js";

// How the monsters look and move. `feet` is the size of the box at their
// feet that collides (like the hero's), `speed` is in pixels per second, and
// `size` is how tall the sprite is. Their hp, gold and XP come from
// src/balance.js, grown by how deep the room is. A boss's `favorite` is the
// move it casts most often, and `minions` are what it raises (boss.js).
export const MOB_TYPES = {
  // The crypt
  tiny_zombie: { speed: 26, feet: [10, 6], size: 16 },
  skeleton:    { speed: 30, feet: [10, 6], size: 16, rusher: true }, // winds up, then charges in a line
  slug:        { speed: 14, feet: [12, 6], size: 23 },               // wanders about, never hunts (balance.js `wanders`)
  mimic:       { speed: 40, feet: [12, 6], size: 16, rusher: true },  // a chest that woke up (crypt.js): lunges like a skeleton
  // The goblin warrens
  goblin:      { speed: 52, feet: [10, 6], size: 16 },
  imp:         { speed: 40, feet: [10, 6], size: 16, shooter: true }, // keeps its distance and throws fireballs
  wogol:       { speed: 38, feet: [10, 6], size: 23, bomber: true },  // runs up and explodes
  // Others, for the old bosses' minions (not in balance.js: a fixed hp).
  orc_warrior: { speed: 36, feet: [10, 6], size: 23, hp: 5 },
  // Bosses
  big_demon:   { speed: 28, feet: [22, 8], size: 36, boss: true, name: "BIG DEMON", favorite: "dash" },
  ogre:        { speed: 30, feet: [22, 8], size: 36, boss: true, name: "OGRE", favorite: "vomit", knockback: 3, minions: ["goblin"] },
  big_zombie:  { speed: 16, feet: [22, 8], size: 36, boss: true, name: "BIG ZOMBIE", favorite: "spawn", minions: ["tiny_zombie"] },
};

// A monster's hp, gold and XP in this room (`room.sub` of `room.depth`). The
// depth's boss has its own numbers in balance.js; anything not in balance.js
// has a fixed hp.
function numbersFor(type, room) {
  const depth = BALANCE.depths[room.depth - 1];
  if (type === depth.boss.type) return { hp: depth.boss.hp, gold: depth.boss.gold, xp: 0 };
  const data = BALANCE.mobs[type];
  if (!data) return { hp: MOB_TYPES[type].hp, gold: 1, xp: 1 };
  const scale = subDepthScale(room.sub);
  return { hp: Math.ceil(data.hp * scale.hp * depth.scale.hp), gold: data.gold * scale.gold * depth.scale.gold, xp: data.xp };
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
// is beaten. With `quick`, it skips the dust and just pops out (what a
// splitter splits into).
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
  const numbers = numbersFor(type, room);
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
// up over it (bigger and gold for a critical hit). Returns true if that hit
// beat it.
export function hurtMob(mob, from, room, damage = 1, crit = false) {
  if (!mob.active) return false;
  mob.hp -= damage;
  playSound(crit ? "crit" : "mobHit");
  popNumber(mob.pos.add(rand(-3, 3), -mob.def.size - 2), damage, crit);
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
  // A wogol goes off anyway, a moment later, where it fell.
  if (mob.def.bomber) blowUp(mob.pos.clone(), room, mob.fuseLeft ?? BOMB.afterDeath);
  // A splitter (balance.js `splitsInto`) splits: its children pop out where it fell.
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
// (for bosses) their special move, or (for skeletons) charge, or (for
// slugs) wander about, or (for imps) keep their distance and shoot, or (for
// wogols) go off when they're close.
function setupBrain(mob, room) {
  const rush = mob.def.rusher ? setupRush(mob, room) : null;
  const wander = BALANCE.mobs[mob.type]?.wanders ? setupWander(mob) : null;
  const shoot = mob.def.shooter ? setupShooter(mob, room) : null;
  const bomb = mob.def.bomber ? setupBomber(mob, room) : null;
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
    if (wander) return wander();                // it doesn't hunt
    if (shoot) return shoot();                  // it keeps its distance
    if (bomb && bomb()) return;                 // its fuse is lit
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

// A wanderer (a slug) never comes after the hero. It crawls off one way for
// a while, sometimes rests, then picks another way; when it runs into a wall
// or something solid, it turns. It still hurts if he walks into it, and
// being hit doesn't change its mind.
function setupWander(mob) {
  let way = vec2(0);
  let until = 0;   // when it picks a new way
  let last = null; // where it was last frame, to tell when it's stuck
  let stuck = 0;   // seconds it has barely moved while crawling
  return () => {
    const now = time();
    if (last && way.len() > 0) stuck = mob.pos.dist(last) < mob.speed * dt() * 0.3 ? stuck + dt() : 0;
    if (now >= until || stuck > 0.15) {
      const rest = way.len() > 0 && stuck === 0 && chance(0.35);
      const angle = rand(0, Math.PI * 2);
      way = rest ? vec2(0) : vec2(Math.cos(angle), Math.sin(angle));
      until = now + (rest ? rand(0.6, 1.4) : rand(1.2, 2.6));
      stuck = 0;
    }
    last = mob.pos.clone();
    if (way.len() === 0) {
      if (mob.getCurAnim()?.name !== "idle") mob.play("idle");
      return;
    }
    mob.move(way.scale(mob.speed));
    keepInRoom(mob, mob.def.feet);
    mob.flipX = way.x < 0;
    if (mob.getCurAnim()?.name !== "run") mob.play("run");
  };
}

// An imp keeps its distance. It heads for a spot SHOOT.keep px from the
// hero on its own side of him, nudged around him away from the other imps,
// so they spread out and come at him from different angles. It never runs
// off to a far corner: the spot is always about that far from him (pressed
// against a wall if it must). Every few seconds it stops, glows orange (the
// warning), and throws a fireball at where he is. The fireball can only be
// dodged (shots.js), and pillars and crates stop it.
const SHOOT = {
  keep: 80,            // px it likes to be from the hero
  spread: 1.6,         // radians (about 90°): closer than this around him, imps push apart
  every: [2.2, 3.4],   // seconds between throws, picked at random
  range: 170,          // px: it only throws from closer than this
  windUp: 0.5,         // seconds of glowing before it throws
  speed: 72,           // px per second (a little slower than the hero walks)
};
function setupShooter(mob, room) {
  let nextShot = time() + rand(1, 2); // they don't all throw the moment they're up
  let throwAt = null;                 // while winding up: when it throws
  const limits = roomLimits(mob.def.feet);
  return () => {
    const now = time();
    const hero = room.player.pos;
    mob.flipX = hero.x < mob.pos.x; // it always faces him

    if (throwAt !== null) {
      mob.color = Math.floor(now * 16) % 2 ? rgb(255, 150, 60) : mob.tint;
      if (now < throwAt) return;
      mob.color = mob.tint;
      throwAt = null;
      nextShot = now + rand(...SHOOT.every);
      const dir = hero.sub(mob.pos).unit();
      addShot(mob.pos.add(dir.scale(8)), dir, { speed: SHOOT.speed, look: "fire" });
      playSound("fireball");
      return;
    }
    if (now >= nextShot && hero.dist(mob.pos) < SHOOT.range) {
      throwAt = now + SHOOT.windUp;
      mob.play("idle");
      playSound("charge");
      return;
    }

    // Where to stand: on its side of him, pushed around him away from the
    // imps that are close to it (by angle).
    const angleOf = (p) => Math.atan2(p.y - hero.y, p.x - hero.x);
    const mine = angleOf(mob.pos);
    let push = 0;
    for (const other of get("mob")) {
      if (other === mob || !other.active || !other.def.shooter) continue;
      let diff = mine - angleOf(other.pos);
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // -π to π
      if (Math.abs(diff) < SHOOT.spread) push += (diff === 0 ? 1 : Math.sign(diff)) * (1 - Math.abs(diff) / SHOOT.spread);
    }
    const angle = mine + clamp(push, -1, 1) * 0.8;
    const spot = vec2(
      clamp(hero.x + Math.cos(angle) * SHOOT.keep, limits.left + 8, limits.right - 8),
      clamp(hero.y + Math.sin(angle) * SHOOT.keep, limits.top + 4, limits.bottom - 4),
    );
    const toSpot = spot.sub(mob.pos);
    if (toSpot.len() > 4) {
      mob.move(toSpot.unit().scale(mob.speed));
      keepInRoom(mob, mob.def.feet);
      if (mob.getCurAnim()?.name !== "run") mob.play("run");
    } else if (mob.getCurAnim()?.name !== "idle") mob.play("idle");
  };
}

// A wogol runs at the hero, and once it's close it stops, flashes, swells,
// and goes off, with the blast's reach marked on the floor while the fuse
// burns. The blast hurts only the hero (not other monsters). Beating it
// doesn't stop it: it goes off a moment later where it fell (hurtMob). When
// it goes off by itself, it's gone, with no gold or XP. Returns the function
// the brain calls every frame: true while its fuse is lit.
const BOMB = {
  range: 22,         // px: closer than this, its fuse is lit
  fuse: 0.7,         // seconds from lighting to the blast
  afterDeath: 0.45,  // seconds from being beaten to the blast
  radius: 30,        // px the blast reaches sideways (70% of that up and down, like its mark on the floor)
};
// Whether `at` is inside the blast's reach around `middle`.
const inBlast = (at, middle) => ((at.x - middle.x) / BOMB.radius) ** 2 + ((at.y - middle.y) / (BOMB.radius * 0.7)) ** 2 < 1;
function setupBomber(mob, room) {
  let blastAt = null;
  mob.onDraw(() => {
    if (blastAt !== null && mob.active) blastMark(vec2(0), blastAt - time());
  });
  return () => {
    const now = time();
    if (blastAt === null) {
      if (room.player.pos.dist(mob.pos) > BOMB.range) return false; // still chasing him
      blastAt = now + BOMB.fuse;
      mob.play("idle");
      playSound("fuse");
    }
    mob.fuseLeft = Math.max(0.05, blastAt - now); // if it's beaten now, the blast still comes on time
    mob.color = Math.floor(now * 20) % 2 ? rgb(255, 255, 255) : rgb(255, 90, 90);
    mob.scale = vec2(1 + 0.25 * (1 - (blastAt - now) / BOMB.fuse));
    if (now < blastAt) return true;
    // It goes off: it's gone, without counting as beaten.
    mob.active = false;
    mob.dead = true;
    room.onVanish?.(mob);
    explode(mob.pos.clone(), room);
    destroy(mob);
    return true;
  };
}

// The blast's reach on the floor around `at` (relative to whatever draws it),
// blinking faster as `left` (seconds until the blast) runs out.
function blastMark(at, left) {
  const blink = Math.floor(time() * (left < 0.25 ? 24 : 12)) % 2;
  drawEllipse({
    pos: at, radiusX: BOMB.radius, radiusY: BOMB.radius * 0.7,
    fill: false, outline: { width: 1, color: blink ? rgb(255, 90, 90) : rgb(255, 205, 70) },
  });
}

// A beaten wogol: its blast mark blinks where it fell, then it goes off.
function blowUp(at, room, delay) {
  const mark = add([pos(at), z(6)]);
  const blastAt = time() + delay;
  mark.onDraw(() => blastMark(vec2(0), blastAt - time()));
  wait(delay, () => {
    destroy(mark);
    explode(at, room);
  });
}

// The blast: smoke, sparks, a boom, and for a moment it's a hazard that
// hurts the hero (setupHurt in combat.js) if he's within its reach. Nothing
// happens once the room is over or frozen (the run ended, or the boss is
// making its entrance).
function explode(at, room) {
  if (room.over || room.frozen) return;
  playSound("boom");
  shakeScreen(4);
  puffDust(at.x, at.y - 4, 16, 20, 11);
  for (let i = 0; i < 4; i++) sparks(at.x + rand(-10, 10), at.y - rand(2, 12), 3);
  const born = time();
  const blast = add([
    pos(at),
    z(11),
    "hazard",
    { touches: (player) => time() - born < 0.12 && inBlast(player.pos, at) },
  ]);
  blast.onDraw(() => {
    const t = Math.min(1, (time() - born) / 0.25);
    drawEllipse({ pos: vec2(0, -4), radiusX: Math.max(1, BOMB.radius * t), radiusY: Math.max(1, BOMB.radius * 0.7 * t), color: rgb(255, 205, 70), opacity: 0.6 * (1 - t) });
  });
  wait(0.25, () => destroy(blast));
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
