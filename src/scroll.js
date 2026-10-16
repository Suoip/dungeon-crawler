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

// Draws the scroll once, pixel by pixel, into a small canvas the size of the
// scroll in game pixels, and uses that as the scroll's background picture.
// The browser then scales it up with hard pixel edges, like the game.
export function drawScroll() {
  const width = GAME_WIDTH;
  const height = SCROLL_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const fill = (rgb, x, y, w = 1, h = 1) => {
    ctx.fillStyle = `rgb(${rgb})`;
    ctx.fillRect(x, y, w, h);
  };

  const OUTLINE = [58, 40, 24];

  // The paper, between the two rolls.
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

  // The two rolls: wooden-brown paper cylinders, lit from the left, with a
  // knob sticking out at each end.
  const ROLL = [OUTLINE, [110, 74, 40], [150, 104, 56], [188, 138, 78], [222, 178, 112], [240, 210, 154],
    [214, 166, 98], [178, 128, 70], [142, 98, 54], [110, 74, 40], [84, 56, 30], OUTLINE];
  for (const left of [0, width - ROLL.length]) {
    ROLL.forEach((rgb, i) => {
      const edge = i === 0 || i === ROLL.length - 1;
      fill(rgb, left + i, edge ? 3 : 2, 1, height - (edge ? 6 : 4));
    });
    fill(OUTLINE, left + 1, 1, ROLL.length - 2, 1);           // top of the roll
    fill(OUTLINE, left + 1, height - 2, ROLL.length - 2, 1);  // bottom
    fill([90, 60, 34], left + 4, 0, 4, 1);                    // the knobs
    fill([90, 60, 34], left + 4, height - 1, 4, 1);
  }

  document.getElementById("scroll").style.backgroundImage = `url(${canvas.toDataURL()})`;
}
