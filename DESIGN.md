# Design plan

The plan for turning the game into an incremental dungeon crawler. It is a
living document: each section is filled in as its decisions are made, and
nothing is built until the plan is settled.

**Status:** the first full draft, under review. The hook (section 4), the
use of bones and trophies, and depths 2–5 are decided later.

## The pitch

A timed incremental dungeon crawler. Runs are very short and you start
almost helpless: one heart and a few seconds on the clock. Everything you
earn goes into a skill tree, and each run gets a little further down. There
are 5 depths of 10 sub-depths each, and a full playthrough should take about
3 to 4 hours.

The quiz is gone. The new game is pure linear progression.

## 1. References and feel

- **Closest to:** timed incrementals (such as Nodebuster). Short timed runs,
  a big skill tree, numbers that go up fast, and something to buy after
  nearly every run.
- **What sets these games apart** is the art, the music and one crucial
  mechanic of their own (see section 4).

## 2. The core loop

- **A run** starts at sub-depth 1 of a depth you choose. Any depth you have
  unlocked can be picked, so you can go back to an easier one to farm.
- **It ends** when you die or the clock runs out.
- **You keep everything** you earned in the run, either way. Every run pays
  out, so even a bad one moves you forward.
- **Between runs** you're in the underworld, where an altar opens the skill
  tree (see section 9). Then you climb the TRY AGAIN ladder for the next run.
- **Starting state:** 1 heart, so the first hit kills you. More hearts are
  bought in the tree.
- **Inside a run** there are small pickups but no lasting power. Lasting
  power comes only from the tree. Pickups might be heart drops, a time orb
  for a few extra seconds, or a burst of gold. Unlocking and improving these
  is part of the tree.
- **The loop between strength and spawns** is what keeps people hooked.
  Upgrades that make you stronger soon mean you clear monsters faster than
  they appear, and you're left waiting for spawns. So you buy spawn
  upgrades, until there are more monsters than you can handle, so you buy
  strength again, and round it goes. The numbers are tuned so neither side
  stalls for long.

## 3. Structure

- **5 depths × 10 sub-depths = 50 rooms.**
- **A sub-depth is one room.** It reuses the existing room and spawning
  code.
- **Rooms fill an XP bar**, the industry standard for these games:
  - **On entering,** a set number of monsters rise from the floor (5 to
    start). Upgrades raise it.
  - **Hordes** arrive on a timer, whether or not the room is clear: 7
    monsters every 20 s to start. The timer starts over in each room.
    Upgrades make hordes bigger and more frequent.
  - **There's always something to fight:** when the last monster falls,
    one more is spawned straight away.
  - **Each kill gives XP** toward the room's bar (and gold, separately).
    XP only counts for that room in that run.
  - **When the bar is full,** the door unchains and spawning stops. The
    monsters still up stay: kill them for their gold, or leave right away
    and save time.
  - **No limit** on how many monsters are up at once. The balance is the
    limit: see the loop in section 2.
- **Early rooms get faster as you get stronger.** More monsters and more XP
  per kill fill a bar faster, so on run 30 room 1 takes a few seconds
  instead of the 20 it took on run 1. Time goes where the challenge is.
- **Checkpoint per depth.** If a run ends before sub-depth 10 of a depth is
  cleared, that depth is still the deepest one unlocked, so the next run
  starts at its sub-depth 1 again. Beating sub-depth 10 unlocks the next
  depth.
- **Sub-depth 10 is a boss room.** Monsters spawn as in any room. When its
  bar is full, spawning stops and **the run clock stops**: you've already
  made it to sub-depth 10 in time, so the boss fight isn't a race. Only your
  hearts can end it. **The boss makes an entrance:** you're held still, the
  room shakes, every monster still up crumbles (dropping its coins, though
  it doesn't count as a kill), and if you're standing where the boss rises
  (the middle of the room) the floor shoves you to the nearest clear spot,
  facing it. It rises and roars, and then you're free to move: the fight
  starts with just the two of you. The boss raises its own minions as it
  fights. When it falls, it bursts into a pile of coins (its reward), and a
  **well** (down to the underworld, to buy upgrades) and a **ladder** (up to
  the main room) appear. Beating it unlocks the next depth. The three
  existing bosses (dash, vomit and spawn moves, plus a rage phase) are a head
  start, and two more are needed.
- **From sub-depth 1 to 9, rooms grow in four ways:**
  - bigger XP bars, and monsters with more HP
  - new mob types, introduced a few at a time across a depth
  - room hazards (spikes, lava and the like) deeper in a depth
  - room layouts: pillars and walls, so rooms aren't all the same open box
- **Each depth has its own theme:** its own look (tileset tint and props),
  its own mob roster and its own music. Unlocking a depth should feel like
  arriving somewhere new.

### Draft: depth 1, the crypt

Mobs, in the order they're met: slugs (wanderers: they crawl about slowly
and never come after you, so the first rooms are calm practice for moving
and the swing's timing), tiny zombies (chasers) and skeletons (rushers:
they wind up, then charge in a line). Chest mimics are the surprise late in
the depth. (Slugs used to split into tiny slugs; since they became the
wanderers, they don't.) Each monster gets more common for a few rooms
after it's introduced, until a newer one eats into its share; by room 10
it's about a third each.

| Sub-depth | What's new | Spawns: slugs / zombies / skeletons |
|---|---|---|
| 1 | Slugs, pots | 100% / – / – |
| 2 | | 100% / – / – |
| 3 | Tiny zombies, the first pillars | 75% / 25% / – |
| 4 | Floor spikes | 60% / 40% / – |
| 5 | Skeletons | 50% / 40% / 10% |
| 6 | Crates (a few hits), bones start dropping | 45% / 38% / 17% |
| 7 | Chests that may be mimics | 40% / 37% / 23% |
| 8 | More spikes, tighter layouts | 36% / 35% / 29% |
| 9 | A big sturdy breakable (many hits, lots of gold) | 33% / 34% / 33% |
| 10 | **Big Zombie** | 30% / 35% / 35% until its bar fills; then the boss appears and raises tiny zombies |

What's in the rooms (built in step 6):

- **Layouts:** each sub-depth has three designed layouts, and every time a
  room is entered one is picked at random. They're written as small text
  grids in `src/layouts.js` (one character per floor tile), and
  `node tools/layouts-check.mjs` checks the rules that keep them fair:
  - the door, the landing spot, the strip under the hearts (the bottom row's
    middle) and, in room 10, the boss's arena and the ladder and well it
    leaves stay clear, with no pillar just below them rising into them
  - a chest is at least 3 tiles from the landing spot (it might be a mimic)
  - every floor tile can be reached, and every breakable can be hit
  - there's always a way from the landing spot to the door without
    crossing spikes
  - each room holds exactly the breakables, chest and spikes that
    `balance.js` says (the pacing simulator counts on it)
- **Pillars** (from room 3): solid at the base, tall, so they hide what's
  behind them. Cover from a skeleton's charge.
- **Floor spikes** (from room 4): all of a room's spikes move together:
  down for 1.6 s, then the tips peek out for 0.45 s (the warning), then up
  for 0.6 s. Standing on them while they're up costs a heart, like a
  monster's hit. Only the hero gets hurt.
- **Breakables:** pots (one hit), crates (a few) and, in room 9, the big
  urn (many hits, lots of gold). They're solid until smashed; their hp and
  gold grow with the sub-depth, and Smash adds to their gold. The tileset
  has crates; the pots and the urn are drawn in code in its colors. The
  hero only swings at one when it's within reach.
- **Chests** (rooms 6 to 9, not every time): closed, a real chest and a
  mimic look exactly the same. A real one takes a few hits and opens into a
  pile of coins, and stays there, open and empty. From room 7, a chest may
  be a mimic: it snaps open when the hero comes close (or hits it), shakes
  in gold for 0.4 s (time to back off), and then lunges at him like a
  skeleton.
- **The boss's dash** stops at pillars, breakables and chests, as at a wall.
- **Bones** (from room 6): a kill may drop one (2%, plus 2% a room deeper),
  picked up like a coin. They're saved and shown on the run's results, and
  don't buy anything yet.

### Depth 2, the goblin warrens

The same kind of rooms as the crypt, tinted a warm, earthy brown, with
their own three layouts per room (the same breakables, spikes and chests as
the crypt's room at that sub-depth, arranged as burrows). Its monsters have
10x the hp and 10x the gold of their numbers in `balance.js` (the depth's
`scale`), so the power curve starts over: the 11 damage that one-shots the
crypt's monsters by its end takes 3 hits on a 30 hp goblin, the way 1
damage did on a 3 hp slug at the crypt's start. The clock and the spawns
start over too (see "Each depth starts over" in section 7). Its monsters
follow the crypt's spawn rule:

| Sub-depth | What's new | Spawns: goblins / imps / wogols |
|---|---|---|
| 1–2 | Goblins: fast chasers | 100% / – / – |
| 3 | Imps: shooters | 75% / 25% / – |
| 4 | | 60% / 40% / – |
| 5 | Wogols: bombers | 50% / 40% / 10% |
| 6–9 | | easing to 33% / 34% / 33% |
| 10 | **The ogre** (a stand-in until the warrens have their own boss) | 30% / 35% / 35% until its bar fills; then the ogre appears and raises goblins |

- **Imps** keep their distance: each heads for a spot about 80 px from the
  hero, on its own side of him, nudged around him away from the other imps,
  so they spread out and come at him from different angles. They never run
  off to a far corner. Every few seconds one stops, glows orange for half a
  second and throws a fireball at where he is. Fireballs are a little
  slower than he walks, and pillars, crates and chests stop them.
- **Shots can only be dodged.** A swing does nothing to a fireball or to
  the Big Zombie's spit: neither can be batted back or broken. (Shielding
  or dodging may become the hook.)
- **Wogols** run at him, and once close they stop, flash, swell, and go off
  0.7 s later, with the blast's reach marked on the floor. Beating one
  doesn't stop it: it goes off where it fell, a moment later. The blast
  costs him a heart if he's inside the mark, and doesn't hurt other
  monsters. One that goes off by itself is gone, with no gold or XP.
- **No material yet:** the warrens' teeth come later; for now nothing drops
  but coins, hearts and orbs.

### Depths 3 to 5

Each one follows the warrens' recipe: the same kind of rooms with three
layouts of their own per room, a tint and something on the back wall, three
monsters met in rooms 1, 3 and 5 with the same spawn rule, monsters with 10x
the hp and gold of the depth before, and a ring of its own in the tree. A
stand-in boss waits in room 10 for now (each depth's real boss and its
special gimmick come later).

**Depth 3, the orc fort:** cold grey-blue stone, red banners on the back
wall, 100x the crypt's numbers (an orc warrior has 300 hp). The ogre stands
in as the boss, raising orc warriors.
- **Orc warriors** (rooms 1–2) are brutes: chasers whose hits shove the hero
  far, and that barely budge when he hits them.
- **Orc shamans** (from room 3) keep their distance like the imps. Every few
  seconds, if a monster near one is hurt, it glows green and sends out a
  healing pulse: every monster within reach (not itself, not a boss) gets
  back 30% of its health, shown in green. They're the ones to reach first.
- **Masked orcs** (from room 5) carry a shield, drawn on the side they face.
  They walk at him but turn slowly; a hit from in front only does a quarter
  of its damage (a grey number and a clank), one from the side or behind
  does it all. Circling one, or dashing past it, gets round the shield.

**Depth 4, the sunken swamp:** murky green, goo dripping down the back wall,
1000x the crypt's numbers. A swamp-green Big Zombie, the "Bog Zombie",
stands in as the boss, raising swampies.
- **Swampies** (rooms 1–2) are slime blobs that split into two small
  swamplets when they fall (1 hp in balance.js, before the depth's scale).
- **Muddies** (from room 3) chase him and leave a trail of mud puddles.
  Each lasts 4 s, and while he stands in one he walks at 55% of his speed
  (the dash isn't slowed).
- **Necromancers** (from room 5) keep their distance. Every few seconds,
  while fewer than four of their ice zombies are up, one glows purple and
  raises two around itself (chasers, worth half a normal kill's XP). They
  stop once the bar is full, like the room's own spawns.

**Depth 5, the demon pit:** deep red, lava pouring from two fountains in the
back wall, 10000x the crypt's numbers. The Big Demon waits in room 10,
raising chorts.
- **Chorts** (rooms 1–2) chase him, and every few seconds, when he's close,
  one marks a spot right next to him with a swirl of dark smoke, then
  vanishes in a puff and appears there. If he's moved away, it lands on the
  mark anyway.
- **Pumpkin dudes** (from room 3) crouch, with where they'll land marked on
  the floor, then leap in an arc to the spot he was on. The landing's
  shockwave costs a heart if he's inside the mark. In the air they can't
  hurt him by touch, and they sail over pillars and crates.
- **Plague doctors** (from room 5) keep their distance and lob flasks. A
  flask sails over pillars in an arc, with where it'll land marked on the
  floor, and bursts into three patches of fire that burn for 3 s.
- **Big gold** shows short in the HUD: "123K", "12.3M".

## The run timer

- **Per run, and very short:** about 15–20 seconds at the start.
- **Grown through the tree.** For example:
  - flat extra time at the start of a run
  - extra time added each time you reach the next sub-depth in that run
  - more of the same kind (to be designed in section 7)
- **What this means for rooms:** the first rooms' XP bars have to be small
  enough that an early run fills one or two of them, mostly from the
  monsters that greet you and the one-at-a-time spawns, since a 15-20 s
  clock rarely lasts until the first horde.

## 4. The hook

**Deferred.** The hook will be chosen once the fundamentals are built and
playable. No extra features until then. The candidates so far, to come back
to:

- **Echoes:** past runs play back as ghosts that fight alongside you.
- **Overtime:** when the clock runs out, hands rise and chase you while you
  fight on for double pay.
- **Fork doors:** two doors per room with visible rewards, one of them a
  cursed high-risk door.
- **Gold is time:** one currency. Kills drop seconds, and the seconds left
  over are what you spend.
- **Hittable world:** pots, bells and levers that react to your weapon.

## 5. Combat and enemies

- **The hero attacks automatically** all game. You move (and dash). The
  swings happen on their own, survivor-style, so the game is about
  positioning and dodging.
- **Swings go where you're facing.** You aim by moving, which takes some
  skill. A retreat means turning back to fight.
- **No swinging at nothing:** when no monster is up (the room is empty, or
  the next ones are still rising), the swing is skipped, but its timer
  keeps the rhythm, so the next one comes exactly when it would have.
- **The swing starts slow:** one every 1.5 s. Quicker swing brings it down
  to about 0.6 s late in the game, so getting faster is a reward you feel,
  and one more way to grow the hero.
- **One weapon, upgraded through the tree:** damage, swing speed, reach and
  arc. More weapons can come later (the tileset has a dozen).
- **The dash is the main skill, but you start without it.** It's unlocked
  in the tree. After that it's your one button: Shift. (Space does nothing
  now that swings are automatic.) The controls on the title floor show only
  what you have: DASH appears once it's unlocked.
  - **Movement only.** A dash doesn't protect you and doesn't hurt mobs.
  - **Its length never changes.** The tree upgrades only its cooldown, and
    adds a second charge. A charge takes 2.5 s to fill at first; Quick feet
    takes 10% off per level (about 1.5 s at the top).
  - **The charges show under his feet:** a small bar per charge, full when
    it's ready and growing while it fills, only while one is missing.
    Every room starts with them full, and a charge bought at the altar
    comes ready.
  - **How charges refill:** if a charge takes *n* seconds, a second charge
    takes *2n* while the first one is ready, but its progress is kept as a
    percentage. Example with n = 4 s: one charge is ready and the second is
    halfway (4 of 8 s). You dash. Now no charge is ready, so the one that
    was halfway fills at the normal rate and is ready in n/2 = 2 s. Once
    it's ready, the next one takes 2n again.
- **Growing numbers.** Damage and HP are real numbers that pop up on every
  hit. Your first swing does 1. Late in the game you hit for thousands
  against mobs with thousands of HP.
- **Mob behaviors** across the game:
  - wanderers (crawl about and never hunt; they hurt on contact, but they
    never come after you), chasers (walk at you) and rushers (wind up, then
    charge in a line)
  - shooters that keep their distance and fire projectiles (the warrens'
    imps)
  - summoners (the necromancer raises skeletons) and splitters (something
    that splits in two when it falls; none in the crypt now)
  - bombers that run up and explode (the warrens' wogols), and mimics:
    chests that turn out to be
    monsters
- **The tileset has enough monsters** for five themed depths: tiny zombie,
  skeleton, goblin, imp, wogol, chort, orc warrior, masked orc, orc shaman,
  ice zombie, muddy, swampy, necromancer, pumpkin dude, slug, tiny slug and
  chest mimic. There are only three big sprites (big zombie, ogre and big
  demon), so two bosses will be scaled-up small mobs.
- **Draft depth themes** (only depth 1 matters for the first milestone):

  | Depth | Theme | Mobs | Boss |
  |---|---|---|---|
  | 1 | Crypt | tiny zombie, skeleton, slug | Big Zombie |
  | 2 | Goblin warrens | goblin, imp, wogol | a giant chest mimic? (the ogre stands in) |
  | 3 | Orc fort | orc warrior, masked orc, orc shaman | Ogre |
  | 4 | Sunken swamp | muddy, swampy, ice zombie, necromancer | a giant necromancer? |
  | 5 | Demon pit | chort, imp, pumpkin dude | Big Demon |

## 6. The economy

- **Three currencies:**
  - **Gold** drops everywhere and buys most nodes. It drops as green gems
    worth 5 and coins for the rest (8 gold is a gem and 3 coins), so a room
    full of kills doesn't bury the floor in coins, and the gems show you're
    earning more.
  - **A depth material** is different for each depth (bones in the crypt,
    teeth in the warrens, and so on) and rarer. **It doesn't buy tree
    upgrades.** It has another use, to be designed later. It's banked from
    the first milestone on. In each depth it doesn't drop in sub-depths 1–5,
    is rare in sub-depth 6, and gets more common in every deeper one.
  - **A boss trophy.** Each boss drops it once, the first time you beat it,
    so there are exactly 5 in the game. Repeat boss kills still pay gold.
    Its use is decided later, because the first milestone ends at the first
    boss.
- **For the first milestone, gold buys every node.**
- **Collecting:** drops land on the floor, and a small magnet pulls them in
  when you're close. The tree grows the magnet's range. Anything left behind
  when you go through the door is lost, so you choose between gold and time.
  When a run ends (death or time), the magnet covers the whole room for a
  moment: every coin still on the floor flies to you while you're dragged
  down, speeding up so even the far ones arrive, and any that don't make it
  before the screen goes dark count anyway. Leaving the boss room down the
  well or up the ladder does the same.
- **Gold comes as whole coins.** A kill's gold (with Greed) is rounded to
  the nearest coin, and is always at least 1. Greed works on kills; Smash
  works on breakables.
- **What pays out:**
  - mob kills
  - boss kills: a big payout, including repeat kills when you farm a depth
  - breakables of different toughness: a pot breaks in one hit and drops a
    little; a crate takes a few hits; something big and sturdy takes many
    hits and drops a lot. Their HP grows with depth like the mobs' HP.
- **Heart drops** are on from the start but rarer than today (currently 2%,
  plus 1% for every kill without a drop). The tree raises the chance.
- **Time orbs** don't drop at all until they're unlocked in the tree, and
  even then they're much rarer than hearts. An orb is a pickup, like a
  heart: a small glowing blue orb that hops out of the monster, bobs, is
  pulled in by the magnet, and blinks out after 8 s if it's left. Grabbing
  it adds its seconds to the clock, which flashes green with "+1S" rising
  under it. None drop while the clock isn't running (the boss fight), and
  the boss's entrance clears any left on the floor. Orbs come from kills, and depth
  1 has too few kills for orb upgrades to pay off, so **Orb finder and
  Bigger orbs are an investment for depth 2** (see "Buying early" in
  section 7).

## 7. The skill tree

- **A web from the middle.** One web starts at a single node in the center
  and branches outward into six branches: weapon, hearts, time, dash, money
  and horde. Every purchase opens up the nodes next to it.
- **Most nodes have levels**, for example Sharper blade 0/10 at +1 damage
  each, getting pricier every level. Special nodes are a one-time buy.
- **Revealed as you buy.** You see the nodes next to ones you own. Nodes
  further out show as dim outlines.
- No quiz lifelines.

### The tree page

- **Drawn in the game,** in pixel art, over the dimmed underworld, rather
  than as an HTML page: a round frame per node with an icon from the
  tileset (weapons, flasks, the heart, a coin, monsters) or a few hand-drawn
  pixels where it has none (an hourglass, an orb, dash marks, a magnet).
  Icons are never shrunk, so they stay crisp at every zoom: the long
  weapons show just the end you know them by (a head, or a hilt), and the
  tiny coin and skull are doubled.
  For a node with more than one level, each level is a pip around the
  frame, lit gold once bought. The frame's rim is gold when maxed, green
  when you can afford the next level, light when some levels are bought
  and grey otherwise.
- **The layout:** Descend in the middle, the weapon branch to the left and
  time to the right (the two longest), hearts and money above, dash and the
  horde below. Hearts and the horde split early, so they sit across from
  each other. At 1x the whole web fits on the screen.
- **Mouse and keyboard.** Point at a node to read it; click to pick it and
  click again to buy. Hold and drag to look around; the wheel zooms between
  1x, 2x and 3x (whole sizes, so the pixels stay crisp) around the cursor.
  The arrow keys or WASD move to the nearest node that way (the view slides
  along to keep it on screen), E buys, + and - zoom around it, Esc closes.
  The strip above the game says how it works while the page is open.
- **The panel at the bottom** shows the node under the cursor, or the
  picked one once a key is pressed: its name, its levels, what the next
  level changes ("SWING EVERY 1.50S > 1.36S") and its price, or why it
  can't be bought (maxed, or the node before it isn't bought). Distances
  a player never sees as a number (the magnet's range and the swing's
  reach) are shown as how much bigger the next level makes them: "MAGNET
  RANGE +25%", and once maxed, "+205% IN ALL".
- **Buying early:** a depth-2 node can be bought before depth 1's boss is
  beaten, at ten times the price (`earlyPrice` in `src/balance.js`); the
  panel says "EARLY 10X" and which depth it's for. It's for players who want
  to save up and overpower depth 1. Depth 2's nodes are priced in depth 2's
  gold, ten times richer, so ten times is what keeps it a real choice: Keen
  edge's first level (+10 damage) costs 200 gold early, a bit more than all
  ten levels of Sharper blade. In the pacing simulator, a shopper who goes
  for it finishes depth 1 in about 35 minutes instead of about 43.
- **Each depth starts over.** Some nodes only work in their own depth (the
  panel says "DEPTH 1 ONLY" or "DEPTH 2 ONLY"): the run's pacing, which is
  More time, Second wind, Crowded rooms, Bigger hordes and Restless dead.
  So depth 2 starts on a 15 s clock with the base spawns, and its ring has
  its own copies of them. Everything else carries over into every depth:
  damage, the swing, hearts, the dash, money, time orbs, Death calls and
  Wisdom.
- **Every node works:** since step 6 (the breakables, for Smash), every
  node does what it says.
- While the page is open, the hero waits at the altar and nothing else can
  be used.

### Draft nodes for the first milestone (depth 1)

Every node costs gold. Costs are set in section 8.

| Branch | Node | Levels | Effect |
|---|---|---|---|
| Center | Descend | 1 | The root. Owned from the start |
| Weapon | Sharper blade | 10 | +1 damage per level |
| Weapon | Quicker swing | 10 | Swings come 9% faster per level: from one every 1.5 s to about 0.6 s |
| Weapon | Longer reach | 5 | +10% reach per level |
| Weapon | Wider arc | 3 | The swing covers a wider angle |
| Hearts | Extra heart | 4 | +1 heart (up to 5) |
| Hearts | Steady nerves | 3 | Longer invincibility after a hit |
| Hearts | Lucky hearts | 5 | Hearts drop more often. Only reachable after Extra heart, because a heart only drops when you're missing one |
| Time | More time | 10 | +4 s at the start of a run |
| Time | Second wind | 5 | +1.5 s every time you reach the next sub-depth |
| Time | Time orbs | 1 | Unlocks time orbs: rare drops worth +1 s |
| Time | Orb finder | 5 | Time orbs drop more often (for depth 2) |
| Time | Bigger orbs | 3 | Time orbs are worth more (for depth 2) |
| Dash | Dash | 1 | Unlocks the dash |
| Dash | Quick feet | 5 | Dash cooldown 10% shorter per level |
| Dash | Second charge | 1 | A second dash charge (it refills at half speed, see section 5) |
| Money | Magnet | 5 | Pickups are pulled in from further away |
| Money | Greed | 10 | +10% gold per kill |
| Money | Smash | 3 | Breakables drop more gold |
| Horde | Crowded rooms | 10 | +1 monster when you enter a room (start: 5) |
| Horde | Bigger hordes | 10 | +1 monster per horde (start: 7; for depth 2) |
| Horde | Restless dead | 5 | Hordes come 2 s sooner (start: every 20 s; for depth 2) |
| Horde | Death calls | 5 | +3% chance that a kill spawns another monster |
| Horde | Wisdom | 10 | +10% XP per kill |

More time, Second wind and Crowded rooms only work in depth 1. Depth 2's
ring (the second ring, further out on each branch), priced in depth 2's
gold:

| Branch | Node | Levels | Effect |
|---|---|---|---|
| Weapon | Keen edge | 10 | +10 damage per level |
| Weapon | Critical hits | 5 | +4% chance per level that a hit does 3x damage (its number pops up bigger, in gold) |
| Hearts | Extra heart II | 2 | +1 heart |
| Time | More time II | 10 | +4 s at the start of a run (depth 2 only) |
| Time | Second wind II | 5 | +1.5 s every time you reach the next sub-depth (depth 2 only) |
| Time | Orb finder | 5 | Time orbs drop more often |
| Time | Bigger orbs | 3 | Time orbs are worth more |
| Dash | Quick feet II | 3 | Dash cooldown 10% shorter per level |
| Money | Greed II | 10 | +10% gold per kill |
| Horde | Crowded rooms II | 10 | +1 monster when you enter a room (depth 2 only) |
| Horde | Bigger hordes | 10 | +1 monster per horde (start: 7; depth 2 only) |
| Horde | Restless dead | 5 | Hordes come 2 s sooner (start: every 20 s; depth 2 only) |

Each depth after that gets a ring of the same seven, further out again and
priced ten times higher: an edge (Brutal edge: +100 damage per level in
depth 3, and ten times more each depth after), its own More time, Second
wind, Crowded rooms, Bigger hordes and Restless dead, and another Greed.
On the tree page, the per-depth clock upgrades run along their own track
beside the time branch, one depth after another, and each depth's horde
upgrades sit two rings further out than the depth before's.

Depth 1's rooms fill their bars before most hordes arrive, so the horde
upgrades start in depth 2. A deeper depth's nodes can be bought early at
ten times the price (see "Buying early"). The tuned numbers (costs, and the
exact effects) live in `src/balance.js`.

## 8. Pacing

- **Every depth takes about 40 minutes for a typical player**, from its
  first run to beating its boss. 5 × 40 minutes is about 3.3 hours. A
  typical player is a bit slower than perfect: about 20% slower clears, 10%
  of the gold missed, and more hits taken. A sharp player is faster (about
  30 minutes).
- **The first run:** you die fast, but you earn enough for 1–2 cheap
  upgrades straight away. The whole loop makes sense within the first
  minute.
- **No upgrades, no room 2.** Without upgrades, room 1's bar can't be
  filled, however well you play: the first clock is 15 s, the slugs take 3
  hits (and have to be walked to), and the bar is big enough. Room 2 opens
  up after about 6–8 upgrades, around the fourth or fifth run. The
  simulator checks both: with no upgrades, not even a sharp player (one who
  walks and dodges 20% better than its efficient one; nobody swings faster
  than the swing's timer) gets through room 1, and it fails if one does. It
  also reports the margin (how many more seconds on the first clock he'd
  need), and the run and number of upgrades room 1 takes.
- **Costs multiply per level** by a fixed factor of about ×1.4–1.6,
  different for each node.
- **The golden rule: a typical careful run always buys something.** A run
  played well (clearing rooms as fast as the current upgrades allow, and
  collecting the gold), with average luck, always earns enough for at least
  one node. Until the tree is fully bought, there must always be a reachable
  node whose next level costs no more than such a run earns. Luck is real
  (a hit costs a whole heart), so the simulator plays each run many times
  and checks the middle result. It fails if the rule breaks, and warns when
  a run has less than 1.3× the cheapest price to spare. An unlucky run, cut
  short by an early hit, may still come up short.
- **Purchase rhythm:** how many upgrades a run's gold buys.
  - **None:** never (the golden rule).
  - **1:** rarely.
  - **2–4:** most runs, some at the low end and some at the high end.
  - **5 or more:** almost never, except near the end of a depth. There, a
    short spree is fine: cleaning up the cheaper levels skipped while going
    for something else. It shouldn't be a big one (about 8 at most).
  The simulator reports the share of runs in each group, and the spree.
  Bigger nodes can still take a few runs of saving up, if you choose to
  save for them.
- **Walls** (where the cheap upgrades run out and the next room is too
  hard) should be short. A short wall is satisfying to break; a long one is
  where people quit. No single room should drag either: each takes a few
  minutes to get through the first time (the boss longer).
- **A pacing simulator** tunes the numbers. It's a small Node script in
  `tools/` that reads the same data file as the game, plays the economy by
  the numbers (room times from damage and time, hits and drops rolled with
  dice, buying upgrades the way a player would, including more time when
  the clock keeps stopping them at the same spot), and reports how long
  depth 1 takes, its spread, how long each room takes to get through, and
  where the walls are. Its guesses about players are checked against the
  game where they can be: the walk over to a slug was measured with a bot
  playing room 1. After that, the numbers are fine-tuned by playing.

A rough estimate to size things by:

- 3.5 hours is about 210 minutes, or about 40 minutes per depth.
- Runs grow from about 20 seconds early on to a few minutes late in the game.
  If the average run, including time in the tree, is about 1.5 minutes, the
  whole game is about 140 runs, or 25–30 per depth.
- So the tree's costs have to stretch across that many runs. All costs and
  rewards will live in one data file so they are easy to tune.

## 9. The hub

- **The title room stays**, with its doors to PLAY, HEROES, OPTIONS and
  CREDITS. Hero choice stays as a cosmetic.
- **The underworld is the hub.** When you die, the hands drag you down into
  the underworld, as they do now.
  - **An altar** stands in the middle of the room, below the results: a
    stone block with a skull and two candles, and a sigil on its front that
    glows when there's something you can afford. Interacting with it opens
    the skill tree page over the game. The hero lands right in front of it.
  - **The two ladders stay:** TRY AGAIN starts the next run, and MENU goes
    back to the title room.
- **Every run ends in the underworld.** On a death, the hero falls over red
  and the hands drag the corpse down. When the clock runs out, the room
  freezes, a gong sounds, and the hands drag you down the same way, without
  the red.
- **The run results** are written on the underworld floor where YOU DIED
  and the stats are now: YOU DIED or OUT OF TIME, then GOLD EARNED, DEEPEST
  (for example 1-6) and KILLS, plus bones once they drop.
- **Beating a depth's boss** ends the run in the boss room: the boss bursts
  into its pile of coins, you gather them with no rush (the clock stopped
  when it appeared), then take the well down to the underworld or the
  ladder up to the main room. The next depth is unlocked. (The separate
  treasure room isn't needed any more; its coin-spill code can be reused
  for the boss's coins.)
- **Choosing a depth** (once there are two): a signpost next to the TRY
  AGAIN ladder shows the depth the next run goes to; pressing E at it
  switches to the next one that's open. Beating a depth's boss for the first
  time opens the next depth, picks it, and says so on the results. The
  title room's PLAY door goes to the picked depth too.
- **The first visit unlocks the underworld.** Every run ends there, by
  death or by time, so that's the end of the very first run. From then on,
  the title room has a well that leads straight down to it, so you can reach
  the altar without playing a run first. Before that, there's no well and
  no tree. The first run is just you, one heart and the clock. The well
  looks the same as the one the boss leaves behind: a round stone well with
  the underworld's red glow at the bottom. It's solid: the hero walks round
  it, and from the floor in front of it he hops over the rim and drops in.
  Coming down it, the TRY AGAIN ladder is a PLAY ladder, and there are no
  results. Saves from before the well existed get it if they have played
  a run.
- **Keyboard only.** Phones and tablets aren't supported any more: the game
  plays too differently now to keep a touch layout as well. The touch
  controls are gone, and on a phone a notice says the game needs a keyboard.
- **No refunds.** Purchases are permanent. You eventually buy most of the
  tree anyway, so the choice is about order.
- **Saving:** progress saves in the browser after every run and every
  purchase. The Options room gets a reset: a red button in the floor that
  asks twice ("SURE?", then "REALLY?") before it erases the gold, the
  upgrades and the well. Walking away from it cancels the asking. The
  settings stay.

## 10. What we keep and what we cut

- **Kept:** movement, scaling, hearts, mobs and waves,
  bosses, effects, sound and music, props, the title, Options and Credits
  rooms, settings, and the underworld (now the hub).
- **Reworked:**
  - the swing becomes automatic
  - the dash gets charges and is unlocked in the tree
  - the room flow becomes a timed run
  - the dungeon file changes from questions to depth data
  - the chained door becomes the exit that opens when the XP bar is full
  - the waves become spawning: monsters on entry, hordes on a timer, and
    the XP bar that opens the door
  - the treasure room gives way to the boss's own pile of coins
- **Removed:**
  - **The scroll band at the top.** The game picture gets about 25% more of
    the screen. The timer, gold and hearts are drawn in the game, and the
    thin hint strip above the game stays for prompts. The credits become
    signs that pop up over their plaques.
  - **All quiz code is deleted**, not switched off: the questions file,
    answer letters on doors, cursed waves, the explanation flow and the
    text-fit checks. Git history keeps it.
  - **The boss-select test room.**
- **The name** stays as a working title. It will be decided together with
  the hook (section 4).

## 11. Build order

- **First milestone:** one depth (10 sub-depths) with a small skill tree,
  tuned until the loop feels good. Depths 2–5 come after that.

The first milestone, one branch and PR per step:

1. **Clean-up:** delete the quiz code, the scroll band and the boss-select
   room. The game still runs: PLAY leads to 10 plain rooms, each with one
   chained door, and the Big Zombie in the last.
2. **Numbers and simulator:** the data file (mobs, rooms, tree nodes,
   costs, drop rates) and the pacing simulator in `tools/`. The first cost
   table comes out of it.
3. **The run:** the run timer, automatic swings, gold drops with a magnet,
   spawning and the XP bar that opens the door, 10 sub-depths, the boss at
   10 (with the clock stopping), every run ending in the underworld with its
   results, and saving.
4. **The hub and the tree:** the altar, the skill tree page, buying nodes,
   the well in the title room and the first-death unlock.
5. **Tree effects:** the dash unlock and its charges, heart drops, time
   orbs, and every node actually doing what it says.
6. **The crypt:** skeletons, slugs, chest mimics, floor spikes, pillars,
   breakables and bones, room by room as in section 3.
7. **Treasure room loot, polish and tuning,** by playing.
