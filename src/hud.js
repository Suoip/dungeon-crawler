import { GAME_WIDTH, TILE } from "./config.js";

// What a run shows in the room itself, in the empty strip above the back
// wall (DESIGN.md section 5):
//   the hourglass  top left: the sand in its top is the share of all the
//                  time this run has had that's still left (run.sand), the
//                  bottom's what has run out; it trickles through while the
//                  clock runs, and a kill that adds time (Seconds per kill)
//                  makes the top shine (hud.addSand)
//   the clock      beside it, in big pixel numbers; red and pulsing for the
//                  last 5 seconds, grey once it has stopped (the boss room),
//                  and a green flash with "+1S" rising under it when a time
//                  orb adds seconds (hud.addTime)
//   the XP bar     two halves either side of the door, filling in toward it;
//                  when they meet the door, it unchains
//   the gold       top right: this run's coins
// And the damage numbers that pop up from every hit.

const LIGHT = [240, 230, 210];
const SHADOW = [12, 10, 20];
const RED = [230, 72, 46];
const GOLD = [255, 205, 70];
const GREEN = [99, 199, 77];
const BAR_Y = 6;     // the XP bar's top, in the strip above the wall
const BAR_HEIGHT = 4;
const DOOR = { left: GAME_WIDTH / 2 - TILE - 2, right: GAME_WIDTH / 2 + TILE + 2 }; // the door's arch, and a little room
const BAR_FROM = 88;                 // the left half starts here (after the hourglass and the clock, even at "9:59")...
const BAR_TO = GAME_WIDTH - 88;      // ...and the right half ends here (before the gold)
const SAND = [237, 201, 120];
const GLASS = [44, 52, 70];
const WOOD = [140, 92, 52];
// The hourglass's chambers, row by row (widths in px, centered): the top
// one narrows down to the neck, the bottom one widens out from it.
const TOP_ROWS = [7, 7, 5, 5, 3, 1];
const BOTTOM_ROWS = [1, 3, 5, 5, 7, 7];
const HOLDS = TOP_ROWS.reduce((a, b) => a + b, 0); // px of sand each chamber holds (both the same)

// Text with a dark copy one pixel down and right, so it reads on anything.
function drawShadowText(content, at, size, rgb, anchorName, opacity = 1) {
  const options = { text: content, size, font: "pixel", anchor: anchorName, opacity };
  drawText({ ...options, pos: at.add(1, 1), color: rgb_(SHADOW) });
  drawText({ ...options, pos: at, color: rgb_(rgb) });
}
const rgb_ = (c) => rgb(...c);

// A big amount of gold, short enough to read at a glance: up to 99999 as it
// is, then "123K", "12.3M", "12.3B" and "12.3T" (from depth 3 on, each depth
// pays hundreds of times the one before).
export const shortGold = (gold) => {
  if (gold < 100000) return String(gold);
  if (gold < 10000000) return `${Math.floor(gold / 1000)}K`;
  const [unit, size] = gold < 1e9 ? ["M", 1e6] : gold < 1e12 ? ["B", 1e9] : ["T", 1e12];
  return `${(Math.floor((gold / size) * 10) / 10).toFixed(1)}${unit}`;
};

// The clock as people read it: "18", or "1:05" from a minute up.
export const clockText = (seconds) => {
  const whole = Math.max(0, Math.ceil(seconds));
  return whole >= 60 ? `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}` : String(whole);
};

// The HUD for one room. `state()` returns { clock, stopped, xp, xpNeeded,
// gold }, read every frame.
export function addHud(state) {
  let flashUntil = 0; // the bar shines for a moment once it's full
  let added = null;   // { text, at }: seconds a time orb just added
  let sanded = -9;    // when a kill last added sand
  const hud = add([pos(0, 0), z(80)]);
  hud.addTime = (seconds) => (added = { text: `+${seconds}S`, at: time() });
  hud.addSand = () => (sanded = time());
  hud.onDraw(() => {
    const { clock, sand, stopped, xp, xpNeeded, gold } = state();
    drawHourglass(vec2(4, 2), sand > 0 ? Math.min(1, clock / sand) : 0, !stopped && clock > 0, time() - sanded < 0.25);

    // The clock (green for a moment when time is added).
    const hurry = !stopped && clock <= 5;
    const pulse = hurry ? 1 + 0.15 * Math.max(0, Math.sin(time() * 2 * Math.PI)) : 1;
    const sinceAdded = added ? time() - added.at : Infinity;
    const color = stopped ? [140, 130, 150] : sinceAdded < 0.4 ? GREEN : hurry ? RED : LIGHT;
    drawShadowText(clockText(clock), vec2(17, 9), 16 * pulse, color, "left");
    if (sinceAdded < 1) {
      // "+1S" rises from under the clock and fades.
      drawShadowText(added.text, vec2(19, 24 - sinceAdded * 6), 8, GREEN, "left", 1 - sinceAdded);
    }

    // The XP bar: two halves, each filling from its outer end toward the door.
    const share = Math.min(1, xpNeeded ? xp / xpNeeded : 0);
    const full = share >= 1;
    if (full && flashUntil === 0) flashUntil = time() + 0.6;
    const shine = time() < flashUntil;
    for (const [from, to] of [[BAR_FROM, DOOR.left], [BAR_TO, DOOR.right]]) {
      const left = Math.min(from, to);
      const width = Math.abs(to - from);
      drawRect({ pos: vec2(left - 1, BAR_Y - 1), width: width + 2, height: BAR_HEIGHT + 2, color: rgb_(SHADOW) });
      drawRect({ pos: vec2(left, BAR_Y), width, height: BAR_HEIGHT, color: rgb(58, 47, 74) });
      const filled = width * share;
      const start = from < to ? left : left + width - filled; // the right half fills leftward
      drawRect({ pos: vec2(start, BAR_Y), width: filled, height: BAR_HEIGHT, color: shine ? rgb(255, 250, 220) : full ? rgb_(GOLD) : rgb(99, 199, 77) });
    }

    // The run's gold, with a coin.
    const goldText = shortGold(gold);
    drawShadowText(goldText, vec2(GAME_WIDTH - 6, 9), 8, GOLD, "right");
    const coinX = GAME_WIDTH - 10 - formatText({ text: goldText, size: 8, font: "pixel" }).width;
    drawSprite({ sprite: "coin", frame: 0, pos: vec2(coinX - 6, 5) });
  });
  return hud;
}

// The hourglass, its top left corner at `at` (9 x 15 px): `left` is the share
// of the sand still in the top (0 to 1). While `running`, a thin stream
// falls through the neck; `shine` lights the top's sand for a moment.
function drawHourglass(at, left, running, shine) {
  const px = (x, y, w, c) => drawRect({ pos: at.add(x, y), width: w, height: 1, color: rgb_(c) });
  // A dark outline, so it reads on anything, then the wooden caps.
  drawRect({ pos: at.add(-1, -1), width: 11, height: 17, color: rgb_(SHADOW), opacity: 0.6 });
  px(0, 0, 9, WOOD);
  px(0, 14, 9, WOOD);
  // How many pixels of sand each chamber has.
  let top = Math.round(left * HOLDS);
  let bottom = HOLDS - top;
  // The top chamber: rows 1-6, sand settled at the bottom (by the neck).
  for (let i = TOP_ROWS.length - 1; i >= 0; i--) {
    const w = TOP_ROWS[i], x = (9 - w) / 2;
    px(x, 1 + i, w, GLASS);
    const n = Math.min(w, top);
    if (n > 0) px(Math.floor((9 - n) / 2), 1 + i, n, shine ? LIGHT : SAND);
    top -= n;
  }
  px(4, 7, 1, GLASS); // the neck
  // The bottom chamber: rows 8-13, sand piled up from the bottom.
  let surface = 14;
  for (let i = BOTTOM_ROWS.length - 1; i >= 0; i--) {
    const w = BOTTOM_ROWS[i], x = (9 - w) / 2;
    px(x, 8 + i, w, GLASS);
    const n = Math.min(w, bottom);
    if (n > 0) {
      px(Math.floor((9 - n) / 2), 8 + i, n, SAND);
      surface = 8 + i;
    }
    bottom -= n;
  }
  // The stream: every other pixel, moving down, from the neck to the pile.
  if (running && left > 0) {
    const step = Math.floor(time() * 12) % 2;
    for (let y = 7; y < surface; y++) if ((y + step) % 2 === 0) px(4, y, 1, SAND);
  }
}

// A damage number that pops up from a hit and floats away.
// `kind`: "hit", "crit" (bigger, gold), "blocked" (grey: a shield took most
// of it) or "heal" (green, with a plus).
const NUMBER_LOOKS = { hit: [8, null], crit: [16, null], blocked: [8, [150, 144, 160]], heal: [8, null] };
export function popNumber(at, amount, kind = "hit") {
  const crit = kind === "crit";
  const label = (kind === "heal" ? "+" : "") + String(Math.round(amount));
  const [size, grey] = NUMBER_LOOKS[kind];
  const colorOf = kind === "heal" ? GREEN : crit ? GOLD : grey ?? LIGHT;
  const number = add([pos(at), opacity(1), z(70), { born: time() }]);
  const drift = rand(-6, 6);
  const life = crit ? 0.8 : 0.6; // a critical hit's number stays a little longer
  number.onUpdate(() => {
    const age = time() - number.born;
    number.pos = at.add(drift * age, -14 * Math.sqrt(age / 0.6));
    number.opacity = age < life - 0.25 ? 1 : 1 - (age - (life - 0.25)) / 0.25;
    if (age > life) destroy(number);
  });
  number.onDraw(() => drawShadowText(label, vec2(0, 0), size, colorOf, "center", number.opacity));
}
