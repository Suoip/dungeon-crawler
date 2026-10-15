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

function setDepth(run, depth) {
  $("dungeon-title").textContent = run.dungeon.title;
  $("progress").textContent = `Depth ${Math.min(depth, run.rooms.length)}/${run.rooms.length}`;
}

// These two fill in a panel's question line and answer list. They take the
// elements to fill as arguments, so they work both on the real panel and on
// the invisible copy that lockPanelHeight() measures.
function fillQuestion(questionEl, answersEl, question, answers) {
  questionEl.textContent = question;
  answersEl.replaceChildren(...answers.map((answer, i) => {
    const item = el("li");
    item.append(letterBadge(i), el("span", answer));
    return item;
  }));
}

function fillSuspense(questionEl, answersEl, letterIndex, answer) {
  questionEl.replaceChildren(el("span", "Your answer: ", "muted"), letterBadge(letterIndex), `${answer} …`);
  answersEl.replaceChildren();
}

// While the knight falls, show only the answer he picked, so the panel doesn't
// give away whether it was right before he lands.
export function showSuspense(run, depth, answered) {
  setDepth(run, depth);
  const { room, chosen } = answered;
  fillSuspense($("question"), $("answers"), room.answers.indexOf(chosen), chosen.text);
}

export function showCorrect() {
  $("question").replaceChildren(el("span", "Correct!", "correct"));
}

export function showQuestion(run, room) {
  setDepth(run, run.index + 1);
  fillQuestion($("question"), $("answers"), room.question, room.answers.map((answer) => answer.text));
}

// The game fills whatever space the panel leaves, so every time the panel
// changed height, the whole game got squeezed or stretched. To stop that, we
// work out the tallest the panel will ever need to be for this dungeon and
// keep it at that height the whole time.
//
// We measure on an invisible copy of the panel, so the real one isn't touched.
// Text wraps differently at different widths, so this runs again whenever the
// window is resized.
function measureTallestPanel(dungeon) {
  const panel = $("panel");
  const copy = panel.cloneNode(true);
  copy.removeAttribute("id"); // its styling comes from the "panel" class, so it still looks the same
  copy.setAttribute("aria-hidden", "true");
  copy.style.cssText = `position: absolute; left: 0; top: 0; width: ${panel.offsetWidth}px; visibility: hidden; min-height: 0;`;
  document.body.append(copy);

  // The top row is still empty when this first runs, so fill it in too, or
  // it would count as zero height.
  copy.querySelector("#dungeon-title").textContent = dungeon.title;
  copy.querySelector("#progress").textContent = `Depth ${dungeon.rooms.length}/${dungeon.rooms.length}`;

  const questionEl = copy.querySelector("#question");
  const answersEl = copy.querySelector("#answers");
  let tallest = 0;
  const measure = () => (tallest = Math.max(tallest, copy.offsetHeight));

  for (const room of dungeon.rooms) {
    const answers = [room.correct, ...room.wrong];
    fillQuestion(questionEl, answersEl, room.question, answers);
    measure();
    // The "Your answer: …" line could be the tallest if an answer is long.
    answers.forEach((answer, i) => {
      fillSuspense(questionEl, answersEl, i, answer);
      measure();
    });
  }

  copy.remove();
  return tallest;
}

export function lockPanelHeight(dungeon) {
  const lock = () => ($("panel").style.minHeight = `${measureTallestPanel(dungeon)}px`);
  lock();
  window.addEventListener("resize", lock);
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
