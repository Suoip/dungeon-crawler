import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BALANCE } from "./balance.js";
import { getSave, enchantPiece } from "./save.js";
import { RUNES, runeName, runeFor, levelOf, enchantOdds, enchanted, bonusText, drawCrafted } from "./crafting.js";
import { C, text, drawFrame, drawCursor, openPage, upgradeRow, isUp, UP_ROW, drawGold, nameOf, drawLevel } from "./forge.js";
import { playSound } from "./sound.js";

// The rune table's page (DESIGN.md section 6), opened at the rune table in
// the underworld: all your gear (worn first, like the gear chest), and the
// runes you have along the title bar. A rune of a piece's depth enchants
// it: its level goes up by one, up to +3, and each level makes all its
// bonuses bigger (balance.js crafting.enchant). Going to +2 or +3 can fail:
// then the rune is lost and the piece stays as it was. The table's upgrades
// (Steady hands, Rune finder) are in a row under the title bar. Mouse:
// click a piece or an upgrade to pick it, click it again to enchant it or
// buy it. Keyboard: the arrows or WASD pick (up from the top goes to the
// upgrades), E does it, Esc closes.

const COLS = 13;
const CELL = 22;
const GRID = { x: (GAME_WIDTH - COLS * CELL) / 2, y: 12 + UP_ROW + 6 };
const PANEL = GAME_HEIGHT - 48;
const ROWS_SHOWN = Math.floor((PANEL - GRID.y) / CELL);
const GLOW = [190, 140, 255]; // the runes' light: levels, and an enchant that worked

export function openRuneTable(onClose) {
  const save = getSave();
  const row = upgradeRow(BALANCE.crafting.upgrades.runes);
  const isWorn = (piece) => Object.values(save.worn).includes(piece.id);
  const pieces = [...save.gear.filter(isWorn), ...save.gear.filter((piece) => !isWorn(piece)).reverse()];
  const runesFor = (piece) => save.parts[runeFor(piece)] ?? 0;
  const ready = (piece) => enchantOdds(piece) !== null && runesFor(piece) > 0;
  let message = null; // { text, color, until }: a moment's note in the panel
  let flash = null;   // { piece, worked, at }: a burst over the piece just enchanted
  let top = 0;        // the grid's first row on show

  const page = {
    picked: 0,
    pick: (point) => {
      const up = row.pick(point);
      if (up) return up;
      const col = Math.floor((point.x - GRID.x) / CELL), line = Math.floor((point.y - GRID.y) / CELL);
      if (col < 0 || col >= COLS || line < 0 || line >= ROWS_SHOWN) return null;
      const i = (top + line) * COLS + col;
      return i < pieces.length ? i : null;
    },
    step: (dir) => {
      if (isUp(page.picked)) return dir.y > 0 ? (pieces.length ? 0 : null) : row.step(page.picked, dir);
      if (dir.y < 0 && page.picked < COLS && top === 0) return "up:0";
      const next = page.picked + dir.x + dir.y * COLS;
      if (next < 0 || next >= pieces.length || (dir.x && Math.floor(next / COLS) !== Math.floor(page.picked / COLS))) return null;
      // Scroll so the picked one stays on show.
      const line = Math.floor(next / COLS);
      top = Math.max(Math.min(top, line), line - ROWS_SHOWN + 1);
      return next;
    },
    scroll: (dir) => (top = Math.max(0, Math.min(Math.ceil(pieces.length / COLS) - ROWS_SHOWN, top + dir))),
    use: (id) => {
      if (isUp(id)) return row.buy(id);
      const piece = pieces[id];
      if (!piece) return;
      const odds = enchantOdds(piece);
      if (odds === null || !runesFor(piece)) {
        message = { text: odds === null ? "IT'S AS ENCHANTED AS IT GETS" : `YOU HAVE NO ${runeName(runeFor(piece))}`, color: C.red, until: time() + 1.2 };
        playSound("letter");
        return;
      }
      const worked = Math.random() < odds;
      enchantPiece(piece.id, runeFor(piece), worked);
      flash = { piece, worked, at: time() };
      message = worked ? { text: `IT WORKED: NOW +${levelOf(piece)}`, color: C.gold, until: time() + 1.5 }
        : { text: "IT FAILED: THE RUNE CRUMBLED", color: C.red, until: time() + 1.5 };
      playSound(worked ? "enchant" : "fizzle");
    },
    draw: (hover) => {
      drawGold({ left: 94 });
      drawRunes();
      row.draw(page.picked);
      if (!pieces.length) {
        text("NO GEAR YET.", GAME_WIDTH / 2, 80, C.muted, "top");
        text("MAKE SOME AT THE FORGE.", GAME_WIDTH / 2, 92, C.muted, "top");
      }
      for (let i = top * COLS; i < Math.min(pieces.length, (top + ROWS_SHOWN) * COLS); i++) drawPiece(pieces[i], i);
      const picked = isUp(page.picked) ? null : cellOf(page.picked);
      if (picked && pieces.length) drawCursor(picked.x, picked.y, CELL - 2);
      drawPanel(hover ?? page.picked);
    },
  };

  // Where a piece's frame is on the page (null when it's scrolled out of view).
  function cellOf(i) {
    const line = Math.floor(i / COLS) - top;
    if (line < 0 || line >= ROWS_SHOWN) return null;
    return vec2(GRID.x + (i % COLS) * CELL + 1, GRID.y + line * CELL + 1);
  }

  // The runes you have, along the right of the title bar: each one's
  // picture and how many. Only the ones found so far.
  function drawRunes() {
    let x = GAME_WIDTH - 6;
    for (const rune of [...RUNES].reverse()) {
      if (save.parts[rune] === undefined) continue;
      const count = String(save.parts[rune]);
      text(count, x, 2, C.light, "topright");
      x -= count.length * 8 + 7;
      drawCrafted(rune, vec2(x, 6));
      x -= 11;
    }
  }

  // A piece: green round it when a rune you have can enchant it, a gold dot
  // when it's worn, and a purple pip for each level.
  function drawPiece(piece, i) {
    const at = cellOf(i);
    if (!at) return;
    drawFrame(at.x, at.y, CELL - 2, ready(piece) ? C.green : C.stoneLight);
    drawCrafted(piece.recipe, at.add(10, 11));
    if (isWorn(piece)) drawRect({ pos: at.add(2, 2), width: 2, height: 2, color: C.gold });
    drawLevel(piece, at, CELL - 2);
    // Just enchanted: a ring of light that spreads (or a grey puff, when it failed).
    const since = flash?.piece === piece ? time() - flash.at : 1;
    if (since < 0.6) {
      const t = since / 0.6;
      drawCircle({ pos: at.add(10, 10), radius: 4 + t * 14, color: flash.worked ? rgb(...GLOW) : C.muted, opacity: 0.6 * (1 - t), fill: false, outline: { width: 2, color: flash.worked ? rgb(...GLOW) : C.muted } });
    }
  }

  function drawPanel(id) {
    drawRect({ pos: vec2(0, PANEL), width: GAME_WIDTH, height: GAME_HEIGHT - PANEL, color: C.ink });
    drawRect({ pos: vec2(0, PANEL), width: GAME_WIDTH, height: 1, color: C.stoneLight });
    if (isUp(id)) return row.panel(id, PANEL, 35, id === page.picked);
    const piece = pieces[id];
    if (!piece) return;
    const level = levelOf(piece);
    drawCrafted(piece.recipe, vec2(15, PANEL + 22));
    text(nameOf(piece), 30, PANEL + 4, C.gold);
    // Its rune, and how many you have.
    const rune = runeFor(piece);
    text(String(runesFor(piece)), GAME_WIDTH - 6, PANEL + 4, runesFor(piece) ? C.light : C.red, "topright");
    drawCrafted(rune, vec2(GAME_WIDTH - 13 - String(runesFor(piece)).length * 8, PANEL + 8));
    // Its bonuses as they are now, enchanting and all, two to a line.
    const bonuses = Object.entries(enchanted(piece)).map(([kind, size]) => bonusText(kind, size));
    text(bonuses.slice(0, 2).join("  "), 30, PANEL + 14);
    if (bonuses.length > 2) text(bonuses.slice(2).join("  "), 30, PANEL + 24);
    const odds = enchantOdds(piece);
    let status;
    if (message && time() < message.until && id === page.picked) status = [message.text, message.color];
    else if (odds === null) status = ["FULLY ENCHANTED", C.gold];
    else if (!runesFor(piece)) status = [`+${level + 1} NEEDS A ${runeName(rune)}`, C.red];
    else {
      const chance = `${Math.round(odds * 100)}%`;
      status = [id === page.picked ? `ENCHANT TO +${level + 1}, ${chance}: CLICK OR E` : `+${level + 1}: ${chance} CHANCE`, C.green];
    }
    text(status[0], 30, PANEL + 35, status[1]);
  }

  return openPage("RUNE TABLE", "Click twice or press E to enchant it or buy it. Esc closes.", page, onClose);
}
