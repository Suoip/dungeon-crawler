import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BALANCE } from "./balance.js";
import { getSave, putOnCounter, takeBack } from "./save.js";
import { recipeOf, priceOf, spareGear, counterFull, haggled, takes, workshop, bonusText, drawCrafted } from "./crafting.js";
import { C, text, timeText, drawFrame, drawCursor, openPage, upgradeRow, isUp, UP_ROW, drawGold } from "./forge.js";
import { playSound } from "./sound.js";

// The merchant's page (DESIGN.md section 6), opened at his stall in the
// underworld: your spare gear on the left (what's in the gear chest and not
// worn), his counter on the right. A piece put on the counter sells on its
// own after a while (its recipe's `sells`), each one at the same time, and
// its gold is banked; the forge's clock does the selling (crafting.js), so
// it goes on in a run too. A piece on the counter can be taken back until
// it's sold. His upgrades (selling faster, a bigger counter, Haggling,
// Auto-sell) are in a row under the title bar. Mouse: click a piece or an
// upgrade to pick it, click it again to put it on the counter (or take it
// back), or buy it. Keyboard: the arrows or WASD pick (right, past the end
// of a row, goes to the counter; up from the top, to the upgrades), E does
// it, Esc closes.

const COLS = 9;
const CELL = 22;
const GRID = { x: 8, y: 12 + UP_ROW + 6 };
const COUNTER = { x: 214, y: GRID.y + 12 }; // the first counter space's frame
const SPACE = 17;                           // px from one counter space to the next
const PANEL = GAME_HEIGHT - 48;
const ROWS_SHOWN = Math.floor((PANEL - GRID.y) / CELL);

// Pieces are picked by number: 0 and up are spares, in the grid's order;
// -1, -2... are the counter's first, second... space. Upgrades are "up:0"...
const onCounter = (i) => !isUp(i) && i < 0;
const spaceOf = (i) => -1 - i;

export function openStall(onClose) {
  const save = getSave();
  const row = upgradeRow(BALANCE.crafting.upgrades.merchant);
  let message = null; // { text, color, until }: a moment's note in the panel
  let top = 0;        // the grid's first row on show
  let spares = spareGear();

  // The picked one, still there after something's sold or moved.
  const keepPicked = () => {
    spares = spareGear();
    if (isUp(page.picked)) return;
    if (onCounter(page.picked) && spaceOf(page.picked) >= save.counter.length) page.picked = save.counter.length ? -save.counter.length : 0;
    if (!onCounter(page.picked) && page.picked >= spares.length) page.picked = save.counter.length && !spares.length ? -1 : Math.max(0, spares.length - 1);
  };
  const say = (words, color) => (message = { text: words, color, until: time() + 1.2 });

  const page = {
    picked: 0,
    pick: (point) => {
      const up = row.pick(point);
      if (up) return up;
      if (point.x >= COUNTER.x - 2 && point.x < GAME_WIDTH) {
        const k = Math.floor((point.y - COUNTER.y + 1) / SPACE);
        return k >= 0 && k < save.counter.length ? -1 - k : null;
      }
      const col = Math.floor((point.x - GRID.x) / CELL), row = Math.floor((point.y - GRID.y) / CELL);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS_SHOWN) return null;
      const i = (top + row) * COLS + col;
      return i < spares.length ? i : null;
    },
    step: (dir) => {
      const i = page.picked;
      if (isUp(i)) {
        if (dir.y > 0) return spares.length ? 0 : save.counter.length ? -1 : null;
        return row.step(i, dir);
      }
      if (dir.y < 0 && (onCounter(i) ? spaceOf(i) === 0 : i < COLS && top === 0)) return "up:0";
      if (onCounter(i)) {
        const k = spaceOf(i);
        if (dir.y) return k + dir.y >= 0 && k + dir.y < save.counter.length ? -1 - (k + dir.y) : null;
        if (dir.x < 0 && spares.length) return Math.min(spares.length - 1, (top + k) * COLS + COLS - 1);
        return null;
      }
      const lastInRow = i % COLS === COLS - 1 || i === spares.length - 1;
      if (dir.x > 0 && lastInRow) {
        return save.counter.length ? -1 - Math.min(save.counter.length - 1, Math.floor(i / COLS) - top) : null;
      }
      const next = i + dir.x + dir.y * COLS;
      if (next < 0 || next >= spares.length || (dir.x && Math.floor(next / COLS) !== Math.floor(i / COLS))) return null;
      const line = Math.floor(next / COLS);
      top = Math.max(Math.min(top, line), line - ROWS_SHOWN + 1);
      return next;
    },
    scroll: (dir) => (top = Math.max(0, Math.min(Math.ceil(spares.length / COLS) - ROWS_SHOWN, top + dir))),
    use: (i) => {
      if (isUp(i)) return row.buy(i);
      if (onCounter(i)) {
        if (!save.counter[spaceOf(i)]) return;
        takeBack(spaceOf(i));
        say("BACK IN THE CHEST", C.muted);
        playSound("letter");
      } else {
        const piece = spares[i];
        if (!piece) return;
        if (counterFull()) {
          say("THE COUNTER IS FULL", C.red);
          playSound("letter");
          return;
        }
        putOnCounter(piece, priceOf(piece), recipeOf(piece.recipe).sells);
        say("ON THE COUNTER", C.gold);
        playSound("coin");
      }
      keepPicked();
    },
    draw: (hover) => {
      keepPicked(); // something may have sold
      drawGold({ right: GAME_WIDTH - 6 });
      if (spares.length) {
        for (let i = top * COLS; i < Math.min(spares.length, (top + ROWS_SHOWN) * COLS); i++) {
          const at = cellOf(i);
          if (!at) continue;
          drawFrame(at.x, at.y, CELL - 2, C.stoneLight);
          drawCrafted(spares[i].recipe, at.add(10, 11));
        }
      } else {
        text("NO SPARE GEAR.", GRID.x + COLS * CELL / 2, 70, C.muted, "top");
        text("MAKE SOME AT", GRID.x + COLS * CELL / 2, 86, C.muted, "top");
        text("THE FORGE.", GRID.x + COLS * CELL / 2, 96, C.muted, "top");
      }
      drawCounter();
      row.draw(page.picked);
      const picked = isUp(page.picked) ? null : onCounter(page.picked) ? vec2(COUNTER.x, COUNTER.y + spaceOf(page.picked) * SPACE) : cellOf(page.picked);
      if (picked && (onCounter(page.picked) ? save.counter.length : spares.length)) drawCursor(picked.x, picked.y, onCounter(page.picked) ? 16 : CELL - 2);
      drawPanel(hover ?? page.picked);
    },
  };

  function cellOf(i) {
    const row = Math.floor(i / COLS) - top;
    if (row < 0 || row >= ROWS_SHOWN) return null;
    return vec2(GRID.x + (i % COLS) * CELL + 1, GRID.y + row * CELL + 1);
  }

  // The counter (3 spaces, more with Bigger counter): each space's piece,
  // what it'll fetch, how long it has left, and a bar for how close it is.
  function drawCounter() {
    text("COUNTER", COUNTER.x, GRID.y, C.muted);
    const bar = GAME_WIDTH - 6 - (COUNTER.x + 20);
    for (let k = 0; k < workshop().counter; k++) {
      const x = COUNTER.x, y = COUNTER.y + k * SPACE;
      const sale = save.counter[k];
      drawFrame(x, y, 16, sale ? C.gold : C.stoneLight, sale ? 1 : 0.5);
      if (!sale) continue;
      drawCrafted(sale.piece.recipe, vec2(x + 8, y + 9));
      text(String(haggled(sale.price)), x + 20, y, C.gold);
      text(timeText(takes(sale.left, "sellTime")), GAME_WIDTH - 6, y, C.muted, "topright");
      const sells = recipeOf(sale.piece.recipe).sells;
      drawRect({ pos: vec2(x + 20, y + 10), width: bar, height: 3, color: C.dark });
      drawRect({ pos: vec2(x + 20, y + 10), width: Math.round(bar * (1 - sale.left / sells)), height: 3, color: C.gold });
    }
  }

  function drawPanel(i) {
    drawRect({ pos: vec2(0, PANEL), width: GAME_WIDTH, height: GAME_HEIGHT - PANEL, color: C.ink });
    drawRect({ pos: vec2(0, PANEL), width: GAME_WIDTH, height: 1, color: C.stoneLight });
    if (isUp(i)) return row.panel(i, PANEL, 35, i === page.picked);
    const sale = onCounter(i) ? save.counter[spaceOf(i)] : null;
    const piece = sale ? sale.piece : spares[i];
    if (!piece) {
      if (message && time() < message.until) text(message.text, 30, PANEL + 35, message.color);
      return;
    }
    const recipe = recipeOf(piece.recipe);
    drawCrafted(piece.recipe, vec2(15, PANEL + 22));
    text(recipe.name.toUpperCase(), 30, PANEL + 4, C.gold);
    text(`${haggled(sale ? sale.price : priceOf(piece))} GOLD`, GAME_WIDTH - 6, PANEL + 4, C.gold, "topright");
    const bonuses = Object.entries(piece.bonuses).map(([kind, size]) => bonusText(kind, size));
    text(bonuses.slice(0, 2).join("  "), 30, PANEL + 14);
    if (bonuses.length > 2) text(bonuses.slice(2).join("  "), 30, PANEL + 24);
    const picked = i === page.picked;
    let status;
    if (message && time() < message.until) status = [message.text, message.color];
    else if (sale) status = [picked ? `SELLS IN ${timeText(takes(sale.left, "sellTime"))}. TAKE IT BACK: E` : "CLICK TO PICK", C.muted];
    else if (counterFull()) status = ["THE COUNTER IS FULL", C.red];
    else status = [picked ? `SELL IT (${timeText(takes(recipe.sells, "sellTime"))}): CLICK OR E` : "CLICK TO PICK", C.green];
    text(status[0], 30, PANEL + 35, status[1]);
  }

  keepPicked();
  return openPage("MERCHANT", "Click twice or press E to sell or buy it. Esc closes.", page, onClose);
}
