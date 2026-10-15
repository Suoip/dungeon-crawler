// The starting point. It sets up Kaplay, loads everything, and starts the
// first room. The real work happens in the other files in src/.
//
// Kaplay puts its functions (add, sprite, pos, ...) on the global window
// object, so the other files can use them without importing anything. They
// only call them inside functions, which run after kaplay() below.

import { GAME_WIDTH, GAME_HEIGHT, BACKGROUND, DUNGEON_URL } from "./config.js";
import { loadAssets } from "./assets.js";
import { loadDungeon, newRun } from "./dungeon.js";
import { registerScenes } from "./scenes.js";
import { showMessage, lockPanelHeight } from "./panel.js";

// The art is tiny, so the game runs at a small "virtual" resolution and Kaplay
// scales it up to fill its box on the page.
kaplay({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  root: document.getElementById("game"), // draw inside this element, under the panel
  stretch: true,     // scale up to fill the box...
  letterbox: true,   // ...but keep the shape (bars if needed)
  crisp: true,       // no smoothing, so pixels stay sharp
  background: BACKGROUND,
});

loadAssets();
registerScenes();

try {
  const dungeon = await loadDungeon(DUNGEON_URL);
  lockPanelHeight(dungeon); // so the game doesn't resize every time the panel changes
  onLoad(() => go("room", newRun(dungeon)));
} catch (error) {
  showMessage(`Something went wrong loading the dungeon: ${error.message}`);
  console.error(error);
}
