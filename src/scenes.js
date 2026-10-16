import { ROOMS } from "./config.js";
import { BALANCE } from "./balance.js";
import { coins } from "./stats.js";
import { endRun } from "./save.js";
import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement, setupDash } from "./player.js";
import { addDoors, doorInteraction, chainDoor, unchainDoor } from "./doors.js";
import { setupInteractions } from "./interact.js";
import {
  fallIn, walkThroughDoor, giveControl, dragDown, climbLadder, climbIntoHatch, LAND_X, LAND_Y,
} from "./cutscenes.js";
import { sleep, animate, addFader, fadeIn, fadeOut, shakeScreen, flashScreen, puffDust } from "./effects.js";
import { startSpawning, raiseMob, MOB_TYPES } from "./mobs.js";
import { setupAutoSwing, setupHurt, addHearts, setupHeartDrops } from "./combat.js";
import { dropCoins, collectFloor } from "./coins.js";
import { addHud } from "./hud.js";
import { addLadder, addHatch } from "./props.js";
import { playSound } from "./sound.js";
import { showDepth, hidePrompt } from "./panel.js";

// One room of the dungeon (DESIGN.md section 3). Every room starts the same
// way: he falls in. Monsters rise from the floor (some as he lands, hordes
// on a timer, one more whenever the room is empty), and every kill fills
// the room's XP bar. When it's full, spawning stops and the chained door on
// the back wall opens: through it is the next room. The monsters still up
// stay, for their gold, if he wants it.
//
// The run's clock counts down only while he's in control (not while he
// falls in or walks through a door). At 0 the run is over, and so it is when
// his last heart goes. Either way, the hands drag him down to the underworld
// (endings.js).
//
// The last room is the boss's. Its bar fills like any other, then the boss
// appears and the clock stops: he made it here in time, so the fight isn't a
// race. When it falls, it leaves its pile of coins, a well down to the
// underworld, and a ladder up to the main room.
export function registerRoomScene() {
  scene("room", (run) => {
    const sub = run.index + 1; // the sub-depth, 1 to ROOMS
    const room = BALANCE.rooms[run.index];
    const { stats } = run;
    const isBossRoom = sub === ROOMS;
    const bossName = MOB_TYPES[BALANCE.boss.type].name;

    buildRoom();
    const [door] = addDoors([null]);
    chainDoor(door);
    const player = addPlayer(LAND_X, LAND_Y);
    setupPlayerMovement(player);
    if (stats.unlocked.has("dash")) setupDash(player); // the dash is bought in the tree
    const fader = addFader();
    const hearts = addHearts(run);
    hearts.update();
    const maybeDropHeart = setupHeartDrops(run, hearts, player, stats);

    let xp = 0;
    let clockRunning = false; // only while he's in control
    let clockStopped = false; // the boss is up
    let bossDown = false;
    let spawner = null;

    // The fight in this room, shared with mobs.js, boss.js and combat.js.
    const fight = {
      player, sub, stats,
      alive: 0,      // monsters up and about
      rising: 0,     // monsters still coming out of the floor
      over: false,   // the hero left the room, or the run ended
      frozen: false, // monsters stop moving (the run is over, or the boss fell)
      full: false,   // the XP bar is full: spawning has stopped
      onSpawn: () => fight.alive++,
      onDeath: (mob) => {
        fight.alive--;
        if (fight.over) return; // too late: the run is over
        run.kills++;
        maybeDropHeart(mob);
        dropCoins(mob.pos.clone(), coins(mob.gold * (1 + stats.goldBonus)), run, player, () => stats.magnetRange,
          { spread: mob.def.boss ? 44 : 10 });
        if (mob.def.boss) return bossBeaten(mob);
        if (fight.full) return;
        xp += mob.xp * (1 + stats.xpBonus);
        if (xp >= room.xp) return barFull();
        // Death calls (a tree upgrade): a kill may call up another monster.
        if (stats.deathCall > 0 && Math.random() < stats.deathCall) spawner?.raise(1);
      },
    };
    setupAutoSwing(player, fight, stats);
    setupHurt(player, run, hearts, fight, defeated, stats);
    addHud(() => ({ clock: run.clock, stopped: clockStopped, xp, xpNeeded: room.xp, gold: run.gold }));

    const things = [doorInteraction(door, () => (door.locked ? null : ["Go deeper"]), () => {
      if (fight.over) return false; // the run is over
      if (!door.locked) return goDeeper();
      playSound("locked"); // rattle the chains
      return false;
    })];
    const interactions = setupInteractions(player, things, () => {
      if (bossDown) return "Take the well down to the underworld, or the ladder up to the menu.";
      if (isBossRoom && fight.full) return `Beat the ${bossName.toLowerCase()}! The clock has stopped.`;
      if (door.locked) return isBossRoom ? "Fill the bar, and the boss will come." : "Fill the bar to unchain the door: defeat monsters!";
      return "Walk up to the door and press E to go deeper.";
    });

    hidePrompt();
    showDepth(sub);

    // The clock: only while he's in control, and not once the boss is up.
    let lastWhole = Math.ceil(run.clock);
    onUpdate(() => {
      if (!clockRunning || clockStopped || fight.over) return;
      run.clock = Math.max(0, run.clock - dt());
      const whole = Math.ceil(run.clock);
      if (whole !== lastWhole && whole <= 5 && whole > 0) playSound("tick"); // each of the last 5 seconds
      lastWhole = whole;
      if (run.clock <= 0) outOfTime();
    });

    (async () => {
      fadeIn(fader, 0.3);
      await fallIn(player);
      giveControl(player);
      interactions.enable();
      clockRunning = true;
      spawner = startSpawning(fight, { spawns: room.spawns, onEnter: stats.onEnter, horde: stats.horde, hordeEvery: stats.hordeEvery });
    })();

    // How far this run got: the rooms cleared, and this room's bar.
    const progress = () => (bossDown ? ROOMS : sub - 1 + Math.min(xp / room.xp, 0.999));

    // The bar is full: spawning stops. In most rooms, the door opens. In the
    // boss room, the boss rises and the clock stops.
    function barFull() {
      fight.full = true;
      playSound("unlock");
      flashScreen([255, 205, 70], 0.15, 0.4);
      if (isBossRoom) {
        clockStopped = true;
        raiseMob(BALANCE.boss.type, fight);
      } else {
        unchainDoor(door);
      }
      interactions.refresh();
    }

    // The boss falls: everything of its goes with it (its minions, even the
    // ones still rising, crumble; its fire and shots fizzle out), and a well
    // and a ladder appear. Its coins have already burst out of it.
    function bossBeaten(boss) {
      bossDown = true;
      run.deepest = ROOMS;
      shakeScreen(6);
      fight.frozen = true;
      for (const mob of get("mob")) {
        if (mob === boss) continue;
        mob.active = false;
        puffDust(mob.pos.x, mob.pos.y - 6, 6, 10);
        animate(1, 0, 0.25, (t) => (mob.scale = vec2(1, t))).then(() => destroy(mob));
      }
      for (const hazard of get("hazard")) {
        puffDust(hazard.pos.x, hazard.pos.y, 2, 6);
        destroy(hazard);
      }
      wait(0.8, () => {
        playSound("door");
        const ladder = addLadder(96); // clear of the clock
        const well = addHatch(14, 7);
        puffDust(well.centerX, well.y + 8, 10, 16);
        things.push(
          {
            zone: add([pos(well.centerX - 10, well.y), area({ shape: new Rect(vec2(0), 20, 16) })]),
            prompt: ["Go down to the underworld"],
            use: async () => {
              if (fight.over) return false;
              await leaveBossRoom(() => climbIntoHatch(player, well, fader));
              go("underworld", run, { ending: "boss" });
              return true;
            },
          },
          {
            zone: ladder.zone,
            prompt: ["Climb up to the menu"],
            use: async () => {
              if (fight.over) return false;
              await leaveBossRoom(() => climbLadder(player, ladder, fader));
              go("title", { from: "below" });
              return true;
            },
          },
        );
        interactions.refresh();
      });
    }

    // Leaving the boss room: the coins still on the floor are his, and the
    // run's gold is banked.
    async function leaveBossRoom(cutscene) {
      fight.over = true;
      interactions.disable();
      await cutscene();
      run.gold += collectFloor();
      bank();
    }

    // The run's gold goes into the save: once per run, however it ends.
    function bank() {
      if (run.banked) return;
      run.banked = true;
      endRun(run.gold, run.deepest);
    }

    // Through the door: on to the next room. Coins left on the floor stay
    // behind. Reaching the next room adds Second wind's seconds to the clock.
    async function goDeeper() {
      if (fight.over) return false;
      clockRunning = false;
      fight.over = true;
      run.deepest = sub;
      await walkThroughDoor(player, door, fader);
      run.index++;
      run.clock += stats.timePerSubDepth;
      go("room", run);
      return true; // he left the room
    }

    // The run is over (the clock, or his last heart): the room freezes, the
    // coins on the floor are his, and the run's gold is banked.
    function stopTheRun() {
      fight.over = true;
      fight.frozen = true;
      clockRunning = false;
      player.frozen = true;
      interactions.disable(); // the door, well and ladder can't be used now
      run.deepest = Math.max(run.deepest, progress());
      run.gold += collectFloor();
      bank();
    }

    // The clock ran out: a gong, and the hands come for him where he stands.
    async function outOfTime() {
      stopTheRun();
      player.opacity = 1;
      player.play("idle");
      playSound("gong");
      shakeScreen(3);
      await sleep(0.8);
      await dragDown(player, { standing: true });
      await fadeOut(fader, 0.5);
      go("underworld", run, { ending: "time" });
    }

    // The mobs got him: he falls over, red, and hands reach up out of the
    // floor and drag him down.
    async function defeated() {
      stopTheRun();
      player.opacity = 1;
      player.play("hit");
      player.use(color(255, 90, 90));
      await animate(0, 90, 0.25, (angle) => (player.angle = angle)); // falls over
      await sleep(0.5);
      await dragDown(player);
      await fadeOut(fader, 0.5);
      go("underworld", run, { ending: "died" });
    }
  });
}
