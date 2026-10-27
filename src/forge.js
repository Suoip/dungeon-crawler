import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BALANCE } from "./balance.js";
import { getSave, startCraft, wearPiece, seeGear } from "./save.js";
import { recipeOf, partsShort, forgeFull, canCraft, bonusText, drawCrafted } from "./crafting.js";
import { playSound } from "./sound.js";
import { getGamePixel } from "./display.js";
import { setPrompt } from "./panel.js";

// The forge's two pages (DESIGN.md section 6), drawn in the game over the
// dimmed underworld like the skill tree:
//   - the forge: the recipes on the left, what it's making on the right (the
//     piece on the anvil and the ones waiting), and the parts you have along
//     the title bar. Pick a recipe and make it.
//   - the gear chest: every piece it has made. Pick one and wear it.
// Mouse: click a recipe or piece to pick it, click it again to make or wear
// it. Keyboard: the arrows or WASD pick, E makes or wears, Esc closes.

const PALETTE = {
  ink: [24, 20, 37], stone: [58, 47, 74], stoneLight: [90, 77, 110],
  light: [240, 230, 210], muted: [169, 155, 185], dark: [44, 36, 56],
  gold: [255, 205, 70], green: [99, 199, 77], red: [230, 72, 46],
};
let C = null;
const TOP_BAR = 12;
const text = (content, x, y, color = C.light, anchorName = "topleft", opacity = 1) =>
  drawText({ text: content, pos: vec2(x, y), size: 8, font: "pixel", color, anchor: anchorName, opacity });

// "30S", "1:00", "2:30".
const timeText = (seconds) => {
  const whole = Math.ceil(seconds);
  return whole < 60 ? `${whole}S` : `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

// A square frame for a recipe or a piece, its rim saying where it stands.
function drawFrame(x, y, size, rim, opacity = 1) {
  drawRect({ pos: vec2(x - 1, y - 1), width: size + 2, height: size + 2, color: C.ink, opacity });
  drawRect({ pos: vec2(x, y), width: size, height: size, color: rim, opacity });
  drawRect({ pos: vec2(x + 1, y + 1), width: size - 2, height: size - 2, color: C.stone, opacity });
}
// Four breathing corner brackets round the picked one, like the tree's.
function drawCursor(x, y, size) {
  const out = 2 + Math.round(Math.sin(time() * 5));
  const [left, top, right, bottom] = [x - out, y - out, x + size + out, y + size + out];
  for (const [cx, cy, sx, sy] of [[left, top, 1, 1], [right, top, -1, 1], [left, bottom, 1, -1], [right, bottom, -1, -1]]) {
    const across = [sx > 0 ? cx : cx - 3, sy > 0 ? cy : cy - 1, 3, 1];
    const down = [sx > 0 ? cx : cx - 1, sy > 0 ? cy : cy - 3, 1, 3];
    for (const [rx, ry, w, h] of [across, down]) drawRect({ pos: vec2(rx - 1, ry - 1), width: w + 2, height: h + 2, color: C.ink });
    for (const [rx, ry, w, h] of [across, down]) drawRect({ pos: vec2(rx, ry), width: w, height: h, color: C.light });
  }
}

// What the two pages share: the dimmed room behind, the title bar, the
// panel at the bottom, and the mouse and keys. `page` gives:
//   pick(point)  what's under the mouse (an index, or null)
//   step(dir)    the picked one after an arrow key (or null to stay)
//   use(index)   make or wear it
//   draw(hover)  the page itself (hover: the one the mouse is on, or null)
//   scroll(dir)  the wheel, up -1 or down 1 (optional)
function openPage(title, hint, page, onClose) {
  C ??= Object.fromEntries(Object.entries(PALETTE).map(([name, [r, g, b]]) => [name, rgb(r, g, b)]));
  const born = time();
  const pointer = () => mousePos().scale(1 / getGamePixel());
  let hovered = null;
  const handles = [];
  handles.push(onMouseMove(() => {
    hovered = page.pick(pointer());
    setCursor(hovered !== null ? "pointer" : "default");
  }));
  handles.push(onMouseRelease("left", () => {
    const at = page.pick(pointer());
    if (at === null) return;
    if (at === page.picked) page.use(at);
    else {
      page.picked = at;
      playSound("letter");
    }
  }));
  if (page.scroll) handles.push(onScroll((delta) => delta.y && page.scroll(Math.sign(delta.y))));
  // A key press means the keyboard is in charge: the panel describes the
  // picked one again, not whatever the mouse is resting on. (The E that
  // opened the page doesn't count.)
  const byKey = (action) => () => {
    if (time() === born) return;
    hovered = null;
    action();
  };
  const dirs = { left: vec2(-1, 0), right: vec2(1, 0), up: vec2(0, -1), down: vec2(0, 1) };
  for (const [button, dir] of Object.entries(dirs)) {
    handles.push(onButtonPress(button, byKey(() => {
      const next = page.step(dir);
      if (next === null || next === page.picked) return;
      page.picked = next;
      playSound("letter");
    })));
  }
  handles.push(onButtonPress("use", byKey(() => page.use(page.picked))));
  handles.push(onKeyPress("escape", byKey(close)));
  setPrompt(null, () => {}, hint);

  const layer = add([pos(0, 0), z(200), fixed()]);
  layer.onDraw(() => {
    const appear = Math.min(1, (time() - born) / 0.15);
    drawRect({ pos: vec2(0, 0), width: GAME_WIDTH, height: GAME_HEIGHT, color: C.ink, opacity: 0.86 * appear });
    drawRect({ pos: vec2(0, 0), width: GAME_WIDTH, height: TOP_BAR, color: C.ink });
    text(title, 6, 2);
    page.draw(hovered);
  });

  function close() {
    handles.forEach((h) => h.cancel());
    setCursor("default");
    destroy(layer);
    playSound("letter");
    onClose?.();
  }
  playSound("unlock");
  return { close };
}

// The parts you have, along the right of the title bar: each one's picture
// and how many. Only the ones found so far, in the order the recipes use.
function drawParts() {
  const { parts } = getSave();
  const order = [...new Set(BALANCE.crafting.recipes.flatMap((recipe) => Object.keys(recipe.parts)))];
  let x = GAME_WIDTH - 6;
  for (const part of order.reverse()) {
    if (parts[part] === undefined) continue;
    const count = String(parts[part]);
    text(count, x, 2, C.light, "topright");
    x -= count.length * 8 + 8;
    drawCrafted(part, vec2(x, 6));
    x -= 12;
  }
}

// ---- The forge -------------------------------------------------------------------

const ROW = 30;          // px from one recipe to the next
const LIST = { x: 8, y: 20 }; // the first recipe's frame
const ANVIL = { x: 204, y: 30 };
const FORGE_PANEL = GAME_HEIGHT - 38;

export function openForge(onClose) {
  const recipes = BALANCE.crafting.recipes;
  const save = getSave();
  let message = null; // { text, color, until }: a moment's note in the panel

  const page = {
    picked: 0,
    pick: (point) => {
      const i = Math.floor((point.y - LIST.y + 3) / ROW);
      return point.x >= LIST.x - 2 && point.x < 190 && i >= 0 && i < recipes.length ? i : null;
    },
    step: (dir) => (dir.y ? Math.max(0, Math.min(recipes.length - 1, page.picked + dir.y)) : null),
    use: (i) => {
      const recipe = recipes[i];
      if (!canCraft(recipe)) {
        message = { text: forgeFull() ? "THE FORGE IS FULL" : "NOT ENOUGH PARTS", color: C.red, until: time() + 1 };
        playSound("letter");
        return;
      }
      startCraft(recipe);
      message = { text: save.forge.length > 1 ? "IN THE QUEUE" : "ON THE ANVIL", color: C.gold, until: time() + 1 };
      playSound("forge");
    },
    draw: (hover) => {
      drawParts();
      recipes.forEach((recipe, i) => drawRecipe(recipe, LIST.y + i * ROW));
      drawCursor(LIST.x, LIST.y + page.picked * ROW, 24);
      drawWork();
      drawPanel(recipes[hover ?? page.picked]);
    },
  };

  function drawRecipe(recipe, y) {
    const short = partsShort(recipe);
    drawFrame(LIST.x, y, 24, canCraft(recipe) ? C.green : C.stoneLight);
    drawCrafted(recipe.id, vec2(LIST.x + 12, y + 13));
    text(recipe.name.toUpperCase(), LIST.x + 32, y + 1, C.gold);
    text(timeText(recipe.time), 186, y + 1, C.muted, "topright");
    // What it takes: each part's picture and how many, red if you're short.
    let x = LIST.x + 37;
    for (const [part, count] of Object.entries(recipe.parts)) {
      drawCrafted(part, vec2(x, y + 17));
      text(String(count), x + 7, y + 13, short[part] ? C.red : C.light);
      x += 14 + String(count).length * 8;
    }
  }

  // The right side: the piece on the anvil, how far along it is, and the
  // ones waiting their turn.
  function drawWork() {
    text("ANVIL", ANVIL.x, 18, C.muted);
    const [first, ...waiting] = save.forge;
    drawFrame(ANVIL.x, ANVIL.y, 24, first ? C.gold : C.stoneLight);
    if (first) {
      const recipe = recipeOf(first.recipe);
      const bob = Math.round(Math.sin(time() * 6));
      drawCrafted(recipe.id, vec2(ANVIL.x + 12, ANVIL.y + 13 + bob));
      text(timeText(first.left), ANVIL.x + 30, ANVIL.y + 8, C.light);
      const done = 1 - first.left / recipe.time;
      drawRect({ pos: vec2(ANVIL.x, ANVIL.y + 28), width: 110, height: 4, color: C.dark });
      drawRect({ pos: vec2(ANVIL.x, ANVIL.y + 28), width: Math.round(110 * done), height: 4, color: C.gold });
      text(recipe.name.toUpperCase(), ANVIL.x, ANVIL.y + 35, C.muted);
    } else text("IDLE", ANVIL.x + 30, ANVIL.y + 8, C.muted);
    text("NEXT", ANVIL.x, ANVIL.y + 50, C.muted);
    for (let i = 0; i < BALANCE.crafting.queue; i++) {
      const x = ANVIL.x + i * 26, y = ANVIL.y + 62;
      drawFrame(x, y, 20, C.stoneLight, waiting[i] ? 1 : 0.5);
      if (waiting[i]) drawCrafted(waiting[i].recipe, vec2(x + 10, y + 11));
    }
  }

  function drawPanel(recipe) {
    drawRect({ pos: vec2(0, FORGE_PANEL), width: GAME_WIDTH, height: GAME_HEIGHT - FORGE_PANEL, color: C.ink });
    drawRect({ pos: vec2(0, FORGE_PANEL), width: GAME_WIDTH, height: 1, color: C.stoneLight });
    drawCrafted(recipe.id, vec2(15, FORGE_PANEL + 19));
    text(recipe.name.toUpperCase(), 30, FORGE_PANEL + 4, C.gold);
    text(recipe.slot.toUpperCase(), GAME_WIDTH - 6, FORGE_PANEL + 4, C.muted, "topright");
    const [fewest, most] = recipe.bonuses;
    const count = fewest === most ? `${fewest}` : `${fewest}-${most}`;
    const [small, big] = recipe.size.map((size) => Math.round(size * 100));
    text(`${count} BONUS${most > 1 ? "ES" : ""} AT RANDOM, +${small}% TO +${big}%`, 30, FORGE_PANEL + 15);
    const short = partsShort(recipe);
    let status;
    if (message && time() < message.until) status = [message.text, message.color];
    else if (Object.keys(short).length) status = [`NEEDS ${Object.entries(short).map(([part, n]) => `${n} ${part.toUpperCase()}`).join(", ")} MORE`, C.red];
    else if (forgeFull()) status = ["THE FORGE IS FULL: WAIT FOR ONE", C.red];
    else status = [recipe === recipes[page.picked] ? "MAKE IT: CLICK OR E" : "CLICK TO PICK", C.green];
    text(status[0], 30, FORGE_PANEL + 26, status[1]);
  }

  return openPage("FORGE", "Click twice or press E to make it. Esc closes.", page, onClose);
}

// ---- The gear chest -------------------------------------------------------------

const COLS = 13;
const CELL = 22;
const GRID = { x: (GAME_WIDTH - COLS * CELL) / 2, y: 18 };
const CHEST_PANEL = GAME_HEIGHT - 48;
const ROWS_SHOWN = Math.floor((CHEST_PANEL - GRID.y) / CELL);

export function openGearChest(onClose) {
  const save = getSave();
  // The pieces: the worn ones first, then the newest first. The ones made
  // since it was last opened get a mark.
  const isWorn = (piece) => Object.values(save.worn).includes(piece.id);
  const pieces = [...save.gear.filter(isWorn), ...save.gear.filter((piece) => !isWorn(piece)).reverse()];
  const fresh = new Set(save.gear.slice(save.gear.length - save.newGear).map((piece) => piece.id));
  seeGear();
  let top = 0; // the first row on show

  const page = {
    picked: 0,
    pick: (point) => {
      const col = Math.floor((point.x - GRID.x) / CELL), row = Math.floor((point.y - GRID.y) / CELL);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS_SHOWN) return null;
      const i = (top + row) * COLS + col;
      return i < pieces.length ? i : null;
    },
    step: (dir) => {
      const next = page.picked + dir.x + dir.y * COLS;
      if (next < 0 || next >= pieces.length || (dir.x && Math.floor(next / COLS) !== Math.floor(page.picked / COLS))) return null;
      // Scroll so the picked one stays on show.
      const row = Math.floor(next / COLS);
      top = Math.max(Math.min(top, row), row - ROWS_SHOWN + 1);
      return next;
    },
    scroll: (dir) => (top = Math.max(0, Math.min(Math.ceil(pieces.length / COLS) - ROWS_SHOWN, top + dir))),
    use: (i) => {
      const piece = pieces[i];
      if (!piece || isWorn(piece)) return;
      wearPiece(piece.id, recipeOf(piece.recipe).slot);
      playSound("wear");
    },
    draw: (hover) => {
      text(`${pieces.length} PIECE${pieces.length === 1 ? "" : "S"}`, GAME_WIDTH - 6, 2, C.muted, "topright");
      if (!pieces.length) {
        text("NOTHING YET.", GAME_WIDTH / 2, 70, C.muted, "top");
        text("MAKE SOMETHING AT THE FORGE.", GAME_WIDTH / 2, 82, C.muted, "top");
        drawPanel(null);
        return;
      }
      for (let i = top * COLS; i < Math.min(pieces.length, (top + ROWS_SHOWN) * COLS); i++) drawPiece(pieces[i], i);
      const picked = cellOf(page.picked);
      if (picked) drawCursor(picked.x, picked.y, CELL - 2);
      drawPanel(pieces[hover ?? page.picked]);
    },
  };

  // Where a piece's frame is on the page (null when it's scrolled out of view).
  function cellOf(i) {
    const row = Math.floor(i / COLS) - top;
    if (row < 0 || row >= ROWS_SHOWN) return null;
    return vec2(GRID.x + (i % COLS) * CELL + 1, GRID.y + row * CELL + 1);
  }

  function drawPiece(piece, i) {
    const at = cellOf(i);
    if (!at) return;
    drawFrame(at.x, at.y, CELL - 2, isWorn(piece) ? C.gold : C.stoneLight);
    drawCrafted(piece.recipe, at.add(10, 11));
    if (fresh.has(piece.id)) drawRect({ pos: at.add(CELL - 6, 2), width: 2, height: 2, color: C.green }); // new
  }

  function drawPanel(piece) {
    drawRect({ pos: vec2(0, CHEST_PANEL), width: GAME_WIDTH, height: GAME_HEIGHT - CHEST_PANEL, color: C.ink });
    drawRect({ pos: vec2(0, CHEST_PANEL), width: GAME_WIDTH, height: 1, color: C.stoneLight });
    if (!piece) return;
    const recipe = recipeOf(piece.recipe);
    drawCrafted(piece.recipe, vec2(15, CHEST_PANEL + 22));
    text(recipe.name.toUpperCase(), 30, CHEST_PANEL + 4, C.gold);
    text(recipe.slot.toUpperCase(), GAME_WIDTH - 6, CHEST_PANEL + 4, C.muted, "topright");
    // Its bonuses, two to a line.
    const bonuses = Object.entries(piece.bonuses).map(([kind, size]) => bonusText(kind, size));
    text(bonuses.slice(0, 2).join("  "), 30, CHEST_PANEL + 14);
    if (bonuses.length > 2) text(bonuses.slice(2).join("  "), 30, CHEST_PANEL + 24);
    const status = isWorn(piece) ? ["YOU'RE WEARING IT", C.gold]
      : [piece === pieces[page.picked] ? "WEAR IT: CLICK OR E" : "CLICK TO PICK", C.green];
    text(status[0], 30, CHEST_PANEL + 35, status[1]);
  }

  return openPage("GEAR CHEST", "Click twice or press E to wear it. Esc closes.", page, onClose);
}
