import { PLAYER_SPEED } from "./config.js";
import { puffDust, during, addShadow } from "./effects.js";
import { getSetting } from "./settings.js";
import { playSound } from "./sound.js";

// In the run animation (frames 4-7 of each hero's strip), frame 4 is the one
// where his foot is planted on the ground. That's when we play a step.
const FOOT_DOWN_FRAME = 4;

// The player, as whichever hero they picked in the Heroes room.
export function addPlayer(x, y) {
  const player = add([
    sprite(getSetting("hero"), { anim: "idle" }),
    pos(x, y),
    anchor("bot"), // pos is the point between his feet, not his top-left corner
    // Only his feet collide (10x6 px), not his whole 16x28 body. That's what
    // lets him walk "in front of" the wall instead of stopping at his head.
    area({ shape: new Rect(vec2(0), 10, 6) }),
    body(),
    opacity(1),
    rotate(0),
    scale(1),  // squashed flat for a moment when he lands
    z(10),     // in front of the floor, cracks and his shadow
    "player",
    // A plain object adds our own properties. While frozen, the keyboard does
    // nothing, so cutscenes (like walking through a door) can move him instead.
    // `facing` is the direction he last walked in; his weapon swings that way.
    { frozen: false, dashing: false, facing: vec2(1, 0) },
  ]);
  // His shadow is hidden during cutscenes (they take away his body): falling
  // in has its own shadow, and in a doorway it would show over the door.
  addShadow(player, 12, () => player.has("body"));
  return player;
}

// True if any of the given keys is being held down.
const held = (...keys) => keys.some((k) => isKeyDown(k));

// The direction the movement keys point, e.g. (1, -1) for up and right.
function heldDirection() {
  const dir = vec2(0, 0);
  if (held("a", "left")) dir.x -= 1;
  if (held("d", "right")) dir.x += 1;
  if (held("w", "up")) dir.y -= 1;
  if (held("s", "down")) dir.y += 1;
  return dir;
}

export function setupPlayerMovement(player) {
  let lastFrame = -1;

  // onUpdate runs every frame (about 60 times a second).
  player.onUpdate(() => {
    if (player.frozen) return;
    player.z = 10 + player.pos.y / 1000; // lower on screen = drawn in front of mobs
    if (player.dashing) return;           // the dash moves him (see below)

    const dir = heldDirection();

    if (dir.len() > 0) {
      // unit() makes diagonal movement the same speed as straight movement.
      // Without it, moving diagonally would be about 41% faster.
      player.move(dir.unit().scale(PLAYER_SPEED));
      player.facing = dir.unit();
      if (dir.x !== 0) player.flipX = dir.x < 0; // face the way he's walking
      if (player.getCurAnim().name !== "run") player.play("run");

      // A footstep and a small puff of dust each time his foot lands, so the
      // sound follows the animation instead of a fixed timer (once per stride).
      if (player.frame === FOOT_DOWN_FRAME && lastFrame !== FOOT_DOWN_FRAME) {
        puffDust(player.pos.x, player.pos.y, 2, 5, 9); // z 9: behind him
        playSound("step");
      }
    } else if (player.getCurAnim().name !== "idle") {
      player.play("idle");
    }
    // Remember the frame every update (also while standing), so the first
    // step after starting to walk is never skipped.
    lastFrame = player.frame;
  });
}

// Shift: a quick dash in the direction he's moving (or facing, if he's
// standing still), for getting into position. It doesn't make him safe
// from hits; it's only for moving. Afterimages trail behind him, and a small
// bar under his feet fills up until he can dash again.
const DASH_DISTANCE = 48; // px
const DASH_TIME = 0.15;   // seconds
const DASH_COOLDOWN = 1;  // seconds

export function setupDash(player) {
  let readyAt = 0;

  onKeyPress("shift", async () => {
    if (player.frozen || player.dashing || time() < readyAt) return;
    const keys = heldDirection();
    const way = keys.len() > 0 ? keys.unit() : player.facing;
    readyAt = time() + DASH_COOLDOWN;
    player.dashing = true;
    playSound("dash");
    puffDust(player.pos.x, player.pos.y, 4, 8, 9);

    let lastGhost = -1;
    await during(DASH_TIME, (elapsed) => {
      // move() (not setting pos) so walls still stop him.
      player.move(way.scale(DASH_DISTANCE / DASH_TIME));
      if (elapsed - lastGhost > 0.035) {
        lastGhost = elapsed;
        addAfterimage(player);
      }
    }, () => !player.frozen);
    player.dashing = false;
  });

  player.onDraw(() => {
    const left = readyAt - time();
    if (left <= 0 || player.frozen) return;
    drawRect({ pos: vec2(-7, 2), width: 14, height: 3, color: rgb(24, 20, 37), opacity: 0.8 });
    drawRect({ pos: vec2(-6, 3), width: 12 * (1 - left / DASH_COOLDOWN), height: 1, color: rgb(140, 200, 255) });
  });
}

// A see-through blue copy of the hero that fades where he just was.
function addAfterimage(player) {
  const ghost = add([
    sprite(player.sprite, { frame: player.frame, flipX: player.flipX }),
    pos(player.pos),
    anchor("bot"),
    color(140, 200, 255),
    opacity(0.5),
    z(player.z - 0.001),
  ]);
  tween(0.5, 0, 0.2, (v) => (ghost.opacity = v)).onEnd(() => destroy(ghost));
}
