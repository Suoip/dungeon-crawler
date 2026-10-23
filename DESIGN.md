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
their own hp and gold scale (the depth's `scale` in `balance.js`), so the
power curve starts over: a goblin starts at 126 hp, about a dozen hits for
the 11 damage the hero has by the crypt's end (where its last room's
monsters take 3-4). That's more
hits than a slug took at the crypt's start (3), because everything else
carries over (a swing more than twice as fast, an arc that catches several
at once), so it's about the same struggle. Each room's monsters are 8%
tougher than the last room's (`growth` in the depth's entry; the crypt's
grow 26.5% a room), and the rooms' bars are bigger than the crypt's. The clock and the spawns
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
monsters met in rooms 1, 3 and 5 with the same spawn rule, monsters scaled
up from the depth before (their hp, gold and growth per room, and the room
bars, are each depth's own, set with the pacing simulator), and a ring of
its own in the tree. A
stand-in boss waits in room 10 for now (each depth's real boss and its
special gimmick come later).

**Depth 3, the orc fort:** cold grey-blue stone, red banners on the back
wall (an orc warrior starts at about 1,900 hp). The ogre stands
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

**Depth 4, the sunken swamp:** murky green, goo dripping down the back wall
(a swampy starts at 33,000 hp). A swamp-green Big Zombie, the "Bog Zombie",
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
back wall (a chort starts at about 280,000 hp). The Big Demon waits in room 10,
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

- **A honeycomb from the middle.** Descend sits in the center and every
  other node is a cell of a honeycomb around it. A node can be bought once
  it touches one you own (any of its six neighbours), so the tree isn't a
  set of separate lines: the six themes (weapon to the left, hearts and
  money above, time to the right, the horde and the dash below) are wedges
  of the honeycomb, and where two wedges meet their nodes touch, so a path
  can turn from one theme into another.
- **Every node is bought once.** What used to be one node with ten levels
  is now a dozen or so nodes spread over its wedge. Most are small (a
  lowercase letter in the map) and some are big (a capital): twice as
  strong, for about twice the price. Each node's price is nudged a little
  up or down (a big one more), so some big nodes are better value than
  two small ones and some worse, and choosing what to buy next is a
  question of what's worth the most for the gold.
- **Revealed as you buy.** You only see the nodes you own and the ones
  touching them; nothing further out is drawn, not even an outline. Buying
  a node pops its neighbours into view.
- **Prices by distance.** Each depth has its own band of the honeycomb:
  depth 1 is the seven rings around Descend, and each deeper depth the next
  two rings. Within its band, a node further out costs more. Each kind also
  has its own worth in each depth (balance.js `kinds`), so a Quicker swing
  costs more than a Sharper blade beside it.
- **Some nodes need another first:** Quick feet and Second charge need the
  Dash, the orb nodes need Time orbs, and Lucky hearts needs an Extra heart
  (a heart only drops while you're missing one). Until then the node is
  dimmed and says what it needs.
- **The map is text.** The whole honeycomb is drawn as text in
  `src/balance.js` (`skillTree.map`), one letter per node, like the room
  layouts: changing a letter changes the node, and `.` leaves a gap. The
  gaps make lanes through the outer bands. Depth 1 has 134 nodes and each
  deeper depth 98, 527 in all with Descend.
- No quiz lifelines.

### The tree page

- **Drawn in the game,** in pixel art, over the dimmed underworld, rather
  than as an HTML page: a round frame per node with an icon from the
  tileset (weapons, flasks, the heart, a coin, monsters) or a few hand-drawn
  pixels where it has none (an hourglass, an orb, dash marks, a magnet).
  Icons are never shrunk, so they stay crisp at every zoom: the long
  weapons show just the end you know them by (a head, or a hilt), and the
  tiny coin and skull are doubled. A big node's frame is bigger. The rim
  is gold once it's yours, green when you can afford it, dark when it needs
  another node first, and grey otherwise. Links join neighbours on show,
  gold between two you own.
- **The layout:** Descend in the middle, the weapon wedge to the left and
  time to the right, hearts and money above, the horde and the dash below.
  At 1x the first rings fit on the screen; further out, the view is
  dragged or follows the keys.
- **Mouse and keyboard.** Point at a node to read it; click to pick it and
  click again to buy. Hold and drag to look around; the wheel zooms between
  1x, 2x and 3x (whole sizes, so the pixels stay crisp) around the cursor.
  The arrow keys or WASD move to the nearest node on show that way (the
  view slides along to keep it on screen), E buys, + and - zoom around it,
  Esc closes. The strip above the game says how it works while the page is
  open.
- **The panel at the bottom** shows the node under the cursor, or the
  picked one once a key is pressed: its name ("Great ..." for a big one),
  what buying it changes ("SWING EVERY 1.50S > 1.43S") and its price, or
  why it can't be bought yet (it needs another node first). Distances a
  player never sees as a number (the magnet's range and the swing's reach)
  are shown as how much bigger it makes them: "MAGNET RANGE +12%", and once
  it's yours, how much bigger they are in all.
- **Buying early:** a deeper depth's node can be bought before the depth
  before it is beaten, at ten times the price (`earlyPrice` in
  `src/balance.js`); the panel says "EARLY 10X" and which depth it's for.
  It's for players who want to save up and overpower a depth. Each band is
  priced in its own depth's gold, which is much richer than the depth
  before (depth 2 about 30 times the crypt, and each depth after it
  hundreds of times the one before), so buying early is a big saving-up
  goal rather than something a player falls into: the first Keen edge
  nodes cost about 3,000 gold early instead of about 300.
- **Each depth starts over.** Some nodes only work in their own depth (the
  panel says "DEPTH 1 ONLY" or "DEPTH 2 ONLY"): the run's pacing, which is
  More time, Second wind, Crowded rooms, Bigger hordes and Restless dead.
  So depth 2 starts on a 15 s clock with the base spawns, and its band has
  its own of them. Everything else carries over into every depth: damage,
  the swing, hearts, the dash, money, time orbs, Death calls and Wisdom.
- **Old saves:** saves from before the honeycomb have their tree wiped (the
  gold, the depths beaten and everything else stay).
- While the page is open, the hero waits at the altar and nothing else can
  be used.

### The nodes

What each letter in the map is. A big node (the capital) is twice as
strong. A node only works in its own depth where it says so.

| Letter | Node | A small one | Where |
|---|---|---|---|
| d | Sharper blade (depth 1), Keen, Brutal, Savage and Demon edge (depths 2-5) | +1 damage in depth 1, +5 in depth 2, ten times more each depth after | Weapon, every depth |
| s | Quicker swing | Swings come 5% faster | Weapon, depth 1 |
| r | Longer reach | +5% reach | Weapon, depth 1 |
| a | Wider arc | +10 degrees of swing | Weapon, depth 1 |
| c | Critical hits | +2% chance that a hit does 3x damage | Weapon, depths 2-5 |
| h | Extra heart (small only) | +1 heart | Hearts, every depth |
| n | Steady nerves | +0.1 s safe after a hit | Hearts, depth 1 |
| l | Lucky hearts (needs an Extra heart) | Hearts drop a little more often | Hearts, depth 1 |
| t | More time (its own depth only) | +2 s at the start of a run | Time, every depth |
| w | Second wind (its own depth only) | +0.75 s every time you reach the next room | Time, every depth |
| o | Time orbs (one) | Unlocks time orbs: rare drops worth +1 s | Time, depth 1 |
| p | Orb finder (needs Time orbs) | Time orbs drop more often | Time, depths 2-5 |
| b | Bigger orbs (needs Time orbs) | Time orbs are worth +0.25 s more | Time, depths 2-5 |
| x | Dash (one) | Unlocks the dash | Dash, next to Descend |
| f | Quick feet (needs the Dash) | Dash cooldown 5% shorter | Dash, every depth |
| z | Second charge (one; needs the Dash) | A second dash charge (it refills at half speed, see section 5) | Dash, depth 1 |
| g | Greed | +5% gold per kill | Money, every depth |
| m | Magnet | Pickups are pulled in from 12% further | Money, depth 1 |
| k | Smash | Breakables drop 12.5% more gold | Money, depth 1 |
| e | Crowded rooms (its own depth only) | +1 monster when you enter a room (start: 5) | Horde, every depth |
| u | Bigger hordes (its own depth only) | +1 monster per horde (start: 7) | Horde, depths 2-5 |
| v | Restless dead (its own depth only) | Hordes come 1 s sooner (start: every 20 s) | Horde, depths 2-5 |
| y | Death calls | +1.5% chance that a kill spawns another monster | Horde, depth 1 |
| i | Wisdom | +5% XP per kill | Horde, depth 1 |

Each depth's band adds up to about what the old multi-level nodes gave:
depth 1, +10 damage, a swing about 2.5 times as fast, +4 hearts, +40 s on
the clock and so on; each deeper depth, ten times the damage of the one
before, +20% critical hits, 2 more hearts, its own +40 s clock and spawn
upgrades, more Greed, the orbs and Quick feet. Depth 1's rooms fill their
bars before most hordes arrive, so Bigger hordes and Restless dead start in
depth 2. The hearts at the bottom of the screen are drawn at 2x up to 7,
and at 1x past that (mostly on the bottom wall), so the deeper depths'
Extra hearts don't spread them over more of the floor. The tuned numbers
(the map, each kind's worth, and the prices) live in `src/balance.js`.

## 8. Pacing

- **Every depth takes about 40 minutes for a typical player**, from its
  first run to beating its boss. 5 × 40 minutes is about 3.3 hours. A
  typical player is a bit slower than perfect: about 20% slower clears, 10%
  of the gold missed, and more hits taken. A sharp player is faster (about
  30 minutes).
- **Where it stands:** with the honeycomb tree, the pacing simulator
  (playing the whole game 30 times per shopper, each depth starting with
  what the depths before left) has the typical player at:

  | Depth | Value shopper | Cheapest shopper |
  |---|---|---|
  | 1, the crypt | 40 min | 50 min |
  | 2, the goblin warrens | 42 min | 43 min |
  | 3, the orc fort | 42 min | 47 min |
  | 4, the sunken swamp | 37 min | 34 min |
  | 5, the demon pit | 38 min | 33 min |
  | The whole game | about 3.3 hours | about 3.4 hours |

  Rooms 1-9 each take about 1-7 minutes to get through the first time; the
  boss rooms take longer (about 10-23 minutes, longest in depths 3-5). The
  golden rule holds in every depth. The depths' numbers (monsters' hp and
  gold, growth per room, room bars, bosses) were set with the simulator,
  one depth at a time, for the old tree; the honeycomb's prices were then
  set so each kind costs about what it did in each depth, and only roughly
  tuned since (each depth's price spread, and depth 5's prices).
- **The first run:** you die fast, but you earn enough for 1–2 cheap
  upgrades straight away. The whole loop makes sense within the first
  minute.
- **No upgrades, no room 2.** Without upgrades, room 1's bar can't be
  filled, however well you play: the first clock is 15 s, the slugs take 3
  hits (and have to be walked to), and the bar is big enough. Room 2 opens
  up after about 10–15 nodes (each a small step), around the fourth or
  fifth run. The
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
  dice, buying upgrades the way a player would: more time first when the
  clock keeps stopping them at the same spot, damage first when a deeper
  depth's first room stops them, and a run back up in the depth above for
  gold when three runs in a row can't get through a deeper depth's first
  room or pay for anything there). It plays all five depths in a row, each
  starting with what the depths before left (`--depths N` stops earlier),
  and reports for each depth how long it takes, its spread, how long each
  room takes to get through, where the walls are, and whether its first
  room is a struggle with only the earlier depths' upgrades. Its guesses about players are checked against the
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
