import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { heroById } from "./heroes.js";
import { getSetting } from "./settings.js";
import { hurtMob } from "./mobs.js";
import { flashScreen, shakeScreen } from "./effects.js";
import { playSound } from "./sound.js";

const SWING_COOLDOWN = 0.35; // seconds between swings
const SWING_TIME = 0.15;     // seconds the weapon takes to sweep across
const INVINCIBLE_FOR = 1;    // seconds the hero can't be hit again after a hit

// Every hero's swing covers the same area: everything in front of them out to
// SLASH_REACH, within SLASH_ARC to each side. It's a real swing: the weapon
// sweeps across that area, and hits whatever it passes through as it goes.
// Its tip leaves a trail along the outer edge, so the hit area is everything
// between the trail and the hero, whatever weapon you hold.
const SLASH_REACH = 30; // px from the hero's chest to the edge of the hit area
const SLASH_ARC = 75;   // degrees to each side of the way he's facing
const TRAIL_WIDTH = 4;  // px thickness of the trail right behind the tip
const TRAIL_LIFE = 0.16; // seconds each bit of trail lasts before it's gone

// The weapons are different sizes in the tileset (the knife is only 13 px).
// Each one is drawn at a size and held far enough out that its tip reaches
// the edge of the slash. `length` is the sprite's height in pixels.
const WEAPONS = {
  weapon_knight_sword: { length: 29, scale: 1 },
  weapon_knife: { length: 13, scale: 2 },
  weapon_red_magic_staff: { length: 30, scale: 1 },
  weapon_green_magic_staff: { length: 30, scale: 1 },
  weapon_axe: { length: 21, scale: 1 },
  weapon_spear: { length: 30, scale: 1 },
};

const chestOf = (player) => player.pos.add(0, -10);

// Angles: weapons point straight up in the sprite sheet, so here 0° = up and
// 90° = right. These convert between that and a direction.
const angleOf = (dir) => (Math.atan2(dir.x, -dir.y) * 180) / Math.PI;
const directionOf = (angle) => vec2(Math.sin((angle * Math.PI) / 180), -Math.cos((angle * Math.PI) / 180));

// The difference between two angles, from -180° to 180°.
const turnBetween = (from, to) => ((to - from + 540) % 360) - 180;

// Space swings the hero's weapon in the direction they're facing. It works
// in every room (try it in the title room); `room` is only passed in rooms
// with mobs to hit.
export function setupAttack(player, room = null) {
  let ready = 0;
  let side = 1; // swings alternate: one way, then back the other way

  onKeyPress("space", () => {
    if (player.frozen || time() < ready) return;
    ready = time() + SWING_COOLDOWN;
    swing(player, room, side);
    side = -side;
  });
}

function swing(player, room, side) {
  playSound("swing");
  const facing = angleOf(player.facing);
  const from = facing - SLASH_ARC * side;
  const to = facing + SLASH_ARC * side;

  const name = heroById(getSetting("hero")).weapon;
  const { length, scale: size } = WEAPONS[name];
  // Held out from the chest so the tip lands on the edge of the hit area.
  const holdOut = Math.max(0, SLASH_REACH - length * size);
  const blade = add([
    sprite(name),
    pos(chestOf(player)),
    anchor("bot"), // the handle end, so it swings around his hand
    rotate(from),
    scale(size),
    z(player.z + 0.01),
  ]);

  const trail = addTrail(player);
  const alreadyHit = new Set(); // each mob gets hit at most once per swing
  let last = from;

  tween(from, to, SWING_TIME, (angle) => {
    blade.angle = angle;
    blade.pos = chestOf(player).add(directionOf(angle).scale(holdOut));
    trail.extend(last, angle);
    if (room) hitSwept(player, last, angle, alreadyHit, room);
    last = angle;
  }, easings.easeOutQuad).onEnd(() => destroy(blade));
}

// Hits every mob the weapon passed through since the last frame: close
// enough, and between the angle it was at then and the angle it's at now.
function hitSwept(player, fromAngle, toAngle, alreadyHit, room) {
  const chest = chestOf(player);
  for (const mob of get("mob")) {
    if (alreadyHit.has(mob)) continue;
    const offset = mob.pos.add(0, -mob.def.size / 2).sub(chest);
    const distance = offset.len();
    const extra = mob.def.boss ? 14 : 6; // so hitting the edge of a mob counts
    if (distance > SLASH_REACH + extra) continue;

    // How many degrees the mob's size covers at that distance, so the
    // weapon only has to reach its edge, not its middle.
    const margin = (Math.atan2(extra, Math.max(distance, 1)) * 180) / Math.PI;
    const where = turnBetween(fromAngle, angleOf(offset)); // the mob's angle, measured from fromAngle
    const swept = toAngle - fromAngle;
    const low = Math.min(0, swept) - margin;
    const high = Math.max(0, swept) + margin;
    if (distance < 8 || (where >= low && where <= high)) {
      alreadyHit.add(mob);
      hurtMob(mob, player.pos, room);
    }
  }
}

// The trail behind the weapon's tip. Each bit of it is laid down where the
// tip passes and fades out on its own, so the trail grows behind the tip and
// disappears from its oldest end first, like a comet's tail. Small random
// wobbles in its edge, and little streaks of air flicking off the tip, keep
// it from looking like a perfect geometric shape.
function addTrail(player) {
  const bits = [];     // { angle, born, radius, width }
  const streaks = [];  // { angle, born, radius, length }
  const trail = add([pos(0, 0), z(player.z + 0.02)]);

  function layDown(angle) {
    bits.push({ angle, born: time(), radius: SLASH_REACH + rand(-1.5, 0.5), width: rand(0.6, 1.2) });
    if (bits.length % 3 === 0) {
      streaks.push({ angle, born: time(), radius: SLASH_REACH + rand(1, 3), length: rand(2, 4) });
    }
  }

  trail.onDraw(() => {
    const chest = chestOf(player);
    const now = time();
    const at = (angle, radius) => chest.add(directionOf(angle).scale(radius));

    // The trail: a strip of small four-sided pieces between neighbouring bits.
    for (let i = 0; i + 1 < bits.length; i++) {
      const a = bits[i];
      const b = bits[i + 1];
      const life = 1 - (now - a.born) / TRAIL_LIFE; // 1 when new, 0 when gone
      if (life <= 0) continue;
      const widthA = TRAIL_WIDTH * life * a.width;
      const widthB = TRAIL_WIDTH * (1 - (now - b.born) / TRAIL_LIFE) * b.width;
      drawPolygon({
        pts: [at(a.angle, a.radius), at(b.angle, b.radius), at(b.angle, b.radius - widthB), at(a.angle, a.radius - widthA)],
        color: rgb(240, 236, 248),
        opacity: 0.85 * life,
      });
    }

    // Streaks of air: short lines along the swing, drifting outward as they fade.
    for (const streak of streaks) {
      const life = 1 - (now - streak.born) / 0.12;
      if (life <= 0) continue;
      const radius = streak.radius + (1 - life) * 3;
      const along = directionOf(streak.angle + 90).scale(streak.length / 2);
      const middle = at(streak.angle, radius);
      drawLine({ p1: middle.sub(along), p2: middle.add(along), width: 1, color: rgb(240, 236, 248), opacity: 0.7 * life });
    }
  });

  return {
    // Lays trail down every few degrees between where the tip was and where
    // it is now, so a fast swing doesn't leave gaps.
    extend(fromAngle, toAngle) {
      const step = 5 * Math.sign(toAngle - fromAngle || 1);
      for (let angle = fromAngle; Math.abs(toAngle - angle) > 5; angle += step) layDown(angle);
      layDown(toAngle);
      // Once every bit has faded, the trail removes itself.
      wait(TRAIL_LIFE + 0.05, () => {
        if (trail.exists() && bits.every((bit) => time() - bit.born > TRAIL_LIFE)) destroy(trail);
      });
    },
  };
}

// The hearts, big and centered at the bottom of the screen, a little
// see-through so you can still see the floor under them.
export function addHearts(run) {
  const SIZE = 13 * 2; // the heart sprite is 13 px wide, drawn at 2x
  const GAP = 6;
  const total = run.maxHearts * SIZE + (run.maxHearts - 1) * GAP;
  const hearts = Array.from({ length: run.maxHearts }, (_, i) => add([
    sprite("heart_full"),
    pos(GAME_WIDTH / 2 - total / 2 + i * (SIZE + GAP), GAME_HEIGHT - 6),
    anchor("botleft"),
    scale(2),
    opacity(0.85),
    z(50), // above everything in the room, below the fades
  ]));

  return {
    update() {
      hearts.forEach((heart, i) => heart.use(sprite(i < run.hearts ? "heart_full" : "heart_empty")));
    },
    // The heart that was just lost pops, so you notice.
    pop() {
      const heart = hearts[run.hearts];
      if (!heart) return;
      tween(3.2, 2, 0.3, (s) => (heart.scale = vec2(s)), easings.easeOutBack);
    },
  };
}

// Mobs hurt the hero by touching him. Each hit costs a whole heart, knocks
// him back, and makes him blink for a moment, during which he can't be hit
// again. `onDeath` runs when the last heart is gone.
export function setupHurt(player, run, heartsHud, room, onDeath) {
  let invincibleUntil = 0;
  let knockVel = vec2(0);
  let knockTime = 0;

  player.onUpdate(() => {
    if (knockTime > 0) {
      knockTime -= dt();
      player.move(knockVel);
    }

    const blinking = time() < invincibleUntil;
    if (!player.frozen) player.opacity = blinking && Math.floor(time() * 12) % 2 ? 0.3 : 1;
    if (player.frozen || blinking || room.over || run.hearts <= 0) return;

    const attacker = get("mob").find((mob) => mob.active && player.isColliding(mob));
    if (!attacker) return;

    run.hearts--;
    heartsHud.update();
    heartsHud.pop();
    playSound("hurt");
    flashScreen([200, 30, 30], 0.3, 0.3);
    shakeScreen(3);

    const away = player.pos.sub(attacker.pos).unit();
    const strength = attacker.def.knockback ?? 1;
    knockVel = away.scale(160 * strength);
    knockTime = 0.15;
    invincibleUntil = time() + INVINCIBLE_FOR;

    if (run.hearts <= 0) onDeath();
  });
}
