// The room layouts of each depth (DESIGN.md section 3): where the pillars,
// floor spikes, breakables and the chest stand. Each sub-depth has a few
// designed layouts, and every time a room is entered one of them is picked
// at random.
//
// A layout is 9 strings of 20 characters: the floor between the back wall
// and the bottom wall, one character per 16 px tile, top row first. The
// door is in the middle of the top row, and the hero lands in the middle,
// a little below the centre. What each character is:
export const TILES = {
  ".": "floor",
  "P": "pillar",   // solid; tall, so it hides what's behind it
  "^": "spikes",   // pop up every couple of seconds (only rooms with a hazard)
  "o": "pot",      // breaks in one hit
  "c": "crate",    // a few hits
  "U": "urn",      // big and sturdy: many hits, lots of gold
  "C": "chest",    // loot or a mimic (balance.js rooms[].chest); not always there
};
// What a room holds has to match its entry in balance.js (the pacing
// simulator counts on it), and some tiles must stay clear: the door, where
// the hero lands, and in sub-depth 10 where the boss rises.
// `node tools/layouts-check.mjs` checks all of that.

// The crypt's layouts.
const CRYPT = [
  // ---- Sub-depth 1 ----
  [
    // The two pots sit in the back corners on either side of the door, a short
    // sideways detour on the way out.
    [
      ".o................o.",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    // One pot halfway up each side wall, level with the middle of the room, so
    // either pot is a straight run sideways from where he lands.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      ".o................o.",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    // The pots hide in the two bottom corners, behind the hero and away from
    // the door, so grabbing them means turning his back on the exit.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      ".o................o.",
    ],
  ],
  // ---- Sub-depth 2 ----
  [
    // The pots flank the door against the back wall, a couple of tiles to
    // either side: a quick, tempting grab right next to the exit.
    [
      "......o......o......",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    // Both pots huddle together in the bottom-left corner, one longer detour
    // that pays off both pots at once.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      ".oo.................",
    ],
    // The pots sit in opposite corners (top-left and bottom-right), so he can
    // only take one on the way out, and getting both means crossing the whole
    // room.
    [
      ".o..................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "..................o.",
    ],
  ],
  // ---- Sub-depth 3 ----
  [
    // Four posts: four pillars in a wide square around the middle, the
    // crypt's first pillars to weave around while the tiny zombies chase
    // you, with the centre lanes wide open and the pots in the two bottom
    // corners.
    [
      "....................",
      "....................",
      "....................",
      ".....P........P.....",
      "....................",
      "....................",
      ".....P........P.....",
      "....................",
      ".o................o.",
    ],
    // Funnel: four pillars in a V that narrows toward the door, leaving a
    // 4-wide lane between the top pair, with a pot in each top corner past the
    // funnel.
    [
      ".o................o.",
      "....................",
      ".......P....P.......",
      "....................",
      "....P..........P....",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    // Two short walls: a pair of 2-pillar walls staggered on opposite sides at
    // different heights, each with a pot tucked just in front of it, out of
    // the middle.
    [
      "....................",
      "....................",
      "....................",
      "...PP...............",
      "...o................",
      "...............PP...",
      "................o...",
      "....................",
      "....................",
    ],
  ],
  // ---- Sub-depth 4 ----
  [
    // Pinwheel: a 2x2 spike patch in the top-left and another in the bottom-
    // right, each balanced by a lone pillar in the opposite corner (the layout
    // looks the same turned upside down), with the pots in the far corners.
    [
      "..................o.",
      "...^^...............",
      "...^^..........P....",
      "....................",
      "....................",
      "....................",
      "....P..........^^...",
      "...............^^...",
      ".o..................",
    ],
    // Shrine: a 2x2 spike patch framed by four pillars at its corners on the
    // left (open on all four sides, so you can walk around it), plus a small
    // spike strip on the right and pots in the right-hand corners.
    [
      "..................o.",
      "....................",
      "...P..P.............",
      "....^^..............",
      "....^^..............",
      "...P..P.............",
      "...............^^...",
      "....................",
      "..................o.",
    ],
    // Barricade: a broken line of spikes and pillars across row 3 with 2-wide
    // gaps and a 4-wide lane to the door, so you choose which gap to take; the
    // pots wait in the top corners beyond it.
    [
      "....................",
      ".o................o.",
      "....................",
      "..^^^..P....P..^^^..",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
  ],
  // ---- Sub-depth 5 ----
  [
    // Spike gate: a line of spikes ending in pillars cuts across row 3 and
    // leaves three ways through (both edges and the 4-wide lane up to the
    // door), with the pots in the top corners past the line and two low
    // pillars for cover in the lower half.
    [
      "..o..............o..",
      "....................",
      "....................",
      "...P^^^^....^^^^P...",
      "....................",
      "....................",
      ".....P........P.....",
      "....................",
      "....................",
    ],
    // Broken rings: two rings of 3 pillars, each around a 2x2 spike patch, one
    // top-left and one bottom-right (the room looks the same turned upside
    // down), each left open on the side facing the centre, with the pots in
    // the other two corners.
    [
      ".................o..",
      "...P..P.............",
      "....^^..............",
      "....^^..............",
      "...P............P...",
      "..............^^....",
      "..............^^....",
      ".............P..P...",
      "..o.................",
    ],
    // Pillar square: four pillars in a wide square around the landing spot
    // give cover from skeleton charges, with a 2x2 spike patch out in each
    // side wing and the pots in the bottom corners.
    [
      "....................",
      "....................",
      "......P......P......",
      "...^^..........^^...",
      "...^^..........^^...",
      "....................",
      "......P......P......",
      "....................",
      ".o................o.",
    ],
  ],
  // ---- Sub-depth 6 ----
  [
    // Storeroom: the crates and the pot are packed into the top-right corner
    // beside a short wall of 2 pillars, the chest sits in the open bottom-left
    // corner well clear of any spikes, and two pillars stand like gateposts on
    // either side of the lane up to the door, one beside a 2x2 spike patch,
    // with a small L of 3 spikes on the right.
    [
      ".................cc.",
      "..................o.",
      "...............PP...",
      ".....^^.............",
      ".....^^P....P.......",
      "....................",
      "..............^^....",
      "..C...........^.....",
      "....................",
    ],
    // Two alcoves: pairs of pillars form two nooks against the back wall, the
    // chest in the left one and the pot in the right (each with a 3-wide mouth
    // and open floor around it), with a 3-tile spike strip low in each wing
    // and the crates in the bottom corners.
    [
      "....................",
      "....C..........o....",
      "....................",
      "..P...P......P...P..",
      "....................",
      "....................",
      "...^^^........^^^...",
      "....................",
      ".c................c.",
    ],
    // L-wall: a 4-pillar wall plus a lone pillar below its left end make an L
    // (with a gap you can see) that shelters a roomy nook on the right where
    // the chest sits, while the left half has a 2x2 spike patch and a spike
    // pair with a 2-wide corridor between them, the pot top-left and the
    // crates bottom-left.
    [
      ".o..................",
      "....................",
      ".............PPPP...",
      "....^^..............",
      "....^^..............",
      ".................C..",
      ".............P......",
      "....^^..............",
      ".cc.................",
    ],
  ],
  // ---- Sub-depth 7 ----
  [
    // Pillar rows: an upper row of four pillars, the middle two standing
    // either side of the door lane like door posts (it stays 4 wide), a lower
    // pair below them, and a small L of spikes in each side lane between the
    // rows; the chest sits in the bottom-left corner.
    [
      ".c................o.",
      "....................",
      "...P...P....P...P...",
      "....................",
      "..^^............^^..",
      "...^............^...",
      ".....P........P.....",
      "....................",
      ".C................c.",
    ],
    // Lopsided: a ring of four pillars around a 2x2 spike pit on the left, and
    // on the open right the chest stands with two pillars in front of it as
    // cover from charges, plus a spike pair low on the right.
    [
      ".c..................",
      "....................",
      "...P..P........C....",
      "....^^..............",
      "....^^..............",
      "...P..P......P...P..",
      "....................",
      "..............^^....",
      ".o...............c..",
    ],
    // Broken diagonal: a staircase of six pillars from top-left to bottom-
    // right with a gap where the door lane runs, a 2x2 spike patch guarding
    // the top-right pot, and the chest in the open lower-left.
    [
      ".c................o.",
      "..............^^....",
      "...P..........^^....",
      ".....P..............",
      ".......P....P.......",
      "..............P.....",
      "...C............P...",
      "....................",
      ".c.............^^...",
    ],
  ],
  // ---- Sub-depth 8 ----
  [
    // Twin rings: two pillar rings, each framing a 2x2 spike pit, one on each
    // side of the open middle, with a spike pair below each ring; the chest
    // sits in the top-left corner and the crates in the bottom corners.
    [
      ".C................o.",
      "....................",
      "...P..P......P..P...",
      "....^^........^^....",
      "....^^........^^....",
      "...P..P......P..P...",
      "....................",
      "....^^........^^....",
      ".c................c.",
    ],
    // Fences: two horizontal fences of pillars with spikes in their one-tile
    // gaps cut off the top corners (the chest waits behind the right fence,
    // reached safely around either end or up the open middle), and two lower
    // pillars with spike L's break up skeleton charges.
    [
      ".c..............C...",
      "....................",
      "....................",
      "..P^P^P......P^P^P..",
      "....................",
      "....................",
      "......P......P......",
      "...^^..........^^...",
      ".o..^..........^..c.",
    ],
    // Pinwheel: four short two-pillar walls turned around the room's middle
    // (top-left flat, top-right upright, bottom-right flat, bottom-left
    // upright), each with a spike strip along its open side, leaving the
    // centre and the door lane open; the chest sits in the bottom-left corner.
    [
      ".c................o.",
      "....................",
      "....PP........^P....",
      "....^^^.......^P....",
      "....................",
      "...P^...............",
      "...P^.........PP....",
      "..............^^....",
      ".C.............^..c.",
    ],
  ],
  // ---- Sub-depth 9 ----
  [
    // The nave: two columns of three spaced pillars make a 6-wide central
    // aisle with a spike pair in it (a sidestep on the way to the door) and a
    // 2x2 spike patch in each side aisle; crates sit in the top corners, the
    // chest in the open bottom-left, and the urn tucked into the bottom-right
    // corner.
    [
      ".c................c.",
      "......P......P......",
      "....................",
      "..^^.....^^.....^^..",
      "..^^..P......P..^^..",
      "....................",
      "....................",
      "..C...P......P......",
      "..................U.",
    ],
    // Two shrines: a square of four pillars on each side around a 2x2 spike
    // pit, plus spike pairs flanking the door; the urn sits against the bottom
    // wall right behind the landing spot (tempting, but the opposite way from
    // the door), and the chest stands in the open bottom-right.
    [
      "....................",
      "......^^....^^......",
      "..P..P........P..P..",
      "...^^..........^^...",
      "...^^..........^^...",
      "..P..P........P..P..",
      "....................",
      "...............C....",
      ".c.............U..c.",
    ],
    // The island: he lands inside four spike brackets with exits up, down and
    // to both sides (2-3 tiles wide), and four lone pillars around the outer
    // room give cover; the urn waits in the far top-left corner and the chest
    // in the open top-right.
    [
      ".U..................",
      "....................",
      ".....P........P.....",
      ".................C..",
      ".......^^...^^......",
      ".......^.....^......",
      "...P............P...",
      "......^^.....^^.....",
      ".c................c.",
    ],
  ],
  // ---- Sub-depth 10 ----
  [
    // Four corner posts frame the arena and give him something to circle with
    // the minions, with crates in opposite corners and the whole middle open.
    [
      ".c..................",
      "....................",
      "...P............P...",
      "....................",
      "....................",
      "....................",
      "...P............P...",
      "....................",
      "..................c.",
    ],
    // Side colonnades: a line of three spaced pillars near each side wall
    // turns the room into a hall, with 2-wide aisles behind them and 14 open
    // columns for the boss's dashes; crates in the top corners.
    [
      ".c................c.",
      "..P..............P..",
      "....................",
      "....................",
      "..P..............P..",
      "....................",
      "....................",
      "..P..............P..",
      "....................",
    ],
    // Wide-open arena: four pillars stand against the back wall (in row 0
    // their tall sprites cover only wall, so they hide no floor), crates sit
    // in the bottom corners, and there's nothing else to snag on.
    [
      "..P....P....P....P..",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      ".c................c.",
    ],
  ],
];

// The goblin warrens' layouts. Each room holds what the crypt's room at the
// same sub-depth holds (balance.js), arranged as a burrow instead: dens off
// to the sides, pillars as tunnel mouths and cover from the imps' fireballs.
const WARRENS = [
  // ---- Sub-depth 1 ----
  [
    // An empty den with the pots in the bottom corners.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      ".o................o.",
    ],
    // One pot up by the back wall on the left, one low on the right.
    [
      "....................",
      "..o.................",
      "....................",
      "....................",
      "....................",
      "....................",
      ".................o..",
      "....................",
      "....................",
    ],
    // Both pots together in the top-left corner.
    [
      "...oo...............",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
  ],
  // ---- Sub-depth 2 ----
  [
    // A pot on each side wall, halfway up.
    [
      "....................",
      "....................",
      "....................",
      ".o................o.",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    // One by the back wall, one low down on the other side.
    [
      ".....o..............",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "...............o....",
      "....................",
    ],
    // Opposite corners.
    [
      ".................o..",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "..o.................",
    ],
  ],
  // ---- Sub-depth 3 ----
  [
    // Burrow mouths: two pairs of pillars on each side, room to hide from a
    // fireball behind either pair, pots in the bottom corners.
    [
      "....................",
      "....................",
      "....PP........PP....",
      "....................",
      "....................",
      "....................",
      "....PP........PP....",
      "....................",
      ".o................o.",
    ],
    // Scattered posts in a loose V, pots in opposite corners.
    [
      "..o.................",
      "....................",
      "...P..........P.....",
      "....................",
      ".......P....P.......",
      "....................",
      "....................",
      "....................",
      ".................o..",
    ],
    // Two short walls of three pillars up by the back wall, with the pots
    // low down on either side.
    [
      "....................",
      "....................",
      "..PPP..........PPP..",
      "....................",
      "....................",
      "....................",
      "....................",
      "..o..............o..",
      "....................",
    ],
  ],
  // ---- Sub-depth 4 ----
  [
    // Spike patches in the top corners, two posts beside the landing spot.
    [
      "....................",
      "....................",
      "...^^..........^^...",
      "...^^..........^^...",
      "....................",
      "......P......P......",
      "....................",
      "....................",
      ".o................o.",
    ],
    // Two spike strips across opposite halves, posts low down.
    [
      ".o..................",
      "....................",
      "....................",
      "..^^^^..............",
      "....................",
      "..............^^^^..",
      "....................",
      "....P........P......",
      "..................o.",
    ],
    // Each pot guarded by an L of spikes, by the back wall.
    [
      "....................",
      "..o^............^o..",
      "...^............^...",
      "....................",
      ".....P........P.....",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
  ],
  // ---- Sub-depth 5 ----
  [
    // Crossroads: four posts, spike pairs out on the wings and down low.
    [
      "....................",
      "....................",
      "....P..........P....",
      "....................",
      "..^^............^^..",
      "....................",
      "....P..........P....",
      "....................",
      ".o.^^..........^^.o.",
    ],
    // Two 2x2 spike patches on either side of the lane to the door.
    [
      "..o.................",
      "....................",
      "......^^....^^......",
      "......^^....^^......",
      "....................",
      "..P..............P..",
      "....................",
      "....................",
      ".................o..",
    ],
    // Spike rows between the posts on each side.
    [
      "....................",
      "...P............P...",
      "....................",
      "....................",
      "...^^^........^^^...",
      "....................",
      "...P............P...",
      ".o................o.",
      "....................",
    ],
  ],
  // ---- Sub-depth 6 ----
  [
    // A store in the top-left corner, the chest down the same side.
    [
      ".cc.................",
      "..o.................",
      "....................",
      "......^^............",
      "......^^.....P......",
      "....................",
      "..............^^....",
      "..C.................",
      "....................",
    ],
    // Crates under a post on the left, the chest up on the right.
    [
      "....................",
      "..P..............P..",
      "..c...........C.....",
      "..c.................",
      "....^^......^^......",
      "....................",
      "..o.................",
      "....................",
      "....................",
    ],
    // Spike columns either side of two posts, the chest in a back corner.
    [
      ".C..................",
      "....................",
      "...^..........^.....",
      "...^..P....P..^.....",
      "...^..........^.....",
      "....................",
      "....................",
      "................cc..",
      "................o...",
    ],
  ],
  // ---- Sub-depth 7 ----
  [
    // Crates in the back corners, one post near the door, the chest low.
    [
      "....................",
      ".c................c.",
      "....................",
      "...^^....P.....^^...",
      "....................",
      "....................",
      "....................",
      ".C................o.",
      "....................",
    ],
    // Twin dens: a crate tucked into each corner of pillars.
    [
      "....................",
      "...PP..........PP...",
      "...cP..........Pc...",
      "....................",
      "......^^....^^......",
      "....................",
      "..o.................",
      "...............C....",
      "....................",
    ],
    // Spike rows high and low on the left, crates and the chest on the right.
    [
      ".o..................",
      "....................",
      "..^^^............C..",
      "....................",
      "....P........P......",
      "....................",
      "..^^^..........cc...",
      "....................",
      "....................",
    ],
  ],
  // ---- Sub-depth 8 ----
  [
    // Spike blocks in all four corners, the store along the bottom.
    [
      "....................",
      "..^^............^^..",
      "..^^..P......P..^^..",
      "....................",
      "....................",
      "..^^............^^..",
      "..^^............^^..",
      ".c..C............co.",
      "....................",
    ],
    // Two long spike strips by the back wall, posts on the sides.
    [
      ".c................c.",
      "....................",
      "....^^^^....^^^^....",
      "....................",
      "..P..............P..",
      "....................",
      "....................",
      "..o.............C...",
      "....................",
    ],
    // Spikes high in the middle and low on the walls, two posts between.
    [
      "....................",
      ".o..^^........^^....",
      "....^^........^^....",
      "......P......P......",
      "....................",
      ".^^..............^^.",
      ".^^..............^^.",
      "...C............cc..",
      "....................",
    ],
  ],
  // ---- Sub-depth 9 ----
  [
    // The urn in a back corner, spike patches dotted about.
    [
      "....................",
      "..U.............^^..",
      "................^^..",
      "...^^...............",
      "...^^.....P.........",
      "....................",
      "............^^......",
      "..C.........^^...cc.",
      "....................",
    ],
    // Spike strips along the back wall between posts, the urn low right.
    [
      ".cc.................",
      "....................",
      "..^^^^.P....P.^^^^..",
      "....................",
      "....................",
      "....................",
      "...P............P...",
      "..................U.",
      ".C..................",
    ],
    // Crates behind posts and spikes up top, more spikes low on the walls.
    [
      "....................",
      "..P.^^......^^.P....",
      "..c.^^......^^.c....",
      "....................",
      "...C...........U....",
      "..^^............^^..",
      "..^^............^^..",
      "....................",
      "....................",
    ],
  ],
  // ---- Sub-depth 10 ----
  [
    // Four posts well out on the wings, crates in the back corners: the
    // middle stays open for the ogre.
    [
      ".c................c.",
      "....................",
      "..P..............P..",
      "....................",
      "....................",
      "....................",
      "..P..............P..",
      "....................",
      "....................",
    ],
    // Posts in the corners, crates halfway down the side walls.
    [
      "....................",
      "..P..............P..",
      "....................",
      "....................",
      ".c................c.",
      "....................",
      "....................",
      "..P..............P..",
      "....................",
    ],
    // Posts against the back wall and near the bottom, crates in the
    // bottom corners.
    [
      "...P............P...",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "...P............P...",
      ".c................c.",
    ],
  ],
];

// The orc fort's layouts: palisades of pillars, gatehouses, barracks and
// armories, with the same contents as the crypt's room at each sub-depth.
const FORT = [
  // ---- Sub-depth 1 ----
  [
    // A pot halfway up each side wall.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      ".o................o.",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    // Both pots up by the back wall, well out to the sides.
    [
      "..o..............o..",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    // One low on the left, one high on the right.
    [
      "....................",
      "................o...",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "...o................",
      "....................",
    ],
  ],
  // ---- Sub-depth 2 ----
  [
    // High on the left, low on the right.
    [
      "....................",
      "....................",
      ".o..................",
      "....................",
      "....................",
      "....................",
      "..................o.",
      "....................",
      "....................",
    ],
    // Level with the landing spot, out by the walls.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "..o..............o..",
      "....................",
      "....................",
      "....................",
    ],
    // Up by the back wall, either side of the door.
    [
      "....o..........o....",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
  ],
  // ---- Sub-depth 3 ----
  [
    // Gatehouse: two pairs of pillars flank the way to the door.
    [
      "....................",
      ".....PP......PP.....",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      ".o................o.",
      "....................",
    ],
    // Watchposts: four pillars spread round the room.
    [
      "..o.................",
      "....................",
      "....................",
      "..P..............P..",
      "....................",
      "....................",
      ".....P........P.....",
      "....................",
      "...............o....",
    ],
    // Palisades: a wall of four pillars out from each side wall.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      ".PPPP..........PPPP.",
      "....................",
      "....................",
      "....................",
      "..o..............o..",
    ],
  ],
  // ---- Sub-depth 4 ----
  [
    // A spike ditch on either side of the way to the door.
    [
      ".o..................",
      "....................",
      "....................",
      "...^^^......^^^.....",
      "....................",
      "..P..............P..",
      "....................",
      "....................",
      "..................o.",
    ],
    // Two posts, each with spikes at its foot.
    [
      "....................",
      "....P........P......",
      "....^........^......",
      "....^........^......",
      "....................",
      "....................",
      "....................",
      ".o...............o..",
      "....................",
    ],
    // Spike rows high on the right and low on the left.
    [
      "...............o....",
      "............^^^^....",
      "....................",
      "....................",
      "....................",
      "....................",
      "...^^^^.............",
      "....o...............",
      "....................",
    ],
  ],
  // ---- Sub-depth 5 ----
  [
    // Barracks: pillar pairs by the back wall, spike patches below them.
    [
      "....................",
      "..PP............PP..",
      "....................",
      "...^^..........^^...",
      "...^^..........^^...",
      "....................",
      "....................",
      ".o................o.",
      "....................",
    ],
    // Two spike columns either side of a post on the way to the door.
    [
      "..o.............o...",
      "....................",
      "......^......^......",
      "......^..P...^......",
      "......^......^......",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    // Spikes along the side walls, posts beside the door's lane.
    [
      "....................",
      "....................",
      ".^^..P......P....^^.",
      ".^^..............^^.",
      "....................",
      "....................",
      "....................",
      "....................",
      ".o................o.",
    ],
  ],
  // ---- Sub-depth 6 ----
  [
    // Armory: crates in a back corner behind a post, the chest on the right.
    [
      ".cc..P..............",
      ".o...P..............",
      "....................",
      "...........^^.......",
      "...........^^...C...",
      "....................",
      "....................",
      "....^^..............",
      "....................",
    ],
    // Spike rows under two posts, the store low on the right.
    [
      "....................",
      "...P............P...",
      "..^^^..........^^^..",
      "....................",
      "....................",
      "..C.................",
      "....................",
      "...............cc...",
      "...............o....",
    ],
    // Crates stacked high on the right, the chest low on the right.
    [
      "..o.............c...",
      "................c...",
      "....................",
      "....^^......^^......",
      "....P........P......",
      "....................",
      "....................",
      "..................C.",
      "....................",
    ],
  ],
  // ---- Sub-depth 7 ----
  [
    // Crates in the back corners, pillar pairs below them.
    [
      ".c................c.",
      "....................",
      "..PP............PP..",
      "....................",
      "......^^....^^......",
      "....................",
      "....................",
      ".o................C.",
      "....................",
    ],
    // Spike columns down both sides, the store along the left wall.
    [
      "....................",
      "..^..P........P..^..",
      "..^..............^..",
      "..^..............^..",
      "....................",
      ".c..................",
      ".c..............o...",
      "....................",
      "...C................",
    ],
    // A spike row by the back wall, the chest in the top corner.
    [
      "...C................",
      "....................",
      "......^^^^..........",
      "....................",
      "...P..........P.....",
      "....................",
      "....................",
      "...............cc...",
      "..o.................",
    ],
  ],
  // ---- Sub-depth 8 ----
  [
    // Long spike rows by the back wall, more low down.
    [
      "....................",
      ".^^^^..........^^^^.",
      "....................",
      "....P........P......",
      "....................",
      "....................",
      ".^^............^^...",
      ".c.............C....",
      ".c................o.",
    ],
    // Spike blocks round a gate of two pillars, more in the corners.
    [
      ".o..............cc..",
      "....................",
      "....^^......^^......",
      "....^^..PP..^^......",
      "..C.................",
      "....................",
      "..^^............^^..",
      "..^^............^^..",
      "....................",
    ],
    // Pillars cap the spike rows by the back wall.
    [
      "....................",
      "..P^^^^......^^^^P..",
      "....................",
      "....................",
      ".c................c.",
      "....................",
      ".^^..............^^.",
      "..C..............o..",
      "....................",
    ],
  ],
  // ---- Sub-depth 9 ----
  [
    // The urn in a back corner, spike rows high and low.
    [
      "..U.................",
      "....................",
      "....^^^......^^^....",
      "....................",
      "..P..............P..",
      "....................",
      ".^^^............^^^.",
      ".c...............C..",
      ".c..................",
    ],
    // Spike pairs beside posts by the back wall.
    [
      ".cc..............U..",
      "....................",
      "...P^^........^^P...",
      "....^^........^^....",
      "....................",
      "....................",
      "....................",
      "..C.................",
      "....................",
    ],
    // Spikes in all four corners, the crates and the urn between them.
    [
      "....................",
      "..^^............^^..",
      "..^^..P......P..^^..",
      "....................",
      "..c..............U..",
      "..c.................",
      "....^^........^^....",
      "....^^........^^..C.",
      "....................",
    ],
  ],
  // ---- Sub-depth 10 ----
  [
    // Posts against the side walls, crates in the back corners.
    [
      ".c..............c...",
      "....................",
      ".P................P.",
      "....................",
      "....................",
      "....................",
      ".P................P.",
      "....................",
      "....................",
    ],
    // Double posts high on the sides, crates low.
    [
      "....................",
      "...P............P...",
      "...P............P...",
      "....................",
      "....................",
      "....................",
      "....................",
      ".c................c.",
      "....................",
    ],
    // Posts in the four corners, crates halfway down the walls.
    [
      "..P..............P..",
      "....................",
      "....................",
      ".c................c.",
      "....................",
      "....................",
      "....................",
      "..P..............P..",
      "....................",
    ],
  ],
];

// The sunken swamp's layouts: bog pools (the spikes), dead trees standing
// alone or in groves (the pillars), with the same contents as the crypt's
// room at each sub-depth.
const SWAMP = [
  // ---- Sub-depth 1 ----
  [
    // Two pots out in the open, either side of the way to the door.
    [
      "....................",
      "....................",
      "......o......o......",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    // One low on the left wall, one high on the right.
    [
      "....................",
      "..................o.",
      "....................",
      "....................",
      "....................",
      "....................",
      ".o..................",
      "....................",
      "....................",
    ],
    // Down by the bottom wall, out to the sides.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "...o............o...",
    ],
  ],
  // ---- Sub-depth 2 ----
  [
    // Halfway up, a little in from the walls.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      "...o............o...",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    // In the top-left corner and just right of the landing spot.
    [
      ".o..................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "............o.......",
      "....................",
    ],
    // Close together, just below the door.
    [
      "....................",
      "....................",
      "....................",
      ".......o....o.......",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
  ],
  // ---- Sub-depth 3 ----
  [
    // Dead trees standing alone, scattered about.
    [
      ".................o..",
      ".............P......",
      "...P................",
      "....................",
      "...............P....",
      "....................",
      ".....P..............",
      "....................",
      "..o.................",
    ],
    // Two groves of three by the back corners.
    [
      "....................",
      "....................",
      "...PP..........PP...",
      "...P............P...",
      "....................",
      "....................",
      "....................",
      "..o..............o..",
      "....................",
    ],
    // Rows of stumps along the back wall on the right and low on the left.
    [
      "..o..........P.P.P..",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      ".P.P.P..............",
      "..................o.",
    ],
  ],
  // ---- Sub-depth 4 ----
  [
    // A bog pool up on the left, another down the right, a tree low left.
    [
      "....................",
      "..^^................",
      "..^^............o...",
      "...............^^...",
      ".o.............^^...",
      "....................",
      "....P...............",
      "....................",
      "....................",
    ],
    // Two small pools either side of the way to the door.
    [
      "...o................",
      "....................",
      ".......^......^.....",
      "......^^......^^....",
      "....................",
      "..P..............P..",
      "....................",
      "................o...",
      "....................",
    ],
    // Long thin pools along the side walls.
    [
      "....................",
      "....................",
      "....................",
      ".^^^................",
      "....................",
      "................^^^.",
      "....................",
      "..o..........P......",
      ".................o..",
    ],
  ],
  // ---- Sub-depth 5 ----
  [
    // Trees with pools at their feet, and more pools further down.
    [
      "....................",
      "...P..........P.....",
      "...^^........^^.....",
      "....................",
      "....................",
      "...^^........^^.....",
      "....................",
      ".o................o.",
      "....................",
    ],
    // A long pool by the back wall on the left, a lone tree on the right.
    [
      ".o..................",
      "....................",
      ".....^^^^^..........",
      "....................",
      "..............P.....",
      "....................",
      "....................",
      "....................",
      "..................o.",
    ],
    // Pairs of narrow pools, trees in front of the landing spot's sides.
    [
      "....................",
      "....................",
      ".^..^........^..^...",
      ".^..^........^..^...",
      "....................",
      "......P......P......",
      "....................",
      "..o.............o...",
      "....................",
    ],
  ],
  // ---- Sub-depth 6 ----
  [
    // The store up on the right, pools on the left and low right.
    [
      ".............cc.....",
      ".............o......",
      "....................",
      "..^^^...............",
      "....................",
      "....P...........^^..",
      "................^^..",
      ".C..................",
      "....................",
    ],
    // The chest in a back corner, square pools between two trees.
    [
      "..C.................",
      "....................",
      "....^^........^^....",
      "....^^........^^....",
      "....................",
      "..P..............P..",
      "....................",
      ".cc..............o..",
      "....................",
    ],
    // Two trees by the back wall, small pools below, the store low.
    [
      "....................",
      ".o..P..........P....",
      "....................",
      "......^^....^^......",
      "....................",
      "....................",
      "....................",
      ".c..............C...",
      ".c..................",
    ],
  ],
  // ---- Sub-depth 7 ----
  [
    // The chest in the top-left corner behind a pair of trees.
    [
      ".C..................",
      "....................",
      "..PP.............o..",
      "....................",
      "...^^^......^^^.....",
      "....................",
      "....................",
      "...............cc...",
      "....................",
    ],
    // Pools down both side walls, crates up high.
    [
      "....................",
      "..c.............c...",
      "....P........P......",
      "....................",
      ".^^..............^^.",
      ".^^..............^^.",
      "....................",
      "..o..............C..",
      "....................",
    ],
    // Wide pools across the back, the store low on the left.
    [
      "..o..............C..",
      "....................",
      "..^^^..........^^^..",
      "....................",
      "....................",
      "....................",
      "...P............P...",
      ".cc.................",
      "....................",
    ],
  ],
  // ---- Sub-depth 8 ----
  [
    // Long pools by the back wall, more low down, the store in the corners.
    [
      "....................",
      "..^^^^......^^^^....",
      "....................",
      "....................",
      "..P..............P..",
      "....................",
      "..^^............^^..",
      ".c.............C....",
      ".c..............o...",
    ],
    // Square pools round two trees, more below.
    [
      ".cc...............C.",
      "....................",
      "...^^..........^^...",
      "...^^..P....P..^^...",
      "....................",
      "....................",
      "...^^..........^^...",
      "....................",
      "...o................",
    ],
    // Pools high in the middle and low on the walls.
    [
      "....................",
      ".o..................",
      "......^^^^....^^^^..",
      "....................",
      "...P..........P.....",
      "....................",
      ".^^...............^.",
      ".c....C..........c..",
      "....................",
    ],
  ],
  // ---- Sub-depth 9 ----
  [
    // A big pool up on the left, the urn in the top-right corner.
    [
      "................U...",
      "....................",
      "..^^^^..............",
      "..^^^^......C.......",
      "....................",
      "...............P....",
      "..............^^^...",
      ".cc.................",
      "....................",
    ],
    // Pools beside two trees by the back wall, the urn in the top-left corner.
    [
      ".U..................",
      "....................",
      "...P^^......^^P.....",
      "....^^......^^......",
      "....................",
      "....................",
      "....................",
      ".C..............cc..",
      "....................",
    ],
    // Pools in all four corners, the urn low beside the landing spot.
    [
      "....................",
      ".^^..............^^.",
      ".^^...P......P...^^.",
      "....................",
      "....................",
      ".^^..............^^.",
      "....................",
      "..c....U.........c..",
      "...............C....",
    ],
  ],
  // ---- Sub-depth 10 ----
  [
    // Two trees on each side, crates high: the middle is open.
    [
      "....................",
      ".c................c.",
      "....................",
      "..P..............P..",
      "....................",
      "..P..............P..",
      "....................",
      "....................",
      "....................",
    ],
    // Trees in the corners, crates halfway down the walls.
    [
      ".P................P.",
      "....................",
      "....................",
      "....................",
      "....................",
      ".c................c.",
      "....................",
      ".P................P.",
      "....................",
    ],
    // Trees high and low on the sides, crates by the bottom wall.
    [
      "....................",
      "....................",
      "...P............P...",
      "....................",
      "....................",
      "....................",
      "....................",
      "...P............P...",
      "..c..............c..",
    ],
  ],
];

// The demon pit's layouts: beds of hot coals (the spikes) and obsidian spires
// (the pillars), with the same contents as the crypt's room at each
// sub-depth.
const PIT = [
  // ---- Sub-depth 1 ----
  [
    // Up near the back wall, a little out from the door.
    [
      "....................",
      ".....o........o.....",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
    ],
    // Low down on both side walls.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      ".o................o.",
      "....................",
    ],
    // One halfway up on the left, one down by the bottom wall on the right.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      "....o...............",
      "....................",
      "....................",
      "....................",
      "...............o....",
    ],
  ],
  // ---- Sub-depth 2 ----
  [
    // High on the left, low on the right.
    [
      "....................",
      "....................",
      "...o................",
      "....................",
      "....................",
      "....................",
      "................o...",
      "....................",
      "....................",
    ],
    // Low on the left, high on the right.
    [
      "....................",
      "................o...",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "...o................",
    ],
    // Either side of the landing spot.
    [
      "....................",
      "....................",
      "....................",
      "....................",
      "....................",
      "......o......o......",
      "....................",
      "....................",
      "....................",
    ],
  ],
  // ---- Sub-depth 3 ----
  [
    // A loose ring of obsidian spires.
    [
      ".o..................",
      "....................",
      ".....P........P.....",
      "....................",
      "....................",
      "....................",
      "...P............P...",
      "....................",
      "..................o.",
    ],
    // Twin spires on either side, partway down.
    [
      "....................",
      "....................",
      "....................",
      "......PP....PP......",
      "....................",
      "....................",
      "....................",
      "..o..............o..",
      "....................",
    ],
    // Spires flanking the door and the landing spot's sides.
    [
      "....................",
      "......P......P......",
      "....................",
      "....................",
      ".o................o.",
      "....P..........P....",
      "....................",
      "....................",
      "....................",
    ],
  ],
  // ---- Sub-depth 4 ----
  [
    // Coal beds high on the left and partway down on the right.
    [
      "....................",
      "....^^^^............",
      "....................",
      "..P.........^^^^....",
      "....................",
      "....................",
      "....................",
      ".o..............P.o.",
      "....................",
    ],
    // Scattered coals either side of the way to the door.
    [
      "..o.................",
      "....................",
      "..^..^......^..^....",
      "....................",
      "..^..^......^..^....",
      "....................",
      "......P......P......",
      "..................o.",
      "....................",
    ],
    // Long coal beds out from both side walls.
    [
      "....................",
      "...P............P...",
      "....................",
      "....................",
      ".^^^^..........^^^^.",
      "....................",
      "....................",
      "...o............o...",
      "....................",
    ],
  ],
  // ---- Sub-depth 5 ----
  [
    // Coal beds round two spires by the back corners.
    [
      "....................",
      "..^^............^^..",
      "..^^..P......P..^^..",
      "....................",
      "....................",
      "....................",
      "....................",
      "..o..............o..",
      "....................",
    ],
    // Square coal beds either side of the lane to the door.
    [
      ".o..............o...",
      "....................",
      "....................",
      "......^^....^^......",
      "......^^....^^......",
      "....................",
      "..P..............P..",
      "....................",
      "....................",
    ],
    // Thin coal lines down from spires by the side walls.
    [
      "....................",
      "....................",
      ".P.^............^.P.",
      "...^............^...",
      "...^............^...",
      "....................",
      "....................",
      ".o................o.",
      "....................",
    ],
  ],
  // ---- Sub-depth 6 ----
  [
    // The store in the top-left corner, the chest out on the right.
    [
      "..cc................",
      "..o.........P.......",
      "....................",
      "......^^......^^....",
      "....................",
      "....................",
      "................C...",
      "....^^..............",
      "....................",
    ],
    // Coal beds below two spires, the store low on the left.
    [
      "...............C....",
      "....................",
      "..^^^...............",
      "....................",
      "..P..............P..",
      "....................",
      "...............^^^..",
      ".c..................",
      ".co.................",
    ],
    // Coal lines down both sides, spires between them.
    [
      "....................",
      ".C................c.",
      "....^..........^..c.",
      "....^..........^....",
      "....^..P....P..^....",
      "....................",
      "....................",
      "..o.................",
      "....................",
    ],
  ],
  // ---- Sub-depth 7 ----
  [
    // Crates in the top-right corner, coal beds across the back.
    [
      "..o..............cc.",
      "....................",
      "...^^^......^^^.....",
      "....................",
      "..P..............P..",
      "....................",
      "....................",
      ".C..................",
      "....................",
    ],
    // Square coal beds down both sides, crates by the spires.
    [
      "....................",
      "..c..P......P..c....",
      "....................",
      "..^^............^^..",
      "..^^............^^..",
      "....................",
      "..............o.....",
      "....................",
      "...C................",
    ],
    // A long coal bed by the door, the chest in a back corner.
    [
      "...C................",
      "....................",
      "..........^^^^^.....",
      "....................",
      "...P............P...",
      "....................",
      ".cc.................",
      "................o...",
      "....................",
    ],
  ],
  // ---- Sub-depth 8 ----
  [
    // Big coal beds in the back corners.
    [
      "....................",
      ".^^^..........^^^...",
      ".^^^..........^^^...",
      "....................",
      "......P......P......",
      "....................",
      "....................",
      ".c..C............c..",
      "..o.................",
    ],
    // Long coal beds by the back wall, more low down.
    [
      ".cc.............o...",
      "....................",
      "...^^^^....^^^^.....",
      "....................",
      "..P..............P..",
      "....................",
      "..^^............^^..",
      "....................",
      "..C.................",
    ],
    // Coal beds behind spires high up, and on the side walls lower down.
    [
      "....................",
      "..P..^^......^^..P..",
      ".....^^......^^.....",
      "....................",
      "....................",
      ".^^..............^^.",
      "....................",
      ".c..............C...",
      ".c...............o..",
    ],
  ],
  // ---- Sub-depth 9 ----
  [
    // A square of coals up on the left, more low right, the urn in a corner.
    [
      "..U.................",
      "....................",
      ".....^^^^...........",
      ".....^^^^...........",
      "....................",
      "..............P.....",
      "............^^^^....",
      ".cc...........C.....",
      "....................",
    ],
    // Wide coal beds either side of two spires.
    [
      ".cc.............U...",
      "....................",
      "..^^^..P....P..^^^..",
      "..^^^..........^^^..",
      "....................",
      "....................",
      "....................",
      "..C.................",
      "....................",
    ],
    // Coals in the back corners and in front, the urn by the landing spot.
    [
      "....................",
      ".^^.............^^..",
      ".^^..P......P...^^..",
      "....................",
      "..c..............c..",
      "....................",
      "....^^......^^......",
      ".......U........C...",
      "....................",
    ],
  ],
  // ---- Sub-depth 10 ----
  [
    // Spires high and low, out on the wings; crates high.
    [
      "....................",
      ".c..P..........P..c.",
      "....................",
      "....................",
      "....................",
      "....................",
      "....P...........P...",
      "....................",
      "....................",
    ],
    // Spires in the corners, crates halfway down the side walls.
    [
      ".P..............P...",
      "....................",
      "....................",
      ".c................c.",
      "....................",
      "....................",
      "....................",
      "....................",
      ".P................P.",
    ],
    // Double spires on both sides, crates low.
    [
      "....................",
      "....................",
      "..P..............P..",
      "..P..............P..",
      "....................",
      "....................",
      "....................",
      "..c..............c..",
      "....................",
    ],
  ],
];

// The layouts of each depth, by depth (index 0 = the crypt) and sub-depth.
export const LAYOUTS = [CRYPT, WARRENS, FORT, SWAMP, PIT];
