import { TILE, TOP, GAME_HEIGHT } from "./config.js";
import { buildRoom, addPit, tileAt } from "./room.js";
import { addPlayer, setupPlayerMovement } from "./player.js";
import { addDoors, doorAt, highlightDoor, openDoor, revealLetters } from "./doors.js";
import { newRun } from "./dungeon.js";
import { sleep, animate, addFader, fadeIn, fadeOut, flashScreen, puffDust } from "./effects.js";
import {
  showQuestion, showSuspense, showCorrect, showMessage,
  setDoorPrompt, hidePrompt, showGameOver, showVictory,
} from "./panel.js";

// Every room is one level deeper: the knight drops in from above and lands
// here, in the middle of the floor.
const LAND_X = 10 * TILE;               // 160 px, the middle
const LAND_Y = GAME_HEIGHT - 3 * TILE;  // 160 px, a bit below the middle
const FALL_SECONDS = 0.6;

const startNewRun = (run) => go("room", newRun(run.dungeon));

// ---------------------------------------------------------------------------
// Cutscenes
// ---------------------------------------------------------------------------

// Drops the knight from above the screen onto the floor. A shadow on the floor
// grows as he gets closer, so you can see where he'll land.
async function fallIn(player) {
  const shadow = add([
    circle(7),
    pos(LAND_X, LAND_Y - 1),
    anchor("center"),
    color(0, 0, 0),
    opacity(0),
    scale(0),
    z(5), // on the floor, under the knight
  ]);

  // easeInQuad starts slow and speeds up, like gravity. The shadow uses the
  // same easing so it grows in step with the fall.
  await Promise.all([
    animate(player.pos.y, LAND_Y, FALL_SECONDS, (y) => (player.pos.y = y), easings.easeInQuad),
    animate(0, 1, FALL_SECONDS, (t) => {
      shadow.scale = vec2(lerp(0.3, 1, t), lerp(0.12, 0.4, t)); // a flat oval
      shadow.opacity = lerp(0.1, 0.45, t);
    }, easings.easeInQuad),
  ]);

  // Thud: squash him flat and wide, then let him spring back to normal.
  shake(2);
  puffDust(LAND_X, LAND_Y);
  animate(shadow.opacity, 0, 0.2, (v) => (shadow.opacity = v)).then(() => destroy(shadow));
  await animate(0, 1, 0.2, (t) => {
    player.scale = vec2(lerp(1.4, 1, t), lerp(0.6, 1, t));
  }, easings.easeOutBack);
}

// The wrong answer: the floor cracks under him, crumbles into a spike pit, and
// he drops in.
async function collapseFloor(floor, player) {
  // A pit 4 tiles wide and 3 tall around where he landed. It's built under
  // the floor right away, but stays hidden until the floor tiles fall away.
  const landed = tileAt(LAND_X, LAND_Y);
  const pit = { left: landed.col - 2, top: landed.row - 1, cols: 4, rows: 3 };
  const spikes = addPit(pit.left, pit.top, pit.cols, pit.rows);

  // List the floor tiles over the pit, nearest to his feet first, so the
  // cracks spread outwards from where he hit the ground.
  const tiles = [];
  for (let col = pit.left; col < pit.left + pit.cols; col++) {
    for (let row = pit.top; row < pit.top + pit.rows; row++) {
      const distance = Math.hypot(col + 0.5 - LAND_X / TILE, row + 0.5 - (LAND_Y - TOP) / TILE);
      tiles.push({ tile: floor.get(`${col},${row}`), distance });
    }
  }
  tiles.sort((a, b) => a.distance - b.distance);

  await sleep(0.4); // a moment where it looks like he made it...

  // Crack! The cracks spread outwards, and each cracked tile goes darker.
  shake(3);
  for (const { tile } of tiles) {
    tile.use(sprite(choose(["floor_2", "floor_4"]))); // the cracked floor tiles
    tile.use(color(150, 140, 150));
    await sleep(0.04);
  }

  // The cracked tiles tremble for a moment before they give way.
  const home = tiles.map(({ tile }) => tile.pos.clone());
  const tremble = onUpdate(() => {
    tiles.forEach(({ tile }, i) => (tile.pos = home[i].add(randi(-1, 2), randi(-1, 2))));
  });
  await sleep(0.45);
  tremble.cancel();

  // Crumble: each tile sinks and fades, at slightly different times.
  shake(5);
  puffDust(LAND_X, LAND_Y, 14, 26);
  tiles.forEach(({ tile }, i) => {
    tile.pos = home[i];
    tile.use(opacity(1));
    const startY = tile.pos.y;
    wait(rand(0, 0.12), () => {
      animate(0, 1, 0.3, (t) => {
        tile.pos.y = startY + 8 * t;
        tile.opacity = 1 - t;
      }, easings.easeInQuad).then(() => destroy(tile));
    });
  });
  await sleep(0.2);

  // He drops into the pit, and the spikes shoot up.
  await animate(player.pos.y, player.pos.y + 10, 0.18, (y) => (player.pos.y = y), easings.easeInQuad);
  spikes.forEach((spike) => spike.play("up"));
  player.play("hit");
  player.use(color(255, 90, 90));
  shake(6);
  flashScreen([200, 30, 30]);

  await sleep(0.5);
  await animate(0, 90, 0.25, (angle) => (player.angle = angle)); // tips over
  await sleep(0.7);
}

async function walkThroughDoor(player, door, fader) {
  player.frozen = true;  // the keyboard stops moving him
  player.unuse("body");  // and walls stop blocking him, so he can step into the doorway
  openDoor(door);
  player.play("run");

  // Line up with the middle of the door, then step in while fading away.
  await animate(player.pos.x, door.centerX, 0.15, (x) => (player.pos.x = x));
  await Promise.all([
    animate(player.pos.y, TOP + 2 * TILE - 4, 0.5, (y) => (player.pos.y = y)),
    animate(1, 0, 0.5, (v) => (player.opacity = v)),
  ]);
  await fadeOut(fader);
}

// ---------------------------------------------------------------------------
// The room scene
// ---------------------------------------------------------------------------

export function registerScenes() {
  // Every room starts the same way: he falls in. What happens on landing
  // depends on how he got here:
  //   { result: "start" }               first room of a run
  //   { result: "correct", answered }   he picked the right door
  //   { result: "wrong", answered }     he picked the wrong door: the floor gives way
  // `answered` is { room, chosen }: the question he just answered and his pick.
  scene("room", (run, arrival = { result: "start" }) => {
    const { result, answered } = arrival;
    const wrong = result === "wrong";

    // The question this room would ask. A wrong-answer room has to look exactly
    // like the real next room until he lands, so it gets the next question's
    // number of doors. After the last question there's no room left to ask,
    // so that room has no doors (right or wrong, so the doors can't give it away).
    const depth = wrong ? run.index + 1 : run.index;
    const room = run.rooms[depth];

    const floor = buildRoom();
    const doors = room ? addDoors(room.answers.length) : [];
    const player = addPlayer(LAND_X, -4); // just above the top of the screen
    player.unuse("body"); // so the top wall doesn't catch him on the way down
    player.frozen = true;
    setupPlayerMovement(player);
    const fader = addFader();

    hidePrompt();
    if (answered) showSuspense(run, depth + 1, answered);
    else showQuestion(run, room);

    let ready = false; // true once he has landed and you can move
    let activeDoor = null;
    let choosing = false;

    (async () => {
      fadeIn(fader, 0.3);
      await fallIn(player);

      if (wrong) {
        await collapseFloor(floor, player);
        await fadeOut(fader, 0.5, 0.6); // dim the scene, not all the way to black
        showGameOver(run, answered.room, answered.chosen, () => startNewRun(run));
        return;
      }

      if (answered) {
        showCorrect();
        await sleep(0.6);
      }

      if (!room) {
        showMessage("You escaped the dungeon!");
        showVictory(run, () => startNewRun(run));
        return;
      }

      showQuestion(run, room);
      revealLetters(doors);
      await sleep(0.35); // let the letters finish popping in

      player.use(body());
      player.frozen = false;
      ready = true;
      setDoorPrompt(null, chooseDoor);
    })();

    async function chooseDoor() {
      if (!ready || !activeDoor || choosing) return;
      choosing = true;
      hidePrompt();

      const chosen = room.answers[activeDoor.index];
      await walkThroughDoor(player, activeDoor, fader);

      if (chosen.correct) {
        run.index++;
        go("room", run, { result: "correct", answered: { room, chosen } });
      } else {
        go("room", run, { result: "wrong", answered: { room, chosen } });
      }
    }

    onKeyPress("e", chooseDoor);
    onKeyPress("space", chooseDoor);

    // Every frame: which door is he standing at? Only update the panel when
    // that changes, not 60 times a second.
    onUpdate(() => {
      if (!ready || choosing) return;
      const door = doorAt(player, doors);
      highlightDoor(doors, door);
      if (door !== activeDoor) {
        activeDoor = door;
        setDoorPrompt(door, chooseDoor);
      }
    });
  });
}
