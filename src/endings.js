import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BALANCE } from "./balance.js";
import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement, setupDash } from "./player.js";
import { newRun, depthLabel, depthData, unlockedDepths, chosenDepth } from "./dungeon.js";
import { getSave, seeUnderworld, chooseDepth } from "./save.js";
import { heroStats } from "./stats.js";
import { setupInteractions } from "./interact.js";
import { fallIn, climbLadder, giveControl, LAND_X } from "./cutscenes.js";
import { addFader, fadeIn, sleep, addRedLight } from "./effects.js";
import { addLadder, addShadowText, addSign, addAltar } from "./props.js";
import { openTree, canBuyAnything } from "./tree.js";
import { playSound } from "./sound.js";
import { hidePrompt, showRoomName } from "./panel.js";
import { shortGold } from "./hud.js";

// Every run ends in the underworld (DESIGN.md section 9): dragged down when
// the clock ran out or the last heart went, or down the well after beating
// the boss. The run's results are written on the floor, the altar in the
// middle opens the skill tree (tree.js), and two ladders up the back wall
// lead to the next run and back to the menu. Once a second depth is open, a
// signpost beside the first ladder says which depth the next run goes to,
// and using it switches to the next one.
//   ending  "died", "time" or "boss"; or "visit" when he came down the
//           title room's well, with no run behind him (run is null)
export function registerEndScenes() {
  scene("underworld", (run, { ending }) => underworld(run, ending));
}

const LADDERS = [
  { x: 96, label: "TRY AGAIN", prompt: "Try again", go: () => go("room", newRun()) },
  { x: 224, label: "MENU", prompt: "Back to the menu", go: () => go("title", { from: "below" }) },
];
// On a visit there's nothing to try again: the same ladder starts a run.
const PLAY_LADDER = { label: "PLAY", prompt: "Start a run" };

const ALTAR_Y = 158;  // the altar's foot, below the results
const LAND_Y = 176;   // he lands in front of it, already at it

const savedStats = () => heroStats(getSave().levels); // the hero as the tree has made him

function underworld(run, ending) {
  buildRoom();
  makeUnderworld();
  seeUnderworld(); // from now on, the title room has its well

  const ladders = LADDERS.map((ladder, i) => {
    const shown = run || i > 0 ? ladder : { ...ladder, ...PLAY_LADDER };
    const built = addLadder(shown.x);
    addSign([{ text: shown.label }], shown.x - 1.5, 7); // over the ladder's top, so it doesn't run through the letters
    return { ...shown, ...built };
  });
  const altar = addAltar(LAND_X, ALTAR_Y);
  altar.setLit(canBuyAnything());
  const signpost = unlockedDepths() > 1 ? addDepthSignpost() : null;

  const player = addPlayer(LAND_X, LAND_Y);
  if (ending === "died") player.use(color(255, 110, 110)); // still red, down here
  setupPlayerMovement(player);
  setupDash(player, savedStats); // works (and gets faster) as soon as it's bought at the altar
  const fader = addFader();
  let total = null; // the TOTAL line of the results, kept up to date as gold is spent

  const climb = ladders.map((ladder) => ({
    zone: ladder.zone,
    prompt: [ladder.prompt],
    use: async () => {
      await climbLadder(player, ladder, fader);
      ladder.go();
      return true; // he left the room
    },
  }));
  // The altar: the skill tree opens over the room, and he waits while it's
  // open (the interaction stays busy until it's closed).
  const pray = {
    zone: altar.zone,
    prompt: ["Open the skill tree"],
    use: () => new Promise((done) => {
      player.frozen = true;
      player.play("idle");
      openTree(() => {
        player.frozen = false;
        altar.setLit(canBuyAnything());
        total?.setText(`TOTAL ${shortGold(getSave().gold)}`);
        done(false); // still in the room
      });
    }),
  };
  // The signpost: the next depth that's open (round to the first again).
  const pick = signpost && {
    zone: signpost.zone,
    prompt: ["Pick the depth"],
    use: () => {
      chooseDepth((chosenDepth() % unlockedDepths()) + 1);
      signpost.show();
      playSound("lever");
      return false; // still in the room
    },
  };
  const interactions = setupInteractions(
    player,
    [pray, ...climb, ...(pick ? [pick] : [])],
    () => (pick ? "Use the altar, pick a depth at the signpost, or climb a ladder." : "Use the altar to spend your gold, or climb a ladder."),
  );

  hidePrompt();
  showRoomName("The underworld");

  (async () => {
    fadeIn(fader, 0.3);
    await fallIn(player, vec2(LAND_X, LAND_Y));
    if (run) total = await writeResults(run, ending);
    giveControl(player);
    interactions.enable();
  })();
}

// The run's results, written on the floor one line after another, like the
// title: how it ended, the gold it earned and what's banked now, how deep it
// got (1-4 is depth 1, room 4) and how many monsters fell. (Nothing on a
// visit: there was no run.) Returns the TOTAL line, so it can follow the
// gold spent at the altar.
const ENDINGS = {
  died: { text: "YOU DIED", color: [230, 72, 46] },
  time: { text: "OUT OF TIME", color: [255, 205, 70] },
  boss: { text: "DEPTH CLEARED", color: [99, 199, 77] },
};
async function writeResults(run, ending) {
  const reached = ending === "boss" ? run.deepest : Math.min(Math.floor(run.deepest) + 1, 10);
  const lines = [
    { text: ENDINGS[ending].text, size: 16, color: ENDINGS[ending].color },
    { text: `GOLD EARNED ${shortGold(run.gold)}`, color: [255, 205, 70] },
    { text: `TOTAL ${shortGold(getSave().gold)}` },
    { text: `DEEPEST ${depthLabel(run.depth, reached)}` },
    { text: `KILLS ${run.kills}${run.material ? `  ${BALANCE.depths[run.depth - 1].material.toUpperCase()} ${run.material}` : ""}` },
    // The first time a depth's boss falls, the next depth opens.
    ...(run.unlocked ? [{ text: `DEPTH ${run.depth + 1} UNLOCKED`, color: [99, 199, 77] }] : []),
  ];
  // Between the lava basins on the back wall and the altar.
  let y = TOP + 3 * TILE + 6;
  let total = null;
  for (const { text, size = 8, color: rgb = [240, 230, 210] } of lines) {
    const line = addShadowText(text, GAME_WIDTH / 2, y, size, rgb, 3);
    if (text.startsWith("TOTAL")) total = line;
    playSound("letter");
    y += size === 16 ? 18 : 10;
    await sleep(0.18);
  }
  return total;
}

// The signpost beside the TRY AGAIN ladder: a board on a post, saying which
// depth the next run goes to. show() writes it again after a switch.
// Returns { zone, show }.
function addDepthSignpost() {
  const x = 40;
  const foot = TOP + 4 * TILE + 4; // the post's foot, on the floor
  add([rect(4, 16), pos(x - 2, foot - 16), color(24, 20, 37), z(2)]);
  add([rect(2, 15), pos(x - 1, foot - 16), color(92, 52, 30), z(2)]);
  let board = null;
  const show = () => {
    board?.destroy();
    const depth = chosenDepth();
    board = addSign([{ text: `DEPTH ${depth}`, color: [255, 205, 70] }, { text: depthData(depth).name }], x, foot - 24, { depth: 3 });
  };
  show();
  const zone = add([pos(x - 12, foot - 4), area({ shape: new Rect(vec2(0), 24, 14) })]);
  return { zone, show };
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
