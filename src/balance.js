// Every number that decides how the game plays and how fast you progress:
// the run timer, the hero, the monsters, what's in each room, drops, and the
// skill tree with its costs. It's plain data with no game code in it, so two
// things can read the same file:
//   - the game (in the browser), from step 3 of DESIGN.md on
//   - the pacing simulator (tools/simulate.mjs, in Node), which "plays" these
//     numbers to check how long each depth takes and that every good run
//     can buy something (DESIGN.md section 8)
// To tune the game, change numbers here and run the simulator again.
//
// The five depths: the crypt, the goblin warrens, the orc fort, the sunken
// swamp and the demon pit. Times are in seconds, distances in game pixels,
// chances from 0 (never) to 1 (always).

export const BALANCE = {
  // ---- The run ----------------------------------------------------------
  run: {
    startTime: 15,       // seconds on the clock at the start of a run, before upgrades
    // The clock only runs while you're in control: falling into a room and
    // walking through its door don't count.
    clockDuringCutscenes: false,
  },

  // ---- The hero, before any upgrades ------------------------------------
  hero: {
    hearts: 1,           // one hit and the run is over
    damage: 1,           // per swing, per monster hit
    swingEvery: 1.5,     // seconds between automatic swings: slow at first, Quicker swing brings it to about 0.6
    reach: 30,           // px from the chest to the end of the swing
    arc: 150,            // degrees the swing covers (75 to each side)
    invincibleFor: 1,    // seconds he can't be hit again after a hit
    critChance: 0,       // the chance a hit is a critical hit (Critical hits raises it)...
    critDamage: 3,       // ...which does this many times the damage
    magnetRange: 20,     // px: dropped things closer than this fly to him
    dash: {
      cooldown: 2.5,     // seconds for a charge to fill (once the dash is unlocked)
      distance: 48,      // px; never upgraded
    },
  },

  // ---- Monsters ---------------------------------------------------------
  // `hp` and `gold` are for sub-depth 1 of the depth the monster belongs to.
  // Deeper sub-depths multiply them (see `growth`), and so does a deeper
  // depth (its `scale`, in `depths`). A kill drops its gold as whole coins: the gold (with Greed) is
  // rounded to the nearest coin, and is always at least 1. `xp` fills the
  // room's bar (see `rooms`). `threat` is how dangerous a monster is while
  // it's up close: roughly the chance per second that it lands a hit on a
  // careful player (the simulator uses it to guess how often you get hit; in
  // the game, it comes from how the monster moves and attacks).
  // `wanders`: it never comes after the hero, it just crawls about (mobs.js),
  // so the first rooms are calm practice. `splitsInto` (none now): what pops
  // out of it when it falls.
  mobs: {
    // The crypt
    slug:        { hp: 3, gold: 1, xp: 1, threat: 0.008, wanders: true }, // wanders slowly; hurts on contact, but never comes after you
    tiny_zombie: { hp: 3, gold: 1.4, xp: 1, threat: 0.02 }, // slow chaser (1.4: 2 coins from room 3 on, or with a little Greed)
    skeleton:    { hp: 4, gold: 3, xp: 2, threat: 0.06 },   // winds up, then charges in a line
    mimic:       { hp: 12, gold: 10, xp: 5, threat: 0.12 }, // a chest that bites (see `chest` in rooms)
    // The goblin warrens (before the depth's `scale`)
    goblin:      { hp: 3, gold: 1.4, xp: 1, threat: 0.03 },  // fast chaser
    imp:         { hp: 3, gold: 2, xp: 1, threat: 0.05 },    // keeps its distance and throws fireballs (the threat is mostly them)
    wogol:       { hp: 4, gold: 3, xp: 2, threat: 0.07 },    // runs up and explodes, even when it's beaten
    // The orc fort
    orc_warrior: { hp: 3, gold: 1.4, xp: 1, threat: 0.05 },  // a brute: chases, and its hits shove you far
    orc_shaman:  { hp: 3, gold: 2, xp: 1, threat: 0.01 },    // keeps its distance and heals the monsters near it
    masked_orc:  { hp: 4, gold: 3, xp: 2, threat: 0.06 },    // shielded in front: hit it from the side or back
    // The sunken swamp
    swampy:      { hp: 3, gold: 1.4, xp: 1, threat: 0.03, splitsInto: ["swamplet", "swamplet"] }, // splits into two small ones
    swamplet:    { hp: 1, gold: 0.6, xp: 1, threat: 0.02 },  // a small swampy
    muddy:       { hp: 3, gold: 2, xp: 1, threat: 0.03 },    // chases, leaving mud that slows you
    necromancer: { hp: 4, gold: 3, xp: 2, threat: 0.02 },    // keeps its distance and raises ice zombies
    ice_zombie:  { hp: 2, gold: 0.5, xp: 0.5, threat: 0.03 }, // a necromancer's (not in any room's spawns)
    // The demon pit
    chort:       { hp: 3, gold: 1.4, xp: 1, threat: 0.05 },  // teleports next to you
    pumpkin_dude: { hp: 3, gold: 2, xp: 1, threat: 0.05 },   // leaps at you, landing with a shockwave
    doc:         { hp: 4, gold: 3, xp: 2, threat: 0.05 },    // a plague doctor: keeps its distance and lobs flasks of fire
  },

  // How much tougher and richer each sub-depth is than the one above:
  // sub-depth n has hp × hp^(n-1) and gold × gold^(n-1). A depth can have
  // its own (its `growth`, in `depths`).
  growth: { hp: 1.265, gold: 1.064 },

  // ---- Spawning -----------------------------------------------------------
  // How monsters arrive in a room, before upgrades (DESIGN.md section 3).
  // Each one rises out of the floor first (about a second of dust), and
  // spawns pick a monster from the room's `spawns` at random.
  spawning: {
    onEnter: 5,          // monsters that rise as you land in a room
    horde: 7,            // monsters in each horde...
    hordeEvery: 20,      // ...every this many seconds in a room (the timer starts over in each room)
    hordeEveryAtLeast: 8, // upgrades can't bring hordes closer together than this
    // When the last monster falls (and the bar isn't full), one more rises
    // straight away, so there's always something to fight.
  },

  // ---- Breakables -------------------------------------------------------
  // Things in rooms you can smash for a little gold. Their hp and gold grow
  // with the sub-depth and the depth, like the monsters'.
  breakables: {
    pot:   { hp: 1, gold: 1 },    // one hit
    crate: { hp: 4, gold: 4 },    // a few hits
    urn:   { hp: 20, gold: 25 },  // big and sturdy: many hits, lots of gold
    chest: { hp: 6, gold: 12 },   // a real chest (not a mimic): it opens into a pile of coins
  },

  // ---- The depths --------------------------------------------------------
  // One entry per depth. Each has:
  //   name    shown on the sign where you pick the depth (in the underworld)
  //   scale   how much tougher (hp) and richer (gold) its monsters are than
  //           their numbers in `mobs`. Each depth starts the power curve
  //           over: the 11 damage the hero has by the crypt's end (3-4 hits
  //           on its last room's monsters) takes about a dozen hits on a
  //           goblin (more than the 3 a slug took at the crypt's start,
  //           because the swing and the arc carry over). Depth 2 is about
  //           30x richer than the crypt and each depth after it hundreds of
  //           times richer than the one before, and its ring is priced to
  //           match
  //   growth  its own `growth` (see above), if it has one
  //   tint    the color its floor and walls are tinted (none: as drawn)
  //   decor   what hangs on its back wall (room.js addDecor), if anything
  //   bones   whether its kills drop bones (the crypt's material, see drops)
  //   rooms   one entry per sub-depth, 1 to 10 (see below)
  //   boss    its boss (see below); a stand-in can have its own `name` and `tint`
  //
  // A room's `xp` is the size of its bar: fill it and the door opens (in
  // sub-depth 10, the boss appears). `spawns` are the monsters that can rise
  // there, with how likely each is, in percent. In every depth, each monster
  // gets more common for a few rooms after it's introduced, until a newer one
  // eats into its share: the first one is all of them in rooms 1-2 and about
  // a third in room 10, the second (from room 3) and the third (from room 5)
  // grow to about a third each. `breakables` and `hazard` (extra danger per
  // second from floor spikes, 0 = none) are what else is in the room; where
  // they stand comes from the room's layout (layouts.js). `chest`: the room
  // may have a chest (`chance`), and it's a mimic that bites (`mimic` of the
  // time) instead of loot. Both look the same, closed.
  //
  // The boss appears in sub-depth 10 when that room's bar is full, and then
  // the run clock stops. Its hp and gold are its own (not grown by sub-depth
  // or the depth's scale). It raises 3 minions around itself every so often,
  // in both of its phases (its own, set in mobs.js). `threat` is for the
  // pacing simulator.
  depths: [
    {
      name: "CRYPT",
      scale: { hp: 1, gold: 1 },
      tint: null,
      bones: true,
      rooms: [
        { xp: 6, spawns: { slug: 100 }, breakables: ["pot", "pot"] },
        { xp: 5, spawns: { slug: 100 }, breakables: ["pot", "pot"] },
        { xp: 9, spawns: { slug: 75, tiny_zombie: 25 }, breakables: ["pot", "pot"] },
        { xp: 10, spawns: { slug: 60, tiny_zombie: 40 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 12, spawns: { slug: 50, tiny_zombie: 40, skeleton: 10 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 13, spawns: { slug: 45, tiny_zombie: 38, skeleton: 17 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.6, mimic: 0 } },
        { xp: 15, spawns: { slug: 40, tiny_zombie: 37, skeleton: 23 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 17, spawns: { slug: 36, tiny_zombie: 35, skeleton: 29 }, breakables: ["pot", "crate", "crate"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 20, spawns: { slug: 33, tiny_zombie: 34, skeleton: 33 }, breakables: ["crate", "crate", "urn"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.6 } },
        { xp: 23, spawns: { slug: 30, tiny_zombie: 35, skeleton: 35 }, breakables: ["crate", "crate"] }, // then the boss
      ],
      boss: { type: "big_zombie", hp: 300, gold: 33, threat: 0.08, minion: "tiny_zombie" },
    },
    {
      // The goblin warrens: goblins chase, imps (from room 3) keep their
      // distance and throw fireballs, and wogols (from room 5) run up and
      // explode. The ogre stands in for the depth's boss until it has its
      // own.
      name: "WARRENS",
      scale: { hp: 42, gold: 29 },
      growth: { hp: 1.080 }, // each room's monsters are this much tougher than the last's
      tint: [196, 168, 120],
      bones: false,
      rooms: [
        { xp: 8, spawns: { goblin: 100 }, breakables: ["pot", "pot"] },
        { xp: 7, spawns: { goblin: 100 }, breakables: ["pot", "pot"] },
        { xp: 12, spawns: { goblin: 75, imp: 25 }, breakables: ["pot", "pot"] },
        { xp: 14, spawns: { goblin: 60, imp: 40 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 17, spawns: { goblin: 50, imp: 40, wogol: 10 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 18, spawns: { goblin: 45, imp: 38, wogol: 17 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.6, mimic: 0 } },
        { xp: 21, spawns: { goblin: 40, imp: 37, wogol: 23 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 23, spawns: { goblin: 36, imp: 35, wogol: 29 }, breakables: ["pot", "crate", "crate"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 28, spawns: { goblin: 33, imp: 34, wogol: 33 }, breakables: ["crate", "crate", "urn"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.6 } },
        { xp: 32, spawns: { goblin: 30, imp: 35, wogol: 35 }, breakables: ["crate", "crate"] }, // then the boss
      ],
      boss: { type: "ogre", hp: 2400, gold: 1700, threat: 0.1, minion: "goblin" },
    },
    {
      // The orc fort: orc warriors shove, shamans (from room 3) heal the
      // others from a distance, and masked orcs (from room 5) hide behind
      // shields. The ogre stands in for the depth's boss, raising orcs.
      name: "FORT",
      scale: { hp: 630, gold: 15000 },
      growth: { hp: 1.071 }, // each room's monsters are this much tougher than the last's
      tint: [148, 164, 204],
      decor: "banners",
      bones: false,
      rooms: [
        { xp: 7, spawns: { orc_warrior: 100 }, breakables: ["pot", "pot"] },
        { xp: 7, spawns: { orc_warrior: 100 }, breakables: ["pot", "pot"] },
        { xp: 13, spawns: { orc_warrior: 75, orc_shaman: 25 }, breakables: ["pot", "pot"] },
        { xp: 16, spawns: { orc_warrior: 60, orc_shaman: 40 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 21, spawns: { orc_warrior: 50, orc_shaman: 40, masked_orc: 10 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 25, spawns: { orc_warrior: 45, orc_shaman: 38, masked_orc: 17 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.6, mimic: 0 } },
        { xp: 32, spawns: { orc_warrior: 40, orc_shaman: 37, masked_orc: 23 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 40, spawns: { orc_warrior: 36, orc_shaman: 35, masked_orc: 29 }, breakables: ["pot", "crate", "crate"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 51, spawns: { orc_warrior: 33, orc_shaman: 34, masked_orc: 33 }, breakables: ["crate", "crate", "urn"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.6 } },
        { xp: 65, spawns: { orc_warrior: 30, orc_shaman: 35, masked_orc: 35 }, breakables: ["crate", "crate"] }, // then the boss
      ],
      boss: { type: "ogre", hp: 230000, gold: 620000, threat: 0.12, minion: "orc_warrior" },
    },
    {
      // The sunken swamp: swampies split in two, muddies (from room 3) leave
      // mud that slows you, and necromancers (from room 5) raise ice zombies
      // from a distance. A swamp-green Big Zombie stands in for the depth's
      // boss, raising swampies.
      name: "SWAMP",
      scale: { hp: 11000, gold: 6500000 },
      growth: { hp: 1.100 }, // each room's monsters are this much tougher than the last's
      tint: [140, 180, 140],
      decor: "goo",
      bones: false,
      rooms: [
        { xp: 7, spawns: { swampy: 100 }, breakables: ["pot", "pot"] },
        { xp: 7, spawns: { swampy: 100 }, breakables: ["pot", "pot"] },
        { xp: 13, spawns: { swampy: 75, muddy: 25 }, breakables: ["pot", "pot"] },
        { xp: 17, spawns: { swampy: 60, muddy: 40 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 23, spawns: { swampy: 50, muddy: 40, necromancer: 10 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 28, spawns: { swampy: 45, muddy: 38, necromancer: 17 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.6, mimic: 0 } },
        { xp: 37, spawns: { swampy: 40, muddy: 37, necromancer: 23 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 47, spawns: { swampy: 36, muddy: 35, necromancer: 29 }, breakables: ["pot", "crate", "crate"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 63, spawns: { swampy: 33, muddy: 34, necromancer: 33 }, breakables: ["crate", "crate", "urn"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.6 } },
        { xp: 82, spawns: { swampy: 30, muddy: 35, necromancer: 35 }, breakables: ["crate", "crate"] }, // then the boss
      ],
      boss: { type: "big_zombie", name: "BOG ZOMBIE", tint: [150, 220, 170], hp: 8100000, gold: 250000000, threat: 0.12, minion: "swampy" },
    },
    {
      // The demon pit: chorts teleport next to you, pumpkin dudes (from room
      // 3) leap at you, and plague doctors (from room 5) lob flasks that
      // burst into fire. The Big Demon waits at the bottom, raising chorts.
      name: "PIT",
      scale: { hp: 93000, gold: 2800000000 },
      growth: { hp: 1.046 }, // each room's monsters are this much tougher than the last's
      tint: [196, 112, 148],
      decor: "lava",
      bones: false,
      rooms: [
        { xp: 7, spawns: { chort: 100 }, breakables: ["pot", "pot"] },
        { xp: 6, spawns: { chort: 100 }, breakables: ["pot", "pot"] },
        { xp: 13, spawns: { chort: 75, pumpkin_dude: 25 }, breakables: ["pot", "pot"] },
        { xp: 16, spawns: { chort: 60, pumpkin_dude: 40 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 22, spawns: { chort: 50, pumpkin_dude: 40, doc: 10 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 27, spawns: { chort: 45, pumpkin_dude: 38, doc: 17 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.6, mimic: 0 } },
        { xp: 35, spawns: { chort: 40, pumpkin_dude: 37, doc: 23 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 45, spawns: { chort: 36, pumpkin_dude: 35, doc: 29 }, breakables: ["pot", "crate", "crate"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 60, spawns: { chort: 33, pumpkin_dude: 34, doc: 33 }, breakables: ["crate", "crate", "urn"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.6 } },
        { xp: 79, spawns: { chort: 30, pumpkin_dude: 35, doc: 35 }, breakables: ["crate", "crate"] }, // then the boss
      ],
      boss: { type: "big_demon", hp: 44000000, gold: 120000000000, threat: 0.15, minion: "chort" },
    },
  ],

  // ---- Drops --------------------------------------------------------------
  drops: {
    // A heart can only drop while you're missing one. Every kill that doesn't
    // drop one raises the chance a little, so they never dry up for long.
    heart: { chance: 0.008, step: 0.004 },
    // Time orbs only drop once they're unlocked in the tree.
    timeOrb: { chance: 0.005, seconds: 1 }, // much rarer than hearts (about 1 in 18 kills while one is missing)
    // Bones (the crypt's material, for later): none before sub-depth 6, then
    // more common the deeper you are.
    bones: { fromSubDepth: 6, chance: 0.02, stepPerSubDepth: 0.02 },
  },

  // ---- The skill tree -----------------------------------------------------
  // A honeycomb out from Descend (`@`) in the middle: every letter in `map`
  // is a node, and a node can be bought once it touches one you own (any of
  // its six neighbours), so paths can cross from one branch into another.
  // Each node is bought once. A lowercase letter is a small node and its
  // capital a big one, twice as strong (an `add` twice over, a `mul` squared)
  // for about twice the price. `.` is a gap (nothing there), which makes the
  // lanes. Each line is a row of the honeycomb; every other row is shifted
  // half a node, so a node's neighbours are the ones two characters to
  // either side and one character to either side on the rows above and
  // below. You only see the nodes you own and the ones touching them.
  //
  // Which depth a node belongs to depends on how far out it is: `bands` is
  // the last ring of each depth (ring 1 is the six around Descend). A
  // deeper depth's nodes are priced in its gold, and can be bought before
  // the depth before it is beaten, at `earlyPrice` times the price.
  //
  // A node's price: the depth's `start`, times `spread` to the power of how
  // far out it is in its band (0 at the band's inside, 1 at its outside),
  // times its kind's `worth` in that depth, times a little up or down for
  // each node (`jitter`); a big node costs `big` times as much, give or take
  // `bigJitter`, so some big nodes are better value than others.
  //
  // `kinds`: what each letter is. `name` and an `add` can be one per depth
  // (lists, depth 1 first). `perDepth`: it only works in its own depth (the
  // run's pacing: the clock and the monsters that come), so a new depth
  // starts on a 15 s clock with the base spawns; everything else carries
  // over. `needs`: the letter of a kind you must own first (the orbs need
  // Time orbs, Quick feet the Dash, Lucky hearts an extra heart).
  earlyPrice: 10,
  skillTree: {
    map: [
      "               . . . . . . . . . g g . P b . .",
      "              . g g G G G G G g g g g t W p p .",
      "             . G g . . . . G . . g . W . . b w .",
      "            . h g G g g G G G g g g t t w P . t w",
      "           . h . G . . g g . G g G . . w B p . P .",
      "          . D . h g G g G G G g g g p P w . P B p .",
      "         d d . h . h g . G g g G G w B B w W p . t .",
      "        . D . d d h g g G G G g g t p b p W . t . t .",
      "       . d c d . c h g . l n . g m K k W . t t t . t t",
      "      . d . d . D d h L l N L . m M G . w p t . t . t .",
      "     . d d d c d D d A . n l L . . g k M t P t T T . T .",
      "    d d . c . d d d s . h N l g m G M g m t T t . w t W .",
      "   . D . C C d c d . R S s n h G . g . G K T W w b W . w .",
      "  . C . d c D d d r a S S S h g g . G w w w T p T B w p b .",
      " . C C C . D C d . S . . D . h g G t t W o w T P t p b . W .",
      ". c c d . c c d a . d r s d d @ t . t t . W . P b p b w . B .",
      " . c . d . d c c A r r d s d x e . T T t T . t w p . P B B .",
      "  . d c d C d C D r s d d d . . . e T T t W t W t P T . P .",
      "   . d . D d D D D . s . f . i e E e y T . t t T P T . T .",
      "    . C . d . d C d r S f F i . I I I e t T t T . T . T .",
      "     . c . D d d . d R f F . E i i Y . I T w T W t W t .",
      "      . d D d C d d f z F I i I y e Y i U U T . T t T .",
      "       c d . d d f F F f y i i . y Y . e u t . T p T .",
      "        . d . D F F f v u E e e u u e e v U v u . T .",
      "         . D . f f U v V e V u v E u . V u . e . w p",
      "          . f f F v u V e E e e u u e v e . v . U .",
      "           . F . F v . . . e E u . u V . V e . u .",
      "            . F . V u E u U e e u E e u v u v V .",
      "             f u v . . . . U . . V . e . . V v .",
      "              . V u e u e E e e u u e v U e v .",
      "               . . v V . . E . . . . . . . . .",
    ],
    bands: [7, 9, 11, 13, 15],
    prices: { start: [1.43, 280, 1.9e5, 1.1e8, 9e10], spread: [120, 25, 25, 90, 90], jitter: 0.12, big: 2, bigJitter: 0.2 },
    kinds: {
      "@": { name: "Descend", effect: { unlock: "descend" } },
      // Weapon
      d: { name: ["Sharper blade", "Keen edge", "Brutal edge", "Savage edge", "Demon edge"], effect: { stat: "damage", add: [1, 5, 50, 500, 5000] }, worth: [1, 1, 1, 1, 1] },
      s: { name: "Quicker swing", effect: { stat: "swingEvery", mul: 0.95 }, worth: 2.86 },
      r: { name: "Longer reach", effect: { stat: "reach", mul: 1.05 }, worth: 0.53 },
      a: { name: "Wider arc", effect: { stat: "arc", add: 10 }, worth: 0.49 },
      c: { name: "Critical hits", effect: { stat: "critChance", add: 0.02 }, worth: [null, 1.6, 2.2, 1.45, 2.41] },
      // Hearts
      h: { name: "Extra heart", effect: { stat: "hearts", add: 1 }, worth: [0.44, 0.86, 1.04, 1.2, 0.8] },
      n: { name: "Steady nerves", effect: { stat: "invincibleFor", add: 0.1 }, worth: 0.97 },
      l: { name: "Lucky hearts", effect: { stat: "heartChance", add: 0.002 }, needs: "h", worth: 1.7 }, // a heart only drops while you're missing one
      // Time
      t: { name: "More time", effect: { stat: "startTime", add: 2 }, perDepth: true, worth: [0.25, 1.21, 1.1, 1.07, 0.96] },
      w: { name: "Second wind", effect: { stat: "timePerSubDepth", add: 0.75 }, perDepth: true, worth: [0.64, 2.54, 2.2, 2.82, 2.57] },
      o: { name: "Time orbs", effect: { unlock: "timeOrbs" }, worth: 2.87 },
      p: { name: "Orb finder", effect: { stat: "timeOrbChance", add: 0.002 }, needs: "o", worth: [null, 8.25, 8.14, 9.32, 8.33] },
      b: { name: "Bigger orbs", effect: { stat: "timeOrbSeconds", add: 0.25 }, needs: "o", worth: [null, 3.46, 3.04, 3.77, 5.3] },
      // Dash
      x: { name: "Dash", effect: { unlock: "dash" }, worth: 1 },
      f: { name: "Quick feet", effect: { stat: "dashCooldown", mul: 0.95 }, needs: "x", worth: [1.46, 2.75, 3, 3.02, 2.49] },
      z: { name: "Second charge", effect: { stat: "dashCharges", add: 1 }, needs: "x", worth: 3.32 },
      // Money
      g: { name: "Greed", effect: { stat: "goldBonus", add: 0.05 }, worth: [0.24, 0.48, 0.52, 0.39, 0.52] }, // on kills; Smash is for breakables
      m: { name: "Magnet", effect: { stat: "magnetRange", mul: 1.12 }, worth: 0.3 },
      k: { name: "Smash", effect: { stat: "breakableBonus", add: 0.125 }, worth: 0.23 },
      // Horde: more monsters, sooner, and more XP from each, so rooms fill
      // their bars faster. Depth 1's rooms fill before most hordes arrive, so
      // Bigger hordes and Restless dead start in depth 2.
      e: { name: "Crowded rooms", effect: { stat: "onEnter", add: 1 }, perDepth: true, worth: [0.71, 1.81, 1.77, 1.83, 1.6] },
      u: { name: "Bigger hordes", effect: { stat: "horde", add: 1 }, perDepth: true, worth: [null, 31.2, 29.6, 32.7, 27.9] },
      v: { name: "Restless dead", effect: { stat: "hordeEvery", add: -1 }, perDepth: true, worth: [null, 2.3, 2.04, 1.94, 2.99] },
      y: { name: "Death calls", effect: { stat: "deathCall", add: 0.015 }, worth: 0.59 },
      i: { name: "Wisdom", effect: { stat: "xpBonus", add: 0.05 }, worth: 1.17 },
    },
  },
};
