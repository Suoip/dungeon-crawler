import { GAME_WIDTH, GAME_HEIGHT, TOP } from "./config.js";
import { heroById } from "./heroes.js";
import { getSetting } from "./settings.js";
import { hurtMob } from "./mobs.js";
import { SHOT_HEIGHT } from "./boss.js";
import { keepInRoom } from "./room.js";
import { PLAYER_FEET } from "./player.js";
import { flashScreen, shakeScreen, hitStop } from "./effects.js";
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

// Space (or the Attack button) swings the hero's weapon in the direction
// they're facing. It works
// in every room (try it in the title room); `room` is only passed in rooms
// with mobs to hit.
export function setupAttack(player, room = null) {
  let ready = 0;
  let side = 1; // swings alternate: one way, then back the other way

  onButtonPress("attack", () => {
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
// It also bats back the boss's shots, once they've turned yellow.
function hitSwept(player, fromAngle, toAngle, alreadyHit, room) {
  const chest = chestOf(player);
  const sweptThrough = (point, extra) => {
    const offset = point.sub(chest);
    const distance = offset.len();
    if (distance > SLASH_REACH + extra) return false;
    // How many degrees the target's size covers at that distance, so the
    // weapon only has to reach its edge, not its middle.
    const margin = (Math.atan2(extra, Math.max(distance, 1)) * 180) / Math.PI;
    const where = turnBetween(fromAngle, angleOf(offset)); // its angle, measured from fromAngle
    const swept = toAngle - fromAngle;
    return distance < 8 || (where >= Math.min(0, swept) - margin && where <= Math.max(0, swept) + margin);
  };

  for (const mob of get("mob")) {
    if (alreadyHit.has(mob)) continue;
    const extra = mob.def.boss ? 14 : 6; // so hitting the edge of a mob counts
    if (sweptThrough(mob.pos.add(0, -mob.def.size / 2), extra)) {
      alreadyHit.add(mob);
      hurtMob(mob, player.pos, room);
    }
  }
  for (const shot of get("shot")) {
    if (shot.batable && !shot.batted && sweptThrough(shot.pos.add(0, -SHOT_HEIGHT), 4)) {
      shot.batBack();
      hitStop(0.03);
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
// see-through so you can still see the floor under them. They're painted on
// the floor (z 1): everything that moves walks over them, so a mob can never
// hide behind them.
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
    z(1),
  ]));

  // On the last heart: it beats, and a dark red glow breathes in from the
  // edges of the screen (z 44: over the room, under the cursed red light).
  let beating = false;
  hearts[0].onUpdate(() => {
    if (run.hearts === 1) {
      beating = true;
      hearts[0].scale = vec2(2 + 0.25 * Math.max(0, Math.sin(time() * 6)) ** 4);
    } else if (beating) {
      beating = false; // healed (or lost it): back to its normal size
      hearts[0].scale = vec2(2);
    }
  });
  const vignette = add([pos(0, TOP), z(44)]);
  vignette.onDraw(() => {
    if (run.hearts !== 1) return;
    const strength = 0.5 + 0.2 * Math.sin(time() * 3);
    const height = GAME_HEIGHT - TOP;
    for (let i = 0; i < 8; i++) {
      const opacity = strength * 0.22 * (1 - i / 8);
      const band = { color: rgb(120, 0, 10), opacity };
      drawRect({ pos: vec2(0, i * 3), width: GAME_WIDTH, height: 3, ...band });
      drawRect({ pos: vec2(0, height - (i + 1) * 3), width: GAME_WIDTH, height: 3, ...band });
      drawRect({ pos: vec2(i * 3, 0), width: 3, height, ...band });
      drawRect({ pos: vec2(GAME_WIDTH - (i + 1) * 3, 0), width: 3, height, ...band });
    }
  });

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
    // And the one just won back.
    grow() {
      const heart = hearts[run.hearts - 1];
      if (!heart) return;
      tween(3.2, 2, 0.4, (s) => (heart.scale = vec2(s)), easings.easeOutElastic);
    },
  };
}

// Mobs hurt the hero by touching him, and so does anything tagged "hazard"
// (the boss's fire and shots), when its touches(player) says so. Each hit
// costs a whole heart, knocks him back, and makes him blink for a moment,
// during which he can't be hit again. `onDeath` runs when the last heart is
// gone.
export function setupHurt(player, run, heartsHud, room, onDeath) {
  let invincibleUntil = 0;
  let knockVel = vec2(0);
  let knockTime = 0;

  player.onUpdate(() => {
    if (knockTime > 0) {
      knockTime -= dt();
      player.move(knockVel);
      keepInRoom(player, PLAYER_FEET);
    }

    const blinking = time() < invincibleUntil;
    if (!player.frozen) player.opacity = blinking && Math.floor(time() * 12) % 2 ? 0.3 : 1;
    if (player.frozen || blinking || room.over || run.hearts <= 0) return;

    const attacker = get("mob").find((mob) => mob.active && player.isColliding(mob))
      ?? get("hazard").find((hazard) => hazard.touches(player));
    if (!attacker) return;
    attacker.onHit?.(); // a shot breaks when it hits

    run.hearts--;
    heartsHud.update();
    heartsHud.pop();
    playSound("hurt");
    flashScreen([200, 30, 30], 0.3, 0.3);
    shakeScreen(3);

    const away = player.pos.sub(attacker.pos).unit();
    const strength = attacker.def?.knockback ?? 1;
    knockVel = away.scale(160 * strength);
    knockTime = 0.15;
    invincibleUntil = time() + INVINCIBLE_FOR;

    if (run.hearts <= 0) onDeath();
  });
}

// Hearts that monsters drop. They only drop while you're missing one, so
// you have to keep fighting while hurt to earn them back. The chance starts
// at 2% a kill and goes up 1% for every kill that didn't drop one, back to
// 2% after a drop, so there are no long unlucky streaks. Returns the
// function to call when a mob is beaten.
const DROP_CHANCE = 0.02;
const DROP_CHANCE_STEP = 0.01;
const PICKUP_LIFE = 8;  // seconds before a dropped heart vanishes
const PICKUP_BLINK = 6; // it blinks from here on, as a warning
const MAGNET_RANGE = 20; // px: closer than this, it drifts toward you

export function setupHeartDrops(run, heartsHud, player) {
  return (mob) => {
    if (run.hearts >= run.maxHearts) return;
    if (Math.random() < DROP_CHANCE + DROP_CHANCE_STEP * run.dropStreak) {
      run.dropStreak = 0;
      dropHeart(mob.pos.clone(), run, heartsHud, player);
    } else {
      run.dropStreak++;
    }
  };
}

function dropHeart(at, run, heartsHud, player) {
  const born = time();
  const canTake = () => !player.frozen && run.hearts < run.maxHearts;
  const heart = add([sprite("heart_full"), pos(at), anchor("bot"), opacity(1), z(9)]);

  heart.onUpdate(() => {
    const age = time() - born;
    // A little hop out of the mob, then a gentle bob.
    const hop = age < 0.35 ? Math.sin((age / 0.35) * Math.PI) * 10 : Math.abs(Math.sin(age * 3)) * 1.5;
    heart.pos = at.sub(0, hop);
    heart.opacity = age > PICKUP_BLINK && Math.floor(age * 8) % 2 ? 0.3 : 1;
    if (age > PICKUP_LIFE) return destroy(heart);
    if (age < 0.35 || !canTake()) return;

    const distance = player.pos.dist(at);
    if (distance < MAGNET_RANGE) at = at.add(player.pos.sub(at).unit().scale(Math.min(distance, 90 * dt())));
    if (distance < 8) {
      run.hearts++;
      heartsHud.update();
      heartsHud.grow();
      playSound("heal");
      flashScreen([230, 72, 46], 0.12, 0.3);
      destroy(heart);
    }
  });
}
