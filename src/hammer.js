import { BALANCE } from "./balance.js";
import { hurtMob } from "./mobs.js";
import { roomLimits } from "./room.js";
import { playSound } from "./sound.js";
import { shakeScreen, puffDust, sparks } from "./effects.js";

// The hammer, the warrens' weapon (the Hammer node in the tree, and its own
// upgrades: Heavier hammer, Hammer time, Bigger head; DESIGN.md section 5).
// Every few seconds (stats.hammerEvery, give or take a quarter) a giant
// hammer rises over the hero, aimed a random way, and its landing zone is
// marked on the floor a little way out from him that way. The zone moves
// with him while the hammer hangs there (BALANCE.hero.hammer.warning s), so
// he steers it onto monsters; then it crashes down. Everything in the zone
// takes stats.hammerDamage and is stunned for a moment (a boss isn't), and
// breakables in it are struck too. It never hurts him.

const FALL = 0.12;   // seconds the swing over and down takes, at the end
const RAISED = 150;  // degrees back from the zone it's held while it's aimed
const HEAD = 32;     // px from the handle's end to the middle of the head, in the sprite
const FLAT = 0.6;    // the zone is an ellipse this much as tall as it's wide

export function setupHammer(fight, stats) {
  if (!stats.unlocked.has("hammer")) return;
  const rules = BALANCE.hero.hammer;
  const { player } = fight;
  const nextWait = () => stats.hammerEvery * rand(0.75, 1.25);
  let wait = nextWait();
  let strike = null; // { dir, born }, while the hammer is up

  // Where the zone is now: `out` px from him along its way, kept on the floor.
  const zoneAt = (dir) => {
    const spot = player.pos.add(dir.scale(rules.out));
    const limits = roomLimits([stats.hammerSize, stats.hammerSize * FLAT]);
    return vec2(clamp(spot.x, limits.left, limits.right), clamp(spot.y, limits.top, limits.bottom));
  };
  const inZone = (center, point, extra = 0) =>
    ((point.x - center.x) / (stats.hammerSize + extra)) ** 2 + ((point.y - center.y) / ((stats.hammerSize + extra) * FLAT)) ** 2 <= 1;

  onUpdate(() => {
    if (fight.over || fight.frozen || player.frozen) {
      strike = null; // a cutscene or the run's end takes it away
      return;
    }
    if (!strike) {
      wait -= dt();
      if (wait > 0) return;
      const angle = rand(0, Math.PI * 2);
      strike = { dir: vec2(Math.cos(angle), Math.sin(angle)), born: time() };
      playSound("hammerRise");
      return;
    }
    if (time() - strike.born < rules.warning) return;
    smash(zoneAt(strike.dir));
    strike = null;
    wait = nextWait();
  });

  // It lands: damage and a stun on everything in the zone (monsters by their
  // feet, with a little room for their size), and breakables struck.
  function smash(center) {
    playSound("hammer");
    shakeScreen(3);
    puffDust(center.x, center.y, 12, stats.hammerSize * 1.4, 11);
    sparks(center.x, center.y - 2, 6);
    for (const mob of get("mob")) {
      if (!mob.active || !inZone(center, mob.pos, mob.def.feet[0] / 2)) continue;
      const beaten = hurtMob(mob, center, fight, stats.hammerDamage);
      if (beaten || mob.def.boss) continue;
      mob.knockVel = vec2(0);
      mob.knockTime = rules.stun; // stands still (mobs.js: knocked back, at no speed)
      mob.stunnedUntil = time() + rules.stun;
    }
    for (const thing of get("strikeable")) if (inZone(center, thing.pos, 6)) thing.struck(player);
  }

  // The zone, and the hammer in his hands: raised up behind him while it's
  // aimed (rocking a little), then swung over and down so its head lands on
  // the zone. And the stars over anything stunned.
  const drawer = add([pos(0, 0), z(9)]);
  drawer.onDraw(() => {
    for (const mob of get("mob")) {
      if (!(mob.stunnedUntil > time()) || !mob.exists()) continue;
      const top = mob.pos.sub(0, mob.def.size + 3);
      for (let i = 0; i < 3; i++) {
        const a = time() * 6 + (i * Math.PI * 2) / 3;
        drawRect({ pos: top.add(Math.cos(a) * 5, Math.sin(a) * 1.5), width: 1, height: 1, color: rgb(255, 230, 120) });
      }
    }
    if (!strike) return void (held = null);
    const t = (time() - strike.born) / rules.warning; // 0 to 1
    const center = zoneAt(strike.dir);
    const pulse = 0.5 + 0.5 * Math.sin(time() * 20);
    drawEllipse({ pos: center, radiusX: stats.hammerSize, radiusY: stats.hammerSize * FLAT, color: rgb(230, 72, 46), opacity: 0.15 + 0.25 * t });
    drawEllipse({ pos: center, radiusX: stats.hammerSize, radiusY: stats.hammerSize * FLAT, fill: false, outline: { width: 1, color: rgb(255, 160 + 60 * pulse, 90) } });
    // Angles as the sprite sees them: 0° is head up, 90° head to the right.
    const hands = player.pos.sub(0, 10);
    const toZone = center.sub(hands);
    const aim = (Math.atan2(toZone.x, -toZone.y) * 180) / Math.PI;
    const back = toZone.x >= 0 ? -1 : 1; // raised on the side away from where it'll swing
    const falling = Math.max(0, (time() - strike.born - (rules.warning - FALL)) / FALL);
    const rock = falling > 0 ? 0 : 6 * Math.sin(time() * 8);
    const angle = aim + back * RAISED * (1 - falling) + rock;
    held = { hands, angle, scale: Math.max(0.7, toZone.len() / HEAD) };
  });
  // The hammer itself is drawn over him and the monsters (they're z 10 and up).
  let held = null;
  const hammerArt = add([pos(0, 0), z(12)]);
  hammerArt.onDraw(() => {
    if (!strike || !held) return;
    drawSprite({ sprite: "weapon_big_hammer", pos: held.hands, anchor: "bot", angle: held.angle, scale: held.scale });
  });
}
