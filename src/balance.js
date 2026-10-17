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
// Only depth 1 (the crypt) exists so far. Times are in seconds, distances in
// game pixels, chances from 0 (never) to 1 (always).

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
  // `hp` and `gold` are for sub-depth 1. Deeper sub-depths multiply them (see
  // `growth`). A kill drops its gold as whole coins: the gold (with Greed) is
  // rounded to the nearest coin, and is always at least 1. `xp` fills the
  // room's bar (see `rooms`). `threat` is how dangerous a monster is while
  // it's up close: roughly the chance per second that it lands a hit on a
  // careful player (the simulator uses it to guess how often you get hit; in
  // the game, it comes from how the monster moves and attacks).
  mobs: {
    tiny_zombie: { hp: 3, gold: 1, xp: 1, threat: 0.02 },   // slow chaser
    skeleton:    { hp: 4, gold: 2, xp: 2, threat: 0.06 },   // winds up, then charges in a line
    slug:        { hp: 3, gold: 2, xp: 1, threat: 0.03, splitsInto: ["tiny_slug", "tiny_slug"] },
    tiny_slug:   { hp: 1, gold: 1, xp: 1, threat: 0.02 },
    mimic:       { hp: 12, gold: 10, xp: 5, threat: 0.12 }, // a chest that bites
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
  },

  // ---- Depth 1: the crypt -------------------------------------------------
  // One entry per sub-depth, 1 to 10. `xp` is the size of the room's bar:
  // fill it and the door opens (in sub-depth 10, the boss appears).
  // `spawns` are the monsters that can rise there, with how likely each is
  // (weights: 3 and 1 means three times as likely). `breakables` and `hazard`
  // (extra danger per second from floor spikes, 0 = none) are what else is
  // in the room.
  rooms: [
    { xp: 8, spawns: { tiny_zombie: 1 }, breakables: ["pot", "pot"] },
    { xp: 9, spawns: { tiny_zombie: 1 }, breakables: ["pot", "pot"] },
    { xp: 11, spawns: { tiny_zombie: 3, skeleton: 1 }, breakables: ["pot", "pot"] },
    { xp: 13, spawns: { tiny_zombie: 2, skeleton: 1 }, breakables: ["pot", "pot"], hazard: 0.005 },
    { xp: 15, spawns: { tiny_zombie: 2, skeleton: 1, slug: 1 }, breakables: ["pot", "pot"], hazard: 0.005 },
    { xp: 18, spawns: { tiny_zombie: 1, skeleton: 1, slug: 1 }, breakables: ["pot", "crate", "crate"], hazard: 0.005 },
    { xp: 21, spawns: { tiny_zombie: 1, skeleton: 1, slug: 1, mimic: 0.1 }, breakables: ["pot", "crate", "crate"], hazard: 0.005 },
    { xp: 24, spawns: { tiny_zombie: 1, skeleton: 2, slug: 1, mimic: 0.1 }, breakables: ["pot", "crate", "crate"], hazard: 0.01 },
    { xp: 28, spawns: { tiny_zombie: 1, skeleton: 2, slug: 2, mimic: 0.15 }, breakables: ["crate", "crate", "urn"], hazard: 0.01 },
    { xp: 33, spawns: { tiny_zombie: 1, skeleton: 1, slug: 1 }, breakables: ["crate", "crate"] }, // then the boss
  ],

  // The boss: it appears in sub-depth 10 when that room's bar is full, and
  // then the run clock stops. Its hp and gold are its own (not grown by
  // sub-depth). It raises 3 minions around itself every so often, in both of
  // its phases. (boss.js raises goblins and an orc once a boss is enraged;
  // for the Big Zombie that becomes tiny zombies, which fit the crypt.)
  boss: {
    type: "big_zombie",
    hp: 300,
    gold: 300,           // its pile of coins, on every kill, the first one and repeats
    threat: 0.08,        // chance per second, while it's up close, that it lands a hit
    minion: "tiny_zombie",
  },

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
    { id: "quicker", name: "Quicker swing", parent: "sharper", levels: 10, cost: 30, growth: 1.47, effect: { stat: "swingEvery", mul: 0.91 } },
    { id: "reach", name: "Longer reach", parent: "quicker", levels: 5, cost: 40, growth: 1.48, effect: { stat: "reach", mul: 1.1 } },
    { id: "arc", name: "Wider arc", parent: "reach", levels: 3, cost: 80, growth: 1.55, effect: { stat: "arc", add: 20 } },

    // Hearts
    { id: "heart", name: "Extra heart", parent: "descend", levels: 4, cost: 3, growth: 1.6, effect: { stat: "hearts", add: 1 } },
    { id: "nerves", name: "Steady nerves", parent: "heart", levels: 3, cost: 98, growth: 1.55, effect: { stat: "invincibleFor", add: 0.25 } },
    // After Extra heart, because a heart only drops while you're missing one.
    { id: "lucky", name: "Lucky hearts", parent: "heart", levels: 5, cost: 120, growth: 1.5, effect: { stat: "heartChance", add: 0.004 } },

    // Time
    { id: "time", name: "More time", parent: "descend", levels: 10, cost: 2, growth: 1.42, effect: { stat: "startTime", add: 4 } },
    { id: "wind", name: "Second wind", parent: "time", levels: 5, cost: 49, growth: 1.52, effect: { stat: "timePerSubDepth", add: 1.5 } },
    { id: "orbs", name: "Time orbs", parent: "wind", levels: 1, cost: 160, growth: 1, effect: { unlock: "timeOrbs" } },
    // Orbs come from kills, and depth 1 has too few kills for these to pay
    // off, so they're an investment for depth 2.
    { id: "orbFinder", name: "Orb finder", parent: "orbs", levels: 5, cost: 120, growth: 1.5, effect: { stat: "timeOrbChance", add: 0.004 }, depth: 2 },
    { id: "biggerOrbs", name: "Bigger orbs", parent: "orbs", levels: 3, cost: 200, growth: 1.55, effect: { stat: "timeOrbSeconds", add: 0.5 }, depth: 2 },

    // Dash
    { id: "dash", name: "Dash", parent: "descend", levels: 1, cost: 7, growth: 1, effect: { unlock: "dash" } },
    { id: "feet", name: "Quick feet", parent: "dash", levels: 5, cost: 98, growth: 1.46, effect: { stat: "dashCooldown", mul: 0.9 } },
    { id: "charge", name: "Second charge", parent: "feet", levels: 1, cost: 300, growth: 1, effect: { stat: "dashCharges", add: 1 } },

    // Money
    { id: "greed", name: "Greed", parent: "descend", levels: 10, cost: 2, growth: 1.4, effect: { stat: "goldBonus", add: 0.1 } }, // on kills; Smash is for breakables
    { id: "magnet", name: "Magnet", parent: "greed", levels: 5, cost: 24, growth: 1.44, effect: { stat: "magnetRange", mul: 1.25 } },
    { id: "smash", name: "Smash", parent: "magnet", levels: 3, cost: 40, growth: 1.5, effect: { stat: "breakableBonus", add: 0.25 } },

    // Horde: more monsters, sooner, and more XP from each, so rooms fill
    // their bars faster. Depth 1's rooms fill before most hordes arrive, so
    // the two horde nodes are an investment for depth 2.
    { id: "crowded", name: "Crowded rooms", parent: "descend", levels: 10, cost: 2, growth: 1.45, effect: { stat: "onEnter", add: 1 } },
    { id: "hordes", name: "Bigger hordes", parent: "crowded", levels: 10, cost: 40, growth: 1.45, effect: { stat: "horde", add: 1 }, depth: 2 },
    { id: "restless", name: "Restless dead", parent: "hordes", levels: 5, cost: 60, growth: 1.5, effect: { stat: "hordeEvery", add: -2 }, depth: 2 },
    { id: "calls", name: "Death calls", parent: "crowded", levels: 5, cost: 49, growth: 1.5, effect: { stat: "deathCall", add: 0.05 } },
    { id: "wisdom", name: "Wisdom", parent: "crowded", levels: 10, cost: 24, growth: 1.42, effect: { stat: "xpBonus", add: 0.1 } },
  ],
};
