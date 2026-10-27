import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BALANCE } from "./balance.js";
import { getSave, putOnCounter, takeBack } from "./save.js";
import { recipeOf, priceOf, spareGear, counterFull, bonusText, drawCrafted } from "./crafting.js";
import { C, text, timeText, drawFrame, drawCursor, openPage } from "./forge.js";
import { playSound } from "./sound.js";
import { shortGold } from "./hud.js";

// The merchant's page (DESIGN.md section 6), opened at his stall in the
// underworld: your spare gear on the left (what's in the gear chest and not
// worn), his counter on the right. A piece put on the counter sells on its
// own after a while (its recipe's `sells`), each one at the same time, and
// its gold is banked; the forge's clock does the selling (crafting.js), so
// it goes on in a run too. A piece on the counter can be taken back until
// it's sold. Mouse: click a piece to pick it, click it again to put it on
// the counter (or take it back). Keyboard: the arrows or WASD pick (right,
// past the end of a row, goes to the counter), E does it, Esc closes.

const COLS = 9;
const CELL = 22;
const GRID = { x: 8, y: 18 };
const COUNTER = { x: 214, y: 30 }; // the first counter space's frame
const SPACE = 40;                  // px from one counter space to the next
const PANEL = GAME_HEIGHT - 48;
const ROWS_SHOWN = Math.floor((PANEL - GRID.y) / CELL);

// Pieces are picked by number: 0 and up are spares, in the grid's order;
// -1, -2... are the counter's first, second... space.
const onCounter = (i) => i < 0;
const spaceOf = (i) => -1 - i;

export function openStall(onClose) {
  const save = getSave();
  let message = null; // { text, color, until }: a moment's note in the panel
  let top = 0;        // the grid's first row on show
  let spares = spareGear();

  // The picked one, still there after something's sold or moved.
  const keepPicked = () => {
    spares = spareGear();
    if (onCounter(page.picked) && spaceOf(page.picked) >= save.counter.length) page.picked = save.counter.length ? -save.counter.length : 0;
    if (!onCounter(page.picked) && page.picked >= spares.length) page.picked = save.counter.length && !spares.length ? -1 : Math.max(0, spares.length - 1);
  };
  const say = (words, color) => (message = { text: words, color, until: time() + 1.2 });

  const page = {
    picked: 0,
    pick: (point) => {
      if (point.x >= COUNTER.x - 2 && point.x < GAME_WIDTH) {
        const k = Math.floor((point.y - COUNTER.y + 4) / SPACE);
        return k >= 0 && k < save.counter.length ? -1 - k : null;
      }
      const col = Math.floor((point.x - GRID.x) / CELL), row = Math.floor((point.y - GRID.y) / CELL);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS_SHOWN) return null;
      const i = (top + row) * COLS + col;
      return i < spares.length ? i : null;
    },
    step: (dir) => {
      const i = page.picked;
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
      const row = Math.floor(next / COLS);
      top = Math.max(Math.min(top, row), row - ROWS_SHOWN + 1);
      return next;
    },
    scroll: (dir) => (top = Math.max(0, Math.min(Math.ceil(spares.length / COLS) - ROWS_SHOWN, top + dir))),
    use: (i) => {
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
      drawGold();
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
      const picked = onCounter(page.picked) ? vec2(COUNTER.x, COUNTER.y + spaceOf(page.picked) * SPACE) : cellOf(page.picked);
      if (picked && (onCounter(page.picked) ? save.counter.length : spares.length)) drawCursor(picked.x, picked.y, onCounter(page.picked) ? 20 : CELL - 2);
      drawPanel(hover ?? page.picked);
    },
  };

  function cellOf(i) {
    const row = Math.floor(i / COLS) - top;
    if (row < 0 || row >= ROWS_SHOWN) return null;
    return vec2(GRID.x + (i % COLS) * CELL + 1, GRID.y + row * CELL + 1);
  }

  // The banked gold, at the right of the title bar, as the tree shows it.
  function drawGold() {
    const gold = shortGold(save.gold);
    text(gold, GAME_WIDTH - 6, 2, C.gold, "topright");
    drawSprite({ sprite: "coin", frame: 0, pos: vec2(GAME_WIDTH - 17 - gold.length * 8, 2) });
  }

  // The counter: each space's piece, what it'll fetch, and how close it is
  // to selling.
  function drawCounter() {
    text("COUNTER", COUNTER.x, 18, C.muted);
    for (let k = 0; k < BALANCE.crafting.counter; k++) {
      const x = COUNTER.x, y = COUNTER.y + k * SPACE;
      const sale = save.counter[k];
      drawFrame(x, y, 20, sale ? C.gold : C.stoneLight, sale ? 1 : 0.5);
      if (!sale) continue;
      drawCrafted(sale.piece.recipe, vec2(x + 10, y + 11));
      text(String(sale.price), x + 26, y + 1, C.gold);
      text(timeText(sale.left), x + 26, y + 11, C.muted);
      const sells = recipeOf(sale.piece.recipe).sells;
      drawRect({ pos: vec2(x, y + 24), width: GAME_WIDTH - 6 - x, height: 3, color: C.dark });
      drawRect({ pos: vec2(x, y + 24), width: Math.round((GAME_WIDTH - 6 - x) * (1 - sale.left / sells)), height: 3, color: C.gold });
    }
  }

  function drawPanel(i) {
    drawRect({ pos: vec2(0, PANEL), width: GAME_WIDTH, height: GAME_HEIGHT - PANEL, color: C.ink });
    drawRect({ pos: vec2(0, PANEL), width: GAME_WIDTH, height: 1, color: C.stoneLight });
    const sale = onCounter(i) ? save.counter[spaceOf(i)] : null;
    const piece = sale ? sale.piece : spares[i];
    if (!piece) {
      if (message && time() < message.until) text(message.text, 30, PANEL + 35, message.color);
      return;
    }
    const recipe = recipeOf(piece.recipe);
    drawCrafted(piece.recipe, vec2(15, PANEL + 22));
    text(recipe.name.toUpperCase(), 30, PANEL + 4, C.gold);
    text(`${sale ? sale.price : priceOf(piece)} GOLD`, GAME_WIDTH - 6, PANEL + 4, C.gold, "topright");
    const bonuses = Object.entries(piece.bonuses).map(([kind, size]) => bonusText(kind, size));
    text(bonuses.slice(0, 2).join("  "), 30, PANEL + 14);
    if (bonuses.length > 2) text(bonuses.slice(2).join("  "), 30, PANEL + 24);
    const picked = i === page.picked;
    let status;
    if (message && time() < message.until) status = [message.text, message.color];
    else if (sale) status = [picked ? `SELLS IN ${timeText(sale.left)}. TAKE IT BACK: E` : "CLICK TO PICK", C.muted];
    else if (counterFull()) status = ["THE COUNTER IS FULL", C.red];
    else status = [picked ? `SELL IT (${timeText(recipe.sells)}): CLICK OR E` : "CLICK TO PICK", C.green];
    text(status[0], 30, PANEL + 35, status[1]);
  }

  keepPicked();
  return openPage("MERCHANT", "Click twice or press E to sell it. Esc closes.", page, onClose);
}
