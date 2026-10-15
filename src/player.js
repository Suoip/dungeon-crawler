import { PLAYER_SPEED } from "./config.js";

export function addPlayer(x, y) {
  return add([
    sprite("knight", { anim: "idle" }),
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
    { frozen: false },
  ]);
}

// True if any of the given keys is being held down.
const held = (...keys) => keys.some((k) => isKeyDown(k));

export function setupPlayerMovement(player) {
  // onUpdate runs every frame (about 60 times a second).
  player.onUpdate(() => {
    if (player.frozen) return;

    const dir = vec2(0, 0);
    if (held("a", "left")) dir.x -= 1;
    if (held("d", "right")) dir.x += 1;
    if (held("w", "up")) dir.y -= 1;
    if (held("s", "down")) dir.y += 1;

    if (dir.len() > 0) {
      // unit() makes diagonal movement the same speed as straight movement.
      // Without it, moving diagonally would be about 41% faster.
      player.move(dir.unit().scale(PLAYER_SPEED));
      if (dir.x !== 0) player.flipX = dir.x < 0; // face the way he's walking
      if (player.getCurAnim().name !== "run") player.play("run");
    } else if (player.getCurAnim().name !== "idle") {
      player.play("idle");
    }
  });
}
