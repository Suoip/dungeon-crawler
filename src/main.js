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
import { registerMenuScenes, MENU_PANELS } from "./menu.js";
import { showMessage, lockPanelHeight } from "./panel.js";
import { scaleToFit } from "./display.js";
import { unlockAudioOnFirstInput } from "./sound.js";

// The art is tiny, so the game is drawn at a small resolution (320x208) and
// display.js scales it up by a whole number to fill its box on the page.
const gameBox = document.getElementById("game");
kaplay({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  root: gameBox,     // draw inside this element, under the panel
  pixelDensity: 1,   // draw exactly 320x208 pixels; display.js does the scaling
  crisp: true,       // no smoothing, so pixels stay sharp when scaled up
  background: BACKGROUND,
});
scaleToFit(document.querySelector("#game canvas"), gameBox);

loadAssets();
unlockAudioOnFirstInput();

try {
  const dungeon = await loadDungeon(DUNGEON_URL);
  registerRoomScene();
  registerMenuScenes(dungeon);
  lockPanelHeight(dungeon, MENU_PANELS); // so the game doesn't resize every time the panel changes
  onLoad(() => go("title"));
} catch (error) {
  showMessage(`Something went wrong loading the dungeon: ${error.message}`);
  console.error(error);
}
