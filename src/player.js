import { PLAYER_SPEED } from "./config.js";
import { MUD_SLOW } from "./mobs.js";
import { BALANCE } from "./balance.js";
import { puffDust, during, addShadow } from "./effects.js";
import { getSetting } from "./settings.js";
import { playSound } from "./sound.js";
import { keepInRoom } from "./room.js";

export const PLAYER_FEET = [10, 6]; // the box at his feet that collides, in px

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
    area({ shape: new Rect(vec2(0), ...PLAYER_FEET) }),
    body(),
    opacity(1),
    rotate(0),
    scale(1),  // squashed flat for a moment when he lands
    z(10),     // in front of the floor and his shadow
    "player",
    // A plain object adds our own properties. While frozen, the keyboard does
    // nothing, so cutscenes (like walking through a door) can move him instead.
    // `facing` is the direction he last walked in; his weapon swings that way.
    // `wade` is how fast he gets through mud and the swamp's water (a share
    // of his speed: Waders raises them), and `inWater()` whether he's in it
    // (water.js sets it in the swamp).
    // `pace` is what his speed is multiplied by (the pit's pacts slow him).
    { frozen: false, dashing: false, facing: vec2(1, 0), wade: { mud: MUD_SLOW, water: 1 }, inWater: () => false, pace: 1 },
  ]);
  // His shadow is hidden during cutscenes (they take away his body): falling
  // in has its own shadow, and in a doorway it would show over the door.
  addShadow(player, 12, () => player.has("body"));
  return player;
}

// How fast he can walk where he stands, as a share of his speed: mud (a
// muddy's trail) and the swamp's water slow him, and where they meet, the
// slower one counts.
function footing(player) {
  const inMud = get("mud").some((mud) => mud.covers(player.pos));
  return player.pace * Math.min(inMud ? player.wade.mud : 1, player.inWater() ? player.wade.water : 1);
}

// Which way he's being told to go: the movement keys (WASD or the arrows,
// see the buttons in main.js).
function heldDirection() {
  const dir = vec2(0, 0);
  if (isButtonDown("left")) dir.x -= 1;
  if (isButtonDown("right")) dir.x += 1;
  if (isButtonDown("up")) dir.y -= 1;
  if (isButtonDown("down")) dir.y += 1;
  // unit() makes diagonal movement the same speed as straight movement.
  // Without it, moving diagonally would be about 41% faster.
  return dir.len() > 0 ? dir.unit() : dir;
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
      player.move(dir.scale(PLAYER_SPEED * footing(player)));
      keepInRoom(player, PLAYER_FEET);
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
// from hits; it's only for moving. Afterimages trail behind him. Water (the
// swamp's) makes it shorter; mud doesn't.
//
// Each dash uses a charge. A charge takes stats.dashCooldown seconds to fill
// (Quick feet shortens it), and Second charge gives him two. While one is
// ready, the other fills at half speed, but keeps its progress: dash with
// one ready and the other halfway, and the halfway one finishes at full
// speed (DESIGN.md section 5). A small bar per charge under his feet shows
// them filling.
//
// `statsNow()` gives the hero's stats (stats.js). It's asked on every press
// and every frame, so in the rooms where the dash can be bought or reset
// (the underworld, Options) it changes at once. Without the dash bought,
// Shift does nothing.
const DASH_TIME = 0.15; // seconds

export function setupDash(player, statsNow) {
  let ready = statsNow().dashCharges; // charges ready to use
  let filling = 0;                    // how full the next one is, 0 to 1
  let charges = ready;                // how many he had last frame

  player.onUpdate(() => {
    const { dashCharges, dashCooldown } = statsNow();
    // A charge just bought at the altar comes ready, like every room's.
    if (dashCharges > charges) ready += dashCharges - charges;
    charges = dashCharges;
    if (ready >= dashCharges) {
      ready = dashCharges;
      filling = 0;
      return;
    }
    filling += dt() / (ready === 0 ? dashCooldown : 2 * dashCooldown);
    if (filling >= 1) {
      ready++;
      filling = ready < dashCharges ? filling - 1 : 0; // the next one starts filling
    }
  });

  onButtonPress("dash", async () => {
    if (!statsNow().unlocked.has("dash") || player.frozen || player.dashing || ready < 1) return;
    const keys = heldDirection();
    const way = keys.len() > 0 ? keys.unit() : player.facing;
    const reach = BALANCE.hero.dash.distance * player.pace * (player.inWater() ? player.wade.water : 1);
    ready--;
    player.dashing = true;
    playSound("dash");
    puffDust(player.pos.x, player.pos.y, 4, 8, 9);

    let lastGhost = -1;
    await during(DASH_TIME, (elapsed) => {
      // move() (not setting pos) so walls still stop him.
      // At most 8 px a frame, so on a slow frame he can't skip through a
      // pot's or a chest's 12 px box.
      player.moveBy(way.scale(Math.min((reach / DASH_TIME) * dt(), 8)));
      keepInRoom(player, PLAYER_FEET);
      if (elapsed - lastGhost > 0.035) {
        lastGhost = elapsed;
        addAfterimage(player);
      }
    }, () => !player.frozen);
    player.dashing = false;
  });

  // The bars under his feet, while a charge is missing: one per charge
  // (14 px in all), full when it's ready, growing while it fills.
  player.onDraw(() => {
    const { dashCharges, unlocked } = statsNow();
    if (!unlocked.has("dash") || ready >= dashCharges || player.frozen) return;
    const gap = 2;
    const width = (14 - gap * (dashCharges - 1)) / dashCharges;
    for (let i = 0; i < dashCharges; i++) {
      const x = -7 + i * (width + gap);
      const share = i < ready ? 1 : i === ready ? filling : 0;
      drawRect({ pos: vec2(x, 2), width, height: 3, color: rgb(24, 20, 37), opacity: 0.8 });
      drawRect({ pos: vec2(x + 1, 3), width: (width - 2) * share, height: 1, color: rgb(140, 200, 255) });
    }
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
