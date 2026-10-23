import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { puffDust } from "./effects.js";
import { playSound } from "./sound.js";

// Things thrown at the hero: the Big Zombie's spit, the imps' fireballs, and
// the plague doctors' flasks (which burst into fire on the floor).
// A shot flies in a straight line and hurts him if it touches him (it's a
// "hazard": setupHurt in combat.js checks those). A swing does nothing to it:
// the only way to deal with a shot is to get out of its way. It bursts when
// it hits him, a wall, or something solid (a pillar, a breakable, a chest).

export const SHOT_HEIGHT = 12; // px above the floor they fly at

// Where flying things are allowed to be: inside the room's walls.
const ROOM = { left: 6, right: GAME_WIDTH - 6, top: TOP + 2 * TILE, bottom: GAME_HEIGHT - 5 };
export const inRoom = (p) => p.x > ROOM.left && p.x < ROOM.right && p.y > ROOM.top && p.y < ROOM.bottom;

// Whether a point on the floor is inside something solid (crypt.js tags
// pillars, breakables and chests "solid", with a box around their base).
export const inSolid = (p) => get("solid").some(({ box }) =>
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

// One patch of fire on the floor (the boss's dash trail, a burst flask): it
// lies under everyone (z 6), burns for `life` seconds, and hurts the hero if
// he steps in it (setupHurt in combat.js checks everything tagged "hazard").
export function addFire(at, life = 4) {
  const born = time();
  const seed = rand(0, 10);
  const fire = add([
    pos(at),
    z(6),
    "hazard",
    {
      touches: (player) => time() - born < life - 0.3
        && Math.abs(player.pos.x - at.x) < 8 && Math.abs(player.pos.y - at.y) < 5,
    },
  ]);

  fire.onUpdate(() => {
    if (time() - born > life) destroy(fire);
  });
  fire.onDraw(() => {
    const fade = Math.min(1, (life - (time() - born)) / 0.6); // fades out over its last 0.6 s
    drawRect({ pos: vec2(-5, -2), width: 10, height: 4, color: rgb(120, 30, 20), opacity: 0.7 * fade });
    // Three little flames that flicker up and down.
    [-3, 0, 3].forEach((x, i) => {
      const height = 3 + 2.5 * Math.abs(Math.sin(time() * 14 + seed + i * 2));
      drawRect({ pos: vec2(x - 1.5, -height), width: 3, height, color: rgb(247, 150, 23), opacity: 0.9 * fade });
      drawRect({ pos: vec2(x - 0.5, -height * 0.6), width: 1, height: height * 0.6, color: rgb(255, 220, 80), opacity: fade });
    });
  });
}

// A flask lobbed from `from` to `to` (a plague doctor's): it sails over
// everything in an arc, with where it'll land blinking on the floor, and
// bursts there into three patches of fire that burn for FLASK.burn seconds.
// Nothing happens if the room is over or frozen by then.
const FLASK = { air: 0.9, height: 40, burn: 3 };
export function lobFlask(from, to, room) {
  const born = time();
  const mark = add([pos(to), z(6)]);
  mark.onDraw(() => drawEllipse({
    pos: vec2(0), radiusX: 11, radiusY: 7,
    fill: false, outline: { width: 1, color: Math.floor(time() * 12) % 2 ? rgb(140, 220, 90) : rgb(255, 205, 70) },
  }));
  const flask = add([pos(from), z(12)]);
  flask.onUpdate(() => {
    const t = Math.min(1, (time() - born) / FLASK.air);
    flask.pos = from.lerp(to, t).sub(0, SHOT_HEIGHT * (1 - t) + Math.sin(t * Math.PI) * FLASK.height);
    if (t < 1) return;
    destroy(flask);
    destroy(mark);
    if (room.over || room.frozen) return;
    playSound("glass");
    puffDust(to.x, to.y - 2, 6, 8, 11);
    for (const [dx, dy] of [[0, 0], [-8, 2], [8, 2]]) addFire(to.add(dx, dy), FLASK.burn);
  });
  flask.onDraw(() => {
    // A little green flask, turning as it flies.
    const tilt = Math.round(Math.sin(time() * 14) * 2);
    drawRect({ pos: vec2(-3, -4), width: 6, height: 6, color: rgb(24, 20, 37) });
    drawRect({ pos: vec2(-2, -3), width: 4, height: 4, color: rgb(99, 199, 77) });
    drawRect({ pos: vec2(-1 + tilt * 0.3, -6), width: 2, height: 2, color: rgb(200, 190, 170) });
  });
}
