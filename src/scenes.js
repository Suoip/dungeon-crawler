import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement, setupDash } from "./player.js";
import {
  addDoors, letterLabels, revealLabels, doorInteraction, highlightDoor, chainDoor, unchainDoor,
  rattleDoor, crossOutDoor,
} from "./doors.js";
import { pauseClock, resumeClock } from "./dungeon.js";
import { setupInteractions } from "./interact.js";
import { fallIn, crackFloor, walkThroughDoor, giveControl, dragDown, LAND_X, LAND_Y } from "./cutscenes.js";
import {
  sleep, animate, addFader, fadeIn, fadeOut, flashScreen, shakeScreen, addRedLight, showBanner,
} from "./effects.js";
import { wavesForRoom, cursedWaves, startWaves } from "./mobs.js";
import { setupAttack, setupHurt, addHearts, setupHeartDrops } from "./combat.js";
import { playSound } from "./sound.js";
import { useHint } from "./touch.js";
import { hideScroll, openScroll, closeScroll, setScrollNotes } from "./scroll.js";
import { addScrollPickup } from "./props.js";
import {
  showQuestion, showDepth, writeExplanation, showStripMessage, crossOutAnswer, tickTimer,
  letterBadge, hidePrompt, setPrompt,
} from "./panel.js";

// One question room. Every room starts the same way: he falls in.
//   { result: "start" }               first room of a run
//   { result: "correct", answered }   he picked the right door in the room above
// `answered` is { room, mistakes }: the question he just answered, and how
// many wrong doors he tried first.
//
// After landing, waves of monsters rise from the floor, and the doors stay
// chained until every wave is beaten. The last monster drops the room's
// scroll, with the question on it; picking it up opens it. A wrong door
// doesn't open: it's crossed out, the chains go back on, and cursed waves
// crawl out of cracks in the floor. Then he picks again from what's left.
// After the last question, the right door leads out of the dungeon (the
// treasure room, "won" (see endings.js).
export function registerRoomScene() {
  scene("room", (run, arrival = { result: "start" }) => {
    const { answered } = arrival;
    const depth = run.index; // 0 = the first room
    const room = run.rooms[depth];
    let mistakes = 0;        // wrong doors tried in this room
    let scrollFound = false; // the question scroll has been picked up

    hideScroll();
    setScrollNotes();
    const floor = buildRoom();
    const doors = addDoors(letterLabels(room.answers.length), { hidden: true });
    doors.forEach((door) => chainDoor(door));
    const player = addPlayer(LAND_X, LAND_Y);
    setupPlayerMovement(player);
    setupDash(player);
    const fader = addFader();
    const redLight = addRedLight();
    const hearts = addHearts(run);
    hearts.update();
    const maybeDropHeart = setupHeartDrops(run, hearts, player);

    // The fight in this room, shared with mobs.js and combat.js.
    const fight = {
      player,
      alive: 0,      // monsters up and about
      rising: 0,     // monsters still coming out of the floor
      waiting: 0,    // waves that haven't started yet
      over: false,   // the hero left the room or was defeated
      frozen: false, // monsters stop moving (e.g. after the hero is defeated)
      onSpawn: () => fight.alive++,
      onDeath: (mob) => {
        maybeDropHeart(mob);
        fight.alive--;
        if (fight.alive === 0 && fight.rising === 0 && fight.waiting === 0) roomCleared(mob);
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
      () => {
        if (doors.some((door) => door.locked && !door.wrong)) {
          return scrollFound ? "The doors are chained. Defeat the monsters first!" : "Defeat the monsters to find the scroll!";
        }
        return scrollFound ? `Walk up to a door and ${useHint()} to answer.` : "Pick up the scroll to read the question!";
      },
    );

    hidePrompt();
    showDepth(run, depth + 1);
    showQuestion(run, room); // written on the scroll now, but it stays hidden until it's found
    loop(0.25, () => tickTimer(run)); // keep the clock in the strip moving

    (async () => {
      fadeIn(fader, 0.3);
      await fallIn(player);
      run.startTime ??= performance.now(); // the clock starts on the first landing

      if (answered) {
        await celebrate(run, answered);
        showQuestion(run, room); // the explanation used the scroll; put this room's question back
      }

      giveControl(player);
      interactions.enable();
      startWaves(wavesForRoom(depth + 1, run.rooms.length, run.boss), fight);
    })();

    // The last monster is down: the doors unlock, and (the first time) it
    // drops the scroll.
    function roomCleared(lastMob) {
      playSound("unlock");
      redLight.off();
      doors.filter((door) => !door.wrong).forEach((door, i) => unchainDoor(door, i * 0.1));
      if (!scrollFound) addScrollPickup(lastMob.pos.clone(), player, findScroll);
      interactions.refresh(); // update the hint: the doors are open now
    }

    // He picked the scroll up: it opens with the question, and the door
    // letters pop in.
    async function findScroll() {
      scrollFound = true;
      playSound("unroll");
      revealLabels(doors);
      interactions.refresh();
      await openScroll();
    }

    // The mobs got him: he falls over, red, and hands reach up out of the
    // floor and drag him down, into the underworld (endings.js).
    async function defeated() {
      fight.over = true;
      fight.frozen = true;
      run.endTime = performance.now();
      player.frozen = true;
      player.opacity = 1;
      player.play("hit");
      player.use(color(255, 90, 90));
      hidePrompt();
      await animate(0, 90, 0.25, (angle) => (player.angle = angle)); // falls over
      await sleep(0.5);
      await dragDown(player);
      await fadeOut(fader, 0.5);
      go("underworld", run, { depth: depth + 1 });
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
      const next = { result: "correct", answered: { room, mistakes } };
      if (run.index < run.rooms.length) {
        go("room", run, next);
      } else {
        run.endTime = performance.now(); // that was the last question: the clock stops
        go("won", run, next);
      }
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

// Landing in a room after the right door: a green flash, and "Correct!" in
// the strip. If it took more than one try, the room's scroll opens with the
// answer and why, and everything waits (the clock too) until he's read it
// and pressed E or tapped Use; then the scroll rolls back up.
export async function celebrate(run, answered) {
  playSound("correct");
  flashScreen([99, 199, 77], 0.25, 0.5); // a soft green flash
  showStripMessage("Correct!", "correct");
  await sleep(0.6);
  if (answered.mistakes === 0) return;

  const clockRunning = run.endTime === null; // (it's already stopped once he's won)
  if (clockRunning) pauseClock(run);
  writeExplanation(answered.room);
  playSound("unroll");
  await openScroll();
  await gotIt();
  await closeScroll();
  if (clockRunning) resumeClock(run);
}

// Waits for "Got it": E, the Use button, or the strip's button.
function gotIt() {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      handle.cancel();
      hidePrompt();
      resolve();
    };
    const handle = onButtonPress("use", finish);
    setPrompt(["Got it"], finish, "");
  });
}
