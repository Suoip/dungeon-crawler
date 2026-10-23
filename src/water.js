import { BALANCE } from "./balance.js";
import { TILE, GAME_WIDTH, GAME_HEIGHT, ROOMS } from "./config.js";
import { MUD_SLOW } from "./mobs.js";
import { playSound } from "./sound.js";

// Rising water, the sunken swamp's gimmick (balance.js depths' `water`,
// DESIGN.md section 3). Each room starts with the bottom of its floor
// flooded, and every so often the murky water creeps up another row, so the
// longer he takes, the less dry floor is left. In it he wades, slower (his
// dash too); the swamp's monsters live there and don't mind it. And it's
// murky: spikes, mud and coins under it only show once he's close. Waders,
// the swamp's special upgrade, makes the wading faster (and the mud too).
// Once the room's bar is full, it stops rising.

const FLOOR_BOTTOM = GAME_HEIGHT - 4;   // the bottom wall's inner edge
const RISE_TIME = 1.5;                  // seconds the water takes to creep up a row
const WATER = [52, 84, 70], SURFACE = [104, 140, 112], FOAM = [150, 180, 150];

export function setupWater(fight, run, stats) {
  const rules = BALANCE.depths[run.depth - 1].water;
  if (!rules) return;
  const { player } = fight;
  player.wade = { mud: MUD_SLOW + stats.waders, water: rules.slow + stats.waders };

  // Room 1's numbers to room 10's, in between for the others.
  const share = (fight.sub - 1) / (ROOMS - 1);
  const between = ([first, last]) => first + (last - first) * share;
  let rows = Math.round(between(rules.start)); // rows flooded, or about to be
  let level = rows;                            // rows flooded right now (it creeps up smoothly)
  const riseEvery = between(rules.rise);
  let nextRise = riseEvery;
  const surface = () => FLOOR_BOTTOM - level * TILE;
  const under = (p) => p.y > surface() + 1;
  player.inWater = () => under(player.pos);

  onUpdate(() => {
    if (level < rows) level = Math.min(rows, level + dt() / RISE_TIME);
    if (fight.over || fight.frozen || fight.full || rows >= rules.most) return;
    nextRise -= dt();
    if (nextRise > 0) return;
    nextRise = riseEvery;
    rows++;
    playSound("waterRise");
  });

  // What lies under the water can only be seen up close: the spikes, the
  // mud, and coins (and stones, and material) that aren't flying to him.
  onUpdate(() => {
    for (const thing of [...get("hazard"), ...get("mud"), ...get("pickup")]) {
      if (thing.is("shot")) continue; // a shot flies over it
      thing.hidden = under(thing.pos) && !thing.flying && !thing.swept && thing.pos.dist(player.pos) > rules.seeFrom;
    }
  });

  // The water: over the floor and what lies on it, under the monsters and
  // him (z 10 and up) and the hearts along the bottom wall (z 1). Its edge
  // has a lighter line with ripples drifting along it, and he leaves
  // ripples round his feet as he wades.
  const water = add([pos(0, 0), z(0.9)]);
  water.onDraw(() => {
    if (level <= 0) return;
    const top = surface();
    drawRect({ pos: vec2(5, top), width: GAME_WIDTH - 10, height: FLOOR_BOTTOM - top, color: rgb(...WATER), opacity: 0.82 });
    drawRect({ pos: vec2(5, top), width: GAME_WIDTH - 10, height: 1, color: rgb(...SURFACE) });
    for (let x = 5; x < GAME_WIDTH - 10; x += 16) {
      const drift = (time() * 6 + x * 0.7) % 16;
      drawRect({ pos: vec2(x + drift, top + 1), width: 4, height: 1, color: rgb(...FOAM), opacity: 0.6 });
    }
    if (player.inWater() && !player.frozen) {
      const pulse = (time() * 2) % 1;
      drawEllipse({ pos: player.pos.sub(0, 1), radiusX: 6 + pulse * 4, radiusY: 2 + pulse * 1.5, color: rgb(...FOAM), opacity: 0.5 * (1 - pulse), fill: false, outline: { width: 1, color: rgb(...FOAM) } });
    }
  });
}
