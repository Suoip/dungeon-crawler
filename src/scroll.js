import { GAME_WIDTH, SCROLL_HEIGHT } from "./config.js";

// The question scroll above the game: a pixel-art scroll opened sideways,
// with the question written on it. The scroll is always the same size (in
// game pixels, scaled with the game), and the text shrinks until it fits.

// How big the text can be, in game pixels. It starts at the biggest size and
// steps down until everything fits. MIN_TEXT is the smallest that's still
// easy to read on a phone, where the game is drawn smallest; it's what the
// character limits for questions and answers are based on.
export const MAX_TEXT = 14;
export const MIN_TEXT = 9;
const STEP = 0.5;

// Shrinks the text on the scroll until it fits. Because everything on the
// stage is sized in game pixels, it wraps the same way on every screen, so a
// question that fits on one screen fits on all of them.
export function fitScrollText() {
  const box = document.getElementById("scroll-text");
  let size = MAX_TEXT;
  box.style.setProperty("--fit", size);
  while (size > MIN_TEXT && overflows(box)) {
    size -= STEP;
    box.style.setProperty("--fit", size);
  }
  return !overflows(box); // false: even the smallest size doesn't fit
}

export const overflows = (box) => box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1;

// Draws the scroll once, pixel by pixel, into small canvases the size of its
// parts in game pixels, and uses those as background pictures: the paper,
// and a roll for each end (separate, so they can slide apart as the scroll
// opens). The browser scales them up with hard pixel edges, like the game.
export const ROLL_WIDTH = 12;

export function drawScroll() {
  const width = GAME_WIDTH;
  const height = SCROLL_HEIGHT;
  const OUTLINE = [58, 40, 24];

  const paint = (w, h, draw) => {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    draw((rgb, x, y, fw = 1, fh = 1) => {
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.fillRect(x, y, fw, fh);
    });
    return `url(${canvas.toDataURL()})`;
  };

  // The paper, between the two rolls.
  const paperImage = paint(width, height, (fill) => {
    const paper = { left: 9, right: width - 10, top: 4, bottom: height - 5 };
    const paperWidth = paper.right - paper.left + 1;
    const paperHeight = paper.bottom - paper.top + 1;
    fill(OUTLINE, paper.left, paper.top, paperWidth, paperHeight);
    fill([232, 213, 169], paper.left, paper.top + 1, paperWidth, paperHeight - 2);
    fill([244, 230, 196], paper.left, paper.top + 1, paperWidth, 1);    // light along the top edge
    fill([214, 190, 142], paper.left, paper.bottom - 2, paperWidth, 2); // darker along the bottom
    // Shade where the paper curls into the rolls.
    for (const [x, rgb] of [[12, [200, 174, 126]], [13, [214, 190, 142]], [14, [224, 203, 158]]]) {
      fill(rgb, x, paper.top + 1, 1, paperHeight - 2);
      fill(rgb, width - 1 - x, paper.top + 1, 1, paperHeight - 2);
    }
    // Speckles, so it looks like old paper. A fixed sequence of "random"
    // numbers, so the scroll looks the same every time.
    let seed = 7;
    const next = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 160; i++) {
      const x = Math.floor(paper.left + 6 + next() * (paperWidth - 12));
      const y = Math.floor(paper.top + 2 + next() * (paperHeight - 5));
      fill(next() < 0.7 ? [220, 199, 152] : [204, 180, 132], x, y);
    }
  });

  // A roll: a wooden-brown paper cylinder, lit from the left, with a knob
  // sticking out at each end.
  const rollImage = paint(ROLL_WIDTH, height, (fill) => {
    const ROLL = [OUTLINE, [110, 74, 40], [150, 104, 56], [188, 138, 78], [222, 178, 112], [240, 210, 154],
      [214, 166, 98], [178, 128, 70], [142, 98, 54], [110, 74, 40], [84, 56, 30], OUTLINE];
    ROLL.forEach((rgb, i) => {
      const edge = i === 0 || i === ROLL.length - 1;
      fill(rgb, i, edge ? 3 : 2, 1, height - (edge ? 6 : 4));
    });
    fill(OUTLINE, 1, 1, ROLL.length - 2, 1);           // top of the roll
    fill(OUTLINE, 1, height - 2, ROLL.length - 2, 1);  // bottom
    fill([90, 60, 34], 4, 0, 4, 1);                    // the knobs
    fill([90, 60, 34], 4, height - 1, 4, 1);
  });

  document.getElementById("scroll-paper").style.backgroundImage = paperImage;
  for (const id of ["roll-left", "roll-right"]) document.getElementById(id).style.backgroundImage = rollImage;
}

// The scroll's three states (a class on #scroll, animated in style.css):
//   hidden   nothing there (rooms start like this)
//   rolled   both rolls together in the middle, the paper rolled up
//   open     the rolls at the ends, the paper and text showing
// Opening goes hidden -> rolled (instantly) -> open (a fast unroll), and
// closing goes open -> rolled -> hidden.
const UNROLL = 0.28; // seconds; keep in step with the transitions in style.css
const scrollEl = () => document.getElementById("scroll");

function setState(state) {
  scrollEl().classList.remove("hidden", "rolled", "open");
  scrollEl().classList.add(state);
}

export function hideScroll() {
  scrollEl().classList.add("instant"); // no animation
  setState("hidden");
  void scrollEl().offsetWidth;          // apply it now, before the next change
  scrollEl().classList.remove("instant");
}

export const isScrollOpen = () => scrollEl().classList.contains("open");

// Unrolls the scroll with whatever is written on it. Resolves when it's open.
export function openScroll() {
  scrollEl().classList.add("instant");
  setState("rolled");
  void scrollEl().offsetWidth;
  scrollEl().classList.remove("instant");
  setState("open");
  return new Promise((resolve) => setTimeout(resolve, UNROLL * 1000));
}

// Rolls it back up and puts it away. Resolves when it's gone.
export function closeScroll() {
  setState("rolled");
  return new Promise((resolve) => setTimeout(() => {
    hideScroll();
    resolve();
  }, UNROLL * 1000));
}

// Notes written in the scroll's space instead of a scroll, at given spots
// (in game pixels), e.g. a line above each door in the boss room.
// notes: [{ x, width, text }]. Called with nothing, it clears them.
export function setScrollNotes(notes = []) {
  const box = document.getElementById("scroll-notes");
  box.replaceChildren(...notes.map(({ x, width, text }) => {
    const note = document.createElement("p");
    note.textContent = text;
    note.style.left = `calc(${x - width / 2} * var(--gp))`;
    note.style.width = `calc(${width} * var(--gp))`;
    return note;
  }));
}
