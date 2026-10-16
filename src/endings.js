import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement, setupDash } from "./player.js";
import { newRun, runTime } from "./dungeon.js";
import { setupInteractions } from "./interact.js";
import { fallIn, climbLadder, giveControl, LAND_X, LAND_Y } from "./cutscenes.js";
import { addFader, fadeIn, sleep, addRedLight } from "./effects.js";
import { addLadder, addShadowText } from "./props.js";
import { setupAttack } from "./combat.js";
import { playSound } from "./sound.js";
import { hideScroll, setScrollNotes } from "./scroll.js";
import { hidePrompt, showRoomName } from "./panel.js";
import { celebrate } from "./scenes.js";

// The two ways a run can end, both of them rooms you walk around in (no
// pop-up screens):
//   won         through the last right door, into the treasure room
//   underworld  dragged down after the monsters took the last heart
// Both write the run's stats on the floor, and have two ladders up the back
// wall: one to try again, one back to the menu.
export function registerEndScenes() {
  scene("won", (run, { answered }) => endRoom(run, { won: true, answered }));
  scene("underworld", (run, { depth }) => endRoom(run, { won: false, depth }));
}

const LADDERS = [
  { x: 96, label: "TRY AGAIN", prompt: "Try again", go: (run) => go("room", newRun(run.dungeon, run.boss)) },
  { x: 224, label: "MENU", prompt: "Back to the menu", go: () => go("title", { from: "below" }) },
];

function endRoom(run, { won, answered, depth }) {
  hideScroll();
  setScrollNotes();
  buildRoom();
  if (won) addTreasure();
  else makeUnderworld();

  const ladders = LADDERS.map((ladder) => {
    const built = addLadder(ladder.x);
    addSign(ladder.label, ladder.x - 1.5, 7);
    return { ...ladder, ...built };
  });

  const player = addPlayer(LAND_X, LAND_Y);
  if (!won) player.use(color(255, 110, 110)); // still red, down here
  setupPlayerMovement(player);
  setupDash(player);
  setupAttack(player); // swing for fun; there's nothing to hit
  const fader = addFader();

  const interactions = setupInteractions(
    player,
    ladders.map((ladder) => ({
      zone: ladder.zone,
      prompt: [ladder.prompt],
      use: async () => {
        await climbLadder(player, ladder, fader);
        ladder.go(run);
        return true; // he left the room
      },
    })),
    () => "Climb a ladder: try again, or go back to the menu.",
  );

  hidePrompt();
  showRoomName(won ? "The treasure room" : "The underworld");

  (async () => {
    fadeIn(fader, 0.3);
    await fallIn(player);
    if (won) openChests();
    // The last question's explanation, if it took more than one try.
    if (answered) await celebrate(run, answered);
    await writeStats(run, won, depth);
    giveControl(player);
    interactions.enable();
  })();
}

// The stats, written on the floor one line after another, like the title.
async function writeStats(run, won, depth) {
  const answered = won ? run.rooms.length : run.index;
  const lines = won
    ? [
      { text: "YOU WON!", size: 16, color: [255, 205, 70] },
      { text: `TIME ${runTime(run)}` },
      { text: `FIRST TRY ${run.firstTry}/${answered}` },
      { text: `HEARTS LEFT ${run.hearts}/${run.maxHearts}` },
    ]
    : [
      { text: "YOU DIED", size: 16, color: [230, 72, 46] },
      { text: `DEPTH ${depth}/${run.rooms.length}` },
      { text: `TIME ${runTime(run)}` },
      { text: `FIRST TRY ${run.firstTry}/${answered}` },
    ];

  let y = TOP + 4 * TILE + 4;
  for (const { text, size = 8, color: rgb = [240, 230, 210] } of lines) {
    addShadowText(text, GAME_WIDTH / 2, y, size, rgb);
    playSound("letter");
    y += size === 16 ? 24 : 14;
    await sleep(0.18);
  }
}

// The treasure room: a chest by each side wall, and piles of gold coins
// around the edges of the floor (clear of the stats, and of where he lands).
let chests = [];
function addTreasure() {
  chests = [[40, 112], [280, 112]].map(([x, y]) =>
    add([sprite("chest_full_open"), pos(x, y), anchor("bot"), z(10 + y / 1000)]));

  const PILES = [[32, 150, 14], [64, 184, 10], [112, 194, 7], [208, 194, 7], [256, 184, 10], [288, 150, 14], [72, 76, 6], [248, 76, 6]];
  for (const [x, y, count] of PILES) {
    for (let i = 0; i < count; i++) {
      // Most coins near the middle of the pile, fewer at its edges.
      const at = vec2(x + rand(-1, 1) * rand(0, 9), y + rand(-1, 1) * rand(0, 4));
      const coin = add([sprite("coin", { anim: "spin" }), pos(at), anchor("bot"), z(10 + at.y / 1000)]);
      coin.animSpeed = rand(0.6, 1.2); // so they don't all spin in step
    }
  }
}

// As he lands, the chests swing open.
function openChests() {
  chests.forEach((chest, i) => wait(0.15 * i, () => {
    chest.play("open");
    playSound("unlock");
  }));
  wait(0.4, () => playSound("correct"));
}

// The underworld: the same kind of room, but dark red, with lava pouring
// out of fountains in the back wall and embers drifting up.
function makeUnderworld() {
  // Everything built so far is the room's floor and walls: tint it red.
  get("*").filter((part) => part.has("sprite")).forEach((part) => part.use(color(190, 100, 96)));
  addRedLight().on();

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

// A sign over a ladder: its label on a small dark wooden board, drawn over
// the ladder's top so the ladder doesn't run through the letters.
function addSign(label, x, y) {
  const width = label.length * 8 + 6;
  add([rect(width + 2, 12), pos(x - width / 2 - 1, y - 6), color(24, 20, 37), z(2)]);
  add([rect(width, 10), pos(x - width / 2, y - 5), color(92, 52, 30), z(2)]);
  add([text(label, { size: 8, font: "pixel" }), pos(x, y + 1), anchor("center"), color(240, 230, 210), z(3)]);
}
