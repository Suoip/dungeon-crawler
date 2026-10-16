// The starting point. It sets up Kaplay, loads everything, and opens the
// title room. The real work happens in the other files in src/.
//
// Kaplay puts its functions (add, sprite, pos, ...) on the global window
// object, so the other files can use them without importing anything. They
// only call them inside functions, which run after kaplay() below.

import { GAME_WIDTH, GAME_HEIGHT, BACKGROUND, DUNGEON_URL } from "./config.js";
import { loadAssets } from "./assets.js";
import { loadDungeon } from "./dungeon.js";
import { registerRoomScene } from "./scenes.js";
import { registerMenuScenes } from "./menu.js";
import { showMessage, fitsOnScroll } from "./panel.js";
import { scaleToFit } from "./display.js";
import { drawScroll, fitScrollText } from "./scroll.js";
import { unlockAudioOnFirstInput } from "./sound.js";
import { setupTouchControls } from "./touch.js";

// The art is tiny, so the game is drawn at a small resolution (320x208) and
// display.js scales it up (with the scroll above it) to fill its box on the
// page.
const gameBox = document.getElementById("game");
const stage = document.getElementById("stage");
kaplay({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  root: stage,       // draw inside the stage, under the scroll
  pixelDensity: 1,   // draw exactly 320x208 pixels; display.js does the scaling
  crisp: true,       // no smoothing, so pixels stay sharp when scaled up
  background: BACKGROUND,
  // Named buttons, so the game asks "is attack pressed?" instead of "is
  // Space pressed?". The touch controls press the same buttons (touch.js).
  buttons: {
    up: { keyboard: ["w", "up"] },
    down: { keyboard: ["s", "down"] },
    left: { keyboard: ["a", "left"] },
    right: { keyboard: ["d", "right"] },
    attack: { keyboard: ["space"] },
    dash: { keyboard: ["shift"] },
    use: { keyboard: ["e"] },
  },
});
drawScroll();
scaleToFit(stage, document.querySelector("#game canvas"), gameBox);

loadAssets();
unlockAudioOnFirstInput();
setupTouchControls();

try {
  const dungeon = await loadDungeon(DUNGEON_URL);
  // The scroll's text is measured in the game's own font, so wait for it.
  await Promise.all([document.fonts.load('400 12px "Atkinson Hyperlegible"'), document.fonts.load('700 12px "Atkinson Hyperlegible"')]);
  checkDungeonFits(dungeon);
  registerRoomScene();
  registerMenuScenes(dungeon);
  onLoad(() => go("title"));
} catch (error) {
  fitScrollText();
  showMessage(`Something went wrong loading the dungeon: ${error.message}`);
  console.error(error);
}

// Every question must fit on the scroll, even with its text at the smallest
// size. A dungeon with a question that's too long doesn't load, and says
// which one, so whoever made it can shorten it. The answers are shuffled
// every run, and a different order can wrap differently, so every order is
// tried (at most 24, for 4 answers).
function checkDungeonFits(dungeon) {
  const orders = (list) => (list.length <= 1 ? [list]
    : list.flatMap((item, i) => orders([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [item, ...rest])));
  dungeon.rooms.forEach((room, i) => {
    if (!orders([room.correct, ...room.wrong]).every((answers) => fitsOnScroll(room.question, answers))) {
      throw new Error(`room ${i + 1}'s question and answers are too long for the scroll ("${room.question.slice(0, 40)}…").`);
    }
  });
}
