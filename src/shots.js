import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { puffDust } from "./effects.js";

// Things thrown at the hero: the Big Zombie's spit and the imps' fireballs.
// A shot flies in a straight line and hurts him if it touches him (it's a
// "hazard": setupHurt in combat.js checks those). A swing does nothing to it:
// the only way to deal with a shot is to get out of its way. It bursts when
// it hits him, a wall, or something solid (a pillar, a breakable, a chest).

export const SHOT_HEIGHT = 12; // px above the floor they fly at

// Where flying things are allowed to be: inside the room's walls.
const ROOM = { left: 6, right: GAME_WIDTH - 6, top: TOP + 2 * TILE, bottom: GAME_HEIGHT - 5 };
const inRoom = (p) => p.x > ROOM.left && p.x < ROOM.right && p.y > ROOM.top && p.y < ROOM.bottom;

// Whether a point on the floor is inside something solid (crypt.js tags
// pillars, breakables and chests "solid", with a box around their base).
const inSolid = (p) => get("solid").some(({ box }) =>
  p.x > box.left && p.x < box.right && p.y > box.top && p.y < box.bottom);

// How each kind of shot is drawn: its outer and inner colors.
const LOOKS = {
  spit: { outer: [60, 110, 40], inner: [110, 160, 60] }, // the Big Zombie's: dark green
  fire: { outer: [230, 72, 46], inner: [255, 205, 70] }, // an imp's fireball
};

// One shot, from `from` (the spot on the floor under it) flying along `dir`
// (a unit vector) at `speed` px per second. `look` is a key of LOOKS.
// Fireballs leave a few sparks behind them.
export function addShot(from, dir, { speed, look = "spit" }) {
  const colors = LOOKS[look];
  const shot = add([
    pos(from),
    z(10),
    "hazard",
    "shot",
    {
      dir,
      touches: (player) => shot.pos.dist(player.pos) < 7,
      onHit: () => pop(shot),
    },
  ]);

  shot.onUpdate(() => {
    shot.z = 10 + shot.pos.y / 1000;
    shot.pos = shot.pos.add(shot.dir.scale(speed * dt()));
    if (!inRoom(shot.pos) || inSolid(shot.pos)) return pop(shot);
    if (look === "fire" && Math.random() < 0.35) ember(shot.pos);
  });

  shot.onDraw(() => {
    drawEllipse({ pos: vec2(0, 0), radiusX: 3, radiusY: 1.2, color: rgb(0, 0, 0), opacity: 0.35 });
    // A fireball flickers a little.
    const radius = look === "fire" ? 3 + 0.5 * Math.sin(time() * 30) : 3;
    drawCircle({ pos: vec2(0, -SHOT_HEIGHT), radius, color: rgb(...colors.outer) });
    drawCircle({ pos: vec2(-0.5, -SHOT_HEIGHT - 0.5), radius: 1.5, color: rgb(...colors.inner) });
  });
  return shot;
}

// A tiny spark left behind a fireball, drifting up and fading.
function ember(at) {
  const spark = add([
    rect(1, 1),
    pos(at.x + rand(-1, 1), at.y - SHOT_HEIGHT + rand(-1, 1)),
    color(...choose([[247, 150, 23], [255, 205, 70]])),
    opacity(1),
    z(11),
  ]);
  tween(1, 0, 0.3, (t) => {
    spark.opacity = t;
    spark.pos.y -= 0.3;
  }).onEnd(() => destroy(spark));
}

function pop(shot) {
  if (!shot.exists()) return;
  puffDust(shot.pos.x, shot.pos.y - SHOT_HEIGHT, 3, 5, 11);
  destroy(shot);
}
