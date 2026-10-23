import { BALANCE } from "./balance.js";
import { coins } from "./stats.js";
import { raiseMob } from "./mobs.js";
import { dropCoins } from "./coins.js";
import { playSound } from "./sound.js";
import { puffDust } from "./effects.js";

// Restless graves, the crypt's gimmick (balance.js depths' `graves`, DESIGN.md
// section 3). A tiny zombie or skeleton that falls may leave a grave: a
// mound of dirt with a little headstone. After `riseAfter` seconds it climbs
// back out (shaking for a moment first), unless the hero walks over the
// grave and stamps it flat. Gravedigger, the crypt's special upgrade, makes
// stamping pay: a share of the monster's gold, and seconds on the clock. A
// monster that climbed out of a grave doesn't leave another, and once the
// room's bar is full the graves crumble away.

const STAMP_REACH = 10; // px from his feet to the grave's middle
const SHAKE_FOR = 1.2;  // seconds of shaking before it rises

// `fight` is the room scene's fight; `addSeconds(s)` puts seconds on the
// clock (and the hourglass). Returns { onKill(mob) }, for the room to call
// when a monster is beaten.
export function setupGraves(fight, run, stats, addSeconds) {
  const rules = BALANCE.depths[run.depth - 1].graves;
  if (!rules) return { onKill: () => {} };

  function onKill(mob) {
    if (mob.risen || mob.def.boss || fight.full || !rules.types.includes(mob.type)) return;
    if (Math.random() < rules.chance) addGrave(mob.pos.clone(), mob.type, mob.gold);
  }

  function addGrave(at, type, gold) {
    const born = time();
    const grave = add([pos(at), z(2), "grave"]);
    grave.onDraw(() => drawGrave(Math.max(0, time() - born - (rules.riseAfter - SHAKE_FOR))));
    grave.onUpdate(() => {
      if (fight.over || fight.frozen) return;
      if (fight.full) return crumble();
      if (!fight.player.frozen && fight.player.pos.dist(at) < STAMP_REACH) return stamp();
      if (time() - born >= rules.riseAfter) rise();
    });
    // Stamped flat: Gravedigger's gold and seconds, if he has it.
    function stamp() {
      destroy(grave);
      puffDust(at.x, at.y, 6, 10);
      playSound("stamp");
      if (stats.graveGold > 0) dropCoins(at, coins(gold * stats.graveGold * (1 + stats.goldBonus)), run, fight.player, () => stats.magnetRange);
      if (stats.graveTime > 0) addSeconds(stats.graveTime);
    }
    // Not stamped in time: its monster climbs back out (the room's usual rise,
    // dust and all), and won't leave a grave again.
    async function rise() {
      destroy(grave);
      const mob = await raiseMob(type, fight, { at, untilFull: true });
      if (mob) mob.risen = true;
    }
    function crumble() {
      destroy(grave);
      puffDust(at.x, at.y, 4, 8);
    }
  }

  return { onKill };
}

// The grave, drawn around its spot (the middle of its foot): dirt, a grey
// headstone, outlined in dark. `shaking` (seconds into its last moments)
// rattles it more and more until it rises.
const DIRT = [101, 74, 52], DIRT_LIGHT = [140, 104, 72], STONE = [150, 150, 162], STONE_DARK = [108, 108, 122];
const GRAVE = [[-7, -3, 14, 3, DIRT], [-5, -5, 10, 2, DIRT], [-4, -5, 8, 1, DIRT_LIGHT], [-2, -12, 4, 8, STONE], [-1, -13, 2, 1, STONE], [-2, -12, 1, 8, STONE_DARK]];
function drawGrave(shaking) {
  const dx = shaking > 0 ? Math.round(Math.sin(time() * 40) * Math.min(1.5, shaking * 1.5)) : 0;
  for (const [x, y, w, h] of GRAVE) drawRect({ pos: vec2(x - 1 + dx, y - 1), width: w + 2, height: h + 2, color: rgb(24, 20, 37) });
  for (const [x, y, w, h, c] of GRAVE) drawRect({ pos: vec2(x + dx, y), width: w, height: h, color: rgb(...c) });
}
