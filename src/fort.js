import { BALANCE } from "./balance.js";
import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { LAND_X, LAND_Y } from "./cutscenes.js";
import { hurtMob } from "./mobs.js";
import { inRoom, inSolid, SHOT_HEIGHT } from "./shots.js";
import { playSound } from "./sound.js";
import { shakeScreen, flashScreen, puffDust } from "./effects.js";

// The orc fort's gimmicks (balance.js depths' `drums` and `plates`,
// DESIGN.md section 3): the war drums, and pressure plates that fire arrows
// from the walls.

// ---- War drums ------------------------------------------------------------------

// Now and then, at random, the war drums beat. A single deep boom warns of
// them; then, for as long as they beat, the orcs rage: they glow red, move
// faster (with a red glow on the floor under them, pulsing with the beat),
// a touch costs the depth's special hit instead of one heart, and
// nothing hurts them (mobs.js hurtMob, combat.js setupHurt). So he's the prey
// for a few seconds, and runs. They stop for good once the room's bar is
// full.
const BEAT = 0.5;                       // seconds between beats
const RAGE_TINT = [255, 170, 160];      // a raging orc's tint
export function setupDrums(fight, run) {
  const rules = BALANCE.depths[run.depth - 1].drums;
  if (!rules) return;
  let wait = rand(...rules.every); // seconds of quiet left
  let warning = 0;                 // seconds of warning left
  let beating = 0;                 // seconds of drumming left
  let nextBeat = 0;
  const setRage = (raging) => {
    fight.raging = raging;
    for (const mob of get("mob")) {
      if (!rules.types.includes(mob.type) || mob.dead) continue;
      if (mob.raging === raging) continue;
      mob.raging = raging;
      mob.speed = mob.def.speed * (raging ? rules.speed : 1);
      mob.tint = raging ? rgb(...RAGE_TINT) : rgb(255, 255, 255);
      mob.color = mob.tint;
    }
  };
  let beatAt = 0; // when the last beat landed
  const glow = add([pos(0, 0), z(9)]); // under the monsters (z 10 and up)
  glow.onDraw(() => {
    if (!fight.raging) return;
    const pulse = Math.max(0, 1 - (time() - beatAt) / BEAT);
    for (const mob of get("mob")) {
      if (!mob.raging || !mob.active) continue;
      const width = mob.def.feet[0] / 2 + 6;
      drawEllipse({ pos: mob.pos.sub(0, 1), radiusX: width + pulse * 2, radiusY: 4 + pulse, color: rgb(230, 40, 30), opacity: 0.3 + 0.35 * pulse });
    }
  });
  onUpdate(() => {
    if (fight.over || fight.frozen || fight.full) {
      if (fight.raging) setRage(false);
      return;
    }
    if (beating > 0) {
      beating -= dt();
      nextBeat -= dt();
      if (nextBeat <= 0) {
        nextBeat += BEAT;
        beatAt = time();
        playSound("drum");
        shakeScreen(1);
      }
      if (beating <= 0) {
        setRage(false);
        wait = rand(...rules.every);
      } else setRage(true); // and any orc that has just risen joins in
      return;
    }
    if (warning > 0) {
      warning -= dt();
      if (warning <= 0) {
        beating = rules.lasts;
        nextBeat = 0;
        flashScreen([200, 40, 30], 0.2, 0.3);
      }
      return;
    }
    wait -= dt();
    if (wait <= 0) {
      warning = rules.warning;
      playSound("drumWarn");
      shakeScreen(2);
    }
  });
}

// ---- Pressure plates ------------------------------------------------------------

// A few pressure plates on the floor of each room, each with an arrow
// shooter in one of the side walls, level with it. When he steps on one, it
// clicks down, and a moment later the shooter fires an arrow straight across
// the room. The arrow costs him the depth's special hit, and hurts the first
// monster it meets too (a share of its health: he can lure orcs into the
// line, though not while the drums have them raging); pillars, breakables
// and chests stop it. A plate comes back up once he's off it.
export function setupPlates(fight, run, solid) {
  const rules = BALANCE.depths[run.depth - 1].plates;
  if (!rules) return;
  const count = randi(rules.count[0], rules.count[1] + 1);
  for (const spot of plateSpots(count, solid)) addPlate(spot, fight, rules);
}

// Spots for the plates: on the open floor, apart from each other, away
// from where he lands, the door, the layout's solid things and its spikes.
function plateSpots(count, solid) {
  const spots = [];
  const hazards = get("hazard").map((h) => h.pos);
  for (let tries = 0; tries < 200 && spots.length < count; tries++) {
    const spot = vec2(Math.round(rand(40, GAME_WIDTH - 40)), Math.round(rand(TOP + 3 * TILE + 6, GAME_HEIGHT - 2 * TILE)));
    if (spot.dist(vec2(LAND_X, LAND_Y)) < 40) continue;
    if (solid.some((tile) => Math.abs(tile.x - spot.x) < 20 && Math.abs(tile.y - spot.y) < 18)) continue;
    if (hazards.some((h) => h.dist(spot) < 18)) continue;
    if (spots.some((other) => other.dist(spot) < 50 || Math.abs(other.y - spot.y) < 12)) continue;
    spots.push(spot);
  }
  return spots;
}

function addPlate(at, fight, rules) {
  const side = chance(0.5) ? -1 : 1; // the wall its shooter is in
  const plate = add([pos(at), z(0.6), "plate", { down: false, side }]);
  plate.onDraw(() => drawPlate(plate.down));
  // The shooter, a slit in the side wall with an arrowhead peeking out.
  const shooter = add([pos(side < 0 ? 0 : GAME_WIDTH, at.y), z(1), "shooter"]);
  shooter.onDraw(() => drawShooter(side));
  let upAt = 0; // when it may come back up
  plate.onUpdate(() => {
    const feet = fight.player.pos;
    const on = Math.abs(feet.x - at.x) < 7 && Math.abs(feet.y - 2 - at.y) < 6;
    if (plate.down) {
      if (!on && time() >= upAt) plate.down = false;
      return;
    }
    if (!on || fight.over || fight.frozen || fight.player.frozen) return;
    plate.down = true;
    upAt = time() + rules.rearm;
    playSound("plate");
    wait(rules.delay, () => !fight.over && fireArrow(vec2(side < 0 ? 7 : GAME_WIDTH - 7, at.y), -side, fight, rules));
  });
}

// An arrow flying along the floor at `from`, rightwards (`way` 1) or left.
// It's a "hazard" and a "shot" to the hero (combat.js: it costs the special
// hit, and the Shield can block it).
function fireArrow(from, way, fight, rules) {
  playSound("arrow");
  const arrow = add([
    pos(from),
    z(10),
    "hazard",
    "shot",
    {
      touches: (player) => Math.abs(arrow.pos.x - player.pos.x) < 6 && Math.abs(arrow.pos.y - player.pos.y) < 5,
      onHit: () => stop(),
    },
  ]);
  const stop = () => {
    if (!arrow.exists()) return;
    puffDust(arrow.pos.x, arrow.pos.y - SHOT_HEIGHT / 2, 3, 5, 11);
    destroy(arrow);
  };
  arrow.onUpdate(() => {
    arrow.z = 10 + arrow.pos.y / 1000;
    arrow.pos = arrow.pos.add(way * rules.arrowSpeed * dt(), 0);
    if (!inRoom(arrow.pos) || inSolid(arrow.pos)) return stop();
    // The first monster in its way takes a share of its health (a boss just
    // shrugs it off).
    const mob = get("mob").find((m) => m.active && Math.abs(m.pos.x - arrow.pos.x) < m.def.feet[0] / 2 + 3 && Math.abs(m.pos.y - arrow.pos.y) < 6);
    if (!mob) return;
    if (!mob.def.boss) hurtMob(mob, arrow.pos.sub(way * 10, 0), fight, Math.ceil(mob.maxHp * rules.mobDamage));
    stop();
  });
  arrow.onDraw(() => {
    const h = -SHOT_HEIGHT / 2; // arrows fly low
    drawRect({ pos: vec2(way > 0 ? -9 : 0, h), width: 9, height: 1, color: rgb(150, 110, 70) }); // shaft
    drawRect({ pos: vec2(way > 0 ? 0 : -3, h - 1), width: 3, height: 3, color: rgb(200, 200, 210) }); // head
    drawRect({ pos: vec2(way > 0 ? -10 : 8, h - 1), width: 2, height: 3, color: rgb(220, 220, 220) }); // fletching
  });
}

// A stone plate set in the floor, around its middle: raised with a light
// edge, or pressed flat and dark.
function drawPlate(down) {
  drawRect({ pos: vec2(-7, -5), width: 14, height: 10, color: rgb(24, 20, 37) });
  drawRect({ pos: vec2(-6, -4), width: 12, height: 8, color: down ? rgb(80, 84, 100) : rgb(120, 126, 146) });
  if (!down) {
    drawRect({ pos: vec2(-6, -4), width: 12, height: 1, color: rgb(170, 176, 196) });
    drawRect({ pos: vec2(-3, -1), width: 6, height: 2, color: rgb(96, 100, 118) }); // its mark
  }
}

// The shooter: a dark slit in the side wall (`side` -1 left, 1 right) with
// an arrowhead in it, level with its plate's row.
function drawShooter(side) {
  const x = side < 0 ? 0 : -7;
  drawRect({ pos: vec2(x, -SHOT_HEIGHT / 2 - 3), width: 7, height: 5, color: rgb(70, 74, 90) });
  drawRect({ pos: vec2(x + 1, -SHOT_HEIGHT / 2 - 2), width: 5, height: 3, color: rgb(16, 12, 22) });
  drawRect({ pos: vec2(side < 0 ? x + 4 : x + 1, -SHOT_HEIGHT / 2 - 1), width: 2, height: 1, color: rgb(200, 200, 210) });
}
