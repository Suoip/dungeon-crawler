import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement } from "./player.js";
import {
  addDoors, letterLabels, revealLabels, doorInteraction, highlightDoor, chainDoor, unchainDoor,
  rattleDoor, crossOutDoor,
} from "./doors.js";
import { newRun, pauseClock, resumeClock } from "./dungeon.js";
import { setupInteractions } from "./interact.js";
import { fallIn, crackFloor, walkThroughDoor, giveControl, LAND_X, LAND_Y } from "./cutscenes.js";
import {
  sleep, animate, addFader, fadeIn, fadeOut, flashScreen, shakeScreen, addRedLight, showBanner,
} from "./effects.js";
import { wavesForRoom, cursedWaves, startWaves } from "./mobs.js";
import { setupAttack, setupHurt, addHearts } from "./combat.js";
import { playSound } from "./sound.js";
import {
  showQuestion, showCorrect, showMessage, showExplanation, crossOutAnswer, tickTimer,
  showVictory, showDefeated, letterBadge, hidePrompt,
} from "./panel.js";

const afterRun = (run) => ({
  onRetry: () => go("room", newRun(run.dungeon, run.boss)),
  onMenu: () => go("title", { from: "below" }),
});

// One question room. Every room starts the same way: he falls in.
//   { result: "start" }               first room of a run
//   { result: "correct", answered }   he picked the right door in the room above
// `answered` is { room, mistakes }: the question he just answered, and how
// many wrong doors he tried first.
//
// After landing, the question appears and waves of monsters rise from the
// floor. The doors stay chained until every wave is beaten. A wrong door
// doesn't open: it's crossed out, the chains go back on, and cursed waves
// crawl out of cracks in the floor. Then he picks again from what's left.
export function registerRoomScene() {
  scene("room", (run, arrival = { result: "start" }) => {
    const { answered } = arrival;
    const depth = run.index; // 0 = the first room
    // After the last question there's no room left to ask, so that room has
    // no doors: it's the way out.
    const room = run.rooms[depth];
    let mistakes = 0; // wrong doors tried in this room

    const floor = buildRoom();
    const doors = room ? addDoors(letterLabels(room.answers.length), { hidden: true }) : [];
    doors.forEach((door) => chainDoor(door));
    const player = addPlayer(LAND_X, LAND_Y);
    setupPlayerMovement(player);
    const fader = addFader();
    const redLight = addRedLight();
    const hearts = addHearts(run);
    hearts.update();

    // The fight in this room, shared with mobs.js and combat.js.
    const fight = {
      player,
      alive: 0,      // monsters up and about
      rising: 0,     // monsters still coming out of the floor
      waiting: 0,    // waves that haven't started yet
      over: false,   // the hero left the room or was defeated
      frozen: false, // monsters stop moving (e.g. after the hero is defeated)
      onSpawn: () => fight.alive++,
      onDeath: () => {
        fight.alive--;
        if (fight.alive === 0 && fight.rising === 0 && fight.waiting === 0) roomCleared();
      },
      onWave: (number, total, cursed) => showBanner(
        `${cursed ? "CURSED WAVE" : "WAVE"} ${number}/${total}`,
        cursed ? [230, 72, 46] : [255, 255, 255],
      ),
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
      () => (doors.some((door) => door.locked && !door.wrong)
        ? "The doors are chained. Defeat the monsters first!"
        : "Walk up to a door and press E to answer."),
    );

    hidePrompt();
    if (answered) showCorrect(run, depth + 1);
    else showQuestion(run, room);
    loop(0.25, () => tickTimer(run)); // keep the clock in the panel moving

    (async () => {
      fadeIn(fader, 0.3);
      await fallIn(player);
      run.startTime ??= performance.now(); // the clock starts on the first landing

      if (answered) {
        playSound("correct");
        flashScreen([99, 199, 77], 0.25, 0.5); // a soft green flash
        await sleep(0.6);
        // If it took more than one try, show why that's the answer. The
        // clock stops while they read.
        if (answered.mistakes > 0) {
          pauseClock(run);
          await showExplanation(answered.room);
          resumeClock(run);
        }
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
      startWaves(wavesForRoom(depth + 1, run.rooms.length, run.boss), fight);
    })();

    function roomCleared() {
      playSound("unlock");
      redLight.off();
      doors.filter((door) => !door.wrong).forEach((door, i) => unchainDoor(door, i * 0.1));
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
      const chosen = room.answers[door.index];
      if (!chosen.correct) {
        await wrongDoor(door);
        return false; // he's still in the room
      }

      fight.over = true;
      if (mistakes === 0) run.firstTry++;
      await walkThroughDoor(player, door, fader);
      run.index++;
      go("room", run, { result: "correct", answered: { room, mistakes } });
      return true; // he left the room
    }

    // The door won't open. The chains slam back onto every door, that answer
    // is crossed out, and the floor cracks open to let the cursed waves out.
    async function wrongDoor(door) {
      mistakes++;
      player.frozen = true;
      playSound("wrong");
      flashScreen([200, 30, 30], 0.3, 0.4);
      await rattleDoor(door);

      crossOutDoor(door);
      crossOutAnswer(door.index);
      doors.filter((other) => !other.locked).forEach((other) => chainDoor(other, { slam: true }));
      await sleep(0.18);
      playSound("locked");
      shakeScreen(3);
      player.frozen = false;
      interactions.refresh();

      // These run on their own, so he can move while the floor cracks.
      (async () => {
        redLight.on();
        const spots = await crackFloor(floor, player);
        startWaves(cursedWaves(depth + 1, run.rooms.length), fight, { cursed: true, spots });
      })();
    }
  });
}
