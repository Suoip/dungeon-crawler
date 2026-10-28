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

import { TREE_MAP } from "./treemap.js";

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
    reach: 22,           // px from the chest to the end of the swing
    arc: 60,             // degrees the swing covers (30 to each side of what it aims at)
    invincibleFor: 1,    // seconds he can't be hit again after a hit
    critChance: 0,       // the chance a hit is a critical hit (Critical hits raises it)...
    critDamage: 3,       // ...which does this many times the damage
    // The hammer (hammer.js), once it's bought in the warrens' ring: every
    // `every` s or so it rises over him, aimed a random way, its landing
    // zone (`size` px across the middle) marked `out` px from him that
    // way and moving with him; `warning` s later it crashes down for
    // `damage` on everything in the zone, stunned for `stun` s.
    hammer: { damage: 80, every: 6, warning: 1, size: 14, out: 26, stun: 1 },
    // Chain lightning (lightning.js), once it's bought in the fort's ring:
    // `charged` of the monsters rise charged; killing one sends lightning
    // `jumps` times, each to the nearest monster within `range` px of the
    // last, for `damage` each.
    lightning: { damage: 900, jumps: 3, range: 40, charged: 0.15 },
    // The boomerang (boomerang.js), once it's bought in the swamp's ring:
    // thrown at the nearest monster within `range` px, it flies out
    // `range` px and comes back to him, hitting everything it passes both
    // ways for `damage`; `rest` s after he catches it, it's thrown again.
    boomerang: { damage: 4000, rest: 1.5, range: 70, count: 1 },
    // The spinning blades (blades.js), once they're bought in the pit's
    // ring: every `every` s, when a monster is within `radius` px, he
    // whirls, and blades sweep a full circle round him (`spins` times),
    // hitting everything in it for `damage` and shoving it back.
    blades: { damage: 45000, every: 4, radius: 30, spins: 1 },
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
  //   material what its kills drop from sub-depth 6 on (see drops), which buys
  //           its special upgrade at the altar
  //   parts   the part each of its monsters drops, for the forge (see drops
  //           and crafting)
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
      scale: { hp: 1, gold: 1.25 }, // (gold 1 before the swing became narrow: fewer kills a swing, so more gold a kill)
      tint: null,
      material: "bones",
      parts: { slug: "goo", tiny_zombie: "flesh", skeleton: "skull", big_zombie: "heart" },
      // Restless graves (graves.js): a tiny zombie or skeleton that falls may
      // leave a grave, and climb back out of it after `riseAfter` seconds
      // unless he stamps it down first (walks over it).
      graves: { chance: 0.3, types: ["tiny_zombie", "skeleton"], riseAfter: 4 },
      rooms: [
        { xp: 5, spawns: { slug: 100 }, breakables: ["pot", "pot"] },
        { xp: 4, spawns: { slug: 100 }, breakables: ["pot", "pot"] },
        { xp: 8, spawns: { slug: 75, tiny_zombie: 25 }, breakables: ["pot", "pot"] },
        { xp: 8, spawns: { slug: 60, tiny_zombie: 40 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 12, spawns: { slug: 50, tiny_zombie: 40, skeleton: 10 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 13, spawns: { slug: 45, tiny_zombie: 38, skeleton: 17 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.6, mimic: 0 } },
        { xp: 15, spawns: { slug: 40, tiny_zombie: 37, skeleton: 23 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 17, spawns: { slug: 36, tiny_zombie: 35, skeleton: 29 }, breakables: ["pot", "crate", "crate"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 20, spawns: { slug: 33, tiny_zombie: 34, skeleton: 33 }, breakables: ["crate", "crate", "urn"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.6 } },
        { xp: 23, spawns: { slug: 30, tiny_zombie: 35, skeleton: 35 }, breakables: ["crate", "crate"] }, // then the boss
      ],
      boss: { type: "big_zombie", hp: 180, gold: 33, threat: 0.08, minion: "tiny_zombie" },
    },
    {
      // The goblin warrens: goblins chase, imps (from room 3) keep their
      // distance and throw fireballs, and wogols (from room 5) run up and
      // explode. The ogre stands in for the depth's boss until it has its
      // own.
      name: "WARRENS",
      scale: { hp: 32, gold: 31 },
      growth: { hp: 1.080 }, // each room's monsters are this much tougher than the last's
      tint: [196, 168, 120],
      material: "teeth",
      parts: { goblin: "ear", imp: "horn", wogol: "powder", ogre: "knuckle" },
      // Coin thieves (thieves.js): a goblin may be a thief, with a sack on its
      // back. It goes for coins lying on the floor, scoops up the ones within
      // `grab` px, and runs for one of the burrows dug into the side walls.
      // One that gets away takes the coins with it, and climbs back out
      // `comeBack` seconds later to steal again; one that's caught drops
      // double what it carried. With no coins about, it fights like a goblin.
      thieves: { type: "goblin", chance: 0.25, grab: 24, comeBack: 5 },
      rooms: [
        { xp: 7, spawns: { goblin: 100 }, breakables: ["pot", "pot"] },
        { xp: 6, spawns: { goblin: 100 }, breakables: ["pot", "pot"] },
        { xp: 10, spawns: { goblin: 75, imp: 25 }, breakables: ["pot", "pot"] },
        { xp: 12, spawns: { goblin: 60, imp: 40 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 14, spawns: { goblin: 50, imp: 40, wogol: 10 }, breakables: ["pot", "pot"], hazard: 0.005 },
        { xp: 15, spawns: { goblin: 45, imp: 38, wogol: 17 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.6, mimic: 0 } },
        { xp: 18, spawns: { goblin: 40, imp: 37, wogol: 23 }, breakables: ["pot", "crate", "crate"], hazard: 0.005, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 20, spawns: { goblin: 36, imp: 35, wogol: 29 }, breakables: ["pot", "crate", "crate"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.5 } },
        { xp: 24, spawns: { goblin: 33, imp: 34, wogol: 33 }, breakables: ["crate", "crate", "urn"], hazard: 0.01, chest: { chance: 0.7, mimic: 0.6 } },
        { xp: 27, spawns: { goblin: 30, imp: 35, wogol: 35 }, breakables: ["crate", "crate"] }, // then the boss
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
      material: "tusks",
      parts: { orc_warrior: "hide", orc_shaman: "feather", masked_orc: "iron", ogre: "crest" },
      // War drums (fort.js): every `every` seconds or so (at random), a boom,
      // then `warning` s later the drums beat for `lasts` s. While they
      // beat, these monsters rage: nothing hurts them, they move `speed`
      // times faster, and a touch costs the depth's special hit.
      drums: { every: [12, 30], warning: 1, lasts: 4, speed: 1.5, types: ["orc_warrior", "orc_shaman", "masked_orc"] },
      // Pressure plates (fort.js): `count` of them in each room. Stepped on,
      // one fires an arrow from the wall `delay` s later, at `arrowSpeed`
      // px/s; it costs him the special hit, or takes `mobDamage` of a
      // monster's health. A plate comes back up `rearm` s after.
      plates: { count: [2, 3], delay: 0.4, arrowSpeed: 220, mobDamage: 0.5, rearm: 1.5 },
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
      scale: { hp: 11000, gold: 7800000 },
      growth: { hp: 1.100 }, // each room's monsters are this much tougher than the last's
      tint: [140, 180, 140],
      decor: "goo",
      material: "slime",
      parts: { swampy: "moss", muddy: "clay", necromancer: "dust", big_zombie: "pearl" },
      // Rising water (water.js): each room starts with `start` rows of the
      // floor flooded from the bottom (from room 1's to room 10's), and every
      // `rise` s (room 1's to room 10's) it creeps up a row, up to `most`.
      // In it he wades at `slow` of his speed (his dash too), and what lies
      // under it (spikes, mud, coins) can only be seen from `seeFrom` px.
      water: { start: [1, 3], rise: [12, 7], most: 6, slow: 0.6, seeFrom: 28 },
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
      boss: { type: "big_zombie", name: "BOG ZOMBIE", tint: [150, 220, 170], hp: 3200000, gold: 250000000, threat: 0.12, minion: "swampy" },
    },
    {
      // The demon pit: chorts teleport next to you, pumpkin dudes (from room
      // 3) leap at you, and plague doctors (from room 5) lob flasks that
      // burst into fire. The Big Demon waits at the bottom, raising chorts.
      name: "PIT",
      scale: { hp: 93000, gold: 3360000000 },
      growth: { hp: 1.046 }, // each room's monsters are this much tougher than the last's
      tint: [196, 112, 148],
      decor: "lava",
      material: "embers",
      parts: { chort: "hoof", pumpkin_dude: "seed", doc: "vial", big_demon: "eye" },
      // Pacts (pacts.js): as he lands in each room he picks one of three
      // curses, each mild, harsh or brutal (picked at random by
      // `tierWeights`). They stack for the run, and each adds its `gold` to
      // what the gold monsters drop is multiplied by, from then on. How
      // much each curse takes, by strength: his damage (`weaker`) and speed
      // (`slower`) lose that share, monsters' health (`tougher`) gains it,
      // and `harder` adds [hearts to a touch, hearts to a special attack].
      pacts: {
        tierWeights: { mild: 45, harsh: 35, brutal: 20 },
        gold: { mild: 0.2, harsh: 0.5, brutal: 1.2 },
        weaker: { mild: 0.15, harsh: 0.3, brutal: 0.5 },
        slower: { mild: 0.15, harsh: 0.3, brutal: 0.5 },
        tougher: { mild: 0.2, harsh: 0.5, brutal: 1 },
        harder: { mild: [1, 0], harsh: [1, 1], brutal: [2, 2] },
      },
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
      // (44M before the pacts; 21M with the curses a typical player takes;
      // 19M once the swing became narrow; 22M once the boomerang came; 28M
      // once the spinning blades did)
      boss: { type: "big_demon", hp: 28000000, gold: 120000000000, threat: 0.15, minion: "chort" },
    },
  ],

  // ---- Drops --------------------------------------------------------------
  drops: {
    // A heart can only drop while you're missing one. Every kill that doesn't
    // drop one raises the chance a little, so they never dry up for long.
    heart: { chance: 0.008, step: 0.004 },
    // Time orbs only drop once they're unlocked in the tree.
    timeOrb: { chance: 0.005, seconds: 1 }, // much rarer than hearts (about 1 in 18 kills while one is missing)
    // Each depth's material (bones, teeth, tusks, slime, embers: its
    // `material`): none before sub-depth 6, then more common the deeper you are.
    material: { fromSubDepth: 6, chance: 0.02, stepPerSubDepth: 0.02 },
    // A monster's part (its depth's `parts`), for the forge: this share of
    // kills drop one, from the first room. A boss always drops its own.
    part: { chance: 0.25 },
  },

  // ---- Crafting ------------------------------------------------------------
  // The forge in the underworld (forge.js) makes gear out of monsters' parts.
  // It works on one piece at a time, with `queue` more waiting, and only
  // while the game is open (in a run too). A finished piece goes in the gear
  // chest beside it, where one of each slot can be worn. The merchant
  // (merchant.js) sells spare pieces for gold: up to `counter` at a time,
  // each on its own, also only while the game is open.
  crafting: {
    queue: 3,
    counter: 3,
    // What a piece can roll: each bonus is a share (0.1 = +10%), and `scale`
    // shrinks it for one that would be too strong at full size. How each
    // works on the hero is in stats.js (withGear).
    bonuses: {
      damage:     { name: "DAMAGE" },              // the sword's and every weapon's
      speed:      { name: "SWING SPEED" },
      gold:       { name: "GOLD" },                // on top of Greed
      time:       { name: "TIME" },                // more on the clock at the start
      magnet:     { name: "MAGNET" },
      critChance: { name: "CRIT CHANCE", scale: 0.25 }, // added to the chance itself: +2% at 8%
      critDamage: { name: "CRIT DAMAGE" },
      xp:         { name: "XP" },                  // on top of Wisdom
    },
    // The gear slots, one per depth: its recipes use its monsters' parts,
    // and its tab on the forge's page opens once the depth is.
    slots: ["head", "feet", "body", "neck", "finger"],
    // A slot's three recipes, from the parts of its depth's first (a),
    // second (b) and third (c) monster and its boss (boss): `parts` is what
    // it takes, `time` seconds at the forge, and it rolls `bonuses` [fewest,
    // most] different bonuses, each `size` [smallest, biggest] (before its
    // scale), at random. `price`: about what it sells for (more for a better
    // roll, see crafting.js priceOf), and `sells` the seconds it takes to
    // sell; `learn`: what it costs to learn (the first is known). Prices
    // are in the crypt's gold, and grow with the depth's (its `scale`): a
    // crypt run earns 10-20 gold early on and 500-900 by the end.
    tiers: [
      { parts: { a: 3, b: 2 }, time: 30, bonuses: [1, 1], size: [0.03, 0.08], price: 5, sells: 20 },
      { parts: { c: 3, b: 3 }, time: 60, bonuses: [1, 2], size: [0.06, 0.15], price: 40, sells: 40, learn: 80 },
      { parts: { boss: 1, c: 4, a: 4 }, time: 120, bonuses: [2, 3], size: [0.12, 0.25], price: 200, sells: 60, learn: 400 },
    ],
    // Each slot's recipes, by tier: [id, name], and its depth's parts.
    gear: [
      { slot: "head", parts: { a: "goo", b: "flesh", c: "skull", boss: "heart" }, recipes: [["rag_hood", "Rag hood"], ["skull_helm", "Skull helm"], ["zombie_crown", "Zombie crown"]] },
      { slot: "feet", parts: { a: "ear", b: "horn", c: "powder", boss: "knuckle" }, recipes: [["goblin_sandals", "Goblin sandals"], ["imp_boots", "Imp boots"], ["ogre_stompers", "Ogre stompers"]] },
      { slot: "body", parts: { a: "hide", b: "feather", c: "iron", boss: "crest" }, recipes: [["hide_vest", "Hide vest"], ["iron_mail", "Iron mail"], ["warlord_plate", "Warlord plate"]] },
      { slot: "neck", parts: { a: "moss", b: "clay", c: "dust", boss: "pearl" }, recipes: [["moss_charm", "Moss charm"], ["dust_locket", "Dust locket"], ["pearl_amulet", "Pearl amulet"]] },
      { slot: "finger", parts: { a: "hoof", b: "seed", c: "vial", boss: "eye" }, recipes: [["hoof_band", "Hoof band"], ["glass_ring", "Glass ring"], ["demon_eye_ring", "Demon eye ring"]] },
    ],
    // The upgrades sold at the forge and at the merchant's stall, along the
    // top of their pages, for gold. `costs`: each level's price; `effect`:
    // what each level does (crafting.js workshop):
    //   forgeTime   pieces take this many times as long to make
    //   anvils      more pieces made at once
    //   rolls       each bonus is rolled this many more times, keeping the biggest
    //   sellTime    pieces take this many times as long to sell
    //   counter     more spaces on the counter
    //   haggle      everything sells for this share more
    //   autoSell    a new piece worth less than the one worn in its slot goes
    //               straight on the counter, when there's room
    upgrades: {
      forge: [
        { id: "faster_forging", name: "Faster forging", icon: "hourglass", costs: [60, 180, 540, 1600], effect: { forgeTime: 0.85 } },
        { id: "second_anvil", name: "Second anvil", icon: "anvil", costs: [1000], effect: { anvils: 1 } },
        { id: "better_rolls", name: "Better rolls", icon: "dice", costs: [100, 300, 900], effect: { rolls: 1 } },
      ],
      merchant: [
        { id: "faster_selling", name: "Faster selling", icon: "hourglass", costs: [60, 180, 540, 1600], effect: { sellTime: 0.85 } },
        { id: "bigger_counter", name: "Bigger counter", icon: "counter", costs: [100, 300, 900], effect: { counter: 1 } },
        { id: "haggling", name: "Haggling", icon: "coins", costs: [80, 240, 720, 2200], effect: { haggle: 0.2 } },
        { id: "auto_sell", name: "Auto-sell", icon: "sack", costs: [300], effect: { autoSell: 1 } },
      ],
    },
  },

  // ---- Special upgrades ---------------------------------------------------
  // One per depth, tied to its gimmick, bought at the altar a level at a time
  // with that depth's material (its `material`). `costs`: each level's price
  // in material; `effect`: what each level adds to the hero (stats.js).
  specials: [
    // Stamping a grave down pays a share of its monster's gold, and seconds.
    { id: "gravedigger", name: "Gravedigger", depth: 1, costs: [5, 15, 40], effect: { graveGold: 0.5, graveTime: 0.5 } },
    // A caught thief drops one more time what it carried, a level.
    { id: "sticky_fingers", name: "Sticky fingers", depth: 2, costs: [5, 15, 40], effect: { thiefBonus: 1 } },
    // One block that stops a hit from a shot (an arrow, a fireball) or a
    // raging orc, and is ready again `recharge[level - 1]` seconds later.
    { id: "shield", name: "Shield", depth: 3, costs: [5, 15, 40], effect: { shield: 1 }, recharge: [20, 12, 6] },
    // He wades through water and mud this much more of his speed, a level.
    { id: "waders", name: "Waders", depth: 4, costs: [5, 15, 40], effect: { waders: 0.1 } },
    // More choice in the pit's pacts: a 4th card, then a reroll in every
    // room, then one card in every room that's always mild.
    { id: "silver_tongue", name: "Silver tongue", depth: 5, costs: [5, 15, 40], effect: { silverTongue: 1 } },
  ],

  // ---- Hits ---------------------------------------------------------------
  // A monster's touch costs one heart. A special attack costs more, by depth
  // (depth 1 first): the boss's moves, shots and spit, fire, a wogol's blast,
  // a landing's shockwave (everything tagged "hazard" except the crypt's
  // floor spikes, which cost one).
  hits: { special: [2, 2, 2, 3, 3] },

  // ---- The skill tree -----------------------------------------------------
  // Branches out from Descend (`@`) in the middle, drawn in `map`
  // (treemap.js): every letter or symbol is a node and the lines between
  // them are its links. A node can be bought once a node linked to it is
  // owned, and you only see the nodes you own and the ones linked to them.
  // Each of the six themes (weapon, hearts, money, time, the horde, the
  // dash) leaves Descend as a short trunk and forks into branches, which fork
  // again further out; each branch alternates between two kinds of upgrade,
  // so the next node is always a choice, and here and there a bridge links
  // one theme's branch to its neighbour's. Each node is bought once. A
  // lowercase letter is a small node and its capital a big one, twice as
  // strong (an `add` twice over, a `mul` squared) for about twice the price.
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
  // `kinds`: what each letter is. `name`, an `add` or a `mul` and `worth`
  // can be one per depth (lists, depth 1 first; null where the kind isn't
  // in that depth). `perDepth`: it only works in its own depth (the run's
  // pacing: the clock, the monsters that come, and Bounty), so a new depth
  // starts on a 15 s clock with the base spawns; everything else carries
  // over. `needs`: the kind you must own first (the orbs need Time orbs,
  // Quick feet and Second charge the Dash, Lucky hearts an Extra heart).
  earlyPrice: 10,
  skillTree: {
    map: TREE_MAP, // treemap.js
    bands: [7, 10, 13, 16, 19],
    prices: { start: [0.76, 240, 1.8e5, 2.9e8, 1.8e11], spread: [400, 60, 60, 100, 400], jitter: 0.12, big: 2, bigJitter: 0.2 },
    kinds: {
      "@": { name: "Descend", effect: { unlock: "descend" } },
      // Weapon
      d: { name: ["Sharper blade", "Keen edge", "Brutal edge", "Savage edge", "Demon edge"], effect: { stat: "damage", add: [1, 11, 130, 1400, 11000] }, worth: [0.35, 1.6, 1.26, 1.15, 0.58] },
      s: { name: "Quicker swing", effect: { stat: "swingEvery", mul: 0.857 }, worth: 8.3 },
      r: { name: "Longer reach", effect: { stat: "reach", mul: 1.072 }, worth: 1.45 },
      a: { name: "Wider arc", effect: { stat: "arc", add: 30 }, worth: 5.93 },
      c: { name: "Critical hits", effect: { stat: "critChance", add: [null, 0.029, 0.025, 0.029, 0.05] }, worth: [null, 5.8, 4.47, 4.94, 4.56] },
      j: { name: "Critical damage", effect: { stat: "critDamage", add: [null, 0.17, 0.17, 0.25, 0.17] }, worth: [null, 13, 8.88, 16, 7.56] },
      // Hearts
      h: { name: "Extra heart", effect: { stat: "hearts", add: [1, 2, 2, 3, 3] }, worth: [0.11, 0.69, 0.6, 0.38, 0.49] }, // more per node deeper, where special attacks cost more (hits)
      n: { name: "Steady nerves", effect: { stat: "invincibleFor", add: [0.23, 0.05, 0.063, 0.05, 0.063] }, worth: [4.9, 0.15, 0.17, 0.12, 0.11] },
      l: { name: "Lucky hearts", effect: { stat: "heartChance", add: [0.004, 0.0033, 0.0025, 0.01, 0.01] }, needs: "h", worth: [4.59, 0.23, 0.14, 0.42, 0.44] }, // a heart only drops while you're missing one
      q: { name: "Mending", effect: { stat: "healOnClear", add: [0.067, 0.05, 0.05, 0.05, 0.1] }, worth: [0.26, 1.06, 1.03, 0.69, 1.68] },
      // Time
      t: { name: "More time", effect: { stat: "startTime", add: [4, 6.7, 8, 8, 6.7] }, perDepth: true, worth: [0.35, 1.81, 1.55, 1.03, 0.51] },
      w: { name: "Second wind", effect: { stat: "timePerSubDepth", add: [2.5, 1.9, 2.5, 1.3, 1.5] }, perDepth: true, worth: [7.86, 12, 18, 10, 12] },
      z: { name: "Sands of time", effect: { stat: "timePerKill", add: [0.25, 0.13, 0.1, 0.17, 0.13] }, perDepth: true, worth: [1.21, 2.49, 1.04, 1.53, 1.16] },
      "*": { name: "Time orbs", effect: { unlock: "timeOrbs" }, worth: 27 },
      p: { name: "Orb finder", effect: { stat: "timeOrbChance", add: [null, 0.01, 0.0067, 0.0067, 0.01] }, needs: "*", worth: [null, 46, 33, 15, 23] },
      b: { name: "Bigger orbs", effect: { stat: "timeOrbSeconds", add: [null, 0.75, 1.5, 1.5, 0.75] }, needs: "*", worth: [null, 52, 78, 78, 37] },
      // Dash
      ">": { name: "Dash", effect: { unlock: "dash" }, worth: 1 },
      f: { name: "Quick feet", effect: { stat: "dashCooldown", mul: [0.938, 0.95, 0.94, 0.94, 0.95] }, needs: ">", worth: [3.29, 2.92, 2.34, 3.11, 2.29] },
      "&": { name: "Second charge", effect: { stat: "dashCharges", add: 1 }, needs: ">", worth: 73 },
      // The hammer (the warrens' weapon) and its own upgrades
      "%": { name: "Hammer", effect: { unlock: "hammer" }, worth: 3 },
      x: { name: "Heavier hammer", effect: { stat: "hammerDamage", add: [null, 60, 500, 5000, 40000] }, needs: "%", worth: [null, 2, 1.3, 1.2, 0.6] },
      "#": { name: "Hammer time", effect: { stat: "hammerEvery", mul: 0.85 }, needs: "%", worth: 4 },
      $: { name: "Bigger head", effect: { stat: "hammerSize", mul: 1.2 }, needs: "%", worth: 3 },
      // Chain lightning (the fort's weapon) and its own upgrades
      "~": { name: "Chain lightning", effect: { unlock: "lightning" }, worth: 3 },
      "^": { name: "Thunder", effect: { stat: "lightningDamage", add: [null, null, 600, 6000, 50000] }, needs: "~", worth: [null, null, 1.5, 1.2, 0.6] },
      "+": { name: "Forked lightning", effect: { stat: "lightningJumps", add: 1 }, needs: "~", worth: 5 },
      "!": { name: "Storm", effect: { stat: "chargedChance", add: 0.05 }, needs: "~", worth: 4 },
      "=": { name: "Long arcs", effect: { stat: "lightningRange", mul: 1.25 }, needs: "~", worth: 2 },
      // The boomerang (the swamp's weapon) and its own upgrades
      ")": { name: "Boomerang", effect: { unlock: "boomerang" }, worth: 3 },
      "(": { name: "Heavy boomerang", effect: { stat: "boomerangDamage", add: [null, null, null, 3000, 25000] }, needs: ")", worth: [null, null, null, 1.5, 0.6] },
      ":": { name: "Quick catch", effect: { stat: "boomerangRest", mul: 0.8 }, needs: ")", worth: 4 },
      ";": { name: "Long flight", effect: { stat: "boomerangRange", mul: 1.2 }, needs: ")", worth: 2 },
      "?": { name: "Twin boomerang", effect: { stat: "boomerangCount", add: 1 }, needs: ")", worth: 20 },
      // The spinning blades (the pit's weapon) and their own upgrades
      "{": { name: "Spinning blades", effect: { unlock: "blades" }, worth: 3 },
      "}": { name: "Sharper blades", effect: { stat: "bladesDamage", add: 45000 }, needs: "{", worth: 1.5 },
      "[": { name: "Quick spin", effect: { stat: "bladesEvery", mul: 0.8 }, needs: "{", worth: 4 },
      "]": { name: "Wide spin", effect: { stat: "bladesRadius", mul: 1.2 }, needs: "{", worth: 3 },
      "<": { name: "Double spin", effect: { stat: "bladesSpins", add: 1 }, needs: "{", worth: 20 },
      // Money
      g: { name: "Greed", effect: { stat: "goldBonus", add: [0.17, 0.13, 0.14, 0.13, 0.11] }, worth: [0.7, 1.52, 1.36, 1.66, 0.57] }, // a share more gold on kills; Smash is for breakables
      o: { name: "Bounty", effect: { stat: "goldPerKill", add: [0.23, 0.17, 0.14, 0.14, 0.23] }, perDepth: true, worth: [2.05, 2.61, 2.15, 1.26, 1.53] }, // flat gold on every kill, in the room's gold (its own depth only)
      m: { name: "Magnet", effect: { stat: "magnetRange", mul: [1.254, 1.046, 1.046, 1.118, 1.077] }, worth: [0.75, 1.33, 1.06, 2.41, 0.72] },
      k: { name: "Smash", effect: { stat: "breakableBonus", add: [0.25, 0.063, 0.05, 0.083, 0.063] }, worth: [2.22, 1.54, 0.76, 1.63, 0.95] },
      // Horde: more monsters, sooner, and more XP from each, so rooms fill
      // their bars faster. Depth 1's rooms fill before most hordes arrive, so
      // Bigger hordes and Restless dead start in depth 2.
      e: { name: "Crowded rooms", effect: { stat: "onEnter", add: [2, 2, 3, 3, 2] }, perDepth: true, worth: [0.75, 3.67, 2.99, 3.39, 1.91] },
      u: { name: "Bigger hordes", effect: { stat: "horde", add: [null, 2, 3, 2, 2] }, perDepth: true, worth: [null, 39, 64, 29, 19] },
      v: { name: "Restless dead", effect: { stat: "hordeEvery", add: [null, -3, -2, -3, -3] }, perDepth: true, worth: [null, 20, 11, 10, 11] },
      y: { name: "Death calls", effect: { stat: "deathCall", add: [0.03, 0.017, 0.017, 0.025, 0.05] }, worth: [1.93, 3.17, 2.67, 4.8, 6.95] },
      i: { name: "Wisdom", effect: { stat: "xpBonus", add: [0.17, 0.17, 0.17, 0.25, 0.17] }, worth: [8.03, 3.7, 1.75, 2.93, 2.62] },
    },
  },
};
