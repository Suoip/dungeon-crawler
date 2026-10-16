import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { buildRoom, roomLimits } from "./room.js";
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
  if (!won) makeUnderworld();

  const ladders = LADDERS.map((ladder) => {
    const built = addLadder(ladder.x);
    addSign(ladder.label, ladder.x - 1.5, 7);
    return { ...ladder, ...built };
  });

  const player = addPlayer(LAND_X, LAND_Y);
  if (won) addTreasure(player);
  else player.use(color(255, 110, 110)); // still red, down here
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
    addShadowText(text, GAME_WIDTH / 2, y, size, rgb, 3); // above the coins
    playSound("letter");
    y += size === 16 ? 24 : 14;
    await sleep(0.18);
  }
}

// The treasure room: heaps of gold in all four corners, each with an open
// chest on top, spilling out across the floor toward the middle. The coins
// lie on the floor (z 2, under everyone): walking through them kicks them
// aside with a jingle, and twinkles blink on and off across the gold.
let chests = [];
function addTreasure(player) {
  const middle = vec2(GAME_WIDTH / 2, TOP + 7 * TILE);
  const CORNERS = [vec2(20, TOP + 3 * TILE), vec2(GAME_WIDTH - 20, TOP + 3 * TILE), vec2(20, GAME_HEIGHT - 10), vec2(GAME_WIDTH - 20, GAME_HEIGHT - 10)];
  const limits = roomLimits([6, 4]);
  const coins = [];
  const addCoin = (at) => {
    const spot = vec2(clamp(at.x, limits.left, limits.right), clamp(at.y, limits.top, limits.bottom));
    const spinning = chance(0.06); // a few spin, flashing their shine now and then
    const coin = add([
      // Coins lying still show a gold side (frame 1 is the white shine, and
      // 2 is edge-on, both mid-spin).
      sprite("coin", spinning ? { anim: "spin" } : { frame: choose([0, 0, 0, 3]) }),
      pos(spot), anchor("bot"), z(2 + spot.y / 1000),
    ]);
    if (spinning) coin.animSpeed = rand(0.6, 1.2); // so they don't all spin in step
    coins.push({ coin, vel: vec2(0) });
  };

  for (const corner of CORNERS) {
    // The heap in the corner: coins piled close together.
    for (let i = 0; i < 80; i++) addCoin(corner.add(rand(-1, 1) * rand(0, 15), rand(-1, 1) * rand(0, 9)));
    // Gold spilling out of it in every direction into the room: lots close
    // to the heap, thinning out the further it goes. The four spills meet
    // along the walls and in the middle, but mostly leave the stats clear.
    const sx = corner.x < middle.x ? 1 : -1;
    const sy = corner.y < middle.y ? 1 : -1;
    for (let i = 0; i < 100; i++) {
      const angle = rand(0, Math.PI / 2);
      const reach = 130 * Math.random() ** 1.4;
      const at = corner.add(sx * Math.cos(angle) * reach, sy * Math.sin(angle) * reach * 0.75);
      const onStats = at.x > 90 && at.x < 230 && at.y > TOP + 56 && at.y < TOP + 130;
      if (onStats && chance(0.85)) continue;
      addCoin(at);
    }
  }

  // An open chest on top of each heap, spilling the gold.
  chests = CORNERS.map((corner) => {
    const at = corner.add(corner.x < middle.x ? 8 : -8, corner.y < middle.y ? 6 : -2);
    return add([sprite("chest_full_open"), pos(at), anchor("bot"), z(9)]);
  });

  // Walking through the gold kicks it aside.
  let jingledAt = 0;
  onUpdate(() => {
    const moving = !player.frozen && player.getCurAnim()?.name === "run";
    for (const c of coins) {
      if (moving && c.coin.pos.dist(player.pos) < 7) {
        c.vel = c.coin.pos.sub(player.pos).unit().scale(rand(50, 110)).add(rand(-20, 20), rand(-20, 20));
        if (time() - jingledAt > 0.09) {
          playSound("coin");
          jingledAt = time();
        }
      }
      if (c.vel.len() < 1) continue;
      const next = c.coin.pos.add(c.vel.scale(dt()));
      c.coin.pos = vec2(clamp(next.x, limits.left, limits.right), clamp(next.y, limits.top, limits.bottom));
      c.coin.z = 2 + c.coin.pos.y / 1000;
      c.vel = c.vel.scale(Math.pow(0.88, dt() * 60)); // slides to a stop
    }
  });

  // Twinkles: a tiny four-pointed glint on a random coin, now and then.
  loop(0.07, () => {
    const { coin } = choose(coins);
    const glint = add([pos(coin.pos.add(rand(-2, 2), -rand(3, 7))), opacity(1), z(3)]);
    glint.onDraw(() => {
      drawRect({ pos: vec2(-1.5, -0.5), width: 3, height: 1, color: rgb(255, 250, 220), opacity: glint.opacity });
      drawRect({ pos: vec2(-0.5, -1.5), width: 1, height: 3, color: rgb(255, 250, 220), opacity: glint.opacity });
    });
    tween(1, 0, 0.35, (v) => (glint.opacity = v)).onEnd(() => destroy(glint));
  });
}

// As he lands, the chests swing open, one after another.
function openChests() {
  chests.forEach((chest, i) => wait(0.12 * i, () => {
    chest.play("open");
    playSound("unlock");
  }));
  wait(0.5, () => playSound("correct"));
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
