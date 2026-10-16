import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement, setupDash } from "./player.js";
import { newRun, depthLabel } from "./dungeon.js";
import { getSave } from "./save.js";
import { setupInteractions } from "./interact.js";
import { fallIn, climbLadder, giveControl, LAND_X, LAND_Y } from "./cutscenes.js";
import { addFader, fadeIn, sleep, addRedLight } from "./effects.js";
import { addLadder, addShadowText, addSign } from "./props.js";
import { playSound } from "./sound.js";
import { hidePrompt, showRoomName } from "./panel.js";

// Every run ends in the underworld (DESIGN.md section 9): dragged down when
// the clock ran out or the last heart went, or down the well after beating
// the boss. The run's results are written on the floor, and two ladders up
// the back wall lead to the next run and back to the menu. (The skill tree's
// altar comes here in step 4.)
//   ending  "died", "time" or "boss"
export function registerEndScenes() {
  scene("underworld", (run, { ending }) => underworld(run, ending));
}

const LADDERS = [
  { x: 96, label: "TRY AGAIN", prompt: "Try again", go: () => go("room", newRun()) },
  { x: 224, label: "MENU", prompt: "Back to the menu", go: () => go("title", { from: "below" }) },
];

function underworld(run, ending) {
  buildRoom();
  makeUnderworld();

  const ladders = LADDERS.map((ladder) => {
    const built = addLadder(ladder.x);
    addSign([{ text: ladder.label }], ladder.x - 1.5, 7); // over the ladder's top, so it doesn't run through the letters
    return { ...ladder, ...built };
  });

  const player = addPlayer(LAND_X, LAND_Y);
  if (ending === "died") player.use(color(255, 110, 110)); // still red, down here
  setupPlayerMovement(player);
  if (run.stats.unlocked.has("dash")) setupDash(player);
  const fader = addFader();

  const interactions = setupInteractions(
    player,
    ladders.map((ladder) => ({
      zone: ladder.zone,
      prompt: [ladder.prompt],
      use: async () => {
        await climbLadder(player, ladder, fader);
        ladder.go();
        return true; // he left the room
      },
    })),
    () => "Climb a ladder: try again, or go back to the menu.",
  );

  hidePrompt();
  showRoomName("The underworld");

  (async () => {
    fadeIn(fader, 0.3);
    await fallIn(player);
    await writeResults(run, ending);
    giveControl(player);
    interactions.enable();
  })();
}

// The run's results, written on the floor one line after another, like the
// title: how it ended, the gold it earned and what's banked now, how deep it
// got (1-4 is depth 1, room 4) and how many monsters fell.
const ENDINGS = {
  died: { text: "YOU DIED", color: [230, 72, 46] },
  time: { text: "OUT OF TIME", color: [255, 205, 70] },
  boss: { text: "DEPTH CLEARED", color: [99, 199, 77] },
};
async function writeResults(run, ending) {
  const reached = ending === "boss" ? run.deepest : Math.min(Math.floor(run.deepest) + 1, 10);
  const lines = [
    { text: ENDINGS[ending].text, size: 16, color: ENDINGS[ending].color },
    { text: `GOLD EARNED ${run.gold}`, color: [255, 205, 70] },
    { text: `TOTAL ${getSave().gold}` },
    { text: `DEEPEST ${depthLabel(reached)}` },
    { text: `KILLS ${run.kills}` },
  ];
  // Between the lava basins on the back wall and where the hero lands.
  let y = TOP + 3 * TILE + 10;
  for (const { text, size = 8, color: rgb = [240, 230, 210] } of lines) {
    addShadowText(text, GAME_WIDTH / 2, y, size, rgb, 3);
    playSound("letter");
    y += size === 16 ? 20 : 11;
    await sleep(0.18);
  }
}

// The underworld: the same kind of room, but dark red, with lava pouring
// out of fountains in the back wall and embers drifting up.
function makeUnderworld() {
  // Everything built so far is the room's floor and walls: tint it red.
  get("*").filter((part) => part.has("sprite")).forEach((part) => part.use(color(190, 100, 96)));
  addRedLight();

  // Fountains in the back wall (columns, left to right), away from the
  // ladders. Their stone gets a lighter red tint than the walls, so the lava
  // still glows.
  const stone = color(230, 150, 140);
  for (const col of [3, 9, 10, 16]) {
    const x = col * TILE;
    add([sprite("wall_fountain_top"), pos(x, TOP), stone]);
    add([sprite("wall_fountain_mid_red", { anim: "flow" }), pos(x, TOP + TILE), stone]);
    add([sprite("wall_fountain_basin_red", { anim: "flow" }), pos(x, TOP + 2 * TILE), stone]);
  }

  // Embers: tiny glowing bits floating up from the floor.
  loop(0.12, () => {
    const ember = add([
      rect(choose([1, 2]), 1),
      pos(rand(8, GAME_WIDTH - 8), rand(TOP + 4 * TILE, GAME_HEIGHT - 6)),
      color(...choose([[247, 150, 23], [255, 205, 70], [230, 72, 46]])),
      opacity(0.9),
      z(12),
    ]);
    const drift = rand(-10, 10);
    const rise = rand(25, 50);
    const start = ember.pos.clone();
    tween(0, 1, rand(1.2, 2), (t) => {
      ember.pos = start.add(drift * t + Math.sin(t * 6) * 2, -rise * t);
      ember.opacity = 0.9 * (1 - t);
    }).onEnd(() => destroy(ember));
  });
}
