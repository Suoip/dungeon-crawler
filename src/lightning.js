import { hurtMob } from "./mobs.js";
import { playSound } from "./sound.js";
import { sparks } from "./effects.js";

// Chain lightning, the fort's weapon (the Chain lightning node in the tree,
// and its own upgrades: Thunder, Forked lightning, Storm, Long arcs;
// DESIGN.md section 5). Once it's bought, some monsters rise charged
// (stats.chargedChance of them; never a boss): they glow and crackle, and
// their touch shocks (the depth's special hit, combat.js). Killing one sends
// lightning jumping from it to the nearest monster within
// stats.lightningRange px, then on from that one to the next, up to
// stats.lightningJumps times, each jump doing stats.lightningDamage. If the
// lightning beats another charged one, that one sets off its own chain.

const JUMP_EVERY = 0.07; // seconds between one jump and the next
const BOLT_LIFE = 0.22;  // seconds a bolt stays on screen

// `fight` is the room scene's fight. Returns { onKill(mob) }, for the room
// to call when a monster is beaten.
export function setupLightning(fight, stats) {
  if (!stats.unlocked.has("lightning")) return { onKill: () => {} };

  // Some monsters rise charged (the room counts each one as it appears).
  const counted = fight.onSpawn;
  fight.onSpawn = (mob) => {
    counted(mob);
    if (!mob.def.boss && Math.random() < stats.chargedChance) mob.charged = true;
  };

  // A charged one is beaten: the lightning leaves it and jumps on.
  async function onKill(mob) {
    if (!mob.charged) return;
    let from = middleOf(mob);
    const struck = new Set([mob]);
    for (let jump = 0; jump < stats.lightningJumps; jump++) {
      const next = nearest(from, struck);
      if (!next) break;
      struck.add(next);
      const to = middleOf(next);
      addBolt(from, to);
      playSound("zap");
      sparks(to.x, to.y, 4);
      hurtMob(next, from, fight, stats.lightningDamage);
      from = to;
      await new Promise((done) => wait(JUMP_EVERY, done));
      if (fight.over) return;
    }
  }

  // The nearest monster up within reach of `from` that this chain hasn't struck.
  function nearest(from, struck) {
    let best = null, bestDistance = stats.lightningRange;
    for (const mob of get("mob")) {
      if (!mob.active || struck.has(mob)) continue;
      const distance = middleOf(mob).dist(from);
      if (distance <= bestDistance) [best, bestDistance] = [mob, distance];
    }
    return best;
  }

  // A soft blue glow on the floor under every charged monster (under the
  // monsters, z 10 and up), flickering.
  const glow = add([pos(0, 0), z(9)]);
  glow.onDraw(() => {
    for (const mob of get("mob")) {
      if (!mob.charged || !mob.active) continue;
      const flicker = 0.25 + 0.15 * Math.random();
      drawEllipse({ pos: mob.pos.sub(0, 1), radiusX: mob.def.feet[0] / 2 + 5, radiusY: 4, color: rgb(80, 160, 255), opacity: flicker });
    }
  });

  // The crackle round every charged monster: a few short blue sparks that
  // flicker about it.
  const crackle = add([pos(0, 0), z(12)]);
  crackle.onDraw(() => {
    for (const mob of get("mob")) {
      if (!mob.charged || !mob.active) continue;
      const middle = middleOf(mob);
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.35) continue;
        const a = rand(0, Math.PI * 2), r = mob.def.size / 2 + rand(0, 3);
        const at = middle.add(Math.cos(a) * r, Math.sin(a) * r);
        drawLine({ p1: at, p2: at.add(rand(-3, 3), rand(-3, 3)), width: 1, color: rgb(140, 210, 255) });
      }
    }
  });

  return { onKill };
}

const middleOf = (mob) => mob.pos.sub(0, mob.def.size / 2);

// A bolt from `from` to `to`: a jagged white-blue line that jitters, and
// fades out.
function addBolt(from, to) {
  const born = time();
  const bolt = add([pos(0, 0), z(13)]);
  bolt.onUpdate(() => {
    if (time() - born > BOLT_LIFE) destroy(bolt);
  });
  bolt.onDraw(() => {
    const fade = 1 - (time() - born) / BOLT_LIFE;
    const along = to.sub(from);
    const across = vec2(-along.y, along.x).unit();
    const points = [from];
    const steps = Math.max(2, Math.round(along.len() / 6));
    for (let i = 1; i < steps; i++) points.push(from.add(along.scale(i / steps)).add(across.scale(rand(-3, 3))));
    points.push(to);
    for (let i = 0; i + 1 < points.length; i++) {
      drawLine({ p1: points[i], p2: points[i + 1], width: 3, color: rgb(80, 150, 255), opacity: 0.5 * fade });
      drawLine({ p1: points[i], p2: points[i + 1], width: 1, color: rgb(235, 245, 255), opacity: fade });
    }
  });
}
