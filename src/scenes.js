import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement } from "./player.js";
import { addDoors, letterLabels, revealLabels, doorInteraction } from "./doors.js";
import { newRun } from "./dungeon.js";
import { setupInteractions } from "./interact.js";
import { fallIn, collapseFloor, walkThroughDoor, giveControl, LAND_X, LAND_Y } from "./cutscenes.js";
import { sleep, addFader, fadeIn, fadeOut, flashScreen } from "./effects.js";
import { playSound } from "./sound.js";
import {
  showQuestion, showSuspense, showCorrect, showMessage,
  showGameOver, showVictory, letterBadge, hidePrompt,
} from "./panel.js";

const afterRun = (run) => ({
  onRetry: () => go("room", newRun(run.dungeon)),
  onMenu: () => go("title", { from: "below" }),
});

// One question room. Every room starts the same way: he falls in. What
// happens on landing depends on how he got here:
//   { result: "start" }               first room of a run
//   { result: "correct", answered }   he picked the right door
//   { result: "wrong", answered }     he picked the wrong door: the floor gives way
// `answered` is { room, chosen }: the question he just answered and his pick.
export function registerRoomScene() {
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
    const doors = room ? addDoors(letterLabels(room.answers.length), { hidden: true }) : [];
    const player = addPlayer(LAND_X, LAND_Y);
    setupPlayerMovement(player);
    const fader = addFader();

    const interactions = setupInteractions(
      player,
      doors.map((door) => doorInteraction(
        door,
        ["Open door ", letterBadge(door.index)],
        () => chooseDoor(door),
      )),
      () => "Walk up to a door to choose your answer.",
    );

    hidePrompt();
    if (answered) showSuspense(run, depth + 1, answered);
    else showQuestion(run, room);

    (async () => {
      fadeIn(fader, 0.3);
      await fallIn(player);

      if (wrong) {
        await collapseFloor(floor, player);
        await fadeOut(fader, 0.5, 0.6); // dim the scene, not all the way to black
        showGameOver(run, answered.room, answered.chosen, afterRun(run));
        return;
      }

      if (answered) {
        showCorrect();
        playSound("correct");
        flashScreen([99, 199, 77], 0.25, 0.5); // a soft green flash, like the red one for a wrong answer
        await sleep(0.6);
      }

      if (!room) {
        showMessage("You escaped the dungeon!");
        showVictory(run, afterRun(run));
        return;
      }

      showQuestion(run, room);
      revealLabels(doors);
      await sleep(0.35); // let the letters finish popping in

      giveControl(player);
      interactions.enable();
    })();

    async function chooseDoor(door) {
      const chosen = room.answers[door.index];
      await walkThroughDoor(player, door, fader);

      if (chosen.correct) {
        run.index++;
        go("room", run, { result: "correct", answered: { room, chosen } });
      } else {
        go("room", run, { result: "wrong", answered: { room, chosen } });
      }
      return true; // he left the room
    }
  });
}
