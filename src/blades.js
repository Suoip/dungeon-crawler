import { hurtMob } from "./mobs.js";
import { playSound } from "./sound.js";
import { sparks } from "./effects.js";

// The spinning blades, the pit's weapon (the Spinning blades node in the
// tree, and their own upgrades: Sharper blades, Quick spin, Wide spin,
// Double spin; DESIGN.md section 5). Every stats.bladesEvery s, once a
// monster is within stats.bladesRadius px of him, the hero whirls round
// and two blades sweep a full circle about him (stats.bladesSpins times,
// one after the other). Everything in the circle is hit once a sweep, for
// stats.bladesDamage, and shoved back out of it (a boss barely budges);
// breakables in it are struck too. It never hurts him.

const SWEEP = 0.3;  // seconds one sweep takes
const SHOVE = 230;  // px per second a blade shoves a monster at...
const SHOVE_FOR = 0.15; // ...for this long

export function setupBlades(fight, stats) {
  if (!stats.unlocked.has("blades")) return;
  const { player } = fight;
  const middle = () => player.pos.sub(0, 8);
  let wait = stats.bladesEvery;
  let spin = null; // { born }, while he's whirling

  // How far a monster's middle is from his, less a little for its size.
  const inRing = (mob) => mob.pos.sub(0, mob.def.size / 2).dist(middle()) - mob.def.feet[0] / 2 <= stats.bladesRadius;

  onUpdate(() => {
    if (fight.over || fight.frozen || player.frozen) {
      if (spin) endSpin();
      return;
    }
    if (spin) return sweep();
    if (wait > 0) wait -= dt();
    if (wait > 0) return;
    if (!get("mob").some((mob) => mob.active && inRing(mob))) return; // ready, waiting for one in reach
    spin = { born: time(), hit: new Set(), round: 0 };
    playSound("spin");
  });

  // The blades going round: each sweep hits what's in the circle once, as the
  // blades come past it.
  function sweep() {
    const t = (time() - spin.born) / SWEEP;
    const round = Math.floor(t);
    if (round >= stats.bladesSpins) return endSpin();
    if (round !== spin.round) {
      spin.round = round;
      spin.hit = new Set();
      playSound("spin");
    }
    const turned = (t % 1) * Math.PI * 2; // how far the blades have gone round
    player.angle = (t % 1) * 360 * (player.flipX ? -1 : 1);
    const centre = middle();
    for (const mob of get("mob")) {
      if (!mob.active || spin.hit.has(mob) || !inRing(mob)) continue;
      // The two blades start at angles 0 and π, so one reaches a monster at
      // angle a once they've turned a (less half a turn, past π).
      const a = (Math.atan2(mob.pos.y - mob.def.size / 2 - centre.y, mob.pos.x - centre.x) + Math.PI * 2) % (Math.PI * 2);
      if (a % Math.PI > turned) continue; // not reached yet
      spin.hit.add(mob);
      const where = mob.pos.sub(0, mob.def.size / 2);
      sparks(where.x, where.y, 3);
      const beaten = hurtMob(mob, centre, fight, stats.bladesDamage);
      if (!beaten && !mob.def.boss) {
        mob.knockVel = mob.pos.sub(player.pos).unit().scale(mob.def.heavy ? SHOVE / 3 : SHOVE);
        mob.knockTime = SHOVE_FOR;
      }
    }
    for (const thing of get("strikeable")) {
      if (spin.hit.has(thing) || thing.pos.sub(0, thing.hitHeight).dist(centre) > stats.bladesRadius + thing.hitSize) continue;
      spin.hit.add(thing);
      thing.struck(player);
    }
  }

  function endSpin() {
    spin = null;
    player.angle = 0;
    wait = stats.bladesEvery;
  }

  // The blades while he spins: a faint ring where they reach, and two blades
  // sweeping round it, points out, with a short trail.
  const art = add([pos(0, 0), z(12)]);
  art.onDraw(() => {
    if (!spin) return;
    const t = ((time() - spin.born) / SWEEP) % 1;
    const centre = middle();
    drawCircle({ pos: centre, radius: stats.bladesRadius, fill: false, outline: { width: 1, color: rgb(230, 72, 46) }, opacity: 0.35 });
    for (const half of [0, Math.PI]) {
      for (let k = 0; k < 4; k++) {
        const a = t * Math.PI * 2 + half - k * 0.18;
        const tip = centre.add(Math.cos(a) * stats.bladesRadius, Math.sin(a) * stats.bladesRadius);
        const base = centre.add(Math.cos(a) * (stats.bladesRadius - 10), Math.sin(a) * (stats.bladesRadius - 10));
        drawLine({ p1: base, p2: tip, width: k ? 2 : 3, color: k ? rgb(230, 72, 46) : rgb(235, 235, 245), opacity: k ? 0.5 - k * 0.12 : 1 });
      }
    }
  });
}
