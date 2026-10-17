// Checks the room layouts in src/layouts.js against the rules that keep a
// room fair and playable, and against src/balance.js (the pacing simulator
// counts on each room's breakables and spikes being what balance.js says).
// Run it with `node tools/layouts-check.mjs`: it lists every broken rule, or
// says all is well. checkLayout() is exported, for trying out new layouts.
//
// A layout is 9 strings of 20 characters: the floor between the back wall
// and the bottom wall, one character per 16 px tile (see layouts.js).
import { pathToFileURL } from "node:url";
import { BALANCE } from "../src/balance.js";
import { LAYOUTS, TILES } from "../src/layouts.js";

const ROWS = 9;
const COLS = 20;
const SOLID = new Set(["P", "o", "c", "U", "C"]); // can't be walked through
const BREAKABLE = { o: "pot", c: "crate", U: "urn" };

// Tiles that must stay empty floor, as [rows, cols] ranges (inclusive). A
// pillar can't stand just below one either: its tall sprite would rise into it.
const CLEAR = {
  door: [[0, 1], [8, 11]],     // in front of the door
  landing: [[5, 7], [8, 11]],  // where the hero lands
  hearts: [[8, 8], [5, 14]],   // under the hearts, drawn over the bottom of the floor (combat.js addHearts, up to 5)
  boss: [[1, 6], [6, 13]],     // sub-depth 10: where the boss rises, and the room he's shoved into
  ladder: [[0, 0], [5, 6]],    // sub-depth 10: the foot of the ladder the boss leaves (scenes.js, x 96)
  well: [[5, 6], [13, 15]],    // sub-depth 10: the well it leaves (column 14) and the floor in front
};

export function checkLayout(sub, rows) {
  const errors = [];
  const room = BALANCE.rooms[sub - 1];
  const at = (r, c) => rows[r]?.[c];
  if (rows.length !== ROWS) errors.push(`${rows.length} rows, not ${ROWS}`);
  rows.forEach((row, r) => {
    if (row.length !== COLS) errors.push(`row ${r} is ${row.length} wide, not ${COLS}`);
    for (const ch of row) if (!TILES[ch]) errors.push(`row ${r}: unknown tile "${ch}"`);
    if (row[0] !== "." || row[COLS - 1] !== ".") errors.push(`row ${r}: the first and last columns are under the side walls, keep them "."`);
  });
  if (errors.length) return errors;

  // The clear zones.
  const zones = ["door", "landing", "hearts", ...(sub === 10 ? ["boss", "ladder", "well"] : [])];
  for (const name of zones) {
    const [[r0, r1], [c0, c1]] = CLEAR[name];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      if (at(r, c) !== ".") errors.push(`the ${name} zone (row ${r}, column ${c}) must be "."`);
      if (at(r + 1, c) === "P") errors.push(`the pillar at row ${r + 1}, column ${c} rises into the ${name} zone`);
    }
  }
  // A chest that's a mimic wakes when he's close: not right where he lands.
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch === "C" && Math.hypot(r - 6, c - 10) < 3) errors.push(`the chest at row ${r}, column ${c} is too close to the landing spot`);
  }));

  // What's in the room, against balance.js.
  const count = (ch) => rows.join("").split(ch).length - 1;
  const wanted = {};
  for (const name of room.breakables ?? []) wanted[name] = (wanted[name] ?? 0) + 1;
  for (const [ch, name] of Object.entries(BREAKABLE)) {
    if (count(ch) !== (wanted[name] ?? 0)) errors.push(`${count(ch)} ${name}s, but balance.js says ${wanted[name] ?? 0}`);
  }
  const chests = count("C");
  if (chests !== (room.chest ? 1 : 0)) errors.push(`${chests} chests, but balance.js says ${room.chest ? 1 : 0}`);
  const spikes = count("^");
  const [fewest, most] = !room.hazard ? [0, 0] : room.hazard < 0.01 ? [4, 10] : [8, 16];
  if (spikes < fewest || spikes > most) errors.push(`${spikes} spike tiles; this room wants ${fewest} to ${most}`);
  const pillars = count("P");
  if (sub < 3 && pillars) errors.push("pillars only from sub-depth 3");
  if (pillars > 8) errors.push(`${pillars} pillars, 8 at most`);
  const solid = [...rows.join("")].filter((ch) => SOLID.has(ch)).length;
  if (solid > 20) errors.push(`${solid} solid tiles, 20 at most (keep rooms open)`);

  // Every floor tile can be reached from where he lands (no closed-off
  // pockets for coins or monsters to get stuck in), and every breakable and
  // chest has a floor tile next to it to hit it from.
  const seen = new Set();
  const queue = [[6, 10]];
  const key = (r, c) => r * COLS + c;
  seen.add(key(6, 10));
  while (queue.length) {
    const [r, c] = queue.shift();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || seen.has(key(nr, nc)) || SOLID.has(at(nr, nc))) continue;
      seen.add(key(nr, nc));
      queue.push([nr, nc]);
    }
  }
  // And there's always a way from where he lands to the door that doesn't
  // cross any spikes.
  const safe = new Set([key(6, 10)]);
  const path = [[6, 10]];
  while (path.length) {
    const [r, c] = path.shift();
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || safe.has(key(nr, nc)) || at(nr, nc) !== ".") continue;
      safe.add(key(nr, nc));
      path.push([nr, nc]);
    }
  }
  if (!safe.has(key(0, 10))) errors.push("there's no way from the landing spot to the door without crossing spikes");

  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const ch = at(r, c);
    if (!SOLID.has(ch) && !seen.has(key(r, c))) errors.push(`row ${r}, column ${c} can't be reached`);
    if (ch !== "P" && SOLID.has(ch)) {
      const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => {
        const nr = r + dr;
        const nc = c + dc;
        return nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && seen.has(key(nr, nc));
      });
      if (!open) errors.push(`the ${TILES[ch]} at row ${r}, column ${c} can't be reached to hit it`);
    }
  }
  return errors;
}

// Run as a script: check every layout.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let problems = 0;
  if (LAYOUTS.length !== 10) {
    console.log(`${LAYOUTS.length} sub-depths of layouts, not 10`);
    problems++;
  }
  LAYOUTS.forEach((layouts, i) => {
    if (layouts.length < 2) {
      console.log(`sub-depth ${i + 1}: only ${layouts.length} layout(s); each room wants 2 or 3`);
      problems++;
    }
    layouts.forEach((rows, j) => {
      for (const error of checkLayout(i + 1, rows)) {
        console.log(`sub-depth ${i + 1}, layout ${j + 1}: ${error}`);
        problems++;
      }
    });
  });
  console.log(problems ? `${problems} problem(s).` : `All ${LAYOUTS.flat().length} layouts are fine.`);
  process.exitCode = problems ? 1 : 0;
}
