import { TILE, TOP, GAME_WIDTH } from "./config.js";
import { playSound } from "./sound.js";

// Things placed in the menu rooms and the underworld: the ladder, the floor
// hatch, the well, the altar, signs, plaques, levers, the reset button,
// keyboard keys and the title text.

// The pack's wood colors, for things we draw ourselves.
const WOOD_DARK = [59, 30, 20];
const WOOD = [138, 75, 43];
const WOOD_LIGHT = [184, 111, 60];

// A wooden ladder leaning on the back wall, going up out of the room. The
// tileset only has a ladder going *down* through the floor, so this one is
// drawn from rectangles in the same colors.
export function addLadder(centerX) {
  const top = 0;               // runs off the top of the screen...
  const bottom = TOP + 2 * TILE; // ...down to the foot of the wall
  const left = centerX - 7;
  const right = centerX + 4;

  for (const x of [left, right]) {
    add([rect(3, bottom - top), pos(x, top), color(...WOOD_DARK), z(1)]);
    add([rect(1, bottom - top), pos(x + 1, top), color(...WOOD_LIGHT), z(1)]);
  }
  for (let y = bottom - 4; y > top; y -= 6) {
    add([rect(right - left - 3, 2), pos(left + 3, y), color(...WOOD), z(1)]);
    add([rect(right - left - 3, 1), pos(left + 3, y + 1), color(...WOOD_DARK), z(1)]);
  }

  const zone = add([
    pos(centerX - 10, bottom),
    area({ shape: new Rect(vec2(0), 20, 14) }),
  ]);
  return { centerX, zone };
}

// The pack's hatch in the floor, with a ladder going down into it. In the
// title room, it's where the knight climbs back up from the rooms below.
export function addHatch(col, row) {
  add([sprite("floor_ladder"), pos(col * TILE, TOP + row * TILE)]);
  return { centerX: col * TILE + TILE / 2, y: TOP + row * TILE };
}

// A stone well, round and open, with the underworld's red glow pulsing deep
// down and an ember drifting up now and then. It's the way down to the
// underworld: after the boss, and from the title room once you've been there.
// It stands on the floor tile at (col, row). It's solid, like the altar
// (only its foot, so the hero can walk behind it), and it's sorted with the
// characters, so he's drawn behind it when he's behind it. Returns its middle
// (centerX), its opening's y, its foot's y, its depth (z) and its zone: the
// floor in front of it. climbIntoWell (cutscenes.js) takes him down it.
export function addWell(col, row) {
  const x = col * TILE + TILE / 2;
  const y = TOP + row * TILE;
  const opening = y + 9;   // the middle of its opening
  const foot = y + 19;     // the bottom of its front wall
  const depth = 10 + foot / 1000;
  const DARK = rgb(24, 20, 37);
  const MORTAR = rgb(66, 58, 80);
  const well = add([
    pos(x, opening),
    area({ shape: new Rect(vec2(-12, 3), 24, 7) }),
    body({ isStatic: true }),
    z(depth),
  ]);
  well.onDraw(() => {
    // Its front: a round wall of stone bricks, three rows of them.
    drawRect({ pos: vec2(-12, 0), width: 24, height: 10, color: DARK });
    drawRect({ pos: vec2(-11, 0), width: 22, height: 9, color: rgb(112, 102, 124) });
    drawRect({ pos: vec2(-11, 7), width: 22, height: 2, color: rgb(84, 76, 98) }); // the bottom, in shade
    for (const rowY of [3, 6]) drawRect({ pos: vec2(-11, rowY), width: 22, height: 1, color: MORTAR });
    for (const [jointX, jointY] of [[-6, 0], [0, 0], [6, 0], [-9, 4], [-3, 4], [3, 4], [9, 4], [-6, 7], [0, 7], [6, 7]]) {
      drawRect({ pos: vec2(jointX, jointY), width: 1, height: 2, color: MORTAR });
    }
    // The rim on top, then the dark hole, its far inside wall, and the
    // underworld's glow down at the bottom.
    drawEllipse({ pos: vec2(0, 0), radiusX: 12, radiusY: 6, color: DARK });
    drawEllipse({ pos: vec2(0, 0), radiusX: 11, radiusY: 5, color: rgb(156, 148, 168) });
    drawEllipse({ pos: vec2(0, 0), radiusX: 8, radiusY: 3, color: rgb(12, 10, 20) });
    drawRect({ pos: vec2(-6, -2), width: 12, height: 1, color: rgb(40, 34, 52) });
    for (const [dx, dy] of [[-10, -1], [-5, -4], [5, -4], [10, -1], [-6, 3], [6, 3]]) {
      drawRect({ pos: vec2(dx, dy), width: 1, height: 1, color: MORTAR }); // the rim's stones
    }
    const glow = 0.4 + Math.sin(time() * 2.5) * 0.2;
    drawEllipse({ pos: vec2(0, 1), radiusX: 5, radiusY: 1.5, color: rgb(230, 72, 46), opacity: glow });
  });
  loop(0.7, () => {
    if (!chance(0.6)) return;
    const ember = add([rect(1, 1), pos(x + rand(-4, 4), opening), color(247, 150, 23), opacity(0.9), z(depth + 0.001)]);
    const start = ember.pos.clone();
    tween(0, 1, rand(0.8, 1.3), (t) => {
      ember.pos = start.add(Math.sin(t * 7) * 1.5, -14 * t);
      ember.opacity = 0.9 * (1 - t);
    }).onEnd(() => destroy(ember));
  });
  const zone = add([pos(x - 12, foot), area({ shape: new Rect(vec2(0), 24, 12) })]);
  return { centerX: x, opening, foot, depth, zone };
}

// The underworld's altar, where the skill tree opens: a block of stone with
// a skull on top, a candle at each end and a sigil carved in the front.
// (x, y) is the middle of its foot. It's solid (only its foot, like the
// characters, so the hero can walk behind it), and the zone is the floor in
// front of it. setLit(true) makes the sigil glow gold: there's something
// you can buy.
export function addAltar(x, y) {
  let lit = false;
  const DARK = rgb(24, 20, 37);
  const altar = add([
    pos(x, y),
    area({ shape: new Rect(vec2(-15, -7), 30, 7) }),
    body({ isStatic: true }),
    z(10 + y / 1000), // sorted with the characters
  ]);
  altar.onDraw(() => {
    drawRect({ pos: vec2(-16, -19), width: 32, height: 19, color: DARK });                // outline
    drawRect({ pos: vec2(-15, -18), width: 30, height: 4, color: rgb(150, 98, 98) });     // the slab on top
    drawRect({ pos: vec2(-15, -18), width: 30, height: 1, color: rgb(186, 128, 124) });   // its lit edge
    drawRect({ pos: vec2(-13, -14), width: 26, height: 12, color: rgb(104, 62, 66) });    // the front, in shade
    drawRect({ pos: vec2(-15, -2), width: 30, height: 2, color: rgb(78, 44, 50) });       // the plinth
    // The sigil: a ring with a cross through it, dull until there's
    // something to buy, then glowing gold.
    const glow = lit ? 0.75 + Math.sin(time() * 4) * 0.25 : 1;
    const mark = lit ? rgb(255, 205, 70) : rgb(64, 34, 40);
    for (const [dx, dy, w, h] of [[-3, -12, 6, 1], [-3, -5, 6, 1], [-4, -11, 1, 6], [3, -11, 1, 6], [0, -13, 1, 10], [-6, -8, 13, 1]]) {
      drawRect({ pos: vec2(dx, dy), width: w, height: h, color: mark, opacity: glow });
    }
    // A skull on top, with its eyes lit like the sigil.
    const BONE = rgb(226, 214, 196);
    drawRect({ pos: vec2(-4, -25), width: 9, height: 6, color: DARK });
    drawRect({ pos: vec2(-3, -20), width: 7, height: 3, color: DARK });
    drawRect({ pos: vec2(-2, -24), width: 5, height: 1, color: BONE });
    drawRect({ pos: vec2(-3, -23), width: 7, height: 3, color: BONE });
    drawRect({ pos: vec2(-2, -20), width: 5, height: 2, color: BONE });
    for (const eyeX of [-2, 1]) drawRect({ pos: vec2(eyeX, -22), width: 2, height: 2, color: lit ? mark : DARK, opacity: lit ? glow : 1 });
    for (const gapX of [-1, 1]) drawRect({ pos: vec2(gapX, -19), width: 1, height: 1, color: DARK }); // between the teeth
    // The candles, with flames that flicker.
    for (const side of [-1, 1]) {
      const cx = side * 11;
      drawRect({ pos: vec2(cx - 1, -24), width: 3, height: 7, color: DARK });
      drawRect({ pos: vec2(cx, -23), width: 1, height: 5, color: rgb(240, 230, 210) });
      const flicker = Math.sin(time() * 13 + side * 2) > 0.3 ? 1 : 0;
      drawRect({ pos: vec2(cx - 0.5, -27 - flicker), width: 2, height: 3 + flicker, color: rgb(247, 150, 23) });
      drawRect({ pos: vec2(cx, -26), width: 1, height: 2, color: rgb(255, 205, 70) });
    }
  });
  const zone = add([pos(x - 14, y), area({ shape: new Rect(vec2(0), 28, 20) })]);
  return { zone, setLit: (on) => (lit = on) };
}

// A big red button in the floor, with its name over it. press() pushes it
// down for good; the label can be changed with setLabel.
export function addFloorButton(x, y, title) {
  const button = add([sprite("button_red_up"), pos(x, y), anchor("bot")]);
  const label = add([text(title, { size: 8, font: "pixel" }), pos(x, y - 24), anchor("center"), color(240, 230, 210)]);
  const zone = add([pos(x - 10, y - 8), area({ shape: new Rect(vec2(0), 20, 14) })]);
  return {
    zone,
    press: () => button.use(sprite("button_red_down")),
    setLabel(content, rgbColor = [240, 230, 210]) {
      label.text = content;
      label.use(color(...rgbColor));
    },
  };
}

// A wooden sign: lines of text on a small dark board, centered on (x, y).
// Each line is { text, color, umlautAt }: the color is optional, and
// umlautAt (also optional) is the position of a letter that gets two dots
// drawn over it, because the pixel font's capital Ö looks like a small ö.
// A sign that doesn't fit where it's asked for slides over until it's on
// the screen. Returns the sign; destroy it to take it down.
const SIGN_LINE = 10;  // px per line of text
const LETTER = 8;      // the pixel font is 8 px a letter
export function addSign(lines, x, y, { depth = 2 } = {}) {
  const width = Math.max(...lines.map((line) => line.text.length)) * LETTER + 6;
  const height = lines.length * SIGN_LINE;
  const centerX = Math.max(width / 2 + 2, Math.min(x, GAME_WIDTH - width / 2 - 2)); // the left edge wins if it's too wide
  const sign = add([pos(centerX, y), scale(1), z(depth)]);
  sign.add([rect(width + 2, height + 2), pos(-width / 2 - 1, -height / 2 - 1), color(24, 20, 37)]);
  sign.add([rect(width, height), pos(-width / 2, -height / 2), color(92, 52, 30)]);
  lines.forEach((line, i) => {
    const lineY = -height / 2 + i * SIGN_LINE + 6;
    const rgb = line.color ?? [240, 230, 210];
    sign.add([text(line.text, { size: 8, font: "pixel" }), pos(0, lineY), anchor("center"), color(...rgb)]);
    if (line.umlautAt === undefined) return;
    const letterX = -(line.text.length * LETTER) / 2 + line.umlautAt * LETTER; // the letter's left edge
    for (const dx of [1, 4]) sign.add([rect(2, 1), pos(letterX + dx, lineY - 6), color(...rgb)]);
  });
  return sign;
}

// A small stone plaque standing on the floor, like a little gravestone, with
// lines engraved on it. setLit(true) makes the engraving glow gold (while the
// hero is reading it). Its z sorts it with the characters, so the hero can
// walk in front of it and behind it.
export function addPlaque(x, y) {
  const depth = z(10 + y / 1000);
  const STONE_DARK = [40, 34, 52];
  add([rect(18, 4), pos(x - 9, y - 4), color(...STONE_DARK), depth]);           // its base
  add([rect(14, 15), pos(x - 7, y - 18), color(...STONE_DARK), depth]);         // outline
  add([rect(10, 2), pos(x - 5, y - 20), color(...STONE_DARK), depth]);          // rounded top
  add([rect(12, 14), pos(x - 6, y - 17), color(120, 112, 134), depth]);         // the stone
  add([rect(8, 2), pos(x - 4, y - 19), color(120, 112, 134), depth]);
  add([rect(2, 13), pos(x - 6, y - 17), color(150, 144, 160), depth]);          // lit edge
  const lines = [y - 15, y - 12, y - 9].map((lineY) =>
    add([rect(6, 1), pos(x - 3, lineY), color(...STONE_DARK), depth]));

  const zone = add([pos(x - 10, y - 2), area({ shape: new Rect(vec2(0), 20, 12) })]);
  const setLit = (on) => lines.forEach((line) => (line.color = on ? rgb(255, 205, 70) : rgb(...STONE_DARK)));
  return { zone, setLit };
}

// A volume slider on the floor: a rail with 11 notches (0 to 10) and a
// stone block on it as the knob. The hero moves the block by walking into
// it: one notch per bump, away from him. Bumped from the left, it slides
// right (louder); from the right, it slides left (quieter). To move it
// again, he steps back and bumps it again. `icon` ("speaker" or "note") is
// drawn at the left end, the number at the right end. `onChange(level)`
// runs on every notch.
const NOTCH = 16; // px between notches
export function addVolumeSlider(y, icon, level, player, onChange) {
  const left = 80;                    // where notch 0 is
  const right = left + 10 * NOTCH;    // and notch 10
  const notchX = (n) => left + n * NOTCH;
  const DARK = [24, 20, 37];

  // The rail: a groove in the floor with a tick at every notch (longer
  // ones at 0, 5 and 10).
  add([rect(right - left + 14, 6), pos(left - 7, y - 3), color(...DARK), z(1)]);
  add([rect(right - left + 12, 2), pos(left - 6, y - 1), color(58, 47, 74), z(1)]);
  for (let n = 0; n <= 10; n++) {
    const long = n % 5 === 0;
    add([rect(1, long ? 5 : 3), pos(notchX(n), y + 4), color(...(long ? [169, 155, 185] : [90, 77, 110])), z(1)]);
  }
  addVolumeIcon(left - 24, y, icon);
  const number = addShadowText(String(level), right + 22, y, 8, [240, 230, 210], 1);

  // The block. It's solid, so he stops against it instead of walking through.
  const block = add([
    pos(notchX(level), y + 3),
    area({ shape: new Rect(vec2(-7, -6), 14, 6) }),
    body({ isStatic: true }),
    z(10 + (y + 3) / 1000),
  ]);
  block.onDraw(() => {
    drawRect({ pos: vec2(-8, -15), width: 16, height: 15, color: rgb(...DARK) });      // outline
    drawRect({ pos: vec2(-7, -14), width: 14, height: 9, color: rgb(150, 144, 160) });  // the top, lit
    drawRect({ pos: vec2(-7, -5), width: 14, height: 4, color: rgb(104, 96, 120) });    // the front, in shade
    drawRect({ pos: vec2(-7, -14), width: 14, height: 1, color: rgb(190, 184, 200) });  // a highlight
    drawRect({ pos: vec2(-1, -12), width: 2, height: 5, color: rgb(255, 205, 70) });    // a gold mark, to line up with the ticks
  });

  const restX = () => notchX(level);

  // A bump: he's right up against its side, in line with it, walking into
  // it. One notch, then nothing more until he stops walking into it (lets go
  // of the key, or steps back): holding the key down doesn't keep pushing.
  let armed = true;
  block.onUpdate(() => {
    const dx = block.pos.x - player.pos.x;
    const inLine = Math.abs(player.pos.y - block.pos.y) < 6;
    const walkingToward = !player.frozen && player.getCurAnim()?.name === "run"
      && Math.sign(player.facing.x) === Math.sign(dx) && Math.abs(player.facing.x) > 0.5;
    if (!walkingToward || !inLine) armed = true;
    if (armed && walkingToward && inLine && Math.abs(dx) < 14) {
      armed = false;
      bump();
    }
  });

  function bump() {
    const way = player.pos.x < block.pos.x ? 1 : -1; // away from him
    const next = level + way;
    if (next < 0 || next > 10) {
      playSound("locked"); // already at the end: it just rattles
      tween(0, 1, 0.2, (t) => (block.pos.x = restX() + Math.sin(t * Math.PI * 4) * 2 * (1 - t)));
      return;
    }
    level = next;
    playSound("mobHit"); // the thunk of the bump
    tween(block.pos.x, restX(), 0.14, (x) => (block.pos.x = x), easings.easeOutQuad);
    number.setText(String(level));
    onChange(level);
  }
}

// The symbols at the start of the volume sliders, drawn in pixels:
//   speaker  a little loudspeaker with sound waves (sound effects)
//   note     a music note (music)
function addVolumeIcon(x, y, kind) {
  const LIGHT = [240, 230, 210];
  const SHADOW = [12, 10, 20];
  const parts = kind === "speaker"
    ? [[-6, -2, 3, 4], [-3, -4, 2, 8], [-1, -6, 2, 12], [3, -2, 1, 4], [5, -4, 1, 2], [5, 2, 1, 2], [6, -2, 1, 4]]
    : [[1, -7, 2, 10], [3, -7, 4, 2], [5, -5, 2, 2], [-3, 1, 5, 4], [-4, 2, 1, 2]];
  for (const [dx, dy, w, h] of parts) add([rect(w, h), pos(x + dx + 1, y + dy + 1), color(...SHADOW), z(1)]);
  for (const [dx, dy, w, h] of parts) add([rect(w, h), pos(x + dx, y + dy), color(...LIGHT), z(1)]);
}

// A lever standing on the floor. Left = off, right = on.
export function addLever(x, y, title, isOn) {
  const lever = add([sprite(isOn ? "lever_right" : "lever_left"), pos(x, y), anchor("bot")]);
  add([text(title, { size: 8, font: "pixel" }), pos(x, y - 30), anchor("center"), color(240, 230, 210)]);
  const state = add([text("", { size: 8, font: "pixel" }), pos(x, y - 20), anchor("center")]);

  function show(on) {
    lever.use(sprite(on ? "lever_right" : "lever_left"));
    state.text = on ? "ON" : "OFF";
    state.use(color(...(on ? [99, 199, 77] : [230, 72, 46])));
  }
  show(isOn);

  const zone = add([pos(x - 10, y), area({ shape: new Rect(vec2(0), 20, 14) })]);
  return { zone, show };
}

// A keyboard key, like the ones on a real keyboard: a light top, a darker
// bottom edge so it looks raised, and the key's name on it.
export function addKeycap(x, y, label) {
  const width = Math.max(14, label.length * 8 + 6);
  const left = x - width / 2;
  add([rect(width, 14, { radius: 2 }), pos(left, y), color(24, 20, 37)]);                  // outline
  add([rect(width - 2, 12, { radius: 1 }), pos(left + 1, y + 1), color(120, 110, 140)]);  // side
  add([rect(width - 2, 10, { radius: 1 }), pos(left + 1, y + 1), color(214, 206, 224)]);  // top
  add([text(label, { size: 8, font: "pixel" }), pos(x, y + 6), anchor("center"), color(40, 34, 56)]);
  return width;
}

// Text in the pixel font with a dark shadow under it, so it stands out on
// the floor.
// `depth` (optional) is its z, e.g. to keep it above things on the floor.
// Returns the text; to change what it says later, use its setText(), which
// changes the shadow too.
export function addShadowText(content, x, y, size, rgb, depth = 0) {
  const shadow = add([text(content, { size, font: "pixel" }), pos(x + 1, y + 1), anchor("center"), color(12, 10, 20), z(depth)]);
  const front = add([text(content, { size, font: "pixel" }), pos(x, y), anchor("center"), color(...rgb), z(depth)]);
  front.setText = (content) => (front.text = shadow.text = content);
  return front;
}
