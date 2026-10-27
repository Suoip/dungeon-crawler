import { BALANCE } from "./balance.js";
import { getSave } from "./save.js";
import { heroStats, withGear } from "./stats.js";
import { wornGear } from "./crafting.js";

// The depths there are (balance.js), and a depth's data by its number.
export const DEPTHS = BALANCE.depths.length;
export const depthData = (depth) => BALANCE.depths[depth - 1];

// The depths you can play: the first, and one more past each boss beaten.
export const unlockedDepths = () => Math.min(getSave().cleared + 1, DEPTHS);
// The depth the next run goes to (picked at the underworld's signpost).
export const chosenDepth = () => Math.min(getSave().depth, unlockedDepths());

// A run is one attempt at a depth (the one picked in the underworld, unless
// another is given): ROOMS rooms deep (config.js), the boss in the last one.
// It starts with the hero as your upgrades and gear make him (stats.js), a clock that
// counts down only while you're in control, and hearts that carry over from
// room to room.
export function newRun(depth = chosenDepth()) {
  const stats = withGear(heroStats(getSave().levels, depth), wornGear());
  return {
    depth,                    // which depth, 1 = the crypt
    index: 0,                 // the room he's in, 0 = the first
    stats,
    hearts: stats.hearts, maxHearts: stats.hearts,
    clock: stats.startTime,   // seconds left
    sand: stats.startTime,    // every second the clock has been given this run (the hourglass, hud.js)
    gold: 0,                  // coins picked up this run
    material: 0,              // the depth's material picked up this run (from sub-depth 6; balance.js depths)
    parts: {},                // monsters' parts picked up this run, for the forge: part -> how many
    kills: 0,
    deepest: 0,               // how far it got: 3.4 = 3 rooms cleared, 40% of the 4th's bar
    dropStreak: 0,            // kills in a row that didn't drop a heart (see combat.js)
  };
}

// A room's name in the strip and the results: "2-3" is depth 2, sub-depth 3.
export const depthLabel = (depth, sub) => `${depth}-${sub}`;
