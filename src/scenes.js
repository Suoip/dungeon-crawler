import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement } from "./player.js";
import {
  addDoors, letterLabels, revealLabels, doorInteraction, highlightDoor, chainDoor, unchainDoor,
} from "./doors.js";
import { newRun } from "./dungeon.js";
import { setupInteractions } from "./interact.js";
import { fallIn, collapseFloor, walkThroughDoor, giveControl, LAND_X, LAND_Y } from "./cutscenes.js";
import { sleep, animate, addFader, fadeIn, fadeOut, flashScreen } from "./effects.js";
import { mobsForRoom, raiseMob } from "./mobs.js";
import { setupAttack, setupHurt, addHearts } from "./combat.js";
import { playSound } from "./sound.js";
import {
  showQuestion, showSuspense, showCorrect, showMessage, tickTimer,
  showGameOver, showVictory, showDefeated, letterBadge, hidePrompt,
} from "./panel.js";

const afterRun = (run) => ({
  onRetry: () => go("room", newRun(run.dungeon, run.boss)),
  onMenu: () => go("title", { from: "below" }),
});

// One question room. Every room starts the same way: he falls in. What
// happens on landing depends on how he got here:
//   { result: "start" }               first room of a run
//   { result: "correct", answered }   he picked the right door
//   { result: "wrong", answered }     he picked the wrong door: the floor gives way
// `answered` is { room, chosen }: the question he just answered and his pick.
//
// After a safe landing, the question appears and monsters rise from the
// floor. The doors stay chained until every monster is beaten.
export function registerRoomScene() {
  scene("room", (run, arrival = { result: "start" }) => {
    const { result, answered } = arrival;
    const wrong = result === "wrong";

    // The question this room would ask. A wrong-answer room has to look exactly
    // like the real next room until he lands, so it gets the next question's
    // number of doors. After the last question there's no room left to ask,
    // so that room has no doors (right or wrong, so the doors can't give it away).
    const depth = wrong ? run.index + 1 : run.index; // 0 = the first room
    const room = run.rooms[depth];

    const floor = buildRoom();
    const doors = room ? addDoors(letterLabels(room.answers.length), { hidden: true }) : [];
    doors.forEach(chainDoor);
    const player = addPlayer(LAND_X, LAND_Y);
    setupPlayerMovement(player);
    const fader = addFader();
    const hearts = addHearts(run);
    hearts.update();

    // The fight in this room, shared with mobs.js and combat.js.
    const fight = {
      player,
      alive: 0,      // monsters up and about
      rising: 0,     // monsters still coming out of the floor
      over: false,   // the hero left the room or was defeated
      frozen: false, // monsters stop moving (e.g. after the hero is defeated)
      onSpawn: () => fight.alive++,
      onDeath: () => {
        fight.alive--;
        if (fight.alive === 0 && fight.rising === 0) roomCleared();
      },
    };
    setupAttack(player, fight);
    setupHurt(player, run, hearts, fight, defeated);

    const interactions = setupInteractions(
      player,
      doors.map((door) => ({
        ...doorInteraction(door, null, () => chooseDoor(door)),
        prompt: () => (door.locked ? null : ["Open door ", letterBadge(door.index)]),
        highlight: (isActive) => highlightDoor(door, isActive && !door.locked),
        use: () => {
          if (!door.locked) return chooseDoor(door);
          playSound("locked"); // rattle the chains
          return false;
        },
      })),
      () => (doors.some((door) => door.locked)
        ? "The doors are chained. Defeat the monsters first!"
        : "Walk up to a door and press E to answer."),
    );

    hidePrompt();
    if (answered) showSuspense(run, depth + 1, answered);
    else showQuestion(run, room);
    loop(0.25, () => tickTimer(run)); // keep the clock in the panel moving

    (async () => {
      fadeIn(fader, 0.3);
      await fallIn(player);
      run.startTime ??= performance.now(); // the clock starts on the first landing

      if (wrong) {
        fight.over = true;
        await collapseFloor(floor, player, () => hearts.drain());
        run.endTime = performance.now();
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
        run.endTime = performance.now();
        showMessage("You escaped the dungeon!");
        showVictory(run, afterRun(run));
        return;
      }

      // The question shows right away, so you can think while you fight.
      showQuestion(run, room);
      revealLabels(doors);
      giveControl(player);
      interactions.enable();

      // Monsters rise one after another.
      mobsForRoom(depth + 1, run.rooms.length, run.boss)
        .forEach((type, i) => wait(i * 0.25, () => raiseMob(type, fight)));
    })();

    function roomCleared() {
      playSound("unlock");
      doors.forEach((door, i) => unchainDoor(door, i * 0.1));
      interactions.refresh(); // update the hint: the doors are open now
    }

    async function defeated() {
      fight.over = true;
      fight.frozen = true;
      run.endTime = performance.now();
      player.frozen = true;
      player.opacity = 1;
      player.play("hit");
      player.use(color(255, 90, 90));
      await animate(0, 90, 0.25, (angle) => (player.angle = angle)); // falls over
      await sleep(0.8);
      await fadeOut(fader, 0.5, 0.6);
      showDefeated(run, depth + 1, afterRun(run));
    }

    async function chooseDoor(door) {
      fight.over = true;
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
