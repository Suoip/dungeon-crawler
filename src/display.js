import { GAME_WIDTH, GAME_HEIGHT, STAGE_HEIGHT } from "./config.js";

// Kaplay draws the game at its real size, 320x208. Above it sit the question
// scroll and the strip (HTML, see index.html), and together they make the
// stage: one picture, 320x276 game pixels. This blows the whole stage up to
// fill its box on the page, by a whole number (2x, 3x, 4x...) where it can.
// At an uneven scale like 2.7x, some game pixels become 3 screen pixels wide
// and others 2, which makes lines look uneven. Whole numbers keep every pixel
// the same size.
//
// But rounding down can waste a lot of space: in a window where 1.5x fits,
// a whole number means 1x, a third smaller. So we only round down when it
// keeps most of the size, and otherwise fill the space like before.
//
// devicePixelRatio is how many real screen pixels make up one CSS pixel (it's
// 2 or 3 on most phones, and 1.25 or 1.5 on many laptops). We count in real
// screen pixels so the scale is whole on the actual screen, not just in CSS.
//
// On sharp screens (2 or more real pixels per CSS pixel, like phones), an
// uneven scale makes some game pixels one tiny real pixel wider than others,
// which you can't see. There, space matters more (a phone's screen is small),
// so we only round down when it costs almost nothing.
const KEEP_AT_LEAST = 0.85;       // round down only if the game keeps 85% of its size
const KEEP_AT_LEAST_SHARP = 0.97; // on sharp screens, only if it keeps 97%

// How many CSS pixels one game pixel is right now. The HTML parts of the
// stage are sized with it (the --gp CSS variable).
let gamePixel = 1;
export const getGamePixel = () => gamePixel;

const resizeListeners = [];
export const onStageResize = (listener) => resizeListeners.push(listener);

export function scaleToFit(stage, canvas, box) {
  function fit() {
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = box.getBoundingClientRect();
    const fits = Math.min((width * ratio) / GAME_WIDTH, (height * ratio) / STAGE_HEIGHT);

    const whole = Math.floor(fits);
    const keep = ratio >= 2 ? KEEP_AT_LEAST_SHARP : KEEP_AT_LEAST;
    const scale = whole >= 1 && whole / fits >= keep ? whole : fits;
    gamePixel = scale / ratio;
    stage.style.setProperty("--gp", `${gamePixel}px`);
    canvas.style.width = `${GAME_WIDTH * gamePixel}px`;
    canvas.style.height = `${GAME_HEIGHT * gamePixel}px`;
    resizeListeners.forEach((listener) => listener());
  }

  fit();
  new ResizeObserver(fit).observe(box);       // the box changed size
  window.addEventListener("resize", fit);     // or the browser zoom changed
}
