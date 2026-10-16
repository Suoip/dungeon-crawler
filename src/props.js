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

// The question scroll, dropped by a room's last monster: a little rolled-up
// scroll with a red ribbon, lying on the floor. It hops out of the monster,
// then bobs gently. Walking over it picks it up: it flies up to where the
// big scroll opens, and `onPickup` runs. Once he's close, it drifts toward
// him, like a dropped heart.
export function addScrollPickup(at, player, onPickup) {
  const born = time();
  let spot = at;
  const scroll = add([pos(at), z(9)]);

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
export function addShadowText(content, x, y, size, rgb) {
  add([text(content, { size, font: "pixel" }), pos(x + 1, y + 1), anchor("center"), color(12, 10, 20)]);
  return add([text(content, { size, font: "pixel" }), pos(x, y), anchor("center"), color(...rgb)]);
}
