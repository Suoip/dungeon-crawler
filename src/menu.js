import { buildRoom } from "./room.js";
import { addPlayer, setupPlayerMovement, setupDash } from "./player.js";
import { addDoors, doorInteraction } from "./doors.js";
import { newRun } from "./dungeon.js";
import { HEROES, heroById } from "./heroes.js";
import { getSetting, setSetting } from "./settings.js";
import { setupInteractions } from "./interact.js";
import {
  fallIn, walkThroughDoor, climbLadder, climbOutOfHatch, climbIntoWell, besideHatch, giveControl, LAND_X, LAND_Y,
} from "./cutscenes.js";
import { addFader, fadeIn, puffDust, shakeScreen } from "./effects.js";
import {
  addLadder, addHatch, addWell, addLever, addKeycap, addShadowText, addPlaque, addSign, addVolumeSlider, addFloorButton,
} from "./props.js";
import { playSound, setEffectsVolume, setMusicVolume } from "./sound.js";
import { hidePrompt, showRoomName } from "./panel.js";
import { getSave, resetSave } from "./save.js";
import { heroStats } from "./stats.js";

// The menu is a room too: its options are doors you walk through. Behind
// HEROES, OPTIONS and CREDITS is a room one level down, with a ladder to
// climb back up.

const MENU_LABEL_COLOR = [240, 230, 210];

// One plaque per credit in the Credits room. Standing at one shows its
// sign; `url` is what using the plaque opens, in a new tab.
const CREDITS = [
  // The pixel font's capital Ö looks like a small ö, so this one is an O
  // with its dots drawn on by hand (see addSign).
  { title: "GAME", lines: [{ text: "Salih Onder", umlautAt: 6 }], url: "https://salihonder.dev" },
  { title: "ART", lines: ["16x16 DungeonTileset II", "by 0x72 (CC0)"], url: "https://0x72.itch.io/dungeontileset-ii" },
  { title: "PIXEL FONT", lines: ["Press Start 2P", "by CodeMan38 (OFL)"], url: "https://fonts.google.com/specimen/Press+Start+2P" },
  {
    title: "TEXT FONT",
    lines: ["Atkinson Hyperlegible", "by the Braille Institute (OFL)"],
    url: "https://fonts.google.com/specimen/Atkinson+Hyperlegible",
  },
  { title: "ENGINE", lines: ["Kaplay"], url: "https://kaplayjs.com" },
  { title: "SOUND EFFECTS", lines: ["ZzFX", "by Frank Force (MIT)"], url: "https://github.com/KilledByAPixel/ZzFX" },
  { title: "PAIR PROGRAMMER", lines: ["Claude (Anthropic)"] },
];

// Whether the dash has been bought in the tree (it starts locked).
const hasTheDash = () => heroStats(getSave().levels).unlocked.has("dash");

// ---------------------------------------------------------------------------
// The title room
// ---------------------------------------------------------------------------

function registerTitle() {
  const MENU = [
    { label: "PLAY", prompt: "Start the game", scene: () => go("room", newRun()) },
    { label: "HEROES", prompt: "Choose your hero", scene: () => go("heroes") },
    { label: "OPTIONS", prompt: "Change the options", scene: () => go("options") },
    { label: "CREDITS", prompt: "See the credits", scene: () => go("credits") },
  ];

  // { from: "start" } when the game first loads; { from: "below" } when the
  // knight climbs back up from one of the rooms below.
  scene("title", ({ from } = { from: "start" }) => {
    buildRoom();
    const doors = addDoors(MENU.map((item) => ({ text: item.label, color: MENU_LABEL_COLOR })));

    // The title, and the controls, drawn as keyboard keys. Only what you
    // have: the hero swings on his own, and DASH shows up once the dash is
    // bought.
    addShadowText("WHO WANTS TO BE A", 160, 60, 8, [240, 230, 210]);
    addShadowText("DUNGEON CRAWLER", 160, 76, 16, [255, 205, 70]);

    const hasDash = hasTheDash();
    const LABEL = [169, 155, 185];
    const columns = hasDash ? [70, 160, 250] : [110, 210];
    const [moveX, useX, dashX] = columns;
    addKeycap(moveX, 94, "W");
    [-14, 0, 14].forEach((dx, i) => addKeycap(moveX + dx, 109, "ASD"[i]));
    addKeycap(useX, 109, "E");
    if (hasDash) addKeycap(dashX, 109, "SHIFT");
    addShadowText("MOVE", moveX, 132, 8, LABEL);
    addShadowText("USE", useX, 132, 8, LABEL);
    if (hasDash) addShadowText("DASH", dashX, 132, 8, LABEL);

    const hatch = addHatch(9, 9);
    const start = besideHatch(hatch);
    const player = addPlayer(start.x, start.y);
    setupPlayerMovement(player);
    if (hasDash) setupDash(player);
    const fader = addFader();

    hidePrompt();
    showRoomName("Main menu");

    const things = doors.map((door, i) => doorInteraction(door, [MENU[i].prompt], async () => {
      await walkThroughDoor(player, door, fader);
      MENU[i].scene();
      return true; // he left the room
    }));
    // Once he's been to the underworld, a well leads straight down to it, so
    // he can spend his gold at the altar without playing a run first.
    const hasWell = getSave().seenUnderworld;
    if (hasWell) {
      const well = addWell(15, 9);
      things.push({
        zone: well.zone,
        prompt: ["Go down to the underworld"],
        use: async () => {
          await climbIntoWell(player, well, fader);
          go("underworld", null, { ending: "visit" });
          return true;
        },
      });
    }
    const interactions = setupInteractions(
      player,
      things,
      () => (hasWell ? "Walk up to a door or the well and press E." : "Walk up to a door and press E."),
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
// ladder on the back wall leads back up. `setup(player)` adds what's
// special about the room and returns the extra things the player can use
// there. `title` goes in the strip, with `hint` (a function, so it can
// change) next to it. The ladder is in the middle of the back wall.
function registerSubRoom(name, title, setup, hint) {
  scene(name, () => {
    buildRoom();
    const ladder = addLadder(LAND_X);
    const player = addPlayer(LAND_X, LAND_Y);
    setupPlayerMovement(player);
    setupDash(player, hasTheDash); // until a reset in Options takes it away
    const fader = addFader();

    hidePrompt();
    showRoomName(title);

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
      [climb, ...setup(player)],
      hint,
    );

    (async () => {
      fadeIn(fader, 0.3);
      await fallIn(player);
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

// The volume mixer: a slider for the sound effects and one for the music,
// each a stone block you bump along a rail by walking into it (0 to 10, 5 by
// default), and a lever for screen shake.
function setupOptions(player) {
  addVolumeSlider(84, "speaker", getSetting("sound"), player, (level) => {
    setSetting("sound", level);
    setEffectsVolume(level);
    playSound("letter"); // a blip, at the new volume
  });
  addVolumeSlider(124, "note", getSetting("music"), player, (level) => {
    setSetting("music", level);
    setMusicVolume(level); // you hear it change right away
    playSound("lever");    // the block clicking into its notch
  });

  const lever = addLever(272, 184, "SHAKE", getSetting("shake"));
  return [{
    zone: lever.zone,
    prompt: () => [`Turn screen shake ${getSetting("shake") ? "off" : "on"}`],
    use() {
      const on = !getSetting("shake");
      setSetting("shake", on);
      playSound("lever");
      lever.show(on);
      if (on) shakeScreen(3); // show what it does
      return false;
    },
  }, setupReset()];
}

// The reset: a red button in the floor that erases your progress (the gold,
// the upgrades and the well; the settings stay). It asks twice first. Walk
// away from it and it forgets you'd started asking.
function setupReset() {
  const button = addFloorButton(48, 184, "RESET");
  const STEPS = [
    { label: "RESET", color: [240, 230, 210], prompt: "Reset all progress" },
    { label: "SURE?", color: [230, 72, 46], prompt: "Yes, erase my gold and upgrades" },
    { label: "REALLY?", color: [230, 72, 46], prompt: "Yes, erase them for good" },
  ];
  let step = 0;      // how far through the asking he is; 3 = done
  const show = () => button.setLabel(STEPS[step].label, STEPS[step].color);
  return {
    zone: button.zone,
    prompt: () => (step < 3 ? [STEPS[step].prompt] : null),
    highlight(isActive) {
      if (isActive || step === 0 || step === 3) return;
      step = 0; // he walked away
      show();
    },
    use() {
      if (step === 3) return false;
      step++;
      if (step < 3) {
        show();
        playSound("locked");
        return false;
      }
      resetSave();
      button.press();
      button.setLabel("DONE", [169, 155, 185]);
      playSound("crumble");
      shakeScreen(4);
      return false;
    },
  };
}

// The Credits room: a plaque for each credit, in two rows. Stand at one and
// its sign pops up above it; use it to open its link.
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
    const y = front ? 104 : 140;
    return { ...addPlaque(x, y), x, y, credit };
  });
  showSignWhileNear(player, spots);

  return spots.filter((spot) => spot.credit.url).map((spot) => ({
    zone: spot.zone,
    prompt: [`Visit ${spot.credit.title === "GAME" ? "salihonder.dev" : "the link"}`],
    use: () => {
      window.open(spot.credit.url, "_blank", "noopener");
      return false;
    },
  }));
}

// While the hero stands at one of the credit plaques, its engraving glows
// and its sign pops up above it: the title in gold, then who made it.
function showSignWhileNear(player, spots) {
  let shown = null;
  let sign = null;
  onUpdate(() => {
    // (Not while he's falling in: he drops through a plaque's spot on the way.)
    const here = player.frozen ? null : spots.find((spot) => player.isColliding(spot.zone)) ?? null;
    if (here === shown) return;
    shown?.setLit(false);
    sign?.destroy();
    sign = null;
    shown = here;
    if (!here) return;

    here.setLit(true);
    const lines = [
      { text: here.credit.title, color: [255, 205, 70] },
      ...here.credit.lines.map((line) => (typeof line === "string" ? { text: line } : line)),
    ];
    const height = lines.length * 10;
    const popped = addSign(lines, here.x, here.y - 26 - height / 2, {
      depth: 60, // over everything
    });
    tween(0.6, 1, 0.18, (size) => (popped.scale = vec2(size)), easings.easeOutBack);
    sign = popped;
  });
}

export function registerMenuScenes() {
  registerTitle();
  registerSubRoom("heroes", "Heroes", setupHeroes,
    () => `You are the ${heroById(getSetting("hero")).name}. Walk up to another hero to swap.`);
  registerSubRoom("options", "Options", setupOptions, () => "Walk into a block to bump it along its rail and change the volume.");
  registerSubRoom("credits", "Credits", setupCredits, () => "Made with these, thank you! Walk up to a plaque to read it.");
}
