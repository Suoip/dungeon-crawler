import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BALANCE } from "./balance.js";
import { getSave, startCraft, wearPiece, seeGear, buyWorkshop } from "./save.js";
import { recipeOf, recipesFor, slotOpen, partsShort, forgeFull, canCraft, knowsRecipe, workshop, takes, upgradeLevel, upgradeCost, bonusText, enchanted, levelOf, drawCrafted } from "./crafting.js";
import { playSound } from "./sound.js";
import { getGamePixel } from "./display.js";
import { setPrompt } from "./panel.js";
import { shortGold } from "./hud.js";

// The forge's two pages (DESIGN.md section 6), drawn in the game over the
// dimmed underworld like the skill tree:
//   - the forge: a tab for each gear slot that's open (one per depth reached),
//     the tab's recipes on the left, what it's making on the right (the
//     pieces on the anvils and the ones waiting), the tab's parts and your
//     gold along the title bar, and the forge's upgrades in a row under it.
//     Pick a recipe and make it (or learn it), or an upgrade and buy it.
//   - the gear chest: every piece it has made. Pick one and wear it.
// Mouse: click a recipe, piece or upgrade to pick it, click it again to
// make, wear or buy it. Keyboard: the arrows or WASD pick, E does it, Esc
// closes.

const PALETTE = {
  ink: [24, 20, 37], stone: [58, 47, 74], stoneLight: [90, 77, 110],
  light: [240, 230, 210], muted: [169, 155, 185], dark: [44, 36, 56],
  gold: [255, 205, 70], green: [99, 199, 77], red: [230, 72, 46],
};
export let C = null; // the colors, made when the first page opens
const TOP_BAR = 12;
export const text = (content, x, y, color = C.light, anchorName = "topleft", opacity = 1) =>
  drawText({ text: content, pos: vec2(x, y), size: 8, font: "pixel", color, anchor: anchorName, opacity });

// "30S", "1:00", "2:30".
export const timeText = (seconds) => {
  const whole = Math.ceil(seconds);
  return whole < 60 ? `${whole}S` : `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

// A square frame for a recipe or a piece, its rim saying where it stands.
export function drawFrame(x, y, size, rim, opacity = 1) {
  drawRect({ pos: vec2(x - 1, y - 1), width: size + 2, height: size + 2, color: C.ink, opacity });
  drawRect({ pos: vec2(x, y), width: size, height: size, color: rim, opacity });
  drawRect({ pos: vec2(x + 1, y + 1), width: size - 2, height: size - 2, color: C.stone, opacity });
}
// Four breathing corner brackets round the picked one, like the tree's.
export function drawCursor(x, y, size) {
  const out = 2 + Math.round(Math.sin(time() * 5));
  const [left, top, right, bottom] = [x - out, y - out, x + size + out, y + size + out];
  for (const [cx, cy, sx, sy] of [[left, top, 1, 1], [right, top, -1, 1], [left, bottom, 1, -1], [right, bottom, -1, -1]]) {
    const across = [sx > 0 ? cx : cx - 3, sy > 0 ? cy : cy - 1, 3, 1];
    const down = [sx > 0 ? cx : cx - 1, sy > 0 ? cy : cy - 3, 1, 3];
    for (const [rx, ry, w, h] of [across, down]) drawRect({ pos: vec2(rx - 1, ry - 1), width: w + 2, height: h + 2, color: C.ink });
    for (const [rx, ry, w, h] of [across, down]) drawRect({ pos: vec2(rx, ry), width: w, height: h, color: C.light });
  }
}

// What the pages share (the merchant's too): the dimmed room behind, the title bar, the
// panel at the bottom, and the mouse and keys. `page` gives:
//   pick(point)  what's under the mouse (an index, or null)
//   step(dir)    the picked one after an arrow key (or null to stay)
//   use(index)   make it, wear it, sell it...
//   draw(hover)  the page itself (hover: the one the mouse is on, or null)
//   scroll(dir)  the wheel, up -1 or down 1 (optional)
export function openPage(title, hint, page, onClose) {
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

// The parts you have for a slot's recipes, along the right of the title
// bar: each one's picture and how many. Only the ones found so far.
function drawParts(slot) {
  const { parts } = getSave();
  const order = [...new Set(recipesFor(slot).flatMap((recipe) => Object.keys(recipe.parts)))];
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

// ---- The upgrades row -------------------------------------------------------------
// The forge's, the merchant's or the rune table's upgrades (balance.js crafting.upgrades), in
// a row under the title bar, like the altar's specials over the skill tree:
// each one's icon in a round frame (gold once it's maxed, green when you can
// afford the next level), its levels as pips, and the next level's price.
// On a page they're picked as "up:0", "up:1"...

export const UP_ROW = 24; // the row's height
const UP_GAP = 62;        // px from one upgrade to the next
const upSpot = (k) => vec2(17 + k * UP_GAP, TOP_BAR + UP_ROW / 2);
export const isUp = (id) => typeof id === "string" && id.startsWith("up:");
const upIndex = (id) => Number(id.slice(3));

// What an upgrade does at a level, as the panel says it.
function upgradeText(upgrade, level) {
  const [[kind, by]] = Object.entries(upgrade.effect);
  if (kind === "recipe") return `LEARNS TO MAKE THE ${recipeOf(by).name.toUpperCase()}`;
  if (kind === "autoSell") return "SELLS NEW PIECES WORSE THAN YOURS";
  const [label, show] = {
    forgeTime: ["FORGING TIME", (l) => `-${Math.round((1 - by ** l) * 100)}%`],
    sellTime: ["SELLING TIME", (l) => `-${Math.round((1 - by ** l) * 100)}%`],
    anvils: ["ANVILS", (l) => `${1 + by * l}`],
    rolls: ["ROLLS", (l) => `BEST OF ${1 + by * l}`],
    counter: ["COUNTER", (l) => `${BALANCE.crafting.counter + by * l}`],
    haggle: ["PRICES", (l) => `+${Math.round(by * l * 100)}%`],
    luck: ["ENCHANTS WORK", (l) => `+${Math.round(by * l * 100)}%`],
    runeChance: ["RUNES DROP", (l) => `+${Math.round(by * l * 100)}%`],
  }[kind];
  return level >= upgrade.costs.length ? `${label} ${show(level)}` : `${label} ${show(level)} > ${show(level + 1)}`;
}

export function upgradeRow(list) {
  const affordable = (upgrade) => upgradeCost(upgrade) !== null && getSave().gold >= upgradeCost(upgrade);
  let message = null; // { k, text, color, until }

  return {
    pick: (point) => {
      if (point.y < TOP_BAR || point.y >= TOP_BAR + UP_ROW) return null;
      const k = Math.floor((point.x - 4) / UP_GAP);
      return k >= 0 && k < list.length ? `up:${k}` : null;
    },
    step: (id, dir) => {
      const k = upIndex(id) + dir.x;
      return dir.x && k >= 0 && k < list.length ? `up:${k}` : null;
    },
    draw: (picked) => {
      drawRect({ pos: vec2(0, TOP_BAR), width: GAME_WIDTH, height: UP_ROW, color: C.ink });
      drawRect({ pos: vec2(0, TOP_BAR + UP_ROW - 1), width: GAME_WIDTH, height: 1, color: C.stoneLight });
      list.forEach((upgrade, k) => {
        const spot = upSpot(k);
        const cost = upgradeCost(upgrade);
        const rim = cost === null ? C.gold : affordable(upgrade) ? C.green : C.stoneLight;
        drawCircle({ pos: spot, radius: 11, color: C.ink });
        drawCircle({ pos: spot, radius: 10, color: rim });
        drawCircle({ pos: spot, radius: 8, color: C.stone });
        drawCrafted(upgrade.icon, spot);
        for (let i = 0; i < upgrade.costs.length; i++) {
          drawRect({ pos: spot.add(14 + i * 5, -8), width: 3, height: 3, color: i < upgradeLevel(upgrade) ? C.gold : C.stoneLight });
        }
        text(cost === null ? "MAX" : shortGold(cost), spot.x + 14, spot.y - 1, cost === null ? C.gold : affordable(upgrade) ? C.light : C.muted);
      });
      if (isUp(picked)) {
        const spot = upSpot(upIndex(picked));
        drawCursor(spot.x - 11, spot.y - 11, 22);
      }
    },
    // The panel's text for one, at `y`, its status line `statusY` below that
    // (`chosen`: it's the picked one, a click or E from bought).
    panel: (id, y, statusY, chosen) => {
      const k = upIndex(id), upgrade = list[k];
      const level = upgradeLevel(upgrade), cost = upgradeCost(upgrade);
      drawCrafted(upgrade.icon, vec2(15, y + 19));
      text(upgrade.name.toUpperCase(), 30, y + 4, C.gold);
      text(`${level}/${upgrade.costs.length}`, GAME_WIDTH - 6, y + 4, C.muted, "topright");
      text(upgradeText(upgrade, level), 30, y + 15);
      let status;
      if (message?.k === k && time() < message.until) status = [message.text, message.color];
      else if (cost === null) status = [upgrade.effect.recipe ? "KNOWN" : "MAXED", C.gold];
      else if (getSave().gold < cost) status = [`COSTS ${shortGold(cost)} GOLD`, C.red];
      else status = [chosen ? `BUY ${shortGold(cost)} GOLD: CLICK OR E` : `${shortGold(cost)} GOLD: CLICK TO PICK`, C.green];
      text(status[0], 30, y + statusY, status[1]);
    },
    buy: (id) => {
      const k = upIndex(id), upgrade = list[k];
      const cost = upgradeCost(upgrade);
      if (cost === null) return;
      if (getSave().gold < cost) {
        message = { k, text: "NOT ENOUGH GOLD", color: C.red, until: time() + 1 };
        playSound("letter");
        return;
      }
      buyWorkshop(upgrade.id, cost);
      message = { k, text: "BOUGHT", color: C.gold, until: time() + 1 };
      playSound("unlock");
    },
  };
}

// The banked gold, as the tree shows it: a coin and the amount, its right
// end at `right` (or its left end at `left`).
export function drawGold({ right, left }) {
  const gold = shortGold(getSave().gold);
  const start = left ?? right - 11 - gold.length * 8;
  drawSprite({ sprite: "coin", frame: 0, pos: vec2(start, 2) });
  text(gold, start + 11, 2, C.gold);
}

// ---- The forge -------------------------------------------------------------------

const TABS_Y = TOP_BAR + UP_ROW + 3;       // the tabs' tops
const TAB_GAP = 14;                         // px between two tabs
const ROW = 30;                             // px from one recipe to the next
const LIST = { x: 8, y: TABS_Y + 16 };      // the first recipe's frame
const ANVIL = { x: 204, y: TABS_Y + 16 };   // the first anvil's
const ANVIL_GAP = 36;                       // px from one anvil to the next
const FORGE_PANEL = GAME_HEIGHT - 38;
let lastTab = "head"; // the tab the forge's page opens on: the one it was left on

export function openForge(onClose) {
  const save = getSave();
  const row = upgradeRow(BALANCE.crafting.upgrades.forge);
  const tabs = BALANCE.crafting.slots.filter(slotOpen);
  let slot = tabs.includes(lastTab) ? lastTab : tabs[0];
  let recipes = recipesFor(slot);
  let message = null; // { text, color, until }: a moment's note in the panel
  // The tabs: each slot's name, left to right.
  const tabX = (k) => LIST.x + tabs.slice(0, k).reduce((x, name) => x + name.length * 8 + TAB_GAP, 0);
  const switchTab = (k) => {
    if (k < 0 || k >= tabs.length || tabs[k] === slot) return;
    slot = lastTab = tabs[k];
    recipes = recipesFor(slot);
    page.picked = 0;
    playSound("letter");
  };

  const page = {
    picked: 0,
    pick: (point) => {
      const up = row.pick(point);
      if (up) return up;
      if (point.y >= TABS_Y - 2 && point.y < TABS_Y + 10) {
        const k = tabs.findIndex((name, i) => point.x >= tabX(i) - 4 && point.x < tabX(i) + name.length * 8 + 4);
        return k >= 0 ? `tab:${k}` : null;
      }
      const i = Math.floor((point.y - LIST.y + 3) / ROW);
      return point.x >= LIST.x - 2 && point.x < 190 && i >= 0 && i < recipes.length ? i : null;
    },
    step: (dir) => {
      if (isUp(page.picked)) return dir.y > 0 ? 0 : row.step(page.picked, dir);
      if (dir.y < 0 && page.picked === 0) return "up:0";
      // Left and right go through the tabs.
      if (dir.x) return switchTab(tabs.indexOf(slot) + dir.x), null;
      return dir.y ? Math.max(0, Math.min(recipes.length - 1, page.picked + dir.y)) : null;
    },
    use: (id) => {
      if (isUp(id)) return row.buy(id);
      const recipe = recipes[id];
      if (!knowsRecipe(recipe)) return learn(recipe);
      if (!canCraft(recipe)) {
        message = { text: forgeFull() ? "THE FORGE IS FULL" : "NOT ENOUGH PARTS", color: C.red, until: time() + 1 };
        playSound("letter");
        return;
      }
      startCraft(recipe);
      message = { text: save.forge.length > workshop().anvils ? "IN THE QUEUE" : "ON THE ANVIL", color: C.gold, until: time() + 1 };
      playSound("forge");
    },
    draw: (hover) => {
      // A click on a tab switches to it.
      if (typeof page.picked === "string" && page.picked.startsWith("tab:")) {
        switchTab(Number(page.picked.slice(4)));
        page.picked = 0;
      }
      drawGold({ left: 54 });
      drawParts(slot);
      drawTabs();
      recipes.forEach((recipe, i) => drawRecipe(recipe, LIST.y + i * ROW));
      if (!isUp(page.picked)) drawCursor(LIST.x, LIST.y + page.picked * ROW, 24);
      drawWork();
      row.draw(page.picked);
      const shown = typeof hover === "string" && hover.startsWith("tab:") ? page.picked : hover ?? page.picked;
      drawPanel(shown);
    },
  };

  // Learns a recipe, for its `learn` gold.
  function learn(recipe) {
    if (save.gold < recipe.learn) {
      message = { text: "NOT ENOUGH GOLD", color: C.red, until: time() + 1 };
      playSound("letter");
      return;
    }
    buyWorkshop(`recipe:${recipe.id}`, recipe.learn);
    message = { text: "LEARNED", color: C.gold, until: time() + 1 };
    playSound("unlock");
  }

  // The tabs: the open slots' names, the one on show in gold and underlined.
  function drawTabs() {
    tabs.forEach((name, k) => {
      const x = tabX(k), on = name === slot;
      text(name.toUpperCase(), x, TABS_Y, on ? C.gold : C.muted);
      if (on) drawRect({ pos: vec2(x, TABS_Y + 9), width: name.length * 8 - 1, height: 1, color: C.gold });
    });
  }

  // A recipe: its piece, name and time, and the parts it takes (red where
  // you're short). One not known yet is dim, with a lock, and says what it
  // costs to learn instead of its time.
  function drawRecipe(recipe, y) {
    const known = knowsRecipe(recipe);
    const short = partsShort(recipe);
    const dim = known ? 1 : 0.4;
    const canLearn = !known && save.gold >= recipe.learn;
    drawFrame(LIST.x, y, 24, canCraft(recipe) || canLearn ? C.green : C.stoneLight);
    drawCrafted(recipe.id, vec2(LIST.x + 12, y + 13), 1, dim);
    if (!known) drawLock(LIST.x + 18, y + 16);
    text(recipe.name.toUpperCase(), LIST.x + 32, y + 1, known ? C.gold : C.muted);
    if (known) text(timeText(takes(recipe.time, "forgeTime")), 186, y + 1, C.muted, "topright");
    else text(shortGold(recipe.learn), 186, y + 13, canLearn ? C.gold : C.muted, "topright");
    let x = LIST.x + 37;
    for (const [part, count] of Object.entries(recipe.parts)) {
      drawCrafted(part, vec2(x, y + 17), 1, dim);
      text(String(count), x + 7, y + 13, short[part] ? C.red : C.light, "topleft", dim);
      x += 14 + String(count).length * 8;
    }
  }
  // A little padlock.
  function drawLock(x, y) {
    drawRect({ pos: vec2(x - 1, y - 4), width: 8, height: 10, color: C.ink });
    drawRect({ pos: vec2(x + 1, y - 3), width: 4, height: 3, color: C.muted });
    drawRect({ pos: vec2(x + 2, y - 2), width: 2, height: 2, color: C.ink });
    drawRect({ pos: vec2(x, y), width: 6, height: 5, color: C.gold });
  }

  // The right side: the pieces on the anvils (two with the Second anvil),
  // how far along each is, and the ones waiting their turn.
  function drawWork() {
    const { anvils } = workshop();
    for (let k = 0; k < anvils; k++) {
      const job = save.forge[k];
      const y = ANVIL.y + k * ANVIL_GAP;
      drawFrame(ANVIL.x, y, 24, job ? C.gold : C.stoneLight);
      if (!job) {
        text("IDLE", ANVIL.x + 30, y + 8, C.muted);
        continue;
      }
      const recipe = recipeOf(job.recipe);
      const bob = Math.round(Math.sin(time() * 6 + k));
      drawCrafted(recipe.id, vec2(ANVIL.x + 12, y + 13 + bob));
      text(timeText(takes(job.left, "forgeTime")), ANVIL.x + 30, y + 8, C.light);
      drawRect({ pos: vec2(ANVIL.x, y + 27), width: 110, height: 3, color: C.dark });
      drawRect({ pos: vec2(ANVIL.x, y + 27), width: Math.round(110 * (1 - job.left / recipe.time)), height: 3, color: C.gold });
    }
    const waiting = save.forge.slice(anvils);
    const y = ANVIL.y + anvils * ANVIL_GAP;
    text("NEXT", ANVIL.x, y, C.muted);
    for (let i = 0; i < BALANCE.crafting.queue; i++) {
      const x = ANVIL.x + i * 26;
      drawFrame(x, y + 11, 20, C.stoneLight, waiting[i] ? 1 : 0.5);
      if (waiting[i]) drawCrafted(waiting[i].recipe, vec2(x + 10, y + 22));
    }
  }

  function drawPanel(id) {
    drawRect({ pos: vec2(0, FORGE_PANEL), width: GAME_WIDTH, height: GAME_HEIGHT - FORGE_PANEL, color: C.ink });
    drawRect({ pos: vec2(0, FORGE_PANEL), width: GAME_WIDTH, height: 1, color: C.stoneLight });
    if (isUp(id)) return row.panel(id, FORGE_PANEL, 26, id === page.picked);
    const recipe = recipes[id];
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
    else if (!knowsRecipe(recipe)) {
      status = save.gold < recipe.learn ? [`LEARNING IT COSTS ${shortGold(recipe.learn)} GOLD`, C.red]
        : [id === page.picked ? `LEARN IT: ${shortGold(recipe.learn)} GOLD, CLICK OR E` : `LEARN IT: ${shortGold(recipe.learn)} GOLD`, C.green];
    }
    else if (Object.keys(short).length) status = [`NEEDS ${Object.entries(short).map(([part, n]) => `${n} ${part.toUpperCase()}`).join(", ")} MORE`, C.red];
    else if (forgeFull()) status = ["THE FORGE IS FULL: WAIT FOR ONE", C.red];
    else status = [id === page.picked ? "MAKE IT: CLICK OR E" : "CLICK TO PICK", C.green];
    text(status[0], 30, FORGE_PANEL + 26, status[1]);
  }

  return openPage("FORGE", "Click twice or press E to make, learn or buy it. Esc closes.", page, onClose);
}

// ---- The gear chest -------------------------------------------------------------

// A piece's name, with its enchanting: "ZOMBIE CROWN +2".
export const nameOf = (piece) => `${recipeOf(piece.recipe).name.toUpperCase()}${levelOf(piece) ? ` +${levelOf(piece)}` : ""}`;
// Its enchanting as purple pips along the bottom right of its frame (at
// `at`, `size` across), one a level.
export function drawLevel(piece, at, size) {
  for (let k = 0; k < levelOf(piece); k++) drawRect({ pos: at.add(size - 6 - k * 3, size - 6), width: 2, height: 2, color: rgb(190, 140, 255) });
}

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
    drawLevel(piece, at, CELL - 2);
  }

  function drawPanel(piece) {
    drawRect({ pos: vec2(0, CHEST_PANEL), width: GAME_WIDTH, height: GAME_HEIGHT - CHEST_PANEL, color: C.ink });
    drawRect({ pos: vec2(0, CHEST_PANEL), width: GAME_WIDTH, height: 1, color: C.stoneLight });
    if (!piece) return;
    const recipe = recipeOf(piece.recipe);
    drawCrafted(piece.recipe, vec2(15, CHEST_PANEL + 22));
    text(nameOf(piece), 30, CHEST_PANEL + 4, C.gold);
    text(recipe.slot.toUpperCase(), GAME_WIDTH - 6, CHEST_PANEL + 4, C.muted, "topright");
    // Its bonuses, enchanting and all, two to a line.
    const bonuses = Object.entries(enchanted(piece)).map(([kind, size]) => bonusText(kind, size));
    text(bonuses.slice(0, 2).join("  "), 30, CHEST_PANEL + 14);
    if (bonuses.length > 2) text(bonuses.slice(2).join("  "), 30, CHEST_PANEL + 24);
    const status = isWorn(piece) ? ["YOU'RE WEARING IT", C.gold]
      : [piece === pieces[page.picked] ? "WEAR IT: CLICK OR E" : "CLICK TO PICK", C.green];
    text(status[0], 30, CHEST_PANEL + 35, status[1]);
  }

  return openPage("GEAR CHEST", "Click twice or press E to wear it. Esc closes.", page, onClose);
}
