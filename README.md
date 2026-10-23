# Who Wants To Be A Dungeon Crawler

A pixel-art dungeon crawler that runs in the browser, built as a timed incremental game. Runs are short: the clock starts at 15 seconds and you have one heart. Monsters rise from the floor of every room, every kill fills the room's XP bar, and a full bar unchains the door deeper. Ten rooms down, a boss waits.

![Room 1-3 of the game: the knight mid-swing at a skeleton, a damage number popping up, with the clock at 27, the XP bar part-filled toward the chained door, 47 gold and one of three hearts left](assets/social/screenshot.png)

**[▶ Play it in your browser](https://dungeon-crawler.salihonder.dev)**

## How to play

| Key | Action |
|---|---|
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrow keys | Move (the hero swings on their own, the way they're facing) |
| <kbd>E</kbd> | Open a door, pull a lever, climb a ladder, use the altar, pick a hero, visit a credit's link |
| <kbd>Shift</kbd> | Dash, once it's unlocked |

The menu is a room too: walk through **PLAY** to start, or explore **HEROES**, **OPTIONS** and **CREDITS**. In the dungeon, the hero swings automatically whenever there's a monster up, so you only move: face the monsters to hit them, and keep away from them. Monsters rise as you land, more keep coming, and every kill fills the XP bar at the top of the room. When it's full, the door unchains and you drop into the next room. The clock at the top left only runs while you're in control; beside it, an hourglass shows how much of all the time the run has had is still left, its sand pouring while the clock runs. When it reaches 0, or a monster gets you, the run is over: little hands reach up out of the floor and drag you down to the underworld, where the run's results are written on the floor. Gold you pick up is banked, and the altar in the middle of the underworld spends it on the skill tree. After the first visit, a well in the title room leads straight down to it.

In the tenth room, once its bar is full, the clock stops and the Big Zombie makes its entrance: the room shakes, the monsters still up crumble into coins, and it rises in the middle of the room and roars. Beat it, and it bursts into a pile of coins and leaves a well down to the underworld and a ladder up to the menu.

The skill tree works with the mouse or the keyboard. Point at a node to read it, click it to pick it and click it again to buy it; hold the button and drag to look around, and use the wheel to zoom. With the keyboard, the arrow keys or <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> move between nodes, <kbd>E</kbd> buys, <kbd>+</kbd> and <kbd>-</kbd> zoom, and <kbd>Esc</kbd> closes it.

The game needs a keyboard. On phones and tablets, a notice says so.

## Features

- **Rooms that fill an XP bar:** monsters rise as you land, a horde arrives every 20 seconds whether or not the room is clear, and when the last monster falls, another rises at once. Every kill fills the room's bar, split in two halves on either side of the door, and a full bar unchains it. The monsters still up stay, for their gold, if you want it.
- **A clock that ends the run:** 15 seconds at the start, counting down only while you're in control, red and ticking for the last five. A monster's touch costs a whole heart, and a special attack (a boss's move, a fireball, fire, a blast) costs two or three; you start with one.
- **The crypt's monsters:** slugs crawl about without hunting you, so the first rooms are calm practice; from room 3, tiny zombies chase you; from room 5, skeletons rattle as a warning and then charge in a straight line. Each kind gets more common after it first shows up, until the next one arrives, so room 10 is about a third of each. Deeper rooms bring more monsters, with more health. Every hit's damage pops up as a number.
- **Restless graves in the crypt:** a tiny zombie or skeleton that falls may leave a grave, and climbs back out of it a few seconds later unless you walk over it and stamp it flat. Gravedigger, bought with bones in its own row at the top of the skill tree, makes each stamp pay some of the monster's gold again and a little time.
- **Coin thieves in the warrens:** some goblins carry a sack and go for coins left on the floor, scoop them up and run for a burrow in the side walls. One that gets away takes the coins for good and climbs back out later to steal again; one caught on the way drops double what it carried. Sticky fingers, bought with teeth at the altar, makes a caught thief drop even more.
- **Depth 5, the demon pit:** deep red with lava pouring down the walls, and the Big Demon at the bottom. Chorts mark a spot next to you with smoke and teleport onto it, pumpkin dudes leap at you and land with a shockwave, and plague doctors lob flasks over the pillars that burst into fire.
- **Depth 4, the sunken swamp:** murky green with goo on the walls. Swampies split in two when they fall, muddies leave trails of mud that slow you down, and necromancers keep their distance and raise ice zombies.
- **Depth 3, the orc fort:** cold stone with red banners. Orc warriors shove you across the room, orc shamans keep their distance and heal the monsters around them, and masked orcs block hits from the front with a shield, so you circle round them.
- **Depth 2, the goblin warrens:** beating the Big Zombie opens a second depth, picked at a signpost in the underworld. Its rooms are tinted earthy brown, with their own layouts and monsters several times tougher: goblins rush you, imps keep their distance, spread out around you and throw fireballs you have to dodge, and wogols run up, flash and explode, even after they're beaten. An ogre waits in the last room.
- **Rooms with something in them:** every room is one of three designed layouts, picked at random: pillars to hide behind, floor spikes that pop up on a beat (with a warning), and pots, crates and a big urn to smash for gold. From room 6, a chest might be waiting: hit it and it opens into coins, unless it's a mimic, which snaps open and comes after you. From there on, kills drop the depth's material too: bones in the crypt, then teeth, tusks, slime and embers.
- **Gold on the floor:** kills drop their gold as coins and stones, the biggest that fit (emeralds worth 5, sapphires 100, rubies 10K, amethysts 1M and diamonds 100M), so each depth brings its own stone, and a small magnet pulls in the ones you get close to. Gold left behind when you go through the door are lost; when a run ends, the ones still on the floor fly to you from all over the room as you're dragged down.
- **The underworld:** every run ends there, dragged down by the hands, with the results on the floor (how it ended, the gold earned and banked, how deep it got, the kills), an altar in the middle and ladders to try again or return to the menu. The altar's sigil glows when there's something you can afford.
- **A skill tree at the altar:** a branching tree of 365 nodes drawn over the room, growing out of Descend in the middle. Six themes (weapon, hearts, money, time, the horde and the dash) each leave Descend as a short trunk and fork into branches that fork again further out, and every branch alternates between two different upgrades (damage and swing speed, a share more gold and a flat bounty per kill, more time and more seconds per kill...), so each step is a choice of what's holding the run back. Bridges here and there cross from one theme into the next, and each deeper depth's nodes sit further out (a new edge, critical hits and how hard they hit, more hearts, its own clock and spawn upgrades, and more). Each node is bought once; most are small steps and some are big ones, twice as strong for about twice the price, give or take. You only see the nodes you own and the ones linked to them, and buying one reveals its neighbours. The whole tree is drawn as a text map (`src/treemap.js`), one letter per node with the links between them. A deeper depth's nodes can be bought early, at ten times the price.
- **Each depth starts over:** each depth's monsters have far more health and drop far more gold than the last one's, its upgrades cost as much more, and the clock and spawn upgrades only work in the depth they were bought for, so each new depth begins with the same struggle as the first, just with bigger numbers. Damage, the swing, hearts, the dash and money carry over. The panel at the bottom shows what the next level does ("DAMAGE 1 > 2", or "MAGNET RANGE +25%") and what it costs.
- **Saved progress:** banked gold and bought upgrades are saved in the browser after every run and every purchase. The Options room has a red reset button that asks twice before it erases them.
- **A dash and time orbs from the tree:** the dash (Shift) is bought at the altar. Each dash uses a charge that takes 2.5 s to fill; Quick feet shortens it and Second charge adds another, shown as small bars under the hero's feet. Time orbs are rare drops that add seconds to the clock when picked up.
- **Hearts to win back:** with more than one heart, monsters can drop a heart while you're missing one. A bad-luck counter makes sure the drops don't dry up, and a dropped heart blinks out after a few seconds.
- **A boss fight that keeps you moving:** the Big Zombie makes its entrance in the last room once its bar is full, and the clock stops for it. It casts a random move every couple of seconds, each with its own warning flash: a dash that leaves a trail of fire, a ring of 12 projectiles you have to dodge, or raising tiny zombies. Below half health it becomes enraged: it dashes twice and fires a second ring that covers the gaps in the first.
- **10 playable heroes, each with their own weapon:** pick one in the Heroes room, and it's remembered.
- **A volume mixer you walk around in:** sound effects and music each have a slider on the floor, a stone block you bump along a rail from 0 to 10, one notch per bump, so you can set your own mix of effects and music. Screen shake is a lever. All of it is remembered between visits.
- **Sound and music made in code:** sound effects are generated with ZzFX, and the background music is a chiptune loop composed in code with the Web Audio API. There are no audio files.

## How it works

Plain JavaScript (ES modules) with the [Kaplay](https://kaplayjs.com) game engine. There's no build step: the browser loads `index.html` and the files in `src/` directly, and GitHub Pages hosts it.

A few parts worth a look:

- **One interaction system** ([`src/interact.js`](src/interact.js)): doors, levers, heroes, ladders, plaques, the altar and the well all work the same way. Each is a zone, a prompt and a `use()` function, and one small module handles detecting the nearest one, the on-screen prompt and the key presses.
- **Cutscenes with `async`/`await`** ([`src/cutscenes.js`](src/cutscenes.js)): Kaplay's tweens and timers are wrapped in Promises, so sequences like "open the door, walk in, fade out" read top to bottom.
- **Layered drawing:** when the knight steps into a doorway, he's drawn behind the door frame but in front of the darkness behind it, using draw order (`z`), so he really walks *into* the door.
- **Crisp pixels** ([`src/display.js`](src/display.js)): the game is drawn at 320×208 and scaled up by a whole number of real screen pixels (accounting for `devicePixelRatio`) when that keeps most of the space, so every pixel is the same size. The strip above it is HTML, sized in game pixels and scaled together with the game as one picture, so it keeps its shape on every screen.
- **Procedural music** ([`src/music.js`](src/music.js)): notes are written as data (`"E5 . . D5 C5"`) and scheduled ahead of time on the Web Audio clock for precise timing.
- **A pacing simulator** ([`tools/simulate.mjs`](tools/simulate.mjs)): the numbers that shape progression live in one data file ([`src/balance.js`](src/balance.js)), and a Node script plays them. It steps through each room one swing at a time, rolls dice for hits and drops, buys upgrades between runs the way two kinds of shopper would, plays all five depths in a row, and reports how long each depth and each room takes and whether every careful run can afford an upgrade. Run it with `node tools/simulate.mjs`.

## Project structure

```
index.html            the page: the strip and the game area
style.css             strip styles, and the notice for phones
src/
  main.js             entry point: sets up Kaplay, loads everything, opens the title room
  config.js           shared sizes, speed and colors
  menu.js             the title room and the Heroes, Options and Credits rooms
  scenes.js           the dungeon's rooms
  endings.js          the underworld, where every run ends, with its results and the altar
  tree.js             the skill tree page: the branches, what's revealed, zoom and drag, buying
  nodes.js            the skill tree's nodes, built from its map, and what can be seen and bought
  treemap.js          the skill tree's map, drawn as text: its nodes and the links between them
  cutscenes.js        falling in, walking through doors, ladders, the well, being dragged down
  interact.js         using doors, levers, heroes, ladders and plaques
  combat.js           the automatic swing, hearts, heart and time-orb drops, getting hurt
  mobs.js             monster types, spawning, rising from the floor, chasing, the skeleton's charge, the mimic, the imp's distance-keeping, the wogol's blast
  shots.js            fireballs and spit: thrown at the hero, dodged, stopped by walls and pillars
  crypt.js            the rooms' pillars, floor spikes, breakables and chests
  graves.js           the crypt's restless graves: left by fallen undead, stamped flat or risen from
  thieves.js          the warrens' coin thieves and the burrows they run for
  layouts.js          each depth's designed room layouts, as small text grids
  coins.js            coins, stones and the depths' materials on the floor, and the magnet
  hud.js              the clock (and the seconds time orbs add), the XP bar, the gold, and damage numbers
  boss.js             the boss's moves: dash and fire trail, projectile rings, raising minions, rage
  player.js           the hero: walking and dashing
  doors.js, room.js, props.js, heroes.js   building the rooms and characters
  panel.js            what the strip says
  dungeon.js          a run: its depth, hero, hearts, clock and gold
  stats.js            what the skill tree's upgrades do to the hero, and what they cost
  save.js             banked gold, bought upgrades and the reset (localStorage)
  sound.js, music.js  sound effects and music
  balance.js          every number that shapes the game: the clock, monsters, rooms, drops, the skill tree
  settings.js         remembered settings (localStorage)
  display.js          whole-pixel scaling
  effects.js          fades, flashes, dust, screen shake
assets/               the tileset, fonts, icons and preview images
lib/zzfx.js           ZzFX sound generator
tools/                the pacing simulator (Node), which plays the numbers in src/balance.js,
                      and layouts-check.mjs, which checks the room layouts are fair
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
