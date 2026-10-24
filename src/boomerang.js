import { hurtMob } from "./mobs.js";
import { playSound } from "./sound.js";
import { sparks } from "./effects.js";

// The boomerang, the swamp's weapon (the Boomerang node in the tree, and its
// own upgrades: Heavy boomerang, Quick catch, Long flight, Twin boomerang;
// DESIGN.md section 5). When there's a monster within stats.boomerangRange
// px, he throws it at the nearest one: it whirls out that far (curving a
// little), then turns and comes back to wherever he is, faster and faster.
// It cuts through everything it passes, once on the way out and once on the
// way back (breakables too), and never hurts him. Once it reaches him he's
// caught it, and stats.boomerangRest s later it can be thrown again: so
// walking toward it as it comes back means the next throw comes sooner.
// With Twin boomerang, two are thrown at once, a little apart.

const OUT_TIME = 0.45;   // seconds it takes to fly out
const BACK_SPEED = 120;  // px per second it starts back at...
const BACK_GAIN = 260;   // ...gaining this much every second
const BEND = 10;         // px it curves to the side on the way out
const CATCH = 8;         // px from his chest: caught
const HIT = 9;           // px from a monster's middle: hit
const SPREAD = 0.45;     // radians between two boomerangs thrown together

export function setupBoomerang(fight, stats) {
  if (!stats.unlocked.has("boomerang")) return;
  const { player } = fight;
  const chest = () => player.pos.sub(0, 10);
  let flying = [];  // the boomerangs in the air
  let restUntil = 0;

  onUpdate(() => {
    if (fight.over || fight.frozen || player.frozen) return;
    if (flying.length || time() < restUntil) return;
    const target = nearest();
    if (!target) return;
    const toward = target.pos.sub(0, target.def.size / 2).sub(chest()).unit();
    const angle = Math.atan2(toward.y, toward.x);
    const count = stats.boomerangCount;
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * SPREAD;
      flying.push(throwOne(vec2(Math.cos(a), Math.sin(a)), i % 2 ? -1 : 1));
    }
    playSound("rangThrow");
  });

  // The nearest monster up within range of his chest.
  function nearest() {
    let best = null, bestDistance = stats.boomerangRange;
    for (const mob of get("mob")) {
      if (!mob.active) continue;
      const distance = mob.pos.sub(0, mob.def.size / 2).dist(chest());
      if (distance <= bestDistance) [best, bestDistance] = [mob, distance];
    }
    return best;
  }

  // One boomerang, thrown along `dir` (curving to `side`).
  function throwOne(dir, side) {
    const from = chest();
    const across = vec2(-dir.y, dir.x).scale(side);
    const born = time();
    const hitOut = new Set(), hitBack = new Set();
    let back = false, backSince = 0;
    const rang = add([pos(from), z(12), { spin: 0 }]);
    rang.onUpdate(() => {
      if (fight.over) return destroy(rang);
      rang.spin += dt() * 900;
      if (!back) {
        const t = Math.min(1, (time() - born) / OUT_TIME);
        const out = 1 - (1 - t) * (1 - t); // fast, then slowing
        rang.pos = from.add(dir.scale(stats.boomerangRange * out)).add(across.scale(Math.sin(t * Math.PI) * BEND));
        if (t >= 1) [back, backSince] = [true, time()];
      } else {
        const home = chest();
        const speed = BACK_SPEED + BACK_GAIN * (time() - backSince);
        const way = home.sub(rang.pos);
        if (way.len() <= Math.max(CATCH, speed * dt())) return caught(rang);
        rang.pos = rang.pos.add(way.unit().scale(speed * dt()));
      }
      cut(rang.pos, back ? hitBack : hitOut);
    });
    rang.onDraw(() => drawRang(rang.spin));
    return rang;
  }

  // It cuts whatever it's passing (each thing once per way).
  function cut(at, hit) {
    for (const mob of get("mob")) {
      if (!mob.active || hit.has(mob)) continue;
      if (mob.pos.sub(0, mob.def.size / 2).dist(at) > HIT + mob.def.feet[0] / 2) continue;
      hit.add(mob);
      sparks(at.x, at.y, 3);
      hurtMob(mob, at, fight, stats.boomerangDamage);
    }
    for (const thing of get("strikeable")) {
      if (hit.has(thing) || thing.pos.sub(0, thing.hitHeight).dist(at) > HIT + thing.hitSize) continue;
      hit.add(thing);
      thing.struck(player);
    }
  }

  // Back in his hand. Once the last one is, the rest starts.
  function caught(rang) {
    destroy(rang);
    flying = flying.filter((r) => r !== rang);
    if (flying.length) return;
    playSound("rangCatch");
    restUntil = time() + stats.boomerangRest;
  }
}

// The boomerang, spinning: a wooden V, outlined, with light tips.
function drawRang(spin) {
  pushTransform();
  pushRotate(spin);
  const arms = [[-6, -1, 7, 3], [-1, -6, 3, 7]];
  for (const [x, y, w, h] of arms) drawRect({ pos: vec2(x - 1, y - 1), width: w + 2, height: h + 2, color: rgb(24, 20, 37) });
  for (const [x, y, w, h] of arms) drawRect({ pos: vec2(x, y), width: w, height: h, color: rgb(160, 104, 56) });
  drawRect({ pos: vec2(-6, -1), width: 2, height: 3, color: rgb(237, 201, 120) });
  drawRect({ pos: vec2(-1, -6), width: 3, height: 2, color: rgb(237, 201, 120) });
  popTransform();
}
