import { LETTERS, LETTER_COLORS } from "./config.js";

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

function letterBadge(index) {
  const badge = el("span", LETTERS[index], "letter");
  badge.style.color = rgb(LETTER_COLORS[index]);
  return badge;
}

// Clicking a button moves keyboard focus off the game, and then Kaplay stops
// hearing key presses. This hands focus back to the game canvas.
function focusGame() {
  document.querySelector("#game canvas")?.focus();
}

export function showQuestion(run, room) {
  $("dungeon-title").textContent = run.dungeon.title;
  $("progress").textContent = `Room ${run.index + 1}/${run.rooms.length}`;
  $("question").textContent = room.question;

  const list = $("answers");
  list.replaceChildren(...room.answers.map((answer, i) => {
    const item = el("li");
    item.append(letterBadge(i), el("span", answer.text));
    return item;
  }));
}

// Replaces the question with a message, e.g. after the last room.
export function showMessage(message) {
  $("question").textContent = message;
  $("answers").replaceChildren();
}

// Shows "Open door B" while the player stands at a door, or a hint otherwise.
// The button works for touch screens; on a keyboard, E or Space does the same.
export function setDoorPrompt(door, onOpen) {
  const button = $("door-button");
  const hint = $("door-hint");

  if (!door) {
    button.hidden = true;
    hint.hidden = false;
    hint.textContent = "Walk up to a door to choose your answer.";
    return;
  }

  hint.hidden = true;
  button.hidden = false;
  button.replaceChildren("Open door ", letterBadge(door.index), el("kbd", "E / Space"));
  button.onclick = () => {
    focusGame();
    onOpen();
  };
}

export function hidePrompt() {
  $("door-button").hidden = true;
  $("door-hint").hidden = true;
}

function showOverlay(children, buttonText, onButton) {
  const overlay = $("overlay");
  const button = el("button", buttonText, "big-button");
  button.onclick = () => {
    overlay.hidden = true;
    focusGame();
    onButton();
  };
  overlay.replaceChildren(el("div", undefined, "card"));
  overlay.firstChild.append(...children, button);
  overlay.hidden = false;
  button.focus(); // so Enter or Space presses it right away
}

function answerLine(label, room, answer) {
  const line = el("p", undefined, "answer-line");
  const index = room.answers.indexOf(answer);
  line.append(el("span", label, "muted"), letterBadge(index), el("strong", answer.text));
  return line;
}

export function showGameOver(run, room, chosen, onRetry) {
  const correct = room.answers.find((answer) => answer.correct);
  showOverlay([
    el("h2", "You fell into a trap!"),
    el("p", room.question, "overlay-question"),
    answerLine("Your answer:", room, chosen),
    answerLine("Correct answer:", room, correct),
    el("p", room.explanation, "explanation"),
    el("p", `Rooms cleared: ${run.index}/${run.rooms.length}`, "score"),
  ], "Try again", onRetry);
}

export function showVictory(run, onRetry) {
  showOverlay([
    el("h2", "Dungeon cleared!"),
    el("p", `You made it through all ${run.rooms.length} rooms of ${run.dungeon.title}.`),
    el("p", `Rooms cleared: ${run.rooms.length}/${run.rooms.length}`, "score"),
  ], "Play again", onRetry);
}
