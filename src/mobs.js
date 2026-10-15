import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { sleep, animate, puffDust } from "./effects.js";
import { playSound } from "./sound.js";

// The monsters. `feet` is the size of the box at their feet that collides
// (like the hero's), `speed` is in pixels per second, `hp` is how many hits
// it takes to beat them.
export const MOB_TYPES = {
  tiny_zombie: { hp: 1, speed: 26, feet: [10, 6], size: 16 },
  goblin:      { hp: 1, speed: 52, feet: [10, 6], size: 16 },
  orc_warrior: { hp: 2, speed: 36, feet: [10, 6], size: 23 },
  big_demon:   { hp: 8, speed: 28, feet: [22, 8], size: 36, boss: "charge" },
  ogre:        { hp: 14, speed: 30, feet: [22, 8], size: 36, boss: "heavy", knockback: 3 },
  big_zombie:  { hp: 8, speed: 16, feet: [22, 8], size: 36, boss: "summon" },
};

// For the boss-select test room.
export const BOSSES = [
  { id: "big_demon", label: "DEMON", name: "Big Demon", blurb: "charges in a straight line after a warning flash" },
  { id: "ogre", label: "OGRE", name: "Ogre", blurb: "very tough, and knocks you far back" },
  { id: "big_zombie", label: "ZOMBIE", name: "Big Zombie", blurb: "very slow, but keeps raising tiny zombies" },
];

// Which mobs a room gets. `depth` starts at 1; the last question room has the
// boss. It gets steeper as you go deeper.
export function mobsForRoom(depth, totalRooms, boss) {
  if (depth === totalRooms) return [boss];
  if (depth <= 3) return ["tiny_zombie", "tiny_zombie"];
  if (depth <= 6) return ["tiny_zombie", "goblin", "goblin"];
  if (depth <= 8) return ["goblin", "orc_warrior", "orc_warrior"];
  return ["goblin", "goblin", "orc_warrior", "orc_warrior"];
}

// A random spot on the floor, not too close to the player (so a mob never
// appears right on top of them).
function spawnSpot(player) {
  for (let tries = 0; tries < 50; tries++) {
    const spot = vec2(rand(32, GAME_WIDTH - 32), rand(TOP + 3 * TILE + 8, GAME_HEIGHT - 20));
    if (spot.dist(player.pos) > 70) return spot;
  }
  return vec2(40, TOP + 5 * TILE);
}

// Raises a mob out of the floor: first some dust swirls on the spot as a
// warning, then it pops up. It can't hurt anyone until it's fully up.
// `room` is { player, rising, onSpawn(mob), onDeath(mob) } from the room
// scene. `room.rising` counts mobs still on their way up, so the room doesn't
// think it's clear while one is still appearing.
export async function raiseMob(type, room, at = null) {
  const def = MOB_TYPES[type];
  const spot = at ?? (def.boss ? vec2(GAME_WIDTH / 2, TOP + 6 * TILE) : spawnSpot(room.player));
  room.rising++;

  const dust = loop(0.12, () => puffDust(spot.x, spot.y, 2, def.boss ? 14 : 6, 9));
  await sleep(0.8);
  dust.cancel();
  room.rising--;
  if (room.over) return null; // the room ended while we waited

  playSound("spawn");
  const mob = add([
    sprite(type, { anim: "idle" }),
    pos(spot),
    anchor("bot"),
    area({ shape: new Rect(vec2(0), def.feet[0], def.feet[1]) }),
    body(),
    scale(vec2(1, 0)),
    color(255, 255, 255),
    z(10),
    "mob",
    {
      type, def,
      hp: def.hp,
      active: false,            // false while rising, dying or frozen
      knockVel: vec2(0), knockTime: 0,
      // For bosses: what they're doing right now and for how long.
      mode: "chase", modeTime: 0, chargeDir: vec2(0),
    },
  ]);
  room.onSpawn(mob);
  setupBrain(mob, room);
  if (def.boss) setupHealthBar(mob);

  await animate(0, 1, 0.25, (t) => (mob.scale = vec2(1, t)), easings.easeOutBack);
  mob.active = true;
  return mob;
}

// Knocks a mob back and makes it flash. Returns true if that hit beat it.
export function hurtMob(mob, from, room) {
  if (!mob.active) return false;
  mob.hp--;
  playSound("mobHit");
  mob.color = rgb(255, 110, 110);
  wait(0.1, () => mob.exists() && (mob.color = rgb(255, 255, 255)));

  // Pushed away from whoever hit it. Bosses barely budge.
  const away = mob.pos.sub(from).unit();
  mob.knockVel = away.scale(mob.def.boss ? 60 : 220);
  mob.knockTime = 0.12;

  if (mob.hp > 0) return false;
  mob.active = false;
  playSound("mobDie");
  puffDust(mob.pos.x, mob.pos.y - mob.def.size / 2, 10, 14, 11);
  animate(1, 0, 0.2, (t) => (mob.scale = vec2(1 + (1 - t) * 0.5, t))).then(() => {
    destroy(mob);
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
      return;
    }

    if (mob.def.boss === "charge" && chargeBrain(mob, room.player)) return;
    if (mob.def.boss === "summon") summonBrain(mob, room);

    const toPlayer = room.player.pos.sub(mob.pos);
    if (toPlayer.len() > 2) {
      mob.move(toPlayer.unit().scale(mob.def.speed));
      mob.flipX = toPlayer.x < 0;
      if (mob.getCurAnim()?.name !== "run") mob.play("run");
    }
  });
}

// The demon: every few seconds it stops, flashes red as a warning, then
// charges in a straight line at where the player was. Returns true while
// it's doing that (so it doesn't also chase).
function chargeBrain(mob, player) {
  mob.modeTime += dt();
  if (mob.mode === "chase" && mob.modeTime > 3.5) {
    mob.mode = "warn";
    mob.modeTime = 0;
    playSound("charge");
  }
  if (mob.mode === "warn") {
    mob.color = Math.floor(mob.modeTime * 12) % 2 ? rgb(255, 90, 90) : rgb(255, 255, 255);
    if (mob.modeTime > 0.6) {
      mob.mode = "charge";
      mob.modeTime = 0;
      mob.color = rgb(255, 255, 255);
      mob.chargeDir = player.pos.sub(mob.pos).unit();
      mob.flipX = mob.chargeDir.x < 0;
    }
    return true;
  }
  if (mob.mode === "charge") {
    mob.move(mob.chargeDir.scale(210));
    if (mob.getCurAnim()?.name !== "run") mob.play("run");
    if (mob.modeTime > 0.6) {
      mob.mode = "chase";
      mob.modeTime = 0;
    }
    return true;
  }
  return false;
}

// The big zombie: every few seconds it raises a tiny zombie nearby, up to 3
// at a time.
function summonBrain(mob, room) {
  mob.modeTime += dt();
  if (mob.modeTime < 4) return;
  mob.modeTime = 0;
  const minions = get("mob").filter((m) => m.type === "tiny_zombie");
  if (minions.length >= 3) return;
  const spot = vec2(
    clamp(mob.pos.x + rand(-40, 40), 32, GAME_WIDTH - 32),
    clamp(mob.pos.y + rand(-20, 30), TOP + 3 * TILE + 8, GAME_HEIGHT - 20),
  );
  raiseMob("tiny_zombie", room, spot);
}

// A small health bar above a boss.
function setupHealthBar(mob) {
  mob.onDraw(() => {
    const width = 30;
    const y = -mob.def.size - 6;
    drawRect({ pos: vec2(-width / 2 - 1, y - 1), width: width + 2, height: 5, color: rgb(24, 20, 37) });
    drawRect({ pos: vec2(-width / 2, y), width: (width * Math.max(0, mob.hp)) / mob.def.hp, height: 3, color: rgb(230, 72, 46) });
  });
}
