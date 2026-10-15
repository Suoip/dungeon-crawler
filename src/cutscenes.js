import { TILE, TOP, GAME_HEIGHT } from "./config.js";
import { tileAt } from "./room.js";
import { spawnSpot } from "./mobs.js";
import { openDoor } from "./doors.js";
import { sleep, animate, fadeOut, puffDust, shakeScreen } from "./effects.js";
import { playSound } from "./sound.js";

// The short scripted moments where the game moves the knight by itself.

// Every room below the title is one level deeper: the knight drops in from
// above and lands here, in the middle of the floor.
export const LAND_X = 10 * TILE;               // 160 px, the middle
export const LAND_Y = GAME_HEIGHT - 3 * TILE;  // 160 px, a bit below the middle
const FALL_SECONDS = 0.6;

// Takes the controls away from the player for a cutscene. Without his body,
// walls stop blocking him, so he can step into doorways and climb ladders.
// (With it, the walls would push him out sideways, to the edge of the room.)
//
// Note: has() checks for a component; is() only checks tags.
function takeControl(player) {
  player.frozen = true;
  if (player.has("body")) player.unuse("body");
}

// Gives the controls back after a cutscene.
export function giveControl(player) {
  if (!player.has("body")) player.use(body());
  player.frozen = false;
}

// Drops the knight from above the screen onto the floor. A shadow on the floor
// grows as he gets closer, so you can see where he'll land.
export async function fallIn(player) {
  takeControl(player);
  player.pos = vec2(LAND_X, -4); // just above the top of the screen

  const shadow = add([
    circle(7),
    pos(LAND_X, LAND_Y - 1),
    anchor("center"),
    color(0, 0, 0),
    opacity(0),
    scale(0),
    z(5), // on the floor, under the knight
  ]);

  // easeInQuad starts slow and speeds up, like gravity. The shadow uses the
  // same easing so it grows in step with the fall.
  playSound("fall");
  await Promise.all([
    animate(player.pos.y, LAND_Y, FALL_SECONDS, (y) => (player.pos.y = y), easings.easeInQuad),
    animate(0, 1, FALL_SECONDS, (t) => {
      shadow.scale = vec2(lerp(0.3, 1, t), lerp(0.12, 0.4, t)); // a flat oval
      shadow.opacity = lerp(0.1, 0.45, t);
    }, easings.easeInQuad),
  ]);

  // Thud: squash him flat and wide, then let him spring back to normal.
  playSound("land");
  shakeScreen(2);
  puffDust(LAND_X, LAND_Y);
  animate(shadow.opacity, 0, 0.2, (v) => (shadow.opacity = v)).then(() => destroy(shadow));
  await animate(0, 1, 0.2, (t) => {
    player.scale = vec2(lerp(1.4, 1, t), lerp(0.6, 1, t));
  }, easings.easeOutBack);
}

// The punishment for a wrong door: the floor cracks open in `count` places
// away from the hero, spreading out tile by tile from each spot, and the
// cursed mobs crawl out of the cracks. Returns those spots.
export async function crackFloor(floor, player, count = 3) {
  const spots = [];
  for (let i = 0; i < count; i++) {
    // Not too close to each other either, so the cracks spread out.
    let spot = spawnSpot(player);
    for (let tries = 0; tries < 20 && spots.some((other) => other.dist(spot) < 60); tries++) spot = spawnSpot(player);
    spots.push(spot);
  }

  for (const spot of spots) {
    // The tiles around the spot, nearest first, so the crack grows outwards.
    const center = tileAt(spot.x, spot.y - 4);
    const tiles = [];
    for (let col = center.col - 1; col <= center.col + 1; col++) {
      for (let row = center.row - 1; row <= center.row + 1; row++) {
        const tile = floor.get(`${col},${row}`);
        const distance = Math.hypot(col - center.col, row - center.row);
        if (tile && (distance < 1 || chance(0.6))) tiles.push({ tile, distance });
      }
    }
    tiles.sort((a, b) => a.distance - b.distance);

    playSound("crack");
    shakeScreen(3);
    puffDust(spot.x, spot.y, 6, 12, 9);
    for (const { tile } of tiles) {
      tile.use(sprite(choose(["floor_2", "floor_4"]))); // the cracked floor tiles
      await sleep(0.03);
    }
    await sleep(0.12);
  }
  playSound("crumble");
  shakeScreen(4);
  return spots;
}

// Opens a door and walks the knight into it, then fades the screen out.
export async function walkThroughDoor(player, door, fader) {
  takeControl(player);
  openDoor(door);
  player.play("run");

  // Line up with the middle of the door, then step into the doorway.
  await animate(player.pos.x, door.centerX, 0.15, (x) => (player.pos.x = x));

  const threshold = TOP + 2 * TILE; // the bottom edge of the door
  const inside = threshold - 6;     // how far in he walks
  await animate(player.pos.y, inside, 0.5, (y) => {
    player.pos.y = y;
    if (y < threshold) {
      // Past the threshold: draw him behind the door frame (z 3) but in
      // front of the darkness (z 1), and fade him out as he goes deeper.
      player.z = 2;
      player.opacity = (y - inside) / (threshold - inside);
    }
  });
  await fadeOut(fader);
}

// Walks the knight to the ladder and climbs it up out of the room, then fades
// the screen out.
export async function climbLadder(player, ladder, fader) {
  takeControl(player);
  player.play("run");
  await animate(player.pos.x, ladder.centerX, 0.15, (x) => (player.pos.x = x));

  // Rung sounds while he climbs.
  const rungs = loop(0.14, () => playSound("climb"));
  await animate(player.pos.y, -6, 0.9, (y) => (player.pos.y = y));
  rungs.cancel();
  await fadeOut(fader);
}

// Where the knight stands in the title room: just to the right of the
// hatch, so he doesn't hide it.
export const besideHatch = (hatch) => vec2(hatch.centerX + 20, hatch.y + 14);

// Back in the title room: the knight climbs up out of the floor hatch and
// steps off it.
export async function climbOutOfHatch(player, hatch) {
  takeControl(player);
  player.pos = vec2(hatch.centerX, hatch.y + 12);
  player.opacity = 0;
  player.play("run");

  const rungs = loop(0.14, () => playSound("climb"));
  await animate(0, 1, 0.45, (t) => {
    player.pos.y = hatch.y + 12 - 10 * t; // rises up out of the hole
    player.opacity = Math.min(1, t * 2);
  });
  rungs.cancel();

  // Step off the hatch, onto the floor beside it.
  const spot = besideHatch(hatch);
  await animate(player.pos, spot, 0.25, (p) => (player.pos = p));
  player.play("idle");
}
