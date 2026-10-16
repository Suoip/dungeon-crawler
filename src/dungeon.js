// A run is one attempt at the dungeon: ROOMS rooms deep (config.js), with
// the boss waiting in the last one. Hearts carry over from room to room for
// the whole run. The timer starts when the hero lands in the first room.
export function newRun() {
  return {
    index: 0, // the room he's in, 0 = the first
    boss: "big_zombie",
    hearts: 3, maxHearts: 3,
    startTime: null, endTime: null,
    dropStreak: 0, // kills in a row that didn't drop a heart (see combat.js)
  };
}

// How long the run has taken so far, as "1:23".
export function runTime(run) {
  if (run.startTime === null) return "0:00";
  const now = run.endTime ?? performance.now();
  const seconds = Math.floor((now - run.startTime) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
