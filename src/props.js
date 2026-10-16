import { TILE, TOP, GAME_WIDTH } from "./config.js";
import { playSound } from "./sound.js";

// Things placed in the menu rooms: the ladder, the floor hatch, signs,
// plaques, levers, keyboard keys and the title text.

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
    number.text = String(level);
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
export function addShadowText(content, x, y, size, rgb, depth = 0) {
  add([text(content, { size, font: "pixel" }), pos(x + 1, y + 1), anchor("center"), color(12, 10, 20), z(depth)]);
  return add([text(content, { size, font: "pixel" }), pos(x, y), anchor("center"), color(...rgb), z(depth)]);
}
