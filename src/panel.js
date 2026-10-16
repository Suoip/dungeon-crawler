import { ROOMS } from "./config.js";
import { runTime } from "./dungeon.js";
import { showUseButton, hideUseButton } from "./touch.js";

// The strip above the game: hints, the button for what you're standing at,
// and the depth and clock. This is plain HTML, not Kaplay.

const $ = (id) => document.getElementById(id);

// Builds an element with text inside it. Text always goes in through
// textContent, never innerHTML, so it can't contain code.
function el(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

// Clicking a button moves keyboard focus off the game, and then Kaplay stops
// hearing key presses. This hands focus back to the game canvas.
function focusGame() {
  document.querySelector("#game canvas")?.focus();
}

// The right end of the strip: "Depth 3/10 · 1:23" in the dungeon, or the
// menu room's name in the menu.
let shownDepth = 1;
export function showDepth(run, depth) {
  shownDepth = Math.min(depth, ROOMS);
  tickTimer(run);
}

// Called a few times a second so the clock keeps moving.
export function tickTimer(run) {
  $("progress").textContent = `Depth ${shownDepth}/${ROOMS} · ${runTime(run)}`;
}

// While the player stands at something they can use (a door, a lever, a
// hero...), the strip shows a button like "Go deeper  [E]"; otherwise it
// shows a hint. The button is for mouse and touch; on a keyboard, E does the
// same thing. On touch screens the same action also shows on the Use button
// by the thumbs (touch.js). `content` is a list of bits of text, e.g.
// ["Become the ", "Elf"].
export function setPrompt(content, onUse, hint) {
  const button = $("door-button");
  const hintEl = $("door-hint");

  if (!content) {
    button.hidden = true;
    hintEl.hidden = false;
    hintEl.textContent = hint;
    hideUseButton();
    return;
  }

  hintEl.hidden = true;
  button.hidden = false;
  button.replaceChildren(...content, el("kbd", "E"));
  button.onclick = () => {
    focusGame();
    onUse();
  };
  showUseButton(content, onUse);
}

export function hidePrompt() {
  $("door-button").hidden = true;
  $("door-hint").hidden = true;
  hideUseButton();
}

// The room's name, at the right end of the strip (in the menu rooms).
export function showRoomName(name) {
  $("progress").textContent = name;
}
