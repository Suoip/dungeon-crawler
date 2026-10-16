import { ROOMS } from "./config.js";
import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement, setupDash } from "./player.js";
import { addDoors, doorInteraction, chainDoor, unchainDoor } from "./doors.js";
import { setupInteractions } from "./interact.js";
import { fallIn, walkThroughDoor, giveControl, dragDown, LAND_X, LAND_Y } from "./cutscenes.js";
import { sleep, animate, addFader, fadeIn, fadeOut, showBanner } from "./effects.js";
import { wavesForRoom, startWaves } from "./mobs.js";
import { setupAttack, setupHurt, addHearts, setupHeartDrops } from "./combat.js";
import { playSound } from "./sound.js";
import { useHint } from "./touch.js";
import { showDepth, tickTimer, hidePrompt } from "./panel.js";

// One room of the dungeon. Every room starts the same way: he falls in.
// Waves of monsters rise from the floor, and the door on the back wall (the
// way deeper) stays chained until every wave is beaten. Through the door is
// the next room; through the last room's door is the treasure room ("won",
// see endings.js). The last room has the boss.
export function registerRoomScene() {
  scene("room", (run) => {
    const depth = run.index; // 0 = the first room

    buildRoom();
    const [door] = addDoors([null]);
    chainDoor(door);
    const player = addPlayer(LAND_X, LAND_Y);
    setupPlayerMovement(player);
    setupDash(player);
    const fader = addFader();
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
        if (fight.alive === 0 && fight.rising === 0 && fight.waiting === 0) roomCleared();
      },
      onWave: (number, total) => showBanner(`WAVE ${number}/${total}`),
    };
    setupAttack(player, fight);
    setupHurt(player, run, hearts, fight, defeated);

    const interactions = setupInteractions(
      player,
      [doorInteraction(door, () => (door.locked ? null : ["Go deeper"]), () => {
        if (!door.locked) return goDeeper();
        playSound("locked"); // rattle the chains
        return false;
      })],
      () => (door.locked
        ? "The door is chained. Defeat the monsters!"
        : `Walk up to the door and ${useHint()} to go deeper.`),
    );

    hidePrompt();
    showDepth(run, depth + 1);
    loop(0.25, () => tickTimer(run)); // keep the clock in the strip moving

    (async () => {
      fadeIn(fader, 0.3);
      await fallIn(player);
      run.startTime ??= performance.now(); // the clock starts on the first landing
      giveControl(player);
      interactions.enable();
      startWaves(wavesForRoom(depth + 1, ROOMS, run.boss), fight);
    })();

    // The last monster is down: the chains drop off the door.
    function roomCleared() {
      playSound("unlock");
      unchainDoor(door);
      interactions.refresh(); // update the hint: the door is open now
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

    async function goDeeper() {
      fight.over = true;
      await walkThroughDoor(player, door, fader);
      run.index++;
      if (run.index < ROOMS) {
        go("room", run);
      } else {
        run.endTime = performance.now(); // out of the last room: the clock stops
        go("won", run);
      }
      return true; // he left the room
    }
  });
}
