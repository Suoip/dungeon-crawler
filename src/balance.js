// Every number that decides how the game plays and how fast you progress:
// the run timer, the hero, the monsters, what's in each room, drops, and the
// skill tree with its costs. It's plain data with no game code in it, so two
// things can read the same file:
//   - the game (in the browser), from step 3 of DESIGN.md on
//   - the pacing simulator (tools/simulate.mjs, in Node), which "plays" these
//     numbers to check how long depth 1 takes and that every good run can
//     buy something (DESIGN.md section 8)
// To tune the game, change numbers here and run the simulator again.
//
// Depths 1 (the crypt) and 2 (the goblin warrens) exist so far. Times are in
// seconds, distances in game pixels, chances from 0 (never) to 1 (always).

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
  },

  // How much tougher and richer each sub-depth is than the one above:
  // sub-depth n has hp × hp^(n-1) and gold × gold^(n-1).
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
  // with the sub-depth like the monsters'.
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
  //           their numbers in `mobs`, so each depth starts the power curve
  //           over with bigger numbers
  //   tint    the color its floor and walls are tinted (none: as drawn)
  //   bones   whether its kills drop bones (the crypt's material, see drops)
  //   rooms   one entry per sub-depth, 1 to 10 (see below)
  //   boss    its boss (see below)
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
      boss: { type: "big_zombie", hp: 300, gold: 300, threat: 0.08, minion: "tiny_zombie" },
    },
    {
      // The goblin warrens: goblins chase, imps (from room 3) keep their
      // distance and throw fireballs, and wogols (from room 5) run up and
      // explode. The ogre stands in for the depth's boss until it has its
      // own.
      name: "WARRENS",
      scale: { hp: 6, gold: 3 },
      tint: [196, 168, 120],
      bones: false,
      rooms: [
        { xp: 6, spawns: { goblin: 100 }, breakables: ["pot", "pot"] },
        { xp: 5, spawns: { goblin: 100 }, breakables: ["pot", "pot"] },
        { xp: 9, spawns: { goblin: 75, imp: 25 }, breakables: ["pot", "pot"] },
        { xp: 10, spawns: { goblin: 60, imp: 40 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 12, spawns: { goblin: 50, imp: 40, wogol: 10 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 13, spawns: { goblin: 45, imp: 38, wogol: 17 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.6, mimic: 0 } },
        { xp: 15, spawns: { goblin: 40, imp: 37, wogol: 23 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 17, spawns: { goblin: 36, imp: 35, wogol: 29 }, breakables: ["pot", "crate", "crate"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 20, spawns: { goblin: 33, imp: 34, wogol: 33 }, breakables: ["crate", "crate", "urn"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.6 } },
        { xp: 23, spawns: { goblin: 30, imp: 35, wogol: 35 }, breakables: ["crate", "crate"] }, // then the boss
      ],
      boss: { type: "ogre", hp: 2400, gold: 2000, threat: 0.1, minion: "goblin" },
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
  // A web out from "descend" in the middle. A node can be bought once its
  // `parent` has at least one level. Level n (counting from 0) costs
  // cost × growth^n gold, rounded to a tidy number; `growth` stays between
  // 1.4 and 1.6 (DESIGN.md section 8). Each level applies `effect` once:
  //   add: x    adds x to the stat        mul: x   multiplies the stat by x
  //   unlock    turns something on (one level only)
  // `depth: 2` marks a node that belongs to depth 2. It can be bought
  // before depth 1's boss is beaten, but at `earlyPrice` times the price.
  earlyPrice: 3,
  tree: [
    { id: "descend", name: "Descend", parent: null, levels: 1, cost: 0, growth: 1, effect: { unlock: "descend" }, owned: true },

    // Weapon
    { id: "sharper", name: "Sharper blade", parent: "descend", levels: 10, cost: 2, growth: 1.45, effect: { stat: "damage", add: 1 } },
    { id: "quicker", name: "Quicker swing", parent: "sharper", levels: 10, cost: 18, growth: 1.47, effect: { stat: "swingEvery", mul: 0.91 } },
    { id: "reach", name: "Longer reach", parent: "quicker", levels: 5, cost: 24, growth: 1.48, effect: { stat: "reach", mul: 1.1 } },
    { id: "arc", name: "Wider arc", parent: "reach", levels: 3, cost: 48, growth: 1.55, effect: { stat: "arc", add: 20 } },

    // Hearts
    { id: "heart", name: "Extra heart", parent: "descend", levels: 4, cost: 3, growth: 1.6, effect: { stat: "hearts", add: 1 } },
    { id: "nerves", name: "Steady nerves", parent: "heart", levels: 3, cost: 59, growth: 1.55, effect: { stat: "invincibleFor", add: 0.25 } },
    // After Extra heart, because a heart only drops while you're missing one.
    { id: "lucky", name: "Lucky hearts", parent: "heart", levels: 5, cost: 72, growth: 1.5, effect: { stat: "heartChance", add: 0.004 } },

    // Time
    { id: "time", name: "More time", parent: "descend", levels: 10, cost: 2, growth: 1.42, effect: { stat: "startTime", add: 4 } },
    { id: "wind", name: "Second wind", parent: "time", levels: 5, cost: 29, growth: 1.52, effect: { stat: "timePerSubDepth", add: 1.5 } },
    { id: "orbs", name: "Time orbs", parent: "wind", levels: 1, cost: 160, growth: 1, effect: { unlock: "timeOrbs" } },
    // Orbs come from kills, and depth 1 has too few kills for these to pay
    // off, so they're an investment for depth 2.
    { id: "orbFinder", name: "Orb finder", parent: "orbs", levels: 5, cost: 120, growth: 1.5, effect: { stat: "timeOrbChance", add: 0.004 }, depth: 2 },
    { id: "biggerOrbs", name: "Bigger orbs", parent: "orbs", levels: 3, cost: 200, growth: 1.55, effect: { stat: "timeOrbSeconds", add: 0.5 }, depth: 2 },

    // Dash
    { id: "dash", name: "Dash", parent: "descend", levels: 1, cost: 6, growth: 1, effect: { unlock: "dash" } },
    { id: "feet", name: "Quick feet", parent: "dash", levels: 5, cost: 59, growth: 1.46, effect: { stat: "dashCooldown", mul: 0.9 } },
    { id: "charge", name: "Second charge", parent: "feet", levels: 1, cost: 300, growth: 1, effect: { stat: "dashCharges", add: 1 } },

    // Money
    { id: "greed", name: "Greed", parent: "descend", levels: 10, cost: 2, growth: 1.4, effect: { stat: "goldBonus", add: 0.1 } }, // on kills; Smash is for breakables
    { id: "magnet", name: "Magnet", parent: "greed", levels: 5, cost: 14, growth: 1.44, effect: { stat: "magnetRange", mul: 1.25 } },
    { id: "smash", name: "Smash", parent: "magnet", levels: 3, cost: 24, growth: 1.5, effect: { stat: "breakableBonus", add: 0.25 } },

    // Horde: more monsters, sooner, and more XP from each, so rooms fill
    // their bars faster. Depth 1's rooms fill before most hordes arrive, so
    // the two horde nodes are an investment for depth 2.
    { id: "crowded", name: "Crowded rooms", parent: "descend", levels: 10, cost: 2, growth: 1.45, effect: { stat: "onEnter", add: 1 } },
    { id: "hordes", name: "Bigger hordes", parent: "crowded", levels: 10, cost: 40, growth: 1.45, effect: { stat: "horde", add: 1 }, depth: 2 },
    { id: "restless", name: "Restless dead", parent: "hordes", levels: 5, cost: 60, growth: 1.5, effect: { stat: "hordeEvery", add: -2 }, depth: 2 },
    { id: "calls", name: "Death calls", parent: "crowded", levels: 5, cost: 29, growth: 1.5, effect: { stat: "deathCall", add: 0.05 } },
    { id: "wisdom", name: "Wisdom", parent: "crowded", levels: 10, cost: 14, growth: 1.42, effect: { stat: "xpBonus", add: 0.1 } },
  ],
};
