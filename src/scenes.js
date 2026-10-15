import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement } from "./player.js";
import { addDoors, doorAt, highlightDoor, openDoor } from "./doors.js";
import { currentRoom, newRun } from "./dungeon.js";
import {
  showQuestion, showMessage, setDoorPrompt, hidePrompt, showGameOver, showVictory,
} from "./panel.js";

// ---------------------------------------------------------------------------
// Helpers for cutscenes
// ---------------------------------------------------------------------------

// Kaplay's wait() and tween() take a callback for "when it's done". Wrapping
// them in Promises lets cutscenes use await, so they read top to bottom:
// "open the door, then walk in, then fade out".
const sleep = (seconds) => new Promise((resolve) => wait(seconds, resolve));

function animate(from, to, seconds, setValue, easing = easings.linear) {
  return new Promise((resolve) => tween(from, to, seconds, setValue, easing).onEnd(resolve));
}

// A black rectangle over the whole game. Changing its opacity fades the
// screen in and out.
function addFader(startOpacity = 1) {
  return add([
    rect(GAME_WIDTH, GAME_HEIGHT),
    pos(0, 0),
    color(0, 0, 0),
    opacity(startOpacity),
    z(100), // drawn on top of everything
  ]);
}

const fadeIn = (fader, seconds = 0.4) => animate(fader.opacity, 0, seconds, (v) => (fader.opacity = v));
const fadeOut = (fader, seconds = 0.4, to = 1) => animate(fader.opacity, to, seconds, (v) => (fader.opacity = v));

const startNewRun = (run) => go("room", newRun(run.dungeon));

// ---------------------------------------------------------------------------
// Walking through a door
// ---------------------------------------------------------------------------

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
// Scenes
// ---------------------------------------------------------------------------

export function registerScenes() {
  // One question room. `run` is the current attempt (see dungeon.js).
  scene("room", (run) => {
    const room = currentRoom(run);
    buildRoom();
    const doors = addDoors(room.answers.length);
    const player = addPlayer(GAME_WIDTH / 2, GAME_HEIGHT - 3 * TILE);
    setupPlayerMovement(player);
    const fader = addFader();

    showQuestion(run, room);
    fadeIn(fader);

    let activeDoor = null;
    let choosing = false;

    async function chooseDoor() {
      if (!activeDoor || choosing) return;
      choosing = true;
      hidePrompt();

      const chosen = room.answers[activeDoor.index];
      await walkThroughDoor(player, activeDoor, fader);

      if (!chosen.correct) {
        go("trap", { run, room, chosen });
      } else if (run.index + 1 < run.rooms.length) {
        run.index++;
        go("room", run);
      } else {
        go("victory", run);
      }
    }

    setDoorPrompt(null, chooseDoor);
    onKeyPress("e", chooseDoor);
    onKeyPress("space", chooseDoor);

    // Every frame: which door is he standing at? Only update the panel when
    // that changes, not 60 times a second.
    onUpdate(() => {
      if (choosing) return;
      const door = doorAt(player, doors);
      highlightDoor(doors, door);
      if (door !== activeDoor) {
        activeDoor = door;
        setDoorPrompt(door, chooseDoor);
      }
    });
  });

  // The wrong door: the knight drops into a room full of spikes.
  scene("trap", ({ run, room, chosen }) => {
    hidePrompt();
    const spikes = buildRoom({ spikes: true });
    const fader = addFader();
    const flash = add([rect(GAME_WIDTH, GAME_HEIGHT), color(200, 30, 30), opacity(0), z(90)]);

    const player = addPlayer(GAME_WIDTH / 2, -4); // starts just above the screen
    player.unuse("body"); // so the top wall doesn't catch him on the way down
    player.frozen = true;

    (async () => {
      await fadeIn(fader, 0.3);

      // Fall. easeInQuad starts slow and speeds up, like gravity.
      await animate(player.pos.y, 130, 0.55, (y) => (player.pos.y = y), easings.easeInQuad);

      // Spikes shoot up, he gets hit.
      spikes.forEach((spike) => spike.play("up"));
      player.play("hit");
      player.use(color(255, 90, 90));
      shake(6);
      flash.opacity = 0.5;
      animate(0.5, 0, 0.5, (v) => (flash.opacity = v));

      await sleep(0.5);
      await animate(0, 90, 0.25, (angle) => (player.angle = angle)); // tips over
      await sleep(0.7);

      // Dim the scene (not all the way to black) and show the game over card.
      await fadeOut(fader, 0.5, 0.6);
      showGameOver(run, room, chosen, () => startNewRun(run));
    })();
  });

  // Every question answered.
  scene("victory", (run) => {
    hidePrompt();
    showMessage("You escaped the dungeon!");
    buildRoom();
    const player = addPlayer(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30);
    player.frozen = true;
    const fader = addFader();

    (async () => {
      await fadeIn(fader);
      showVictory(run, () => startNewRun(run));
    })();
  });
}
