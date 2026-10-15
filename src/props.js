import { TILE, TOP } from "./config.js";

// Things placed in the menu rooms: the ladder, the floor hatch, levers,
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
export function addShadowText(content, x, y, size, rgb) {
  add([text(content, { size, font: "pixel" }), pos(x + 1, y + 1), anchor("center"), color(12, 10, 20)]);
  return add([text(content, { size, font: "pixel" }), pos(x, y), anchor("center"), color(...rgb)]);
}
