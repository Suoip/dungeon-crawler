import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement } from "./player.js";
import { addDoors, doorInteraction } from "./doors.js";
import { newRun } from "./dungeon.js";
import { HEROES, heroById } from "./heroes.js";
import { getSetting, setSetting } from "./settings.js";
import { setupInteractions } from "./interact.js";
import {
  fallIn, walkThroughDoor, climbLadder, climbOutOfHatch, besideHatch, giveControl, LAND_X, LAND_Y,
} from "./cutscenes.js";
import { addFader, fadeIn, puffDust, shakeScreen } from "./effects.js";
import { addLadder, addHatch, addLever, addKeycap, addShadowText } from "./props.js";
import { playSound, setMusicPlaying } from "./sound.js";
import { showMenuPanel, hidePrompt, link, isTouchScreen } from "./panel.js";
import { setupAttack } from "./combat.js";
import { BOSSES } from "./mobs.js";

// The menu is a room too: its options are doors you walk through. Behind
// HEROES, OPTIONS and CREDITS is a room one level down, with a ladder to
// climb back up.

const MENU_LABEL_COLOR = [240, 230, 210];
const strong = (text) => Object.assign(document.createElement("strong"), { textContent: text });

// ---------------------------------------------------------------------------
// What the panel shows in each menu room. They're functions so lockPanelHeight
// can measure them too (see main.js).
// ---------------------------------------------------------------------------

const titlePanel = () => ({
  left: "Main menu",
  line: isTouchScreen()
    ? "Best played with a keyboard. Touch controls are coming soon!"
    : "Every room asks a question, and the doors are the answers. Pick a door to begin.",
});

const heroesPanel = () => ({
  left: "Heroes",
  line: ["You are the ", strong(heroById(getSetting("hero")).name), "."],
  items: ["Walk up to another hero and press E to swap."],
});

const onOff = (on) => (on ? "ON" : "OFF");
const optionsPanel = () => ({
  left: "Options",
  line: "Flip a lever to change a setting.",
  items: [
    `Sound: ${onOff(getSetting("sound"))}`,
    `Music: ${onOff(getSetting("music"))}`,
    `Screen shake: ${onOff(getSetting("shake"))}`,
  ],
});

const creditsPanel = () => ({
  left: "Credits",
  line: "Made with these, thank you!",
  items: [
    ["Game by ", link("Salih Önder", "https://salihonder.dev")],
    ["Art: ", link("DungeonTileset II", "https://0x72.itch.io/dungeontileset-ii"), " by 0x72 (CC0)"],
    ["Font: ", link("Press Start 2P", "https://fonts.google.com/specimen/Press+Start+2P"), " (OFL)"],
    ["Engine: ", link("Kaplay", "https://kaplayjs.com")],
    ["Sound: ", link("ZzFX", "https://github.com/KilledByAPixel/ZzFX"), " by Frank Force"],
    "Pair programmer: Claude (Anthropic)",
  ],
});

const bossesPanel = () => ({
  left: "Choose a boss",
  line: "Test room: pick which boss waits in the last room of the dungeon.",
  items: BOSSES.map((boss) => [strong(boss.name), `: ${boss.blurb}`]),
});

export const MENU_PANELS = [titlePanel, heroesPanel, optionsPanel, creditsPanel, bossesPanel];

// ---------------------------------------------------------------------------
// The title room
// ---------------------------------------------------------------------------

function registerTitle(dungeon) {
  const MENU = [
    { label: "PLAY", prompt: "Start the game", scene: () => go("bosses") },
    { label: "HEROES", prompt: "Choose your hero", scene: () => go("heroes") },
    { label: "OPTIONS", prompt: "Change the options", scene: () => go("options") },
    { label: "CREDITS", prompt: "See the credits", scene: () => go("credits") },
  ];

  // { from: "start" } when the game first loads; { from: "below" } when the
  // knight climbs back up from one of the rooms below.
  scene("title", ({ from } = { from: "start" }) => {
    buildRoom();
    const doors = addDoors(MENU.map((item) => ({ text: item.label, color: MENU_LABEL_COLOR })));

    // The title, and the controls drawn as keyboard keys.
    addShadowText("WHO WANTS TO BE A", 160, 60, 8, [240, 230, 210]);
    addShadowText("DUNGEON CRAWLER", 160, 76, 16, [255, 205, 70]);

    const LABEL = [169, 155, 185];
    addKeycap(80, 94, "W");
    [66, 80, 94].forEach((x, i) => addKeycap(x, 109, "ASD"[i]));
    addShadowText("MOVE", 80, 132, 8, LABEL);

    addKeycap(160, 109, "E");
    addShadowText("USE", 160, 132, 8, LABEL);

    addKeycap(240, 109, "SPACE");
    addShadowText("ATTACK", 240, 132, 8, LABEL);

    const hatch = addHatch(9, 9);
    const start = besideHatch(hatch);
    const player = addPlayer(start.x, start.y);
    setupPlayerMovement(player);
    setupAttack(player); // swing for practice; there's nothing to hit here
    const fader = addFader();

    hidePrompt();
    showMenuPanel(titlePanel());

    const interactions = setupInteractions(
      player,
      doors.map((door, i) => doorInteraction(door, [MENU[i].prompt], async () => {
        await walkThroughDoor(player, door, fader);
        MENU[i].scene();
        return true; // he left the room
      })),
      () => (isTouchScreen() ? "" : "Walk up to a door and press E."),
    );

    (async () => {
      fadeIn(fader, 0.3);
      if (from === "below") await climbOutOfHatch(player, hatch);
      giveControl(player);
      interactions.enable();
    })();
  });
}

// ---------------------------------------------------------------------------
// The rooms below the title: Heroes, Options, Credits
// ---------------------------------------------------------------------------

// Every room below the title works the same way: the knight falls in, and a
// ladder on the back wall leads back up. `setup(player, fader)` adds what's
// special about the room and returns the extra things the player can use
// there. The ladder is in the middle unless `ladderX` says otherwise.
function registerSubRoom(name, panel, setup, { ladderX = LAND_X } = {}) {
  scene(name, () => {
    buildRoom();
    const ladder = addLadder(ladderX);
    const player = addPlayer(LAND_X, LAND_Y);
    setupPlayerMovement(player);
    setupAttack(player); // swing for practice; there's nothing to hit here
    const fader = addFader();

    hidePrompt();
    showMenuPanel(panel());

    const climb = {
      zone: ladder.zone,
      prompt: ["Climb up to the menu"],
      use: async () => {
        await climbLadder(player, ladder, fader);
        go("title", { from: "below" });
        return true;
      },
    };
    const interactions = setupInteractions(
      player,
      [climb, ...setup(player, fader)],
      () => "Climb the ladder to go back up.",
    );

    (async () => {
      fadeIn(fader, 0.3);
      await fallIn(player);
      giveControl(player);
      interactions.enable();
    })();
  });
}

// All the heroes stand in two rows. Walk up to one and press E to swap places:
// you become them, and the hero you were takes their spot.
function setupHeroes(player) {
  const figures = HEROES.map((hero, i) => {
    const x = 64 + (i % 5) * 48;
    const y = i < 5 ? 100 : 136;
    return {
      hero, x, y,
      figure: add([sprite(hero.id, { anim: "idle" }), pos(x, y), anchor("bot"), opacity(1)]),
      zone: add([pos(x - 10, y), area({ shape: new Rect(vec2(0), 20, 12) })]),
    };
  });

  // Your own spot is empty, because you're standing somewhere else.
  const isCurrent = (f) => f.hero.id === getSetting("hero");
  figures.forEach((f) => (f.figure.opacity = isCurrent(f) ? 0 : 1));

  return figures.map((f) => ({
    zone: f.zone,
    prompt: () => (isCurrent(f) ? null : ["Become the ", f.hero.name]),
    highlight(isActive) {
      if (isActive && !isCurrent(f)) {
        f.figure.pos.y = f.y - Math.abs(Math.sin(time() * 6)) * 3; // hops on the spot
        if (f.figure.getCurAnim()?.name !== "run") f.figure.play("run");
      } else {
        f.figure.pos.y = f.y;
        if (f.figure.getCurAnim()?.name !== "idle") f.figure.play("idle");
      }
    },
    use() {
      if (isCurrent(f)) return false;
      const old = figures.find(isCurrent);
      setSetting("hero", f.hero.id);

      // Swap: the old hero appears in their spot, the new one leaves theirs.
      player.use(sprite(f.hero.id, { anim: "idle" }));
      f.figure.opacity = 0;
      old.figure.opacity = 1;
      playSound("poof");
      puffDust(player.pos.x, player.pos.y - 8, 10, 12);
      puffDust(f.x, f.y - 8, 6, 10);
      puffDust(old.x, old.y - 8, 6, 10);

      showMenuPanel(heroesPanel());
      return false; // still in the room
    },
  }));
}

// Three levers: Sound, Music and Screen shake.
function setupOptions() {
  const LEVERS = [
    { setting: "sound", title: "SOUND", x: 96 },
    { setting: "music", title: "MUSIC", x: 160 },
    { setting: "shake", title: "SHAKE", x: 224 },
  ];

  return LEVERS.map(({ setting, title, x }) => {
    const lever = addLever(x, 112, title, getSetting(setting));
    const name = setting === "shake" ? "screen shake" : setting;
    return {
      zone: lever.zone,
      prompt: () => [`Turn ${name} ${getSetting(setting) ? "off" : "on"}`],
      use() {
        const on = !getSetting(setting);
        if (!on) playSound("lever"); // turning sound off: play it while we still can
        setSetting(setting, on);
        if (on) playSound("lever");
        lever.show(on);

        if (setting === "music") setMusicPlaying(on);
        if (setting === "shake" && on) shakeScreen(3); // show what it does

        showMenuPanel(optionsPanel());
        return false;
      },
    };
  });
}

// The credits are in the panel; the room just has a few things lying around.
function setupCredits() {
  add([sprite("chest"), pos(48, 64)]);
  add([sprite("crate"), pos(256, 56)]);
  add([sprite("crate"), pos(272, 64)]);
  add([sprite("skull"), pos(80, 150)]);
  add([sprite("skull"), pos(244, 168)]);
  add([sprite("flask_red"), pos(40, 120)]);
  add([sprite("flask_blue"), pos(270, 120)]);
  return [];
}

// A test room for trying out the bosses: three doors, each boss standing
// under its own. Going through a door starts the dungeon with that boss
// waiting in the last room.
function setupBosses(player, fader, dungeon) {
  const doors = addDoors(BOSSES.map((boss) => ({ text: boss.label, color: [230, 72, 46] })));
  doors.forEach((door, i) => add([
    sprite(BOSSES[i].id, { anim: "idle" }),
    pos(door.centerX, 112),
    anchor("bot"),
  ]));

  return doors.map((door, i) => doorInteraction(door, [`Fight the ${BOSSES[i].name}`], async () => {
    await walkThroughDoor(player, door, fader);
    go("room", newRun(dungeon, BOSSES[i].id));
    return true; // he left the room
  }));
}

export function registerMenuScenes(dungeon) {
  registerTitle(dungeon);
  registerSubRoom("heroes", heroesPanel, setupHeroes);
  registerSubRoom("options", optionsPanel, setupOptions);
  registerSubRoom("credits", creditsPanel, setupCredits);
  // The ladder goes on the left here, because the middle of the wall has a door.
  registerSubRoom("bosses", bossesPanel, (player, fader) => setupBosses(player, fader, dungeon), { ladderX: 28 });
}
