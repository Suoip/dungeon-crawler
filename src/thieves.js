import { BALANCE } from "./balance.js";
import { TILE, TOP, GAME_HEIGHT } from "./config.js";
import { raiseMob } from "./mobs.js";
import { dropCoins } from "./coins.js";
import { playSound } from "./sound.js";
import { puffDust } from "./effects.js";
import { keepInRoom, roomLimits } from "./room.js";

// Coin thieves, the warrens' gimmick (balance.js depths' `thieves`, DESIGN.md
// section 3). Some goblins are thieves, with a sack on their back. A thief
// goes for coins lying on the floor (not ones already flying to the hero),
// scoops up all of them around it, and runs for the nearer of the room's two
// burrows, dug into the side walls. If it gets there, it dives in and the
// coins are gone for good; a few seconds later it climbs back out, sack
// empty, to steal again. Catch it on the way and it drops double what it
// carried (more with Sticky fingers, the warrens' special upgrade). With no
// coins about, it fights like any goblin.

const STUCK_AFTER = 0.4; // seconds of barely moving before it tries going round
const SIDESTEP = 0.35;   // seconds it goes round for

// `fight` is the room scene's fight. Sets `fight.thiefBrain`, which mobs.js
// asks for each new monster's thieving (null for one that never steals).
// Returns { onKill(mob) }, for the room to call when a monster is beaten.
export function setupThieves(fight, run, stats) {
  const rules = BALANCE.depths[run.depth - 1].thieves;
  if (!rules) return { onKill: () => {} };
  const burrows = digBurrows(fight.solid ?? []);

  fight.thiefBrain = (mob) => {
    if (mob.type !== rules.type || mob.def.boss) return null;
    mob.thief = Math.random() < rules.chance;
    mob.carried = 0; // gold in its sack
    mob.onDraw(() => mob.thief && drawSack(mob.flipX, mob.carried > 0));
    let last = null, stuck = 0, sidestepUntil = 0, sidestep = vec2(0);
    // Each frame, while it's up: true if it was busy stealing (it moved).
    return () => {
      if (!mob.thief) return false;
      let target;
      if (mob.carried > 0) {
        const burrow = burrows.reduce((a, b) => (a.mouth.dist(mob.pos) < b.mouth.dist(mob.pos) ? a : b));
        if (mob.pos.dist(burrow.mouth) < 4) return escape(mob, burrow), true;
        target = burrow.mouth;
      } else {
        const coin = nearestCoin(mob.pos);
        if (!coin) return false; // nothing to steal: it fights instead
        if (mob.pos.dist(coin.pos) < 5) return grab(mob), true;
        target = coin.pos;
      }
      // Blocked by a pillar or a crate: it goes round for a moment.
      if (last && mob.pos.dist(last) < mob.speed * dt() * 0.3) stuck += dt();
      else stuck = 0;
      last = mob.pos.clone();
      const toward = target.sub(mob.pos).unit();
      if (stuck > STUCK_AFTER) {
        stuck = 0;
        sidestepUntil = time() + SIDESTEP;
        sidestep = vec2(-toward.y, toward.x).scale(chance(0.5) ? 1 : -1);
      }
      const way = time() < sidestepUntil ? sidestep : toward;
      mob.move(way.scale(mob.speed));
      keepInRoom(mob, mob.def.feet);
      mob.flipX = way.x < 0;
      if (mob.getCurAnim()?.name !== "run") mob.play("run");
      return true;
    };
  };

  // Every coin (and stone) lying around it goes in the sack.
  function grab(mob) {
    for (const coin of get("coin")) {
      if (!lying(coin) || coin.pos.dist(mob.pos) > rules.grab) continue;
      mob.carried += coin.value;
      destroy(coin);
    }
    playSound("snatch");
  }

  // Into the burrow with the loot: gone. It climbs back out later, unless
  // the room's bar has filled by then.
  function escape(mob, burrow) {
    mob.active = false;
    puffDust(burrow.mouth.x, burrow.mouth.y, 6, 8);
    playSound("burrow");
    destroy(mob);
    fight.onVanish();
    wait(rules.comeBack, async () => {
      if (fight.over || fight.full) return;
      puffDust(burrow.mouth.x, burrow.mouth.y, 6, 8);
      const back = await raiseMob(rules.type, fight, { at: burrow.mouth, quick: true, untilFull: true });
      if (back) back.thief = true;
    });
  }

  // Caught: it drops its loot, doubled (and more with Sticky fingers).
  function onKill(mob) {
    if (!mob.carried) return;
    dropCoins(mob.pos.clone(), Math.round(mob.carried * (2 + stats.thiefBonus)), run, fight.player, () => stats.magnetRange);
    playSound("gem");
  }

  return { onKill };
}

// A coin that has landed and is just lying there (not flying to the hero).
const lying = (coin) => coin.landed && !coin.flying && !coin.swept;
function nearestCoin(from) {
  let best = null;
  for (const coin of get("coin")) if (lying(coin) && (!best || coin.pos.dist(from) < best.pos.dist(from))) best = coin;
  return best;
}

// The room's two burrows, one in each side wall, at heights clear of the
// layout's pillars, breakables and chest (`solid`: their middles).
function digBurrows(solid) {
  const feet = roomLimits([10, 6]);
  return [{ side: -1, x: feet.left }, { side: 1, x: feet.right }].map(({ side, x }) => {
    let y;
    for (let tries = 0; tries < 30; tries++) {
      y = Math.round(rand(TOP + 4 * TILE, GAME_HEIGHT - 2 * TILE));
      if (solid.every((tile) => Math.abs(tile.x - x) > 28 || Math.abs(tile.y - y) > 20)) break;
    }
    const wall = side < 0 ? 5 : x + 5; // the wall's inner edge
    const hole = add([pos(wall, y), z(1), "burrow"]);
    hole.onDraw(() => drawBurrow(side));
    return { mouth: vec2(x, y), side };
  });
}

// A burrow dug into the wall: a dark hole with a rim of dirt, and a few
// crumbs kicked out onto the floor. Drawn around the wall's inner edge at
// its foot; `side` -1 for the left wall, 1 for the right.
const DIRT = [120, 88, 56], DIRT_DARK = [84, 60, 40], HOLE = [16, 12, 22];
const BURROW = [ // [x, y, w, h, color] for the left wall; mirrored for the right
  [-3, -12, 7, 2, DIRT], [-3, -10, 9, 10, DIRT], [-3, 0, 8, 1, DIRT_DARK],
  [-3, -10, 6, 1, HOLE], [-3, -9, 7, 8, HOLE],
  [7, -2, 2, 1, DIRT], [9, 0, 1, 1, DIRT_DARK], [6, 1, 2, 1, DIRT],
];
function drawBurrow(side) {
  for (const [x, y, w, h, c] of BURROW) {
    drawRect({ pos: vec2(side < 0 ? x : -x - w, y), width: w, height: h, color: rgb(...c) });
  }
}

// A thief's sack, on its back (behind it, whichever way it faces): small and
// limp while it's empty, bulging with a glint of gold once it has loot.
const SACK = [196, 160, 110], SACK_DARK = [130, 96, 60];
function drawSack(facingLeft, full) {
  const size = full ? 7 : 5;
  const x = facingLeft ? 3 : -3 - size;
  const y = -11 - (full ? 1 : 0);
  drawRect({ pos: vec2(x - 1, y - 1), width: size + 2, height: size + 2, color: rgb(24, 20, 37) });
  drawRect({ pos: vec2(x, y), width: size, height: size, color: rgb(...SACK) });
  drawRect({ pos: vec2(x, y + size - 1), width: size, height: 1, color: rgb(...SACK_DARK) });
  drawRect({ pos: vec2(x + Math.floor(size / 2) - 1, y - 2), width: 2, height: 2, color: rgb(...SACK_DARK) }); // the tie
  if (full) drawRect({ pos: vec2(x + 2, y + 2), width: 2, height: 2, color: rgb(255, 205, 70) });
}
