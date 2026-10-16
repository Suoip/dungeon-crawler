import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement, setupDash } from "./player.js";
import { addDoors, doorInteraction } from "./doors.js";
import { newRun } from "./dungeon.js";
import { HEROES, heroById } from "./heroes.js";
import { getSetting, setSetting } from "./settings.js";
import { setupInteractions } from "./interact.js";
import {
  fallIn, walkThroughDoor, climbLadder, climbOutOfHatch, besideHatch, giveControl, LAND_X, LAND_Y,
} from "./cutscenes.js";
import { addFader, fadeIn, puffDust, shakeScreen } from "./effects.js";
import { addLadder, addHatch, addLever, addKeycap, addTouchIcon, addShadowText, addPlaque } from "./props.js";
import { playSound, setMusicPlaying } from "./sound.js";
import { hidePrompt, link, showRoomName, writeMenuScroll } from "./panel.js";
import { hideScroll, openScroll, setScrollNotes } from "./scroll.js";
import { isTouch, useHint } from "./touch.js";
import { setupAttack } from "./combat.js";
import { BOSSES } from "./mobs.js";

// The menu is a room too: its options are doors you walk through. Behind
// HEROES, OPTIONS and CREDITS is a room one level down, with a ladder to
// climb back up.

const MENU_LABEL_COLOR = [240, 230, 210];

// ---------------------------------------------------------------------------
// Most menu rooms explain themselves, so they have no scroll: just their name
// and a hint in the strip. The Credits room picks up a scroll on entering.
// ---------------------------------------------------------------------------

const creditsScroll = () => ({
  line: "Made with these, thank you!",
  items: ["Walk up to a plaque to read it."],
});

// One plaque per credit in the Credits room. `url` is what using the plaque
// opens, in a new tab.
const CREDITS = [
  { title: "Game", by: () => [link("Salih Önder", "https://salihonder.dev")], url: "https://salihonder.dev" },
  {
    title: "Art",
    by: () => [link("16x16 DungeonTileset II", "https://0x72.itch.io/dungeontileset-ii"), " by 0x72 (CC0)"],
    url: "https://0x72.itch.io/dungeontileset-ii",
  },
  {
    title: "Pixel font",
    by: () => [link("Press Start 2P", "https://fonts.google.com/specimen/Press+Start+2P"), " by CodeMan38 (OFL)"],
    url: "https://fonts.google.com/specimen/Press+Start+2P",
  },
  {
    title: "Text font",
    by: () => [link("Atkinson Hyperlegible", "https://fonts.google.com/specimen/Atkinson+Hyperlegible"), " by the Braille Institute (OFL)"],
    url: "https://fonts.google.com/specimen/Atkinson+Hyperlegible",
  },
  { title: "Engine", by: () => [link("Kaplay", "https://kaplayjs.com")], url: "https://kaplayjs.com" },
  {
    title: "Sound effects",
    by: () => [link("ZzFX", "https://github.com/KilledByAPixel/ZzFX"), " by Frank Force (MIT)"],
    url: "https://github.com/KilledByAPixel/ZzFX",
  },
  { title: "Pair programmer", by: () => ["Claude (Anthropic)"] },
];

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

    // The title, and the controls: drawn as keyboard keys, or on a touch
    // screen as the joystick and buttons.
    addShadowText("WHO WANTS TO BE A", 160, 60, 8, [240, 230, 210]);
    addShadowText("DUNGEON CRAWLER", 160, 76, 16, [255, 205, 70]);

    const LABEL = [169, 155, 185];
    if (isTouch()) {
      addTouchIcon(52, 112, "stick");
      addTouchIcon(122, 112, "use");
      addTouchIcon(194, 112, "attack");
      addTouchIcon(268, 112, "dash");
    } else {
      addKeycap(52, 94, "W");
      [38, 52, 66].forEach((x, i) => addKeycap(x, 109, "ASD"[i]));
      addKeycap(122, 109, "E");
      addKeycap(194, 109, "SPACE");
      addKeycap(268, 109, "SHIFT");
    }
    addShadowText("MOVE", 52, 132, 8, LABEL);
    addShadowText("USE", 122, 132, 8, LABEL);
    addShadowText("ATTACK", 194, 132, 8, LABEL);
    addShadowText("DASH", 268, 132, 8, LABEL);

    const hatch = addHatch(9, 9);
    const start = besideHatch(hatch);
    const player = addPlayer(start.x, start.y);
    setupPlayerMovement(player);
    setupAttack(player); // swing for practice; there's nothing to hit here
    setupDash(player);
    const fader = addFader();

    hidePrompt();
    hideScroll();
    setScrollNotes();
    showRoomName("Main menu");

    const interactions = setupInteractions(
      player,
      doors.map((door, i) => doorInteraction(door, [MENU[i].prompt], async () => {
        await walkThroughDoor(player, door, fader);
        MENU[i].scene();
        return true; // he left the room
      })),
      () => `Walk up to a door and ${useHint()}.`,
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
// there. `title` goes in the strip, with `hint` (a function, so it can
// change) next to it. The ladder is in the middle unless `ladderX` says
// otherwise, and with `scroll` (a function giving what's written on it) the
// room picks up a scroll as he lands.
function registerSubRoom(name, title, setup, {
  ladderX = LAND_X, hint = () => "Climb the ladder to go back up.", scroll = null,
} = {}) {
  scene(name, () => {
    hideScroll();
    setScrollNotes();
    buildRoom();
    const ladder = addLadder(ladderX);
    const player = addPlayer(LAND_X, LAND_Y);
    setupPlayerMovement(player);
    setupAttack(player); // swing for practice; there's nothing to hit here
    setupDash(player);
    const fader = addFader();

    hidePrompt();
    showRoomName(title);
    if (scroll) writeMenuScroll(scroll());

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
      hint,
    );

    (async () => {
      fadeIn(fader, 0.3);
      await fallIn(player);
      if (scroll) {
        playSound("unroll");
        openScroll();
      }
      giveControl(player);
      interactions.enable();
    })();
  });
}

// All the heroes stand in two rows. Walk up to one and use it to swap places:
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
        return false;
      },
    };
  });
}

// The Credits room: a plaque for each credit, in two rows. Stand at one and
// the scroll shows what it says; use it to open its link.
function setupCredits(player) {
  add([sprite("chest"), pos(48, 64)]);
  add([sprite("crate"), pos(256, 56)]);
  add([sprite("crate"), pos(272, 64)]);
  add([sprite("skull"), pos(244, 176)]);
  add([sprite("flask_red"), pos(24, 150)]);
  add([sprite("flask_blue"), pos(284, 150)]);

  const spots = CREDITS.map((credit, i) => {
    const front = i < 4;
    const x = front ? 64 + i * 64 : 96 + (i - 4) * 64;
    const plaque = addPlaque(x, front ? 104 : 140);
    return {
      ...plaque,
      scroll: () => ({ line: credit.title, items: [credit.by()] }),
      credit,
    };
  });
  showOnScrollWhileNear(player, spots, creditsScroll);

  return spots.filter((spot) => spot.credit.url).map((spot) => ({
    zone: spot.zone,
    prompt: [`Visit ${spot.credit.title === "Game" ? "salihonder.dev" : "the link"}`],
    use: () => {
      window.open(spot.credit.url, "_blank", "noopener");
      return false;
    },
  }));
}

// While the hero stands at one of the `spots` (each { zone, scroll(), and
// optionally setLit() }), the scroll shows what that spot says; anywhere
// else it shows the room's own writing.
function showOnScrollWhileNear(player, spots, roomScroll) {
  let shown = null;
  onUpdate(() => {
    const here = spots.find((spot) => player.isColliding(spot.zone)) ?? null;
    if (here === shown) return;
    shown?.setLit?.(false);
    here?.setLit?.(true);
    shown = here;
    writeMenuScroll(here ? here.scroll() : roomScroll());
  });
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
  // Above each door, where the scroll would be, a note about its boss.
  setScrollNotes(doors.map((door, i) => ({ x: door.centerX, width: 74, text: BOSSES[i].blurb })));

  return doors.map((door, i) => doorInteraction(door, [`Fight the ${BOSSES[i].name}`], async () => {
    await walkThroughDoor(player, door, fader);
    go("room", newRun(dungeon, BOSSES[i].id));
    return true; // he left the room
  }));
}

export function registerMenuScenes(dungeon) {
  registerTitle(dungeon);
  registerSubRoom("heroes", "Heroes", setupHeroes, {
    hint: () => `You are the ${heroById(getSetting("hero")).name}. Walk up to another hero to swap.`,
  });
  registerSubRoom("options", "Options", setupOptions, { hint: () => "Flip a lever to change a setting." });
  registerSubRoom("credits", "Credits", setupCredits, { scroll: creditsScroll });
  // The ladder goes on the left here, because the middle of the wall has a door.
  registerSubRoom("bosses", "Choose a boss", (player, fader) => setupBosses(player, fader, dungeon), {
    ladderX: 28,
    hint: () => "Test room: pick the boss that waits in the last room.",
  });
}
