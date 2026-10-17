// The crypt's room layouts (DESIGN.md section 3): where the pillars, floor
// spikes, breakables and the chest stand. Each sub-depth has a few designed
// layouts, and every time a room is entered one of them is picked at random.
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

export const LAYOUTS = [
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
    // Four posts: four pillars in a wide square around the middle, so you get
    // your first cover from skeleton charges and the centre lanes stay wide
    // open, with the pots in the two bottom corners.
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
