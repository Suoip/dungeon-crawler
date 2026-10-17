import { GAME_WIDTH, TILE } from "./config.js";

// What a run shows in the room itself, in the empty strip above the back
// wall (DESIGN.md section 5):
//   the clock      top left, in big pixel numbers; red and pulsing for the
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
const BAR_FROM = 76;                 // the left half starts here (after the clock, even at "9:59")...
const BAR_TO = GAME_WIDTH - 76;      // ...and the right half ends here (before the gold)

// Text with a dark copy one pixel down and right, so it reads on anything.
function drawShadowText(content, at, size, rgb, anchorName, opacity = 1) {
  const options = { text: content, size, font: "pixel", anchor: anchorName, opacity };
  drawText({ ...options, pos: at.add(1, 1), color: rgb_(SHADOW) });
  drawText({ ...options, pos: at, color: rgb_(rgb) });
}
const rgb_ = (c) => rgb(...c);

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
  const hud = add([pos(0, 0), z(80)]);
  hud.addTime = (seconds) => (added = { text: `+${seconds}S`, at: time() });
  hud.onDraw(() => {
    const { clock, stopped, xp, xpNeeded, gold } = state();

    // The clock (green for a moment when time is added).
    const hurry = !stopped && clock <= 5;
    const pulse = hurry ? 1 + 0.15 * Math.max(0, Math.sin(time() * 2 * Math.PI)) : 1;
    const sinceAdded = added ? time() - added.at : Infinity;
    const color = stopped ? [140, 130, 150] : sinceAdded < 0.4 ? GREEN : hurry ? RED : LIGHT;
    drawShadowText(clockText(clock), vec2(6, 9), 16 * pulse, color, "left");
    if (sinceAdded < 1) {
      // "+1S" rises from under the clock and fades.
      drawShadowText(added.text, vec2(8, 24 - sinceAdded * 6), 8, GREEN, "left", 1 - sinceAdded);
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
    drawShadowText(String(gold), vec2(GAME_WIDTH - 6, 9), 8, GOLD, "right");
    const coinX = GAME_WIDTH - 10 - formatText({ text: String(gold), size: 8, font: "pixel" }).width;
    drawSprite({ sprite: "coin", frame: 0, pos: vec2(coinX - 6, 5) });
  });
  return hud;
}

// A damage number that pops up from a hit and floats away.
export function popNumber(at, amount, crit = false) {
  const label = String(Math.round(amount));
  const number = add([pos(at), opacity(1), z(70), { born: time() }]);
  const drift = rand(-6, 6);
  const life = crit ? 0.8 : 0.6; // a critical hit's number stays a little longer
  number.onUpdate(() => {
    const age = time() - number.born;
    number.pos = at.add(drift * age, -14 * Math.sqrt(age / 0.6));
    number.opacity = age < life - 0.25 ? 1 : 1 - (age - (life - 0.25)) / 0.25;
    if (age > life) destroy(number);
  });
  number.onDraw(() => drawShadowText(label, vec2(0, 0), crit ? 16 : 8, crit ? GOLD : LIGHT, "center", number.opacity));
}
