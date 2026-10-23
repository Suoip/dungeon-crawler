import { ROOMS } from "./config.js";
import { BALANCE } from "./balance.js";
import { coins, roomScale } from "./stats.js";
import { endRun } from "./save.js";
import { buildRoom, tintRoom, addDecor } from "./room.js";
import { addPlayer, setupPlayerMovement, setupDash } from "./player.js";
import { addDoors, doorInteraction, chainDoor, unchainDoor } from "./doors.js";
import { setupInteractions } from "./interact.js";
import {
  fallIn, walkThroughDoor, giveControl, dragDown, climbLadder, climbIntoWell, shoveAside, LAND_X, LAND_Y,
} from "./cutscenes.js";
import { sleep, animate, addFader, fadeIn, fadeOut, shakeScreen, flashScreen, puffDust } from "./effects.js";
import { startSpawning, raiseMob, bossSpot, MOB_TYPES } from "./mobs.js";
import { setupAutoSwing, setupHurt, addHearts, setupHeartDrops, setupOrbDrops } from "./combat.js";
import { dropCoins, dropMaterial, collectFloor, sweepFloor, floorValue, floorMaterial } from "./coins.js";
import { buildLayout } from "./crypt.js";
import { setupGraves } from "./graves.js";
import { setupThieves } from "./thieves.js";
import { addHud } from "./hud.js";
import { addLadder, addWell } from "./props.js";
import { playSound } from "./sound.js";
import { showDepth, hidePrompt } from "./panel.js";
import { depthData } from "./dungeon.js";

// How far from the middle the hero is kept when the boss rises there (px).
const BOSS_CLEARANCE = 40;

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
    const depth = depthData(run.depth);
    const room = depth.rooms[run.index];
    const { stats } = run;
    const isBossRoom = sub === ROOMS;
    const bossName = depth.boss.name ?? MOB_TYPES[depth.boss.type].name;

    buildRoom();
    const [door] = addDoors([null]);
    if (depth.tint) tintRoom(depth.tint); // the floor, the walls and the door's frame
    if (depth.decor) addDecor(depth.decor, depth.tint); // banners, goo or lava on the back wall
    chainDoor(door);
    const player = addPlayer(LAND_X, LAND_Y);
    setupPlayerMovement(player);
    setupDash(player, () => stats); // it does nothing until the dash is bought in the tree
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
      depth: run.depth,
      minion: depth.boss.minion, // what its boss raises
      bossName, bossTint: depth.boss.tint, // a stand-in boss's own name and color
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
        maybeDropOrb(mob);
        maybeDropMaterial(mob);
        // Flat gold per kill (a tree upgrade) comes on top of the monster's own,
        // in this room's gold, and Greed adds its share of both.
        const flat = mob.def.boss ? 0 : stats.goldPerKill * roomScale(run.depth, sub).gold;
        dropCoins(mob.pos.clone(), coins((mob.gold + flat) * (1 + stats.goldBonus)), run, player, () => stats.magnetRange,
          { spread: mob.def.boss ? 44 : 10 });
        if (mob.def.boss) return bossBeaten(mob);
        graves.onKill(mob); // the crypt's restless graves (graves.js)
        thieves.onKill(mob); // the warrens' coin thieves (thieves.js)
        // Seconds per kill (a tree upgrade): while the clock runs, every kill
        // adds a little sand to the hourglass.
        if (stats.timePerKill > 0 && clockRunning && !clockStopped) {
          run.clock += stats.timePerKill;
          run.sand += stats.timePerKill;
          hud.addSand();
        }
        if (fight.full) return;
        xp += mob.xp * (1 + stats.xpBonus);
        if (xp >= room.xp) return barFull();
        // Death calls (a tree upgrade): a kill may call up another monster.
        if (stats.deathCall > 0 && Math.random() < stats.deathCall) spawner?.raise(1);
      },
      // A monster gone without being beaten (a wogol that went off).
      onVanish: () => fight.alive--,
    };
    // The room's layout (crypt.js): pillars, spikes, breakables, maybe a chest.
    fight.solid = buildLayout(fight, run);
    setupAutoSwing(player, fight, stats);
    setupHurt(player, run, hearts, fight, defeated, stats);
    // The depth's material (bones in the crypt, teeth in the warrens...): from
    // sub-depth 6 on, a kill may drop a piece, more often the deeper it is.
    const drop = BALANCE.drops.material;
    const materialChance = sub < drop.fromSubDepth ? 0 : drop.chance + drop.stepPerSubDepth * (sub - drop.fromSubDepth);
    const maybeDropMaterial = (mob) => {
      if (Math.random() < materialChance) dropMaterial(mob.pos.clone(), run, player, () => stats.magnetRange, depth.material);
    };
    const hud = addHud(() => ({ clock: run.clock, sand: run.sand, stopped: clockStopped, xp, xpNeeded: room.xp, gold: run.gold }));
    // Time orbs: while the clock runs, a kill may drop one, worth seconds.
    const maybeDropOrb = setupOrbDrops(player, stats, () => clockRunning && !clockStopped, (seconds) => {
      run.clock += seconds;
      run.sand += seconds;
      hud.addTime(seconds);
    });
    // The depth's gimmick, if it has one: the crypt's restless graves, the
    // warrens' coin thieves.
    const graves = setupGraves(fight, run, stats, (seconds) => {
      if (!clockRunning || clockStopped) return;
      run.clock += seconds;
      run.sand += seconds;
      hud.addTime(seconds);
    });
    const thieves = setupThieves(fight, run, stats);

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
    showDepth(run.depth, sub);

    // The clock: only while he's in control, and not once the boss is up.
    let lastWhole = Math.ceil(run.clock);
    onUpdate(() => {
      if (!clockRunning || clockStopped || fight.over) return;
      run.clock = Math.max(0, run.clock - dt());
      const whole = Math.ceil(run.clock);
      // A tick for each of the last 5 seconds (only counting down: a time
      // orb that pushes the clock back up doesn't tick).
      if (whole < lastWhole && whole <= 5 && whole > 0) playSound("tick");
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
    // boss room, the boss makes its entrance.
    function barFull() {
      fight.full = true;
      playSound("unlock");
      // Heal on clear (a tree upgrade): a chance of a heart back.
      if (run.hearts < run.maxHearts && Math.random() < stats.healOnClear) {
        run.hearts++;
        hearts.update();
        hearts.grow();
        playSound("heal");
      }
      flashScreen([255, 205, 70], 0.15, 0.4);
      if (isBossRoom) bossEntrance();
      else unchainDoor(door);
      interactions.refresh();
    }

    // A monster crumbles to dust (when the boss arrives, or when it falls).
    // At the boss's arrival, the ones that were up drop their coins too, as
    // if they'd been beaten (but they don't count as kills).
    function crumble(mob, { dropsCoins = false } = {}) {
      if (mob.dead) return; // just beaten: it's already falling
      if (dropsCoins && mob.active) {
        dropCoins(mob.pos.clone(), coins(mob.gold * (1 + stats.goldBonus)), run, player, () => stats.magnetRange);
      }
      mob.active = false;
      fight.alive--;
      puffDust(mob.pos.x, mob.pos.y - 6, 6, 10);
      animate(1, 0, 0.25, (t) => (mob.scale = vec2(mob.baseScale, mob.baseScale * t))).then(() => destroy(mob));
    }

    // The boss room's bar is full: the clock stops and the boss makes its
    // entrance, with the hero held still. The room shakes, every monster
    // crumbles, he's shoved off the middle if he's standing where the boss
    // rises, and he gets his controls back once it has roared. So the fight
    // starts with just the two of them.
    async function bossEntrance() {
      clockStopped = true;
      player.frozen = true;
      player.opacity = 1; // not stuck halfway through a blink
      player.play("idle");
      fight.frozen = true; // nothing moves, and nothing still rising comes up
      shakeScreen(6);
      playSound("crumble");
      for (const mob of get("mob")) crumble(mob, { dropsCoins: true });
      for (const orb of get("orb")) {
        puffDust(orb.pos.x, orb.pos.y, 3, 6); // no use for time now: they fizzle out
        destroy(orb);
      }
      await sleep(0.4);
      await shoveAside(player, bossSpot(), BOSS_CLEARANCE);
      fight.frozen = false;
      const boss = await raiseMob(depth.boss.type, fight);
      await boss?.ready; // its name, and its roar
      if (fight.over) return;
      player.frozen = false;
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
        if (mob !== boss) crumble(mob);
      }
      for (const hazard of get("hazard")) {
        puffDust(hazard.pos.x, hazard.pos.y, 2, 6);
        destroy(hazard);
      }
      wait(0.8, () => {
        playSound("door");
        const ladder = addLadder(96); // clear of the clock
        const well = addWell(14, 7);
        puffDust(well.centerX, well.foot, 10, 16);
        things.push(
          {
            zone: well.zone,
            prompt: ["Go down to the underworld"],
            use: async () => {
              if (fight.over) return false;
              await leaveBossRoom(() => climbIntoWell(player, well, fader));
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

    // Leaving the boss room: the run's gold is banked, coins on the floor
    // included, and they fly to him on his way out.
    async function leaveBossRoom(cutscene) {
      fight.over = true;
      interactions.disable();
      bankWithTheFloor();
      await cutscene();
      collectTheRest();
    }

    // The run is over: its gold and material go into the save right away,
    // counting what's still on the floor (so closing the page during the
    // cutscene loses nothing), and then those fly to him, just to show it.
    function bankWithTheFloor() {
      bank(floorValue(), floorMaterial());
      sweepFloor();
    }

    // What the sweep didn't bring in before the screen went dark: it was
    // banked already, so it only joins the run's totals on the results.
    function collectTheRest() {
      collectFloor(run);
    }

    // The run's gold and material (plus `gold` and `pieces` more) go into the
    // save: once per run, however it ends. `run.unlocked`: this run beat the
    // depth's boss for the first time, and the next depth is open now.
    function bank(gold = 0, pieces = 0) {
      if (run.banked) return;
      run.banked = true;
      run.unlocked = endRun({ gold: run.gold + gold, deepest: run.deepest, depth: run.depth, cleared: bossDown, material: run.material + pieces });
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
      run.sand += stats.timePerSubDepth;
      go("room", run);
      return true; // he left the room
    }

    // The run is over (the clock, or his last heart): the room freezes, the
    // run's gold is banked, and every coin on the floor flies to him while
    // he's taken down.
    function stopTheRun() {
      fight.over = true;
      fight.frozen = true;
      clockRunning = false;
      player.frozen = true;
      interactions.disable(); // the door, well and ladder can't be used now
      run.deepest = Math.max(run.deepest, progress());
      bankWithTheFloor();
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
      collectTheRest();
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
      collectTheRest();
      await fadeOut(fader, 0.5);
      go("underworld", run, { ending: "died" });
    }
  });
}
