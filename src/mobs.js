import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { sleep, animate, puffDust, hitStop, addShadow, addSpawnHole, sparks } from "./effects.js";
import { playSound } from "./sound.js";
import { setupBoss } from "./boss.js";
import { keepInRoom } from "./room.js";

// The monsters. `feet` is the size of the box at their feet that collides
// (like the hero's), `speed` is in pixels per second, `hp` is how many hits
// it takes to beat them. A boss's `favorite` is the move it casts most often
// (see boss.js).
export const MOB_TYPES = {
  tiny_zombie: { hp: 2, speed: 26, feet: [10, 6], size: 16 },
  goblin:      { hp: 3, speed: 52, feet: [10, 6], size: 16 },
  orc_warrior: { hp: 5, speed: 36, feet: [10, 6], size: 23 },
  big_demon:   { hp: 24, speed: 28, feet: [22, 8], size: 36, boss: true, name: "BIG DEMON", favorite: "dash" },
  ogre:        { hp: 42, speed: 30, feet: [22, 8], size: 36, boss: true, name: "OGRE", favorite: "vomit", knockback: 3 },
  big_zombie:  { hp: 24, speed: 16, feet: [22, 8], size: 36, boss: true, name: "BIG ZOMBIE", favorite: "spawn" },
};

// Cursed mobs (the punishment for a wrong door) are tinted red and faster.
const CURSED_TINT = [255, 140, 140];
const CURSED_SPEED = 1.25;

// For the boss-select test room.
export const BOSSES = [
  { id: "big_demon", label: "DEMON", name: "Big Demon", blurb: "loves to dash at you, leaving fire behind" },
  { id: "ogre", label: "OGRE", name: "Ogre", blurb: "very tough, vomits a lot, and knocks you far back" },
  { id: "big_zombie", label: "ZOMBIE", name: "Big Zombie", blurb: "very slow, but keeps raising the dead" },
];

// The waves of mobs a room sends at you, one list of mobs per wave. Deeper
// rooms have more waves, and tougher mobs in them.
const Z = "tiny_zombie", G = "goblin", O = "orc_warrior";
const TIERS = [
  [[Z, Z, Z], [Z, Z, G]],                                  // depth 1-3
  [[Z, G, G], [Z, Z, G, G], [G, G, O]],                    // depth 4-6
  [[G, G, O], [G, O, O], [G, G, O, O]],                    // depth 7-8
  [[G, G, O], [G, O, O], [G, G, O, O], [O, O, O]],         // depth 9
];
const tierOf = (depth) => (depth <= 3 ? 0 : depth <= 6 ? 1 : depth <= 8 ? 2 : 3);

// `depth` starts at 1. The last question room has only the boss (it raises
// its own minions, see boss.js).
export function wavesForRoom(depth, totalRooms, boss) {
  if (depth === totalRooms) return [[boss]];
  return TIERS[tierOf(depth)];
}

// The punishment for a wrong door: two waves from the next tier down (the
// hardest two it has). In the boss room, and at depth 9, that's the
// toughest tier there is.
export function cursedWaves(depth, totalRooms) {
  const tier = depth === totalRooms ? TIERS.length - 1 : Math.min(tierOf(depth) + 1, TIERS.length - 1);
  return TIERS[tier].slice(-2);
}

// Raises a room's waves one after another. The next wave starts rising as
// soon as only one mob of the current wave is left (the boss doesn't count),
// so there's never a quiet moment. `room.waiting` counts waves that haven't
// started yet, so the room doesn't think it's clear in between.
//   cursed  the mobs are cursed (red and faster)
//   spots   where they rise (cursed mobs crawl out of the floor cracks)
export function startWaves(waves, room, { cursed = false, spots = null } = {}) {
  room.waiting += waves.length;
  let next = 0;

  function raiseWave() {
    if (room.over || next >= waves.length) return;
    const wave = waves[next++];
    room.waiting--;
    if (waves.length > 1) room.onWave?.(next, waves.length, cursed); // (no "WAVE 1/1" for a lone boss)

    let left = wave.filter((type) => !MOB_TYPES[type].boss).length;
    let started = false;
    const died = () => {
      left--;
      if (left <= 1 && !started) {
        started = true;
        raiseWave();
      }
    };
    wave.forEach((type, i) => {
      const spot = spots && !MOB_TYPES[type].boss
        ? spots[i % spots.length].add(rand(-10, 10), rand(-6, 6))
        : null;
      raiseMob(type, room, { at: spot, delay: i * 0.25, cursed, onDeath: MOB_TYPES[type].boss ? null : died });
    });
  }
  raiseWave();
}

// A random spot on the floor, not too close to the player (so a mob never
// appears right on top of them).
export function spawnSpot(player) {
  for (let tries = 0; tries < 50; tries++) {
    const spot = vec2(rand(32, GAME_WIDTH - 32), rand(TOP + 3 * TILE + 8, GAME_HEIGHT - 20));
    if (spot.dist(player.pos) > 70) return spot;
  }
  return vec2(40, TOP + 5 * TILE);
}

// Raises a mob out of the floor: first some dust swirls on the spot as a
// warning, then it pops up. It can't hurt anyone until it's fully up.
// `room` is { player, rising, onSpawn(mob), onDeath(mob) } from the room
// scene. `room.rising` counts mobs still on their way up (or waiting to
// start, after `delay` seconds), so the room doesn't think it's clear while
// one is still appearing. `onDeath` is called when this mob is beaten.
export async function raiseMob(type, room, { at = null, delay = 0, cursed = false, onDeath = null } = {}) {
  const def = MOB_TYPES[type];
  room.rising++;
  await sleep(delay);
  if (room.over) {
    room.rising--;
    return null;
  }
  const spot = at ?? (def.boss ? vec2(GAME_WIDTH / 2, TOP + 6 * TILE) : spawnSpot(room.player));

  const closeHole = addSpawnHole(spot, def.feet[0]);
  const dust = loop(0.12, () => puffDust(spot.x, spot.y, 2, def.boss ? 14 : 6, 9));
  await sleep(0.8);
  dust.cancel();
  room.rising--;
  if (room.over) {
    closeHole();
    return null; // the room ended while we waited
  }

  playSound("spawn");
  const mob = add([
    sprite(type, { anim: "idle" }),
    pos(spot),
    anchor("bot"),
    area({ shape: new Rect(vec2(0), def.feet[0], def.feet[1]) }),
    body(),
    scale(vec2(1, 0)),
    color(...(cursed ? CURSED_TINT : [255, 255, 255])),
    z(10),
    "mob",
    {
      type, def, cursed, onBeaten: onDeath,
      hp: def.hp,
      speed: def.speed * (cursed ? CURSED_SPEED : 1),
      tint: rgb(...(cursed ? CURSED_TINT : [255, 255, 255])), // its normal color, to go back to after a flash
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

  await animate(0, 1, 0.25, (t) => (mob.scale = vec2(1, t)), easings.easeOutBack);
  closeHole();
  mob.active = true;
  return mob;
}

// Knocks a mob back and makes it flash. Returns true if that hit beat it.
export function hurtMob(mob, from, room) {
  if (!mob.active) return false;
  mob.hp--;
  playSound("mobHit");
  hitStop(mob.hp > 0 ? 0.04 : 0.08); // a tiny freeze, so the hit feels heavy
  // Sparks on the side of the mob that got hit.
  const middle = mob.pos.sub(0, mob.def.size / 2);
  const toward = from.sub(0, 10).sub(middle).unit().scale(Math.min(8, mob.def.size / 3));
  sparks(middle.x + toward.x, middle.y + toward.y);
  mob.color = mob.cursed ? rgb(190, 40, 40) : rgb(255, 110, 110);
  wait(0.1, () => mob.exists() && (mob.color = mob.tint));

  // Pushed away from whoever hit it. Bosses barely budge, and not at all in
  // the middle of a move.
  if (!(mob.def.boss && mob.busy)) {
    const away = mob.pos.sub(from).unit();
    mob.knockVel = away.scale(mob.def.boss ? 60 : 220);
    mob.knockTime = 0.12;
  }

  if (mob.hp > 0) return false;
  mob.active = false;
  playSound("mobDie");
  puffDust(mob.pos.x, mob.pos.y - mob.def.size / 2, 10, 14, 11);
  animate(1, 0, 0.2, (t) => (mob.scale = vec2(1 + (1 - t) * 0.5, t))).then(() => {
    destroy(mob);
    mob.onBeaten?.();
    room.onDeath(mob);
  });
  return true;
}

// What a mob does every frame: get knocked back, or chase the player, or
// (for bosses) their special move.
function setupBrain(mob, room) {
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
    const toPlayer = room.player.pos.sub(mob.pos);
    if (toPlayer.len() > 2) {
      mob.move(toPlayer.unit().scale(mob.speed));
      keepInRoom(mob, mob.def.feet);
      mob.flipX = toPlayer.x < 0;
      if (mob.getCurAnim()?.name !== "run") mob.play("run");
    }
  });
}

// A small health bar above a boss, with a notch at half: that's where it
// becomes enraged.
function setupHealthBar(mob) {
  mob.onDraw(() => {
    const width = 30;
    const y = -mob.def.size - 6;
    drawRect({ pos: vec2(-width / 2 - 1, y - 1), width: width + 2, height: 5, color: rgb(24, 20, 37) });
    drawRect({
      pos: vec2(-width / 2, y), width: (width * Math.max(0, mob.hp)) / mob.def.hp, height: 3,
      color: mob.raging ? rgb(255, 40, 40) : rgb(230, 72, 46),
    });
    drawRect({ pos: vec2(-0.5, y - 1), width: 1, height: 5, color: rgb(24, 20, 37) });
  });
}
