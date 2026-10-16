import { TILE, TOP } from "./config.js";
import { playSound } from "./sound.js";

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

// The question scroll, dropped by a room's last monster: a little rolled-up
// scroll with a red ribbon, lying on the floor. It hops out of the monster,
// then bobs gently. Walking over it picks it up: it flies up to where the
// big scroll opens, and `onPickup` runs. Once he's close, it drifts toward
// him, like a dropped heart.
export function addScrollPickup(at, player, onPickup) {
  const born = time();
  let spot = at;
  const scroll = add([pos(at), z(9), "scroll-pickup"]);

  const drawRolled = (y, size = 1) => {
    const PAPER = rgb(232, 213, 169);
    const DARK = rgb(58, 40, 24);
    const ROLL = rgb(178, 128, 70);
    const w = 12 * size;
    const h = 6 * size;
    drawRect({ pos: vec2(-w / 2, y - h), width: w, height: h, color: DARK });
    drawRect({ pos: vec2(-w / 2 + size, y - h + size), width: w - 2 * size, height: h - 2 * size, color: PAPER });
    drawRect({ pos: vec2(-w / 2, y - h), width: 2 * size, height: h, color: ROLL });       // the rolled ends
    drawRect({ pos: vec2(w / 2 - 2 * size, y - h), width: 2 * size, height: h, color: ROLL });
    drawRect({ pos: vec2(-size / 2, y - h), width: size, height: h, color: rgb(200, 40, 40) }); // ribbon
  };

  scroll.onDraw(() => {
    const age = time() - born;
    const hop = age < 0.35 ? Math.sin((age / 0.35) * Math.PI) * 10 : Math.abs(Math.sin(age * 3)) * 1.5;
    drawEllipse({ pos: vec2(0, 0), radiusX: 5, radiusY: 1.5, color: rgb(0, 0, 0), opacity: 0.3 });
    drawRolled(-hop - 1);
  });

  scroll.onUpdate(() => {
    if (time() - born < 0.35 || player.frozen) return;
    const distance = player.pos.dist(spot);
    if (distance < 20) spot = spot.add(player.pos.sub(spot).unit().scale(Math.min(distance, 90 * dt())));
    scroll.pos = spot;
    if (distance >= 8) return;

    // Picked up: it flies up, growing, to the top of the screen, where the
    // big scroll opens.
    destroy(scroll);
    const flying = add([pos(spot), z(60), opacity(1)]);
    let size = 1;
    flying.onDraw(() => drawRolled(0, size));
    const from = spot.clone();
    tween(0, 1, 0.22, (t) => {
      flying.pos = from.lerp(vec2(160, -6), t);
      size = 1 + t * 1.5;
    }, easings.easeInQuad).onEnd(() => {
      destroy(flying);
      onPickup();
    });
  });
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
// stone block on it as the knob. The hero moves the block by hitting it with
// his weapon: one notch per hit, away from him. Hit from the left, it slides
// right (louder); from the right, it slides left (quieter). `icon`
// ("speaker" or "note") is drawn at the left end, the number at the right
// end. `onChange(level)` runs on every notch.
const NOTCH = 16; // px between notches
export function addVolumeSlider(y, icon, level, onChange) {
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

  // The block. It's solid, so he stops against it instead of walking
  // through, and "strikeable": combat.js calls struck() when a swing hits it.
  const block = add([
    pos(notchX(level), y + 3),
    area({ shape: new Rect(vec2(-7, -6), 14, 6) }),
    body({ isStatic: true }),
    z(10 + (y + 3) / 1000),
    "strikeable",
    { hitHeight: 8, hitSize: 9, struck },
  ]);
  block.onDraw(() => {
    drawRect({ pos: vec2(-8, -15), width: 16, height: 15, color: rgb(...DARK) });      // outline
    drawRect({ pos: vec2(-7, -14), width: 14, height: 9, color: rgb(150, 144, 160) });  // the top, lit
    drawRect({ pos: vec2(-7, -5), width: 14, height: 4, color: rgb(104, 96, 120) });    // the front, in shade
    drawRect({ pos: vec2(-7, -14), width: 14, height: 1, color: rgb(190, 184, 200) });  // a highlight
    drawRect({ pos: vec2(-1, -12), width: 2, height: 5, color: rgb(255, 205, 70) });    // a gold mark, to line up with the ticks
  });

  const restX = () => notchX(level);

  function struck(player) {
    const way = player.pos.x < block.pos.x ? 1 : -1; // away from him
    const next = level + way;
    if (next < 0 || next > 10) {
      playSound("locked"); // already at the end: it just rattles
      tween(0, 1, 0.2, (t) => (block.pos.x = restX() + Math.sin(t * Math.PI * 4) * 2 * (1 - t)));
      return;
    }
    level = next;
    playSound("mobHit"); // the thunk of the hit
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

// The touch controls, drawn small for the title room: the joystick (a ring
// with a knob in it) or one of the round buttons, like the real ones.
export function addTouchIcon(x, y, kind) {
  if (kind === "stick") {
    add([circle(11), pos(x, y), anchor("center"), color(24, 20, 37)]);
    add([circle(10), pos(x, y), anchor("center"), color(90, 77, 110)]);
    add([circle(5), pos(x + 3, y - 2), anchor("center"), color(24, 20, 37)]);
    add([circle(4), pos(x + 3, y - 2), anchor("center"), color(214, 206, 224)]);
    return;
  }
  const radius = kind === "attack" ? 11 : kind === "use" ? 9 : 9;
  const ring = { attack: [230, 72, 46], use: [255, 205, 70], dash: [120, 110, 140] }[kind];
  add([circle(radius + 1), pos(x, y + 1), anchor("center"), color(18, 15, 28)]); // its shadow, so it looks raised
  add([circle(radius), pos(x, y), anchor("center"), color(...ring)]);
  add([circle(radius - 2), pos(x, y), anchor("center"), color(58, 47, 74)]);
}

// Text in the pixel font with a dark shadow under it, so it stands out on
// the floor.
// `depth` (optional) is its z, e.g. to keep it above things on the floor.
export function addShadowText(content, x, y, size, rgb, depth = 0) {
  add([text(content, { size, font: "pixel" }), pos(x + 1, y + 1), anchor("center"), color(12, 10, 20), z(depth)]);
  return add([text(content, { size, font: "pixel" }), pos(x, y), anchor("center"), color(...rgb), z(depth)]);
}
