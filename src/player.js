import { PLAYER_SPEED } from "./config.js";
import { puffDust } from "./effects.js";
import { getSetting } from "./settings.js";
import { playSound } from "./sound.js";

// In the run animation (frames 4-7 of each hero's strip), frame 4 is the one
// where his foot is planted on the ground. That's when we play a step.
const FOOT_DOWN_FRAME = 4;

// The player, as whichever hero they picked in the Heroes room.
export function addPlayer(x, y) {
  return add([
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
    { frozen: false, facing: vec2(1, 0) },
  ]);
}

// True if any of the given keys is being held down.
const held = (...keys) => keys.some((k) => isKeyDown(k));

export function setupPlayerMovement(player) {
  let lastFrame = -1;

  // onUpdate runs every frame (about 60 times a second).
  player.onUpdate(() => {
    if (player.frozen) return;
    player.z = 10 + player.pos.y / 1000; // lower on screen = drawn in front of mobs

    const dir = vec2(0, 0);
    if (held("a", "left")) dir.x -= 1;
    if (held("d", "right")) dir.x += 1;
    if (held("w", "up")) dir.y -= 1;
    if (held("s", "down")) dir.y += 1;

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
