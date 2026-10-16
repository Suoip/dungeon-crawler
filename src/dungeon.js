import { getSave } from "./save.js";
import { heroStats } from "./stats.js";

// The depth being played. Only depth 1, the crypt, exists so far.
export const DEPTH = 1;

// A run is one attempt at the depth: ROOMS rooms deep (config.js), the boss
// in the last one. It starts with the hero as your upgrades make him
// (stats.js), a clock that counts down only while you're in control, and
// hearts that carry over from room to room.
export function newRun() {
  const stats = heroStats(getSave().levels);
  return {
    index: 0,                 // the room he's in, 0 = the first
    stats,
    hearts: stats.hearts, maxHearts: stats.hearts,
    clock: stats.startTime,   // seconds left
    gold: 0,                  // coins picked up this run
    kills: 0,
    deepest: 0,               // how far it got: 3.4 = 3 rooms cleared, 40% of the 4th's bar
    dropStreak: 0,            // kills in a row that didn't drop a heart (see combat.js)
  };
}

// A room's name in the strip and the results: "1-3" is depth 1, sub-depth 3.
export const depthLabel = (sub) => `${DEPTH}-${sub}`;
