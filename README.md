# Who Wants To Be A Dungeon Crawler

A pixel-art dungeon crawler that runs in the browser. Waves of monsters rise from the floor of every room, and the door deeper stays chained until they're all beaten. Ten rooms down, a boss waits.

![A room of the game: the knight swinging at goblins and an orc in front of the chained door, with two of three hearts left](assets/social/screenshot.png)

**[▶ Play it in your browser](https://dungeon-crawler.salihonder.dev)**

## How to play

| Key | Action |
|---|---|
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrow keys | Move |
| <kbd>Space</kbd> | Attack |
| <kbd>Shift</kbd> | Dash |
| <kbd>E</kbd> | Open a door, pull a lever, climb a ladder, pick a hero, visit a credit's link |

The menu is a room too: walk through **PLAY** to start, or explore **HEROES**, **OPTIONS** and **CREDITS**. In the dungeon, waves of monsters rise from the floor and the door on the back wall stays chained until you've beaten them all. Then walk through it and drop into the next room, ten rooms deep, with the boss in the last one. You have 3 hearts for the whole run, and monsters sometimes drop one when you're missing one. There are no pop-up screens: a run ends in a room too, either in the treasure room or down in the underworld, with your stats written on the floor and ladders to try again or go back to the menu.

On phones and tablets, touch controls appear: drag anywhere on the left for a joystick, and use the Attack and Dash buttons on the right. A Use button pops up next to them whenever there's something to use. Held upright, the controls sit below the game; held sideways, they sit beside it.

## Features

- **Ten rooms deep:** each room is a fight, and its door only unchains once every wave is beaten. Deeper rooms send more waves, and tougher monsters in them.
- **Endings you walk around in:** get through the last door into the treasure room, where heaps of gold flow out of the corners toward the middle (and scatter when you run through them), and your stats are written on the floor. Lose your last heart and little hands reach up out of the floor and drag your body down into the underworld, a red room with lava fountains, where your stats wait for you. Both have ladders to try again or return to the menu.
- **Combat in waves:** monsters rise from the floor in waves (zombies, then goblins, then orcs as you go deeper), and the next wave starts as the last one is nearly beaten. Each hit costs one of your 3 hearts for the whole run. A quick dash on a cooldown helps you get into position, and a tiny hit-stop makes every hit land with weight.
- **Hearts to win back:** monsters can drop a heart, but only while you're missing one, so you have to keep fighting while hurt to earn it. A bad-luck counter makes sure the drops don't dry up, and a dropped heart blinks out after a few seconds.
- **A boss fight that keeps you moving:** the Big Zombie in the last room casts a random move every couple of seconds, each with its own warning flash: a dash that leaves a trail of fire, a ring of 12 projectiles, or raising minions. Once the projectiles turn yellow, a swing bats them back at the boss. Below half health it becomes enraged: it dashes twice, fires a second ring that covers the gaps in the first, and raises tougher minions.
- **10 playable heroes, each with their own weapon:** pick one in the Heroes room, and it's remembered.
- **A run timer:** the faster you clear rooms, the better your time.
- **A volume mixer you walk around in:** sound effects and music each have a slider on the floor, a stone block you knock along a rail from 0 to 10, one notch per hit of your weapon, so you can set your own mix of effects and music. Screen shake is a lever. All of it is remembered between visits.
- **Sound and music made in code:** sound effects are generated with ZzFX, and the background music is a chiptune loop composed in code with the Web Audio API. There are no audio files.

## How it works

Plain JavaScript (ES modules) with the [Kaplay](https://kaplayjs.com) game engine. There's no build step: the browser loads `index.html` and the files in `src/` directly, and GitHub Pages hosts it.

A few parts worth a look:

- **One set of controls for keys and touch** ([`src/touch.js`](src/touch.js)): the game listens for named buttons (attack, dash, use) instead of keys. The keyboard is bound to them, and the on-screen buttons press the same ones, so no game code knows which was used. The joystick is analog: a small push walks slowly.
- **One interaction system** ([`src/interact.js`](src/interact.js)): doors, levers, heroes, ladders and plaques all work the same way. Each is a zone, a prompt and a `use()` function, and one small module handles detecting the nearest one, the on-screen prompt and the key presses.
- **Cutscenes with `async`/`await`** ([`src/cutscenes.js`](src/cutscenes.js)): Kaplay's tweens and timers are wrapped in Promises, so sequences like "open the door, walk in, fade out" read top to bottom.
- **Layered drawing:** when the knight steps into a doorway, he's drawn behind the door frame but in front of the darkness behind it, using draw order (`z`), so he really walks *into* the door.
- **Crisp pixels** ([`src/display.js`](src/display.js)): the game is drawn at 320×208 and scaled up by a whole number of real screen pixels (accounting for `devicePixelRatio`) when that keeps most of the space, so every pixel is the same size. The strip above it is HTML, sized in game pixels and scaled together with the game as one picture, so it keeps its shape on every screen.
- **Procedural music** ([`src/music.js`](src/music.js)): notes are written as data (`"E5 . . D5 C5"`) and scheduled ahead of time on the Web Audio clock for precise timing.
- **A pacing simulator** ([`tools/simulate.mjs`](tools/simulate.mjs)): the numbers that shape progression live in one data file ([`src/balance.js`](src/balance.js)), and a Node script plays them. It steps through each room one swing at a time, rolls dice for hits and drops, buys upgrades between runs the way two kinds of shopper would, and reports how long a depth takes and whether every careful run can afford an upgrade. Run it with `node tools/simulate.mjs`.

## Project structure

```
index.html            the page: the strip and the game area
style.css             strip and touch control styles
src/
  main.js             entry point: sets up Kaplay, loads everything, opens the title room
  config.js           shared sizes, speed and colors
  menu.js             the title room and the Heroes, Options and Credits rooms
  scenes.js           the dungeon's rooms
  endings.js          the two rooms a run can end in: the treasure room, and the underworld
  cutscenes.js        falling in, walking through doors, ladders, being dragged down
  interact.js         using doors, levers, heroes, ladders and plaques
  combat.js           swinging weapons, hearts, heart drops, getting hurt
  mobs.js             monster types, waves, rising from the floor, chasing
  boss.js             the boss's moves: dash and fire trail, projectile rings, raising minions, rage
  player.js           the hero: walking and dashing
  touch.js            touch controls: the joystick and buttons
  doors.js, room.js, props.js, heroes.js   building the rooms and characters
  panel.js            what the strip says
  dungeon.js          a run: its rooms, hearts and clock
  sound.js, music.js  sound effects and music
  balance.js          every number that shapes the game: the clock, monsters, rooms, drops, the skill tree
  settings.js         remembered settings (localStorage)
  display.js          whole-pixel scaling
  effects.js          fades, flashes, dust, screen shake, hit-stop
assets/               the tileset, fonts, icons and preview images
lib/zzfx.js           ZzFX sound generator
tools/                the pacing simulator (Node), which plays the numbers in src/balance.js
DESIGN.md             the design plan
```

## Running it locally

The game is made of ES modules, which browsers only load from a server, so it needs to be served rather than opened as a file. Any static server works, for example:

```bash
python -m http.server 8000
```

Then open http://localhost:8000. In VS Code, the Live Server extension works too.

## Credits

- Game by [Salih Önder](https://salihonder.dev)
- Art: [16x16 DungeonTileset II](https://0x72.itch.io/dungeontileset-ii) by 0x72 (CC0)
- Pixel font: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) by CodeMan38 (SIL Open Font License, see [`assets/fonts/OFL-LICENSE.txt`](assets/fonts/OFL-LICENSE.txt))
- Text font: [Atkinson Hyperlegible](https://fonts.google.com/specimen/Atkinson+Hyperlegible) by the Braille Institute (SIL Open Font License, see [`assets/fonts/ATKINSON-HYPERLEGIBLE-OFL.txt`](assets/fonts/ATKINSON-HYPERLEGIBLE-OFL.txt))
- Engine: [Kaplay](https://kaplayjs.com)
- Sound effects: [ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force (MIT, see [`lib/ZZFX-LICENSE.txt`](lib/ZZFX-LICENSE.txt))
- Built with Claude (Anthropic) as a pair programmer

## License

The game's code is released under the [MIT License](LICENSE). The third-party assets keep their own licenses: the tileset is CC0, both fonts are under the SIL Open Font License, and ZzFX is MIT (see Credits).
