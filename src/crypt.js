import { TILE, TOP } from "./config.js";
import { BALANCE } from "./balance.js";
import { subDepthScale, coins } from "./stats.js";
import { LAYOUTS } from "./layouts.js";
import { dropCoins } from "./coins.js";
import { wakeMimic } from "./mobs.js";
import { sleep, puffDust, sparks } from "./effects.js";
import { popNumber } from "./hud.js";
import { playSound } from "./sound.js";

// The crypt's rooms (DESIGN.md section 3). Each room is built from one of
// its layouts (layouts.js), picked at random: pillars, floor spikes, things
// to smash for gold, and sometimes a chest that may be a mimic.

// Where a layout tile is: layout row 0 is the first row of floor, under the
// back wall (2 tiles tall).
const tileX = (col) => col * TILE;
const tileY = (row) => TOP + (row + 2) * TILE;
const middleOf = (col, row) => vec2(tileX(col) + TILE / 2, tileY(row) + TILE / 2);
const BREAKABLES = { o: "pot", c: "crate", U: "urn" };
const OUTLINE = [24, 20, 37];

// Builds a layout for this room. `fight` is the room's fight (scenes.js),
// `run` the run (for its stats and gold). Returns the middles of the solid
// tiles, so no monster rises inside one (mobs.js spawnSpot).
export function buildLayout(fight, run) {
  const room = BALANCE.rooms[fight.sub - 1];
  const rows = choose(LAYOUTS[fight.sub - 1]);
  if (!rows) return [];
  const solid = [];
  const spikes = [];
  rows.forEach((line, row) => [...line].forEach((ch, col) => {
    if (ch === "P") solid.push(addPillar(col, row));
    else if (ch === "^") spikes.push(addSpikes(col, row));
    else if (BREAKABLES[ch]) solid.push(addBreakable(BREAKABLES[ch], col, row, fight, run));
    else if (ch === "C" && room.chest && chance(room.chest.chance)) {
      solid.push(addChest(col, row, chance(room.chest.mimic), fight, run));
    }
  }));
  if (spikes.length) runSpikes(spikes, fight);
  return solid;
}

// ---- Pillars --------------------------------------------------------------------

// A stone pillar standing on its tile, its top reaching up over the tiles
// behind it. Only its base is solid, and it's sorted with the characters,
// so he can walk behind it (and be hidden by it).
function addPillar(col, row) {
  const bottom = tileY(row) + TILE; // where its base meets the floor
  // The sprite's art ends 9 px above the bottom of its 48 px cell.
  add([
    sprite("column"),
    pos(tileX(col), bottom - 39),
    area({ shape: new Rect(vec2(1, 27), 14, 12) }),
    body({ isStatic: true }),
    z(10 + bottom / 1000),
    "solid",
    { box: boxAt(tileX(col) + TILE / 2, bottom) },
  ]);
  return middleOf(col, row);
}

// The solid box at the foot of a pillar, breakable or chest (14 x 12 px,
// its bottom edge at `bottom`), in room coordinates. Its "solid" tag and
// this box let the boss's dash stop at it (boss.js). 12 px tall, so even a
// dash on a slow frame can't skip through it.
const boxAt = (x, bottom) => ({ left: x - 7, right: x + 7, top: bottom - 12, bottom });

// ---- Floor spikes ---------------------------------------------------------------

// All of a room's spikes move together, round and round: down, then the
// tips peek out (the warning), then up (standing on them costs a heart,
// like a monster's hit; only the hero gets hurt), then back down.
const SPIKES = { down: 1.6, warn: 0.45, up: 0.6, retract: 0.1 }; // seconds
const SPIKES_PERIOD = SPIKES.down + SPIKES.warn + SPIKES.up + SPIKES.retract;

// One tile of spikes. It's a "hazard" (combat.js setupHurt): it hurts him
// while touches() says so.
function addSpikes(col, row) {
  const middle = middleOf(col, row);
  // z 0.5: on the floor, under everything else (the hearts are z 1).
  const spikes = add([sprite("floor_spikes", { frame: 0 }), pos(middle), anchor("center"), z(0.5), "hazard", { up: false }]);
  // His feet (a 10x6 box just above his position) on the tile.
  spikes.touches = (player) => spikes.up
    && Math.abs(player.pos.x - middle.x) < TILE / 2 + 3
    && player.pos.y - 3 > middle.y - TILE / 2 && player.pos.y - 3 < middle.y + TILE / 2;
  return spikes;
}

function runSpikes(spikes, fight) {
  let t = rand(0, SPIKES_PERIOD); // each room starts somewhere in the cycle
  onUpdate(() => {
    t = (t + dt()) % SPIKES_PERIOD;
    const frame = t < SPIKES.down ? 0
      : t < SPIKES.down + SPIKES.warn ? 1
      : t < SPIKES.down + SPIKES.warn + SPIKES.up ? 3
      : 2;
    const up = frame === 3;
    if (up && !spikes[0].up && !fight.over) playSound("spikes");
    for (const tile of spikes) {
      tile.frame = frame;
      tile.up = up;
    }
  });
}

// ---- Breakables -----------------------------------------------------------------

// A pot, a crate or the urn: solid until it's smashed. Every swing that
// passes through it does his damage (its number pops up, it shakes); when
// it breaks, it bursts into bits and its gold (grown with the sub-depth,
// plus Smash) spills out as coins. Swings find it by its "strikeable" tag
// (combat.js), with `struck()`.
function addBreakable(type, col, row, fight, run) {
  const data = BALANCE.breakables[type];
  const scale = subDepthScale(fight.sub);
  const foot = vec2(tileX(col) + TILE / 2, tileY(row) + TILE - 1); // the middle of its bottom edge
  const height = { pot: 11, crate: 19, urn: 20 }[type];
  const thing = add([
    pos(foot),
    area({ shape: new Rect(vec2(-7, -12), 14, 12) }),
    body({ isStatic: true }),
    z(10 + foot.y / 1000),
    "strikeable",
    "solid",
    { hp: Math.ceil(data.hp * scale.hp), hitHeight: height / 2, hitSize: 7, shakeUntil: 0, box: boxAt(foot.x, foot.y) },
  ]);
  thing.onDraw(() => {
    const shake = time() < thing.shakeUntil ? Math.round(Math.sin(time() * 60)) : 0;
    DRAW[type](shake);
  });
  thing.struck = () => {
    const { damage, breakableBonus, magnetRange } = run.stats;
    thing.hp -= damage;
    popNumber(foot.add(rand(-2, 2), -height - 2), damage);
    if (thing.hp > 0) {
      thing.shakeUntil = time() + 0.15;
      playSound("mobHit");
      sparks(foot.x, foot.y - height / 2, 3);
      return;
    }
    playSound("smash");
    shards(foot, height, type === "urn" ? 14 : 8);
    dropCoins(foot.clone(), coins(data.gold * scale.gold * (1 + breakableBonus)), run, fight.player, () => magnetRange,
      { spread: type === "urn" ? 22 : 10 });
    destroy(thing);
  };
  return middleOf(col, row);
}

// Bits of whatever broke, flying out and falling, plus some dust.
function shards(foot, height, count) {
  puffDust(foot.x, foot.y, 6, 12);
  for (let i = 0; i < count; i++) {
    const bit = add([rect(choose([1, 2]), choose([1, 2])), pos(foot.x + rand(-5, 5), foot.y - rand(2, height)),
      color(...choose([[176, 98, 58], [122, 62, 40], [120, 112, 134], [138, 75, 43]])), opacity(1), z(12)]);
    const start = bit.pos.clone();
    const way = vec2(rand(-28, 28), rand(-30, -10));
    tween(0, 1, rand(0.3, 0.5), (t) => {
      bit.pos = start.add(way.x * t, way.y * t + 60 * t * t); // out, then down
      bit.opacity = 1 - t * t;
    }).onEnd(() => destroy(bit));
  }
}

// The pot and the urn aren't in the tileset, so they're drawn here, in its
// colors: rectangles on a grid around the middle of their bottom edge. The
// crate is the tileset's (its art ends 1 px above the bottom of its cell).
const CLAY = [176, 98, 58];
const CLAY_DARK = [122, 62, 40];
const CLAY_LIGHT = [214, 138, 88];
const STONE = [120, 112, 134];
const STONE_DARK = [84, 76, 98];
const STONE_LIGHT = [168, 160, 180];
const GOLD = [255, 205, 70];
const shapes = (parts, dx) => {
  for (const [x, y, w, h, c] of parts) drawRect({ pos: vec2(x + dx, y), width: w, height: h, color: rgb(...c) });
};
const DRAW = {
  // A round clay pot with a narrow neck.
  pot: (dx) => shapes([
    [-4, -11, 8, 3, OUTLINE], [-6, -9, 12, 9, OUTLINE],
    [-3, -10, 6, 1, CLAY_LIGHT], [-2, -9, 4, 1, CLAY_DARK],
    [-5, -8, 10, 6, CLAY], [-4, -2, 8, 1, CLAY], [-5, -3, 10, 1, CLAY_DARK],
    [-3, -7, 2, 3, CLAY_LIGHT],
  ], dx),
  crate: (dx) => drawSprite({ sprite: "crate", pos: vec2(-8 + dx, -22) }),
  // A tall stone urn with handles and a gold band: worth the trouble.
  urn: (dx) => shapes([
    [-5, -20, 10, 3, OUTLINE], [-7, -17, 14, 2, OUTLINE], [-8, -15, 16, 13, OUTLINE], [-6, -2, 12, 2, OUTLINE],
    [-10, -14, 3, 6, OUTLINE], [7, -14, 3, 6, OUTLINE], // the handles
    [-9, -13, 2, 4, STONE_DARK], [7, -13, 2, 4, STONE_DARK],
    [-4, -19, 8, 1, STONE_LIGHT], [-3, -18, 6, 2, STONE_DARK],
    [-6, -16, 12, 2, STONE], [-7, -14, 14, 11, STONE], [-5, -3, 10, 2, STONE_DARK],
    [-7, -11, 14, 2, GOLD], [-5, -14, 2, 3, STONE_LIGHT], [-5, -8, 2, 4, STONE_LIGHT],
  ], dx),
};

// ---- Chests -----------------------------------------------------------------------

// A chest. Closed, a real one and a mimic look exactly the same (the
// tileset draws them alike). A real chest takes a few hits, then opens and
// its gold spills out as coins; it stays there, open and empty. A mimic
// snaps open when he comes close or hits it, and turns into a monster
// (mobs.js wakeMimic), which shakes for a moment before it bites.
const MIMIC_WAKES = 28; // px: this close, it can't wait any longer
function addChest(col, row, isMimic, fight, run) {
  const foot = vec2(tileX(col) + TILE / 2, tileY(row) + TILE);
  const data = BALANCE.breakables.chest;
  const scale = subDepthScale(fight.sub);
  const chest = add([
    sprite(isMimic ? "mimic" : "chest_loot", { frame: 0 }),
    pos(foot),
    anchor("bot"),
    area({ shape: new Rect(vec2(0), 14, 12) }),
    body({ isStatic: true }),
    z(10 + foot.y / 1000),
    "strikeable",
    "solid",
    { hp: Math.ceil(data.hp * scale.hp), hitHeight: 7, hitSize: 7, shakeUntil: 0, box: boxAt(foot.x, foot.y) },
  ]);
  chest.onUpdate(() => {
    chest.pos = foot.add(time() < chest.shakeUntil ? Math.round(Math.sin(time() * 60)) : 0, 0);
  });

  if (isMimic) {
    let awake = false;
    const wake = async () => {
      if (awake) return;
      awake = true;
      chest.untag("strikeable");
      chest.play("open");
      playSound("chomp");
      await sleep(0.25);
      destroy(chest);
      wakeMimic(foot, fight);
    };
    chest.onUpdate(() => {
      if (!fight.over && !fight.frozen && !fight.player.frozen && fight.player.pos.dist(foot) < MIMIC_WAKES) wake();
    });
    chest.struck = wake;
  } else {
    chest.struck = () => {
      const { damage, breakableBonus, magnetRange } = run.stats;
      chest.hp -= damage;
      popNumber(foot.add(rand(-2, 2), -18), damage);
      if (chest.hp > 0) {
        chest.shakeUntil = time() + 0.15;
        playSound("mobHit");
        return;
      }
      chest.untag("strikeable"); // it stays, open and empty
      chest.play("open");
      playSound("unlock");
      sparks(foot.x, foot.y - 8, 6);
      dropCoins(foot.sub(0, 6), coins(data.gold * scale.gold * (1 + breakableBonus)), run, fight.player, () => magnetRange,
        { spread: 18 });
    };
  }
  return middleOf(col, row);
}
