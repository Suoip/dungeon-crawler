import { LETTERS, LETTER_COLORS } from "./config.js";
import { runTime } from "./dungeon.js";
import { showUseButton, hideUseButton } from "./touch.js";
import { fitScrollText, overflows, MIN_TEXT } from "./scroll.js";
import { onStageResize } from "./display.js";

// Everything outside the game canvas: what the question scroll above it says,
// and the strip under the scroll (hints and the clock). This is plain HTML,
// not Kaplay.

const $ = (id) => document.getElementById(id);
const rgb = ([r, g, b]) => `rgb(${r}, ${g}, ${b})`;

// Builds an element with text inside it. Questions will come from user-made
// dungeons one day, so text always goes in through textContent. If we used
// innerHTML, someone could put a <script> in a question and run code on
// other players' computers.
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

// A colored answer letter. On the light paper of the scroll the door colors
// are too pale to read (yellow especially), so it uses darker shades of them.
export function letterBadge(index, { onScroll = false } = {}) {
  const badge = el("span", LETTERS[index], "letter");
  const color = LETTER_COLORS[index].map((c) => (onScroll ? Math.round(c * 0.62) : c));
  badge.style.color = rgb(color);
  return badge;
}

// Clicking a button moves keyboard focus off the game, and then Kaplay stops
// hearing key presses. This hands focus back to the game canvas.
function focusGame() {
  document.querySelector("#game canvas")?.focus();
}

// The right end of the strip: "Depth 3/10 · 1:23" in the dungeon, or the
// menu room's name in the menu.
let shownDepth = 1;
function setDepth(run, depth) {
  shownDepth = Math.min(depth, run.rooms.length);
  tickTimer(run);
}

// Called a few times a second so the clock keeps moving.
export function tickTimer(run) {
  $("progress").textContent = `Depth ${shownDepth}/${run.rooms.length} · ${runTime(run)}`;
}

// Writes on the scroll: a line of text, then a row of items (the answers,
// or a menu room's list), and shrinks it to fit. `line` and each item can be
// text, an element, or a list of them.
function writeOnScroll(line, items = []) {
  fillScroll($("scroll-text"), line, items);
  fitScrollText();
}

function fillScroll(box, line, items) {
  box.querySelector(".scroll-line").replaceChildren(...[line].flat());
  box.querySelector(".scroll-items").replaceChildren(...items.map((item) => {
    const li = el("li");
    li.append(...[item].flat());
    return li;
  }));
}

const answerItems = (texts) => texts.map((text, i) => [letterBadge(i, { onScroll: true }), el("span", text)]);

// Whether something fits on the scroll, even at the smallest text size.
// It's checked on an invisible copy of the scroll's writing area, so the
// real one isn't touched. Everything on the stage is sized in game pixels
// and the font comes with the game, so the answer is the same on every
// screen.
function fits(line, items) {
  const box = $("scroll-text");
  const copy = box.cloneNode(true);
  copy.querySelectorAll("[id]").forEach((part) => part.removeAttribute("id"));
  copy.removeAttribute("id");
  copy.setAttribute("aria-hidden", "true");
  copy.style.visibility = "hidden";
  copy.style.setProperty("--fit", MIN_TEXT);
  box.parentElement.append(copy);
  fillScroll(copy, line, items);
  const result = !overflows(copy);
  copy.remove();
  return result;
}

// A question with its answers in this order.
export const fitsOnScroll = (question, answers) => fits(question, answerItems(answers));

// The explanation scroll for a room (with its correct answer as letter A,
// the widest case doesn't matter much, so the first letter is fine).
export const explanationFits = (correct, explanation) => fits(explanationLine(0, correct), [explanation]);

// The scroll keeps its size in game pixels, so when the game is scaled, the
// text is re-fitted.
onStageResize(fitScrollText);

export function showQuestion(run, room) {
  setDepth(run, run.index + 1);
  writeOnScroll(room.question, answerItems(room.answers.map((answer) => answer.text)));
}

// Just the depth and time in the strip (e.g. while falling into a room,
// before its question is found).
export function showDepth(run, depth) {
  setDepth(run, depth);
}

// After a question that took more than one try: the answer and why, on the
// scroll. (The scene opens it.)
const explanationLine = (index, text) => [el("span", "Correct! ", "correct"), "The answer is ", letterBadge(index, { onScroll: true }), el("strong", text)];

export function writeExplanation(room) {
  const index = room.answers.findIndex((answer) => answer.correct);
  writeOnScroll(explanationLine(index, room.answers[index].text), [room.explanation]);
}

// A short message in the strip, where the hints go, e.g. "Correct!".
export function showStripMessage(text, className = "") {
  $("door-button").hidden = true;
  hideUseButton();
  const hint = $("door-hint");
  hint.hidden = false;
  hint.textContent = text;
  hint.className = className;
}

// A wrong answer gets crossed out in the list, so you can see what's left.
export function crossOutAnswer(index) {
  $("answers").children[index]?.classList.add("crossed");
}

// Replaces the question with a message, e.g. after the last room.
export function showMessage(message) {
  writeOnScroll(message);
}

// The strip under the scroll. While the player stands at something
// they can use (a door, a lever, a hero...), it shows a button like
// "Open door B  [E]"; otherwise it shows a hint. The button is for
// mouse and touch; on a keyboard, E does the same thing. On touch screens
// the same action also shows on the Use button by the thumbs (touch.js).
// `content` is a list of text and elements, e.g. ["Open door ", letterBadge(1)].
export function setPrompt(content, onUse, hint) {
  const button = $("door-button");
  const hintEl = $("door-hint");

  if (!content) {
    button.hidden = true;
    hintEl.hidden = false;
    hintEl.textContent = hint;
    hintEl.className = "";
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

// Writes on a menu room's scroll: one line of text and a list of items.
export function writeMenuScroll({ line, items = [] }) {
  writeOnScroll(line, items);
}

// A link that opens in a new tab.
export function link(text, href) {
  const a = el("a", text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}
