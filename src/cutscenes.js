import { TILE, TOP, GAME_HEIGHT } from "./config.js";
import { openDoor } from "./doors.js";
import { sleep, animate, fadeOut, puffDust, shakeScreen, addSpawnHole } from "./effects.js";
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
// grows as he gets closer, so you can see where he'll land. `at` is where
// that is (the middle of the room, unless the room has something there).
export async function fallIn(player, at = vec2(LAND_X, LAND_Y)) {
  takeControl(player);
  player.pos = vec2(at.x, -4); // just above the top of the screen
  player.z = 10 + at.y / 1000; // in front of whatever he lands in front of

  const shadow = add([
    circle(7),
    pos(at.x, at.y - 1),
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
    animate(player.pos.y, at.y, FALL_SECONDS, (y) => (player.pos.y = y), easings.easeInQuad),
    animate(0, 1, FALL_SECONDS, (t) => {
      shadow.scale = vec2(lerp(0.3, 1, t), lerp(0.12, 0.4, t)); // a flat oval
      shadow.opacity = lerp(0.1, 0.45, t);
    }, easings.easeInQuad),
  ]);

  // Thud: squash him flat and wide, then let him spring back to normal.
  playSound("land");
  shakeScreen(2);
  puffDust(at.x, at.y);
  animate(shadow.opacity, 0, 0.2, (v) => (shadow.opacity = v)).then(() => destroy(shadow));
  await animate(0, 1, 0.2, (t) => {
    player.scale = vec2(lerp(1.4, 1, t), lerp(0.6, 1, t));
  }, easings.easeOutBack);
}

// The run is over: a dark hole opens under the hero, little hands reach up
// out of it and grab him, and drag him down into it, to the underworld.
// When he's died he's lying on the floor; with { standing: true } (the clock
// ran out) he's still on his feet.
export async function dragDown(player, { standing = false } = {}) {
  // Lying down, he's rotated 90° around his feet, so his body is to their right.
  const middle = standing ? player.pos.clone() : player.pos.add(11, 0);
  const closeHole = addSpawnHole(middle, standing ? 22 : 30);
  playSound("crumble");
  shakeScreen(3);
  await sleep(0.3);

  // Four hands, some in front of him and some behind, so they look like
  // they're grabbing him from both sides.
  const hands = [-11, -4, 3, 10].map((dx, i) => addHand(middle.add(dx, i % 2 ? 2 : -1), i % 2 ? 11 : 9));
  playSound("spawn");
  await animate(0, 1, 0.35, (t) => hands.forEach((hand) => (hand.reach = t)), easings.easeOutBack);
  await sleep(0.25);
  hands.forEach((hand) => (hand.grab = true)); // the fingers close
  playSound("mobHit");
  await sleep(0.3);

  // Down he goes.
  playSound("fall");
  shakeScreen(4);
  const start = player.pos.clone();
  await animate(0, 1, 0.7, (t) => {
    player.pos = start.add(0, 6 * t);
    player.opacity = 1 - t;
    player.scale = vec2(1 - 0.4 * t);
    hands.forEach((hand) => (hand.reach = 1 - t));
  }, easings.easeInQuad);
  hands.forEach((hand) => destroy(hand));
  closeHole();
  await sleep(0.4);
}

// One grey-green hand reaching up out of the floor. `reach` (0 to 1) is how
// far it's come out; with `grab`, its fingers bend over to hold on.
function addHand(at, depth) {
  const hand = add([pos(at), z(depth), { reach: 0, grab: false }]);
  hand.onDraw(() => {
    const arm = 9 * hand.reach;
    if (arm < 0.5) return;
    const SKIN = rgb(122, 150, 110);
    const DARK = rgb(38, 50, 38);
    drawRect({ pos: vec2(-2, -arm), width: 4, height: arm, color: DARK }); // the arm
    drawRect({ pos: vec2(-1, -arm), width: 2, height: arm, color: SKIN });
    const top = -arm - 3;
    drawRect({ pos: vec2(-3, top), width: 6, height: 4, color: DARK });    // the palm
    drawRect({ pos: vec2(-2, top + 1), width: 4, height: 2, color: SKIN });
    for (const x of [-3, -1, 1]) {
      // Open: fingers up. Grabbing: bent over to the side.
      if (hand.grab) drawRect({ pos: vec2(x, top - 1), width: 2, height: 1, color: SKIN });
      else drawRect({ pos: vec2(x + 0.5, top - 3), width: 1, height: 3, color: SKIN });
    }
  });
  return hand;
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

// Down the well (props.js addWell): he walks up to it, hops over the rim
// into the opening, and sinks out of sight with the well's front wall in
// front of him. Then the screen fades out.
export async function climbIntoWell(player, well, fader) {
  takeControl(player);
  player.play("run");
  await animate(player.pos, vec2(well.centerX, well.foot + 3), 0.25, (p) => (player.pos = p));
  const from = player.pos.clone();
  const into = vec2(well.centerX, well.opening + 3);
  playSound("dash");
  await animate(0, 1, 0.3, (t) => {
    player.pos = from.lerp(into, t).sub(0, Math.sin(t * Math.PI) * 10); // the hop
    if (t > 0.5) player.z = well.depth - 0.001; // over the rim: behind its wall now
  });
  playSound("fall");
  await animate(0, 1, 0.45, (t) => {
    player.pos.y = lerp(into.y, well.foot, t); // down into it, but no lower than its wall
    player.opacity = 1 - t;
  }, easings.easeInQuad);
  await fadeOut(fader);
}

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
