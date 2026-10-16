import { LETTERS, LETTER_COLORS } from "./config.js";
import { runTime } from "./dungeon.js";
import { showUseButton, hideUseButton } from "./touch.js";

// Everything outside the game canvas: the question panel above it, and the
// game over / victory screens laid over it. This is plain HTML, not Kaplay.

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

export function letterBadge(index) {
  const badge = el("span", LETTERS[index], "letter");
  badge.style.color = rgb(LETTER_COLORS[index]);
  return badge;
}

// Clicking a button moves keyboard focus off the game, and then Kaplay stops
// hearing key presses. This hands focus back to the game canvas.
function focusGame() {
  document.querySelector("#game canvas")?.focus();
}

// The top row: the dungeon's name, then "Depth 3/10 · 1:23" (depth and time).
let shownDepth = 1;
function setDepth(run, depth) {
  lockToDungeon();
  shownDepth = Math.min(depth, run.rooms.length);
  $("dungeon-title").textContent = run.dungeon.title;
  tickTimer(run);
}

// Called a few times a second so the clock keeps moving.
export function tickTimer(run) {
  $("progress").textContent = `Depth ${shownDepth}/${run.rooms.length} · ${runTime(run)}`;
}

// These two fill in a panel's question line and answer list. They take the
// elements to fill as arguments, so they work both on the real panel and on
// the invisible copy that measureTallest() measures.
function fillQuestion(questionEl, answersEl, question, answers) {
  questionEl.textContent = question;
  answersEl.replaceChildren(...answers.map((answer, i) => {
    const item = el("li");
    item.append(letterBadge(i), el("span", answer));
    return item;
  }));
}

export function showCorrect(run, depth) {
  setDepth(run, depth);
  $("question").replaceChildren(el("span", "Correct!", "correct"));
  $("answers").replaceChildren();
}

export function showQuestion(run, room) {
  setDepth(run, run.index + 1);
  fillQuestion($("question"), $("answers"), room.question, room.answers.map((answer) => answer.text));
}

// A wrong answer gets crossed out in the list, so you can see what's left.
export function crossOutAnswer(index) {
  $("answers").children[index]?.classList.add("crossed");
}

// The game fills whatever space the panel leaves, so every time the panel
// changed height, the whole game got squeezed or stretched. To stop that, the
// panel's height is locked:
//   - in the dungeon, to the tallest of all its questions, so it never
//     changes during a run
//   - in each menu room, to that room's own panel
// It only changes when a new room is set up, which happens while the screen
// is black (every room fades in), so you never see the game jump. Locking per
// room, instead of to the tallest panel of all, lets the game be bigger: the
// credits list was the tallest, and every room had to make space for it.
//
// We measure on an invisible copy of the panel, so the real one isn't touched.
// Text wraps differently at different widths, so this runs again whenever the
// window is resized.
function measureTallest(fillers) {
  const panel = $("panel");
  const copy = panel.cloneNode(true);
  copy.removeAttribute("id"); // its styling comes from the "panel" class, so it still looks the same
  copy.setAttribute("aria-hidden", "true");
  copy.style.cssText = `position: absolute; left: 0; top: 0; width: ${panel.offsetWidth}px; visibility: hidden; min-height: 0;`;
  document.body.append(copy);

  let tallest = 0;
  for (const fill of fillers) {
    fill(copy);
    tallest = Math.max(tallest, copy.offsetHeight);
  }
  copy.remove();
  return tallest;
}

// Every question of the dungeon, filled into the copy one at a time.
const questionFillers = (dungeon) => dungeon.rooms.map((room) => (copy) => {
  copy.querySelector("#dungeon-title").textContent = dungeon.title;
  copy.querySelector("#progress").textContent = `Depth ${dungeon.rooms.length}/${dungeon.rooms.length} · 0:00`;
  fillQuestion(copy.querySelector("#question"), copy.querySelector("#answers"), room.question, [room.correct, ...room.wrong]);
});

let lockedDungeon = null;
let lockedTo = null; // "dungeon", or the content of the menu room we're in

function applyLock() {
  if (!lockedTo) return;
  const fillers = lockedTo === "dungeon"
    ? questionFillers(lockedDungeon)
    : [(copy) => fillMenu(copy, lockedTo)];
  $("panel").style.minHeight = `${measureTallest(fillers)}px`;
}

// Called once, with the dungeon whose questions the run will ask.
export function lockPanelHeight(dungeon) {
  lockedDungeon = dungeon;
  window.addEventListener("resize", applyLock);
}

function lockToDungeon() {
  if (lockedTo === "dungeon") return; // already locked for the run
  lockedTo = "dungeon";
  applyLock();
}

// Replaces the question with a message, e.g. after the last room.
export function showMessage(message) {
  $("question").textContent = message;
  $("answers").replaceChildren();
}

// The prompt row under the question. While the player stands at something
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

// Fills a panel for the menu rooms: a heading row, one line of text, and a
// list of items (text or elements, laid out like the answers). Works on the
// real panel or on the invisible copy measureTallest() measures.
function fillMenu(panelEl, { left = "", right = "", line, items = [] }) {
  panelEl.querySelector("#dungeon-title").textContent = left;
  panelEl.querySelector("#progress").textContent = right;
  panelEl.querySelector("#question").replaceChildren(...[line].flat());
  panelEl.querySelector("#answers").replaceChildren(...items.map((item) => {
    const li = el("li");
    li.append(...[item].flat());
    return li;
  }));
}

// A menu room's panel, with the panel locked to its height. (Measure first:
// filling the copy borrows the content's links, and filling the real panel
// afterwards takes them back.)
export function showMenuPanel(content) {
  lockedTo = content;
  applyLock();
  fillMenu($("panel"), content);
}

// A link that opens in a new tab.
export function link(text, href) {
  const a = el("a", text);
  a.href = href;
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}

// A card over the game with a title, some content and one or more buttons,
// e.g. [{ text: "Try again", onClick }, { text: "Menu", onClick }].
function showOverlay(children, buttons) {
  const overlay = $("overlay");
  const row = el("div", undefined, "card-buttons");
  const buttonEls = buttons.map(({ text, onClick }) => {
    const button = el("button", text, "big-button");
    button.onclick = () => {
      overlay.hidden = true;
      focusGame();
      onClick();
    };
    return button;
  });
  row.append(...buttonEls);
  overlay.replaceChildren(el("div", undefined, "card"));
  overlay.firstChild.append(...children, row);
  overlay.hidden = false;
  buttonEls[0].focus(); // so Enter or Space presses the first button right away
}

function answerLine(label, room, answer) {
  const line = el("p", undefined, "answer-line");
  const index = room.answers.indexOf(answer);
  line.append(el("span", label, "muted"), letterBadge(index), el("strong", answer.text));
  return line;
}

// After a question they got wrong at least once, once they've found the
// right door: the answer and why. Resolves when they press Continue.
export function showExplanation(room) {
  const correct = room.answers.find((answer) => answer.correct);
  return new Promise((resolve) => showOverlay([
    el("h2", "Correct!"),
    el("p", room.question, "overlay-question"),
    answerLine("Answer:", room, correct),
    el("p", room.explanation, "explanation"),
  ], [{ text: "Continue", onClick: resolve }]));
}

const score = (run, cleared) =>
  el("p", `Rooms cleared: ${cleared}/${run.rooms.length} · First try: ${run.firstTry} · Time: ${runTime(run)}`, "score");

// When the mobs take the last heart.
export function showDefeated(run, depth, { onRetry, onMenu }) {
  showOverlay([
    el("h2", "Defeated!"),
    el("p", `The monsters got you at depth ${depth}. Fewer hits next time!`),
    score(run, run.index),
  ], [{ text: "Try again", onClick: onRetry }, { text: "Menu", onClick: onMenu }]);
}

export function showVictory(run, { onRetry, onMenu }) {
  showOverlay([
    el("h2", "Dungeon cleared!"),
    el("p", `You made it through all ${run.rooms.length} rooms of ${run.dungeon.title}.`),
    score(run, run.rooms.length),
  ], [{ text: "Play again", onClick: onRetry }, { text: "Menu", onClick: onMenu }]);
}
