import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BALANCE } from "./balance.js";
import { heroStats, costOf, isEarly } from "./stats.js";
import { getSave, buyLevel } from "./save.js";
import { playSound } from "./sound.js";
import { puffDust } from "./effects.js";
import { getGamePixel } from "./display.js";
import { setPrompt } from "./panel.js";

// The skill tree page (DESIGN.md section 7), opened at the underworld's altar.
// It's drawn in the game itself, over the dimmed room, like a stone tablet:
// a web out from Descend in the middle, six branches around it, each node a
// round frame with an icon and pips for its levels. Depth 2's nodes (the
// second ring) sit further out on each branch. You see the nodes next to the
// ones you own; the ones further out are dark outlines.
//
// Mouse: point at a node to read it, click it to pick it, click it again to
// buy a level. Hold the button and drag to move around, and the wheel zooms
// (1x to 3x, whole sizes so the pixels stay crisp). Keyboard: the arrows or
// WASD move between nodes, E buys, + and - zoom, Esc closes. Whichever was
// used last decides which node the panel at the bottom describes.

// ---- The layout ---------------------------------------------------------------

// Each branch heads out from the middle at its own angle (degrees, 0 = right,
// 90 = down). The two longest branches go sideways, where there's most room,
// and the two that split early (hearts, horde) sit across from each other so
// their forks don't bump into a neighbour's.
const BRANCH_ANGLE = { weapon: 180, hearts: -126, money: -54, time: 0, horde: 54, dash: 126 };
const FIRST_RING = 30; // px from Descend to the first ring of nodes, at 1x
const RING = 26;       // px between the rings after that
const SPREAD = 26;     // px a fork sits to either side of its branch

// Where each node sits: its branch, its ring (1 = next to Descend), and a
// `fork` to one side (-1) or the other (+1) where a branch splits (further
// for a node squeezed in beside a neighbour on the same ring).
const PLACES = {
  descend: { ring: 0 },
  sharper: { branch: "weapon", ring: 1 }, quicker: { branch: "weapon", ring: 2 },
  reach: { branch: "weapon", ring: 3 }, arc: { branch: "weapon", ring: 4 },
  heart: { branch: "hearts", ring: 1 }, nerves: { branch: "hearts", ring: 2, fork: -1 }, lucky: { branch: "hearts", ring: 2, fork: 1 },
  // The time branch has two tracks: down the middle, the clock and the
  // orbs; to one side, each depth's own clock upgrades, one depth after
  // another.
  time: { branch: "time", ring: 1 }, wind: { branch: "time", ring: 2 }, orbs: { branch: "time", ring: 3 },
  orbFinder: { branch: "time", ring: 4 }, biggerOrbs: { branch: "time", ring: 5 },
  dash: { branch: "dash", ring: 1 }, feet: { branch: "dash", ring: 2 }, charge: { branch: "dash", ring: 3 },
  greed: { branch: "money", ring: 1 }, magnet: { branch: "money", ring: 2 }, smash: { branch: "money", ring: 3 },
  crowded: { branch: "horde", ring: 1 }, hordes: { branch: "horde", ring: 2 }, restless: { branch: "horde", ring: 3 },
  calls: { branch: "horde", ring: 2, fork: -1 }, wisdom: { branch: "horde", ring: 2, fork: 1 },
  // Depth 2's ring
  keen: { branch: "weapon", ring: 5 }, crit: { branch: "weapon", ring: 6 },
  heart2: { branch: "hearts", ring: 3 },
  time2: { branch: "time", ring: 2, fork: -1 }, wind2: { branch: "time", ring: 3, fork: -1 },
  feet2: { branch: "dash", ring: 4 },
  greed2: { branch: "money", ring: 4 },
  crowded2: { branch: "horde", ring: 3, fork: -1.4 },
  // Depth 3's ring (each depth's horde nodes sit two rings further out)
  edge3: { branch: "weapon", ring: 7 },
  time3: { branch: "time", ring: 4, fork: -1 }, wind3: { branch: "time", ring: 5, fork: -1 },
  greed3: { branch: "money", ring: 5 },
  hordes3: { branch: "horde", ring: 4 }, restless3: { branch: "horde", ring: 5 }, crowded3: { branch: "horde", ring: 5, fork: -1.4 },
  // Depth 4's ring
  edge4: { branch: "weapon", ring: 8 },
  time4: { branch: "time", ring: 6, fork: -1 }, wind4: { branch: "time", ring: 7, fork: -1 },
  greed4: { branch: "money", ring: 6 },
  hordes4: { branch: "horde", ring: 6 }, restless4: { branch: "horde", ring: 7 }, crowded4: { branch: "horde", ring: 7, fork: -1.4 },
  // Depth 5's ring
  edge5: { branch: "weapon", ring: 9 },
  time5: { branch: "time", ring: 8, fork: -1 }, wind5: { branch: "time", ring: 9, fork: -1 },
  greed5: { branch: "money", ring: 7 },
  hordes5: { branch: "horde", ring: 8 }, restless5: { branch: "horde", ring: 9 }, crowded5: { branch: "horde", ring: 9, fork: -1.4 },
};

// A node's spot in the web, in px from the middle at 1x.
function placeOf(id) {
  const { branch, ring, fork = 0 } = PLACES[id];
  if (!ring) return vec2(0, 0);
  const radius = FIRST_RING + (ring - 1) * RING;
  const angle = (BRANCH_ANGLE[branch] * Math.PI) / 180 + (fork * SPREAD) / radius;
  return vec2(Math.cos(angle), Math.sin(angle)).scale(radius);
}

// ---- The icons --------------------------------------------------------------------

// Each node's picture: a sprite from the tileset, or a few pixels drawn by
// hand where the tileset has nothing (an hourglass, a glowing orb, dash
// marks, a magnet). `box` is the part of the sprite to show, [x, y, width,
// height] in its own pixels: the art without the empty space around it, or
// for the long weapons, just the end you'd know them by (the spear's head,
// the hammer's head, the sword's hilt). Nothing is shrunk, so the pixels stay crisp at every
// zoom; a tiny one (the coin, the skull) is shown at `scale` 2.
const ICONS = {
  descend: { sprite: "floor_ladder", box: [2, 2, 12, 12] },
  sharper: { sprite: "weapon_knight_sword", box: [0, 15, 10, 14] }, quicker: { sprite: "weapon_knife" },
  reach: { sprite: "weapon_spear", box: [0, 0, 6, 14] }, arc: { sprite: "weapon_double_axe", box: [0, 0, 16, 13] },
  heart: { sprite: "heart_full" },
  nerves: { sprite: "flask_blue", box: [4, 3, 8, 11] }, lucky: { sprite: "flask_red", box: [4, 3, 8, 11] },
  time: { draw: "hourglass" }, wind: { sprite: "flask_big_yellow", box: [3, 3, 10, 11] }, orbs: { draw: "orb" },
  orbFinder: { sprite: "flask_big_blue", box: [3, 3, 10, 11] }, biggerOrbs: { sprite: "flask_big_green", box: [3, 3, 10, 11] },
  dash: { draw: "dash" }, feet: { sprite: "flask_green", box: [4, 3, 8, 11] }, charge: { draw: "dash2" },
  greed: { sprite: "coin", box: [0, 0, 6, 7], scale: 2 }, magnet: { draw: "magnet" },
  smash: { sprite: "weapon_big_hammer", box: [0, 0, 10, 14] },
  crowded: { sprite: "tiny_zombie", box: [4, 6, 9, 10] }, hordes: { sprite: "skeleton", box: [3, 2, 10, 14] },
  restless: { sprite: "skull", box: [5, 7, 6, 6], scale: 2 }, calls: { sprite: "necromancer", box: [1, 8, 13, 15] },
  wisdom: { sprite: "weapon_green_magic_staff", box: [0, 0, 8, 14] },
  // Depth 2's ring
  keen: { sprite: "weapon_golden_sword", box: [0, 8, 10, 14] }, crit: { draw: "crit" },
  heart2: { sprite: "heart_full" },
  time2: { draw: "hourglass2" }, wind2: { sprite: "flask_yellow", box: [4, 3, 8, 11] },
  feet2: { draw: "dash3" },
  greed2: { draw: "gem" },
  crowded2: { sprite: "goblin", box: [3, 4, 10, 12] },
  // Depth 3's ring
  edge3: { sprite: "weapon_red_gem_sword", box: [0, 7, 10, 14] },
  time3: { draw: "hourglass3" }, wind3: { sprite: "flask_big_red", box: [3, 3, 10, 11] },
  greed3: { draw: "gemBlue" },
  hordes3: { sprite: "masked_orc", box: [2, 6, 12, 15] }, restless3: { sprite: "skull", box: [5, 7, 6, 6], scale: 2 },
  crowded3: { sprite: "orc_warrior", box: [2, 6, 12, 15] },
  // Depth 4's ring
  edge4: { sprite: "weapon_lavish_sword", box: [0, 16, 10, 14] },
  time4: { draw: "hourglass4" }, wind4: { sprite: "flask_blue", box: [4, 3, 8, 11] },
  greed4: { draw: "gemRed" },
  hordes4: { sprite: "muddy", box: [1, 3, 14, 13] }, restless4: { sprite: "skull", box: [5, 7, 6, 6], scale: 2 },
  crowded4: { sprite: "swampy", box: [1, 3, 14, 13] },
  // Depth 5's ring
  edge5: { sprite: "weapon_saw_sword", box: [0, 11, 10, 14] },
  time5: { draw: "hourglass5" }, wind5: { sprite: "flask_red", box: [4, 3, 8, 11] },
  greed5: { draw: "gemPurple" },
  hordes5: { sprite: "pumpkin_dude", box: [2, 4, 12, 17] }, restless5: { sprite: "skull", box: [5, 7, 6, 6], scale: 2 },
  crowded5: { sprite: "chort", box: [2, 4, 12, 17] },
};

// The page's colors. Kaplay's rgb() only exists once the game has started,
// so they're made the first time the page opens.
const PALETTE = {
  ink: [24, 20, 37], stone: [58, 47, 74], stoneLight: [90, 77, 110],
  light: [240, 230, 210], muted: [169, 155, 185], dark: [44, 36, 56],
  gold: [255, 205, 70], green: [99, 199, 77], red: [230, 72, 46],
  blue: [120, 190, 255], pale: [220, 240, 255], // a time orb
  gem: [56, 183, 100], gemLight: [160, 236, 150], gemDark: [30, 120, 64], // a gem
  purple: [160, 90, 220], lilac: [220, 190, 250],
};
let C = null;

// Draws a node's icon centered on `at` (whole pixels).
function drawIcon(id, at, zoom, opacity = 1) {
  const icon = ICONS[id];
  if (icon.draw) return drawPixels(icon.draw, at, zoom, opacity);
  // The sprite's first frame, in px (Kaplay keeps it as a share, 0 to 1, of
  // the whole tileset), and the part of it to show, as a share of the frame.
  const data = getSprite(icon.sprite)?.data;
  const frame = data?.frames[0];
  if (!frame) return;
  const frameW = frame.w * data.tex.width;
  const frameH = frame.h * data.tex.height;
  const [x, y, w, h] = icon.box ?? [0, 0, frameW, frameH];
  const size = (icon.scale ?? 1) * zoom;
  drawSprite({
    sprite: icon.sprite,
    quad: new Quad(x / frameW, y / frameH, w / frameW, h / frameH),
    pos: vec2(Math.round(at.x - (w * size) / 2), Math.round(at.y - (h * size) / 2)),
    scale: size,
    opacity,
  });
}

// The hand-drawn icons, as rectangles on a 14x14 grid around the middle.
const PIXELS = {
  hourglass: [[-4, -6, 8, 2, "gold"], [-4, 4, 8, 2, "gold"], [-3, -4, 6, 2, "light"], [-2, -2, 4, 2, "light"],
    [-1, 0, 2, 1, "light"], [-2, 1, 4, 1, "gold"], [-3, 2, 6, 2, "gold"]],
  orb: [[-3, -5, 6, 10, "blue"], [-5, -3, 10, 6, "blue"], [-4, -4, 8, 8, "blue"], [-2, -3, 2, 2, "pale"]],
  dash: [[-5, -4, 2, 2, "light"], [-3, -2, 2, 2, "light"], [-1, 0, 2, 2, "light"], [-3, 2, 2, 2, "light"], [-5, 4, 2, 2, "light"],
    [1, -4, 2, 2, "muted"], [3, -2, 2, 2, "muted"], [5, 0, 2, 2, "muted"], [3, 2, 2, 2, "muted"], [1, 4, 2, 2, "muted"]],
  dash2: [[-6, -4, 2, 2, "light"], [-4, -2, 2, 2, "light"], [-2, 0, 2, 2, "light"], [-4, 2, 2, 2, "light"], [-6, 4, 2, 2, "light"],
    [0, -4, 2, 2, "light"], [2, -2, 2, 2, "light"], [4, 0, 2, 2, "light"], [2, 2, 2, 2, "light"], [0, 4, 2, 2, "light"]],
  magnet: [[-5, -5, 3, 8, "red"], [2, -5, 3, 8, "red"], [-5, 3, 10, 3, "red"], [-5, -5, 3, 2, "light"], [2, -5, 3, 2, "light"]],
  // Depth 2's: a burst for critical hits, a blue hourglass, gold dash marks,
  // and the green gem that gold drops as (coins.js).
  crit: [[-1, -6, 2, 12, "gold"], [-6, -1, 12, 2, "gold"], [-3, -3, 6, 6, "gold"], [-1, -1, 2, 2, "light"]],
  hourglass2: [[-4, -6, 8, 2, "blue"], [-4, 4, 8, 2, "blue"], [-3, -4, 6, 2, "light"], [-2, -2, 4, 2, "light"],
    [-1, 0, 2, 1, "light"], [-2, 1, 4, 1, "blue"], [-3, 2, 6, 2, "blue"]],
  dash3: [[-6, -4, 2, 2, "gold"], [-4, -2, 2, 2, "gold"], [-2, 0, 2, 2, "gold"], [-4, 2, 2, 2, "gold"], [-6, 4, 2, 2, "gold"],
    [0, -4, 2, 2, "gold"], [2, -2, 2, 2, "gold"], [4, 0, 2, 2, "gold"], [2, 2, 2, 2, "gold"], [0, 4, 2, 2, "gold"]],
  gem: [[-3, -5, 6, 1, "gemLight"], [-5, -4, 10, 3, "gem"], [-4, -1, 8, 2, "gem"], [-2, 1, 4, 2, "gem"], [-1, 3, 2, 1, "gem"],
    [-4, -4, 3, 1, "gemLight"], [1, 0, 3, 1, "gemDark"]],
  // Depth 3's: a green hourglass and a blue gem.
  hourglass3: [[-4, -6, 8, 2, "gem"], [-4, 4, 8, 2, "gem"], [-3, -4, 6, 2, "light"], [-2, -2, 4, 2, "light"],
    [-1, 0, 2, 1, "light"], [-2, 1, 4, 1, "gem"], [-3, 2, 6, 2, "gem"]],
  gemBlue: [[-3, -5, 6, 1, "pale"], [-5, -4, 10, 3, "blue"], [-4, -1, 8, 2, "blue"], [-2, 1, 4, 2, "blue"], [-1, 3, 2, 1, "blue"],
    [-4, -4, 3, 1, "pale"], [1, 0, 3, 1, "ink"]],
  // Depth 4's: a red hourglass and a red gem.
  hourglass4: [[-4, -6, 8, 2, "red"], [-4, 4, 8, 2, "red"], [-3, -4, 6, 2, "light"], [-2, -2, 4, 2, "light"],
    [-1, 0, 2, 1, "light"], [-2, 1, 4, 1, "red"], [-3, 2, 6, 2, "red"]],
  gemRed: [[-3, -5, 6, 1, "light"], [-5, -4, 10, 3, "red"], [-4, -1, 8, 2, "red"], [-2, 1, 4, 2, "red"], [-1, 3, 2, 1, "red"],
    [-4, -4, 3, 1, "light"], [1, 0, 3, 1, "ink"]],
  // Depth 5's: a purple hourglass and a purple gem.
  hourglass5: [[-4, -6, 8, 2, "purple"], [-4, 4, 8, 2, "purple"], [-3, -4, 6, 2, "light"], [-2, -2, 4, 2, "light"],
    [-1, 0, 2, 1, "light"], [-2, 1, 4, 1, "purple"], [-3, 2, 6, 2, "purple"]],
  gemPurple: [[-3, -5, 6, 1, "lilac"], [-5, -4, 10, 3, "purple"], [-4, -1, 8, 2, "purple"], [-2, 1, 4, 2, "purple"], [-1, 3, 2, 1, "purple"],
    [-4, -4, 3, 1, "lilac"], [1, 0, 3, 1, "ink"]],
};
function drawPixels(kind, at, zoom, opacity) {
  for (const [x, y, w, h, color] of PIXELS[kind]) {
    drawRect({ pos: at.add(x * zoom, y * zoom), width: w * zoom, height: h * zoom, color: C[color], opacity });
  }
}

// ---- What a node says ------------------------------------------------------------

// The stat each node changes, as people read it: a label and how to show
// the number. `null` means it's shown as a percentage instead: a distance in
// pixels means nothing to a player, but "+25%" of the range they've seen in
// play does.
const pct = (x) => `${Math.round(x * 1000) / 10}%`;
const secs = (x) => `${x.toFixed(x < 10 ? 2 : 1)}S`;
const STAT_TEXT = {
  damage: ["DAMAGE", (x) => `${x}`],
  swingEvery: ["SWING EVERY", secs],
  reach: ["REACH", null],
  arc: ["SWING WIDTH", (x) => `${Math.round(x)} DEG`],
  hearts: ["HEARTS", (x) => `${x}`],
  invincibleFor: ["SAFE AFTER A HIT", secs],
  heartChance: ["HEART DROPS", pct],
  startTime: ["CLOCK", (x) => `${Math.round(x)}S`],
  timePerSubDepth: ["EACH ROOM ADDS", (x) => `${x}S`],
  timeOrbChance: ["ORB DROPS", pct],
  timeOrbSeconds: ["ORBS ADD", (x) => `${x}S`],
  dashCooldown: ["DASH COOLDOWN", secs],
  dashCharges: ["DASH CHARGES", (x) => `${x}`],
  goldBonus: ["GOLD PER KILL", (x) => `+${Math.round(x * 100)}%`],
  magnetRange: ["MAGNET RANGE", null],
  breakableBonus: ["BREAKABLE GOLD", (x) => `+${Math.round(x * 100)}%`],
  onEnter: ["MONSTERS ON ENTRY", (x) => `${x}`],
  horde: ["HORDE SIZE", (x) => `${x}`],
  hordeEvery: ["HORDE EVERY", (x) => `${x}S`],
  deathCall: ["DEATH CALLS", pct],
  xpBonus: ["XP PER KILL", (x) => `+${Math.round(x * 100)}%`],
  critChance: ["3X HITS", pct],
};
const UNLOCK_TEXT = { descend: "WHERE EVERYTHING GROWS FROM", dash: "UNLOCKS THE DASH (SHIFT)", timeOrbs: "UNLOCKS TIME ORBS" };

// "DAMAGE 3 > 4": what the next level changes, now and after. Or, for a
// stat shown as a percentage, "MAGNET RANGE +25%": how much bigger the next
// level makes it (and once it's maxed, how much bigger it is in all). A node
// that only works in its own depth shows that depth's numbers.
function effectText(node, levels) {
  if (node.effect.unlock) return UNLOCK_TEXT[node.effect.unlock] ?? "UNLOCKS SOMETHING NEW";
  const { stat } = node.effect;
  const [label, show] = STAT_TEXT[stat];
  const depth = node.depth ?? 1;
  const now = heroStats(levels, depth)[stat];
  const level = levels[node.id] ?? 0;
  const maxed = level >= node.levels;
  const next = maxed ? now : heroStats({ ...levels, [node.id]: level + 1 }, depth)[stat];
  const percent = (ratio) => `+${Math.round((ratio - 1) * 100)}%`;
  if (!show) return maxed ? `${label} ${percent(now / heroStats({})[stat])} IN ALL` : `${label} ${percent(next / now)}`;
  return maxed ? `${label} ${show(now)}` : `${label} ${show(now)} > ${show(next)}`;
}

// ---- The page -------------------------------------------------------------------

const nodes = BALANCE.tree;
const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
const TOP_BAR = 12;                       // the title bar's height
const PANEL_Y = GAME_HEIGHT - 38;         // the info panel's top
const ZOOMS = [1, 2, 3];
const FRAME = 9; // a node frame's radius at 1x

// The rules for what you can see and buy, from the save (save.js).
const owned = (id) => (getSave().levels[id] ?? 0) > 0;
// Seen: next to something owned (its parent is), or owned itself.
const shown = (node) => owned(node.id) || !node.parent || owned(node.parent);
// For a depth not reached yet (stats.js): on sale already, at the early
// price (balance.js earlyPrice), for anyone who'd rather save up for it.
const early = (node) => isEarly(node, getSave().cleared);
// What its next level costs, or null when it's maxed.
function nextPrice(node) {
  const level = getSave().levels[node.id] ?? 0;
  return level < node.levels ? costOf(node, level, early(node)) : null;
}
const canBuy = (node) => shown(node) && nextPrice(node) !== null && getSave().gold >= nextPrice(node);

// Whether there's anything you could buy right now (the altar's sigil glows).
export const canBuyAnything = () => nodes.some(canBuy);

// Opens the tree over the current scene. `onClose` runs when it's closed.
export function openTree(onClose) {
  C ??= Object.fromEntries(Object.entries(PALETTE).map(([name, [r, g, b]]) => [name, rgb(r, g, b)]));
  const VIEW_MIDDLE = vec2(GAME_WIDTH / 2, (TOP_BAR + PANEL_Y) / 2);
  // How far the view can go: its middle stays within the outermost nodes,
  // so there's always some of the web on screen.
  const places = nodes.map((n) => placeOf(n.id));
  const EDGES = {
    left: Math.min(...places.map((p) => p.x)), right: Math.max(...places.map((p) => p.x)),
    top: Math.min(...places.map((p) => p.y)), bottom: Math.max(...places.map((p) => p.y)),
  };
  const save = getSave();
  const levels = save.levels;
  let zoom = 1;
  let camera = vec2(0, 0);   // the web's point at the middle of the view
  let selected = "descend";
  let hovered = null;         // the node under the mouse, until a key is pressed
  let message = null;        // { id, text, color, until }: a moment's note about a node, in the panel
  const born = time();
  // The E press that opened the page is still being handed out when the
  // page's own E handler is added, so it would buy something straight away.
  // Nothing on the page reacts in the frame it opened.
  const justOpened = () => time() === born;
  const flashes = {};        // node id -> when it was last bought (for its sparkle)

  const toScreen = (place) => VIEW_MIDDLE.add(place.sub(camera).scale(zoom));
  const nodeAt = (point) => nodes.find((n) => toScreen(placeOf(n.id)).dist(point) < (FRAME + 2) * zoom && point.y > TOP_BAR && point.y < PANEL_Y)?.id ?? null;

  function buy(id) {
    const node = byId[id];
    const level = levels[id] ?? 0;
    const say = (text, color = C.red) => (message = { id, text, color, until: time() + 1.6 });
    if (!shown(node)) return say("BUY THE ONE BEFORE IT FIRST"), playSound("locked");
    if (level >= node.levels) return say("ALREADY MAXED", C.muted), playSound("locked");
    const price = nextPrice(node);
    if (save.gold < price) return say(`NEEDS ${price} GOLD`), playSound("locked");
    buyLevel(id, price);
    flashes[id] = time();
    playSound("unlock");
    const at = toScreen(placeOf(id));
    puffDust(at.x, at.y + 4, 6, 10, 210);
    say(`${node.name.toUpperCase()} ${levels[id]}/${node.levels}`, C.green);
  }

  // Keyboard: the arrows move to the nearest node that way.
  function step(direction) {
    const from = placeOf(selected);
    let best = null;
    for (const node of nodes) {
      if (node.id === selected) continue;
      const offset = placeOf(node.id).sub(from);
      const along = offset.dot(direction);
      if (along <= 0) continue;
      const across = Math.abs(offset.x * direction.y - offset.y * direction.x);
      const score = along + across * 2;
      if (!best || score < best.score) best = { id: node.id, score };
    }
    if (!best) return;
    selected = best.id;
    playSound("letter");
    // Keep it in view: if it's too close to an edge, slide the view just
    // enough to bring it back in.
    const margin = (FRAME + 3) * zoom; // its frame and pips
    const at = toScreen(placeOf(selected));
    const dx = Math.min(0, at.x - margin) + Math.max(0, at.x - (GAME_WIDTH - margin));
    const dy = Math.min(0, at.y - (TOP_BAR + margin)) + Math.max(0, at.y - (PANEL_Y - margin));
    camera = camera.add(dx / zoom, dy / zoom);
    keepCamera();
  }

  function setZoom(next, around = VIEW_MIDDLE) {
    const z = clamp(next, ZOOMS[0], ZOOMS.at(-1));
    if (z === zoom) return;
    const world = camera.add(around.sub(VIEW_MIDDLE).scale(1 / zoom)); // the point under the cursor stays put
    zoom = z;
    camera = world.sub(around.sub(VIEW_MIDDLE).scale(1 / zoom));
    keepCamera();
  }
  const keepCamera = () => (camera = vec2(clamp(camera.x, EDGES.left, EDGES.right), clamp(camera.y, EDGES.top, EDGES.bottom)));

  // ---- Input -----------------------------------------------------------------------
  // Kaplay gives the mouse in the page's pixels, but the game is drawn
  // scaled up (display.js), so it's turned back into game pixels here.
  const pointer = () => mousePos().scale(1 / getGamePixel());
  const handles = [];
  let pressAt = null;   // where the left button went down, while it's held
  let lastAt = null;    // where the mouse was last frame, while it's held
  let dragged = false;
  handles.push(onMousePress("left", () => {
    pressAt = lastAt = pointer();
    dragged = false;
  }));
  // What's under the mouse, for the panel, and the mouse cursor to match: a
  // hand over a node, a fist while dragging.
  const hoverAt = (point) => {
    hovered = nodeAt(point);
    setCursor(hovered ? "pointer" : pressAt ? "grabbing" : "default");
  };
  handles.push(onMouseMove(() => {
    const point = pointer();
    hoverAt(point);
    if (!pressAt) return;
    if (!dragged && point.dist(pressAt) < 3) return; // a wobble isn't a drag
    dragged = true;
    camera = camera.sub(point.sub(lastAt).scale(1 / zoom));
    lastAt = point;
    keepCamera();
  }));
  handles.push(onMouseRelease("left", () => {
    const point = pointer();
    if (pressAt && !dragged) {
      const id = nodeAt(point);
      if (id && id === selected) buy(id);
      else if (id) {
        selected = id;
        playSound("letter");
      }
    }
    pressAt = null;
    hoverAt(point);
  }));
  // Kaplay only hears the mouse over the game, so a drag that's let go of
  // outside it would never end. The page listens for that itself.
  const letGoOutside = (e) => {
    if (e.target instanceof HTMLCanvasElement) return; // Kaplay has this one
    pressAt = null;
    dragged = false;
  };
  window.addEventListener("mouseup", letGoOutside);
  // The wheel: one zoom step per flick, and only for scrolling up or down.
  // A touchpad sends a stream of small scrolls for one swipe (and keeps
  // going while it glides to a stop), so a step only happens when the wheel
  // has been still for a moment first; every scroll pushes that moment back.
  let stillAt = 0;
  handles.push(onScroll((delta) => {
    if (delta.y === 0) return;
    const wasStill = time() >= stillAt;
    stillAt = time() + 0.2;
    if (!wasStill) return;
    setZoom(zoom + (delta.y < 0 ? 1 : -1), pointer());
    hoverAt(pointer());
  }));
  // A key press means the keyboard is in charge: the panel describes the
  // selected node again, not whatever the mouse was resting on.
  const byKey = (action) => () => {
    if (justOpened()) return;
    hovered = null;
    action();
  };
  const dirs = { left: vec2(-1, 0), right: vec2(1, 0), up: vec2(0, -1), down: vec2(0, 1) };
  for (const [button, dir] of Object.entries(dirs)) handles.push(onButtonPress(button, byKey(() => step(dir))));
  handles.push(onButtonPress("use", byKey(() => buy(selected))));
  // The keys zoom around the selected node, so it stays on screen.
  handles.push(onKeyPress(["=", "+"], byKey(() => setZoom(zoom + 1, toScreen(placeOf(selected))))));
  handles.push(onKeyPress("-", byKey(() => setZoom(zoom - 1, toScreen(placeOf(selected))))));
  handles.push(onKeyPress("escape", byKey(close)));
  // The strip above the game says how it works, and how to get out.
  setPrompt(null, () => {}, "Click twice or press E to buy. Drag, scroll to zoom. Esc closes.");

  // ---- Drawing ---------------------------------------------------------------------
  const page = add([pos(0, 0), z(200), fixed()]);
  page.onDraw(() => {
    const appear = Math.min(1, (time() - born) / 0.15);
    drawRect({ pos: vec2(0, 0), width: GAME_WIDTH, height: GAME_HEIGHT, color: C.ink, opacity: 0.86 * appear });

    // The links, then the nodes.
    for (const node of nodes) {
      if (!node.parent) continue;
      const a = screenOf(node.parent);
      const b = screenOf(node.id);
      const color = owned(node.id) ? C.gold : shown(node) ? C.stoneLight : C.dark;
      drawLine({ p1: a, p2: b, width: Math.max(1, zoom), color, opacity: appear });
    }
    for (const node of nodes) drawNode(node, appear);
    drawCursor(appear);

    // The title bar.
    drawRect({ pos: vec2(0, 0), width: GAME_WIDTH, height: TOP_BAR, color: C.ink });
    drawText({ text: "SKILL TREE", pos: vec2(6, 2), size: 8, font: "pixel", color: C.light });
    const gold = String(save.gold);
    drawText({ text: gold, pos: vec2(GAME_WIDTH - 6, 2), size: 8, font: "pixel", color: C.gold, anchor: "topright" });
    drawSprite({ sprite: "coin", frame: 0, pos: vec2(GAME_WIDTH - 17 - gold.length * 8, 2) });
    drawText({ text: `${zoom}X`, pos: vec2(GAME_WIDTH / 2, 2), size: 8, font: "pixel", color: C.muted, anchor: "top" });

    drawPanel(hovered ?? selected);
  });

  function drawNode(node, appear) {
    const at = screenOf(node.id);
    const reach = (FRAME + 4) * zoom; // its frame and pips stick out this far
    if (at.x < -reach || at.x > GAME_WIDTH + reach || at.y < -reach || at.y > GAME_HEIGHT + reach) return;
    const level = levels[node.id] ?? 0;
    const isShown = shown(node);
    const r = FRAME * zoom;
    const spot = spotOf(node.id);

    // The frame's rim says where it stands: gold when maxed, green when you
    // can afford the next level, light when some levels are bought, grey
    // otherwise. (The pips show how many are bought.)
    const rim = !isShown ? C.dark : level >= node.levels ? C.gold : canBuy(node) ? C.green : level > 0 ? C.light : C.stoneLight;
    drawCircle({ pos: spot, radius: r + zoom, color: C.ink, opacity: appear });
    drawCircle({ pos: spot, radius: r, color: rim, opacity: appear });
    drawCircle({ pos: spot, radius: r - 2 * zoom, color: isShown ? C.stone : C.ink, opacity: appear });
    if (isShown) drawIcon(node.id, spot, zoom, appear);

    // Pips around the frame: one per level, lit for the levels bought. They
    // go clockwise from the bottom left, over the top, to the bottom right.
    if (node.levels > 1 && isShown) {
      for (let i = 0; i < node.levels; i++) {
        const angle = Math.PI * (0.75 + (1.5 * i) / (node.levels - 1));
        const p = spot.add(vec2(Math.cos(angle), Math.sin(angle)).scale(r + 2.5 * zoom));
        drawRect({ pos: p.sub(zoom, zoom), width: 2 * zoom, height: 2 * zoom, color: i < level ? C.gold : C.stoneLight, opacity: appear });
      }
    }
    // A sparkle when it's just been bought.
    const since = time() - (flashes[node.id] ?? -9);
    if (since < 0.4) drawCircle({ pos: spot, radius: r + (4 + since * 30) * zoom * 0.3, outline: { width: zoom, color: C.gold }, fill: false, opacity: 1 - since / 0.4 });
  }

  // Where a node is on screen, in whole pixels so it's drawn crisp.
  function screenOf(id) {
    const at = toScreen(placeOf(id));
    return vec2(Math.round(at.x), Math.round(at.y));
  }
  // Where a node is drawn: the selected one bobs a little.
  function spotOf(id) {
    const bob = id === selected ? Math.round(Math.sin(time() * 5) * 0.8 * zoom) : 0;
    return screenOf(id).add(0, bob);
  }

  // The selected node gets a cursor: four corner brackets around it, that
  // breathe in and out a little. They're outlined in dark, so they still
  // show where they cross a neighbour's light rim.
  function drawCursor(appear) {
    const spot = spotOf(selected);
    const out = (FRAME + 5) * zoom + Math.round(Math.sin(time() * 5)) * zoom;
    const arm = 3 * zoom;
    const arms = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const corner = spot.add(sx * out, sy * out);
        const x = sx < 0 ? corner.x : corner.x - arm;
        const y = sy < 0 ? corner.y : corner.y - arm;
        arms.push([x, sy < 0 ? corner.y : corner.y - zoom, arm, zoom]);   // across
        arms.push([sx < 0 ? corner.x : corner.x - zoom, y, zoom, arm]);   // down
      }
    }
    for (const [x, y, w, h] of arms) {
      drawRect({ pos: vec2(x - zoom, y - zoom), width: w + 2 * zoom, height: h + 2 * zoom, color: C.ink, opacity: appear });
    }
    for (const [x, y, w, h] of arms) drawRect({ pos: vec2(x, y), width: w, height: h, color: C.light, opacity: appear });
  }

  function drawPanel(id) {
    const node = byId[id];
    const level = levels[id] ?? 0;
    drawRect({ pos: vec2(0, PANEL_Y), width: GAME_WIDTH, height: GAME_HEIGHT - PANEL_Y, color: C.ink });
    drawRect({ pos: vec2(0, PANEL_Y), width: GAME_WIDTH, height: 1, color: C.stoneLight });
    const text = (content, x, y, color = C.light, anchorName = "topleft") =>
      drawText({ text: content, pos: vec2(x, y), size: 8, font: "pixel", color, anchor: anchorName });

    if (!shown(node)) {
      text("???", 30, PANEL_Y + 5, C.muted);
      text("BUY THE NODE BEFORE IT TO SEE IT", 30, PANEL_Y + 16, C.muted);
      return;
    }
    drawIcon(id, vec2(15, PANEL_Y + 19), 1);
    text(node.name.toUpperCase(), 30, PANEL_Y + 4, C.gold);
    // Top right: its levels, and the depth it's for: "DEPTH 2 ONLY" for one
    // that only works there, "DEPTH 2" for an early one.
    const depthTag = node.perDepth ? `DEPTH ${node.depth ?? 1} ONLY` : early(node) ? `DEPTH ${node.depth}` : "";
    const corner = [depthTag, node.levels > 1 ? `${level}/${node.levels}` : ""];
    text(corner.filter(Boolean).join("  "), GAME_WIDTH - 6, PANEL_Y + 4, C.muted, "topright");
    text(effectText(node, levels), 30, PANEL_Y + 15);

    let status;
    if (message?.id === id && time() < message.until) status = [message.text, message.color];
    else if (!node.parent) status = ["OWNED", C.muted];
    else if (level >= node.levels) status = ["MAXED", C.gold];
    else {
      // The selected node is one click (or E) from bought; any other node the
      // mouse is on is a click from being selected. An early node says it
      // costs more for now.
      const price = nextPrice(node);
      const afford = save.gold >= price;
      const tag = early(node) ? `EARLY ${BALANCE.earlyPrice}X: ` : "";
      if (!afford) status = [`${tag}COSTS ${price} GOLD`, C.red];
      else if (id === selected) status = [early(node) ? `${tag}${price} GOLD, CLICK OR E` : `BUY ${price} GOLD: CLICK OR E`, C.green];
      else status = [`${tag}${price} GOLD${early(node) ? "," : ":"} CLICK TO PICK`, C.green];
    }
    text(status[0], 30, PANEL_Y + 26, status[1]);
  }

  function close() {
    handles.forEach((h) => h.cancel());
    window.removeEventListener("mouseup", letGoOutside);
    setCursor("default");
    destroy(page);
    playSound("letter");
    onClose?.();
  }

  playSound("unlock");
  return { close };
}
