// The starting point. It sets up Kaplay, loads everything, and opens the
// title room. The real work happens in the other files in src/.
//
// Kaplay puts its functions (add, sprite, pos, ...) on the global window
// object, so the other files can use them without importing anything. They
// only call them inside functions, which run after kaplay() below.

import { GAME_WIDTH, GAME_HEIGHT, BACKGROUND } from "./config.js";
import { loadAssets } from "./assets.js";
import { registerRoomScene } from "./scenes.js";
import { registerEndScenes } from "./endings.js";
import { registerMenuScenes } from "./menu.js";
import { scaleToFit } from "./display.js";
import { unlockAudioOnFirstInput } from "./sound.js";
import { startForge } from "./crafting.js";

// The art is tiny, so the game is drawn at a small resolution (320x208) and
// display.js scales it up (with the strip above it) to fill its box on the
// page.
const gameBox = document.getElementById("game");
const stage = document.getElementById("stage");
kaplay({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  root: stage,       // draw inside the stage, under the strip
  pixelDensity: 1,   // draw exactly 320x208 pixels; display.js does the scaling
  crisp: true,       // no smoothing, so pixels stay sharp when scaled up
  background: BACKGROUND,
  // Named buttons, so the game asks "is dash pressed?" instead of "is Shift
  // pressed?". The hero swings on his own, so there's no attack button.
  buttons: {
    up: { keyboard: ["w", "up"] },
    down: { keyboard: ["s", "down"] },
    left: { keyboard: ["a", "left"] },
    right: { keyboard: ["d", "right"] },
    dash: { keyboard: ["shift"] },
    use: { keyboard: ["e"] },
  },
});
scaleToFit(stage, document.querySelector("#game canvas"), gameBox);

loadAssets();
unlockAudioOnFirstInput();
startForge(); // the forge works while the game is open, wherever you are
// The game needs a keyboard. On a phone or tablet (its only pointer is a
// finger), a notice over the game says so. A laptop with a touch screen
// still has a mouse or trackpad, so it doesn't get the notice.
const onlyFingers = matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;
document.getElementById("keyboard-notice").hidden = !onlyFingers;

registerRoomScene();
registerEndScenes();
registerMenuScenes();
onLoad(() => go("title"));
