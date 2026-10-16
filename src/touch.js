// Touch controls for phones and tablets: a joystick on the left, and Attack,
// Dash and Use buttons on the right. They're plain HTML laid over the page
// (see #touch in index.html and style.css), and they only show on touch
// screens.
//
// The game never asks "was it a key or a tap?". main.js gives Kaplay named
// buttons ("attack" is the Space key, "dash" is Shift, ...), the game listens
// for those buttons, and the on-screen buttons press the same ones with
// Kaplay's pressButton() / releaseButton(). The joystick is different because
// it isn't just on or off: it's analog, so it's read with joystickDirection().

const $ = (id) => document.getElementById(id);

const STICK_RADIUS = 44; // px the knob can move from the middle
const DEAD_ZONE = 0.2;   // a nudge smaller than this (out of 1) doesn't move him

const stick = { x: 0, y: 0 }; // where the joystick points, each -1 to 1

// True on phones and tablets: their main pointer is a finger ("coarse").
// A laptop with a touch screen counts too, once it's been touched.
let touched = false;
export const isTouch = () => touched || window.matchMedia("(pointer: coarse)").matches;

// The words for "use" in hints: a key on a keyboard, a button on a phone.
export const useHint = () => (isTouch() ? "tap USE" : "press E");

// Where the joystick is pointing, as a vec2 whose length is 0 (not touched)
// up to 1 (pushed all the way), so a small push walks slowly.
export function joystickDirection() {
  return vec2(stick.x, stick.y);
}

export function setupTouchControls() {
  const show = () => document.body.classList.add("touch");
  if (isTouch()) show();
  window.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "touch") return;
    touched = true;
    show();
  }, true);

  setupJoystick();
  holdToPress($("touch-attack"), "attack");
  holdToPress($("touch-dash"), "dash");
  setupFullscreen();

  // Sideways, the joystick area is the empty space left of the stage.
  const stage = $("stage");
  const measureSide = () =>
    document.documentElement.style.setProperty("--side-space", `${stage.getBoundingClientRect().left}px`);
  measureSide();
  new ResizeObserver(measureSide).observe(stage);
}

// A button that presses one of Kaplay's named buttons while a finger is on it.
function holdToPress(element, name) {
  element.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    element.setPointerCapture(event.pointerId); // keep it pressed even if the finger slides off
    element.classList.add("down");
    pressButton(name);
  });
  const release = () => {
    element.classList.remove("down");
    releaseButton(name);
  };
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
}

// A floating joystick: put a thumb down anywhere in the left area and the
// stick appears under it, then drag. When it's not in use, it waits faintly
// in the middle of the area so you know where it goes.
function setupJoystick() {
  const zone = $("stick-zone");
  const base = $("stick-base");
  const knob = $("stick-knob");
  let finger = null; // the pointerId of the thumb on it, if any
  let origin = null;

  const place = (x, y) => {
    base.style.left = `${x}px`;
    base.style.top = `${y}px`;
  };
  const rest = () => {
    finger = null;
    stick.x = stick.y = 0;
    base.classList.remove("active");
    base.style.left = base.style.top = ""; // back to its spot in the stylesheet
    knob.style.transform = "";
  };

  zone.addEventListener("pointerdown", (event) => {
    if (finger !== null) return; // a second finger on the left side is ignored
    event.preventDefault();
    finger = event.pointerId;
    zone.setPointerCapture(finger);
    const box = zone.getBoundingClientRect();
    origin = { x: event.clientX, y: event.clientY };
    place(origin.x - box.left, origin.y - box.top);
    base.classList.add("active");
  });

  zone.addEventListener("pointermove", (event) => {
    if (event.pointerId !== finger) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    const distance = Math.hypot(dx, dy);
    const reach = Math.min(distance, STICK_RADIUS);
    const kx = distance ? (dx / distance) * reach : 0;
    const ky = distance ? (dy / distance) * reach : 0;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;

    const strength = reach / STICK_RADIUS;
    const push = strength < DEAD_ZONE ? 0 : (strength - DEAD_ZONE) / (1 - DEAD_ZONE);
    stick.x = distance ? (dx / distance) * push : 0;
    stick.y = distance ? (dy / distance) * push : 0;
  });

  for (const type of ["pointerup", "pointercancel"]) {
    zone.addEventListener(type, (event) => {
      if (event.pointerId === finger) rest();
    });
  }
}

// The fullscreen button hides the browser's address bar and toolbars, for
// more room. Android allows it; iPhones don't let web pages go fullscreen,
// so there the button never shows.
function setupFullscreen() {
  const button = $("touch-fullscreen");
  if (!document.fullscreenEnabled) return;
  button.hidden = false;
  button.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {}); // e.g. the browser said no
  });
}

// The Use button only shows while there's something to use. It's labelled
// like the panel's button (e.g. "Open door B") and does the same thing.
export function showUseButton(content, onUse) {
  const button = $("touch-use");
  button.replaceChildren(...content.map((part) => (typeof part === "string" ? part : part.cloneNode(true))));
  button.onpointerdown = (event) => {
    event.preventDefault();
    onUse();
  };
  button.hidden = false;
}

export function hideUseButton() {
  $("touch-use").hidden = true;
}
