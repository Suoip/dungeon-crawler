import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { BALANCE } from "./balance.js";
import { heroStats, costOf, isEarly } from "./stats.js";
import { NODES, byId, CENTER, isShown, blockerOf, needsName } from "./nodes.js";
import { getSave, buyLevel, buySpecial as buySpecialLevel } from "./save.js";
import { playSound } from "./sound.js";
import { puffDust } from "./effects.js";
import { getGamePixel } from "./display.js";
import { setPrompt } from "./panel.js";
import { shortGold } from "./hud.js";

// The skill tree page (DESIGN.md section 7), opened at the underworld's altar.
// It's drawn in the game itself, over the dimmed room, like a stone tablet:
// branches out from Descend in the middle (balance.js skillTree, built in
// nodes.js), each node a round frame with an icon, a big node's frame bigger,
// and lines for the links between them. Each deeper depth's nodes sit
// further out. You only see the nodes you own and the ones linked to them;
// buying one brings its neighbours into view.
//
// Under the title bar, once a depth's material has been found, a row holds
// the special upgrades it buys (balance.js specials), a level at a time.
//
// Mouse: point at a node to read it, click it to pick it, click it again to
// buy it. Hold the button and drag to move around, and the wheel zooms
// (1x to 3x, whole sizes so the pixels stay crisp). Keyboard: the arrows or
// WASD move between nodes, E buys, + and - zoom, Esc closes. Whichever was
// used last decides which node the panel at the bottom describes.

// ---- The layout ---------------------------------------------------------------

const SPACING = 22; // px between neighbouring nodes, at 1x
// A node's spot in the web, in px from the middle at 1x. Every other row is
// shifted half a node (nodes.js), so x counts half nodes.
const placeOf = (id) => {
  const node = byId[id];
  return vec2((node.x * SPACING) / 2, (node.y * SPACING * Math.sqrt(3)) / 2);
};

// ---- The icons --------------------------------------------------------------------

// Each kind's picture (by its letter in the map; a list is one per depth,
// depth 1 first): a sprite from the tileset, or a few pixels drawn by hand
// where the tileset has nothing (an hourglass, a glowing orb, dash marks, a
// magnet). `box` is the part of the sprite to show, [x, y, width, height] in
// its own pixels: the art without the empty space around it, or for the
// long weapons, just the end you'd know them by (the spear's head, the
// hammer's head, the sword's hilt). Nothing is shrunk, so the pixels stay
// crisp at every zoom; a tiny one (the coin, the skull) is shown at `scale` 2.
const SKULL = { sprite: "skull", box: [5, 7, 6, 6], scale: 2 };
const ICONS = {
  "@": { sprite: "floor_ladder", box: [2, 2, 12, 12] },
  d: [{ sprite: "weapon_knight_sword", box: [0, 15, 10, 14] }, { sprite: "weapon_golden_sword", box: [0, 8, 10, 14] },
    { sprite: "weapon_red_gem_sword", box: [0, 7, 10, 14] }, { sprite: "weapon_lavish_sword", box: [0, 16, 10, 14] },
    { sprite: "weapon_saw_sword", box: [0, 11, 10, 14] }],
  s: { sprite: "weapon_knife" },
  r: { sprite: "weapon_spear", box: [0, 0, 6, 14] },
  a: { sprite: "weapon_double_axe", box: [0, 0, 16, 13] },
  c: { draw: "crit" },
  j: { draw: "crit2" },
  h: { sprite: "heart_full" },
  n: { sprite: "flask_blue", box: [4, 3, 8, 11] },
  l: { sprite: "flask_red", box: [4, 3, 8, 11] },
  q: { draw: "mend" },
  t: [{ draw: "hourglass" }, { draw: "hourglass2" }, { draw: "hourglass3" }, { draw: "hourglass4" }, { draw: "hourglass5" }],
  w: [{ sprite: "flask_big_yellow", box: [3, 3, 10, 11] }, { sprite: "flask_yellow", box: [4, 3, 8, 11] },
    { sprite: "flask_big_red", box: [3, 3, 10, 11] }, { sprite: "flask_blue", box: [4, 3, 8, 11] }, { sprite: "flask_red", box: [4, 3, 8, 11] }],
  "*": { draw: "orb" },
  z: { draw: "sands" },
  p: { sprite: "flask_big_blue", box: [3, 3, 10, 11] },
  b: { sprite: "flask_big_green", box: [3, 3, 10, 11] },
  ">": { draw: "dash" },
  f: [{ sprite: "flask_green", box: [4, 3, 8, 11] }, { draw: "dash3" }],
  "&": { draw: "dash2" },
  // Greed: each depth's stone (coins.js): the coin, then sapphire, ruby, amethyst and diamond.
  g: [{ sprite: "coin", box: [0, 0, 6, 7], scale: 2 }, { draw: "gemBlue" }, { draw: "gemRed" }, { draw: "gemPurple" }, { draw: "gemWhite" }],
  o: { sprite: "chest", box: [2, 3, 12, 12] },
  m: { draw: "magnet" },
  k: { sprite: "weapon_big_hammer", box: [0, 0, 10, 14] },
  e: [{ sprite: "tiny_zombie", box: [4, 6, 9, 10] }, { sprite: "goblin", box: [3, 4, 10, 12] }, { sprite: "orc_warrior", box: [2, 6, 12, 15] },
    { sprite: "swampy", box: [1, 3, 14, 13] }, { sprite: "chort", box: [2, 4, 12, 17] }],
  u: [{ sprite: "skeleton", box: [3, 2, 10, 14] }, { sprite: "skeleton", box: [3, 2, 10, 14] }, { sprite: "masked_orc", box: [2, 6, 12, 15] },
    { sprite: "muddy", box: [1, 3, 14, 13] }, { sprite: "pumpkin_dude", box: [2, 4, 12, 17] }],
  v: SKULL,
  y: { sprite: "necromancer", box: [1, 8, 13, 15] },
  i: { sprite: "weapon_green_magic_staff", box: [0, 0, 8, 14] },
};
// A node's icon: its kind's, for its depth (a list's last one past its end).
function iconOf(node) {
  const icon = ICONS[node.letter];
  return Array.isArray(icon) ? icon[Math.min(node.depth, icon.length) - 1] : icon;
}

// The page's colors. Kaplay's rgb() only exists once the game has started,
// so they're made the first time the page opens.
const PALETTE = {
  ink: [24, 20, 37], stone: [58, 47, 74], stoneLight: [90, 77, 110],
  light: [240, 230, 210], muted: [169, 155, 185], dark: [44, 36, 56],
  gold: [255, 205, 70], green: [99, 199, 77], red: [230, 72, 46],
  blue: [120, 190, 255], pale: [220, 240, 255], // a time orb
  gem: [56, 183, 100], gemLight: [160, 236, 150], gemDark: [30, 120, 64], // a gem
  purple: [160, 90, 220], lilac: [220, 190, 250],
  sand: [237, 201, 120], wood: [140, 92, 52],
};
let C = null;

// Draws a node's icon centered on `at` (whole pixels).
function drawIcon(node, at, zoom, opacity = 1) {
  const icon = node.icon ?? iconOf(node); // (a special upgrade brings its own)
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
  // A red burst for Critical damage, a heart with a plus for Mending, and
  // a wooden hourglass full of sand for Sands of time.
  crit2: [[-1, -6, 2, 12, "red"], [-6, -1, 12, 2, "red"], [-3, -3, 6, 6, "red"], [-1, -1, 2, 2, "light"]],
  mend: [[-5, -4, 4, 3, "red"], [1, -4, 4, 3, "red"], [-5, -1, 10, 3, "red"], [-3, 2, 6, 2, "red"], [-1, 4, 2, 1, "red"],
    [-1, -3, 2, 6, "light"], [-3, -1, 6, 2, "light"]],
  sands: [[-4, -6, 8, 2, "wood"], [-4, 4, 8, 2, "wood"], [-3, -4, 6, 2, "sand"], [-2, -2, 4, 2, "sand"],
    [-1, 0, 2, 1, "sand"], [-2, 1, 4, 1, "sand"], [-3, 2, 6, 2, "sand"]],
  // Gravedigger's shovel.
  shovel: [[-1, -7, 2, 8, "wood"], [-3, -7, 6, 1, "wood"], [-3, 1, 6, 3, "muted"], [-2, 4, 4, 1, "muted"], [-1, 5, 2, 1, "muted"]],
  // The Shield's: steel with a gold boss.
  shield: [[-5, -6, 10, 7, "pale"], [-4, 1, 8, 2, "pale"], [-3, 3, 6, 2, "pale"], [-1, 5, 2, 1, "pale"], [-5, -6, 10, 1, "light"],
    [-1, -3, 2, 3, "gold"]],
  // Waders: a tall green boot.
  boot: [[-4, -7, 7, 2, "gemLight"], [-3, -5, 5, 7, "gem"], [-3, 2, 9, 3, "gem"], [-3, -2, 5, 1, "gold"], [-4, 5, 11, 1, "gemDark"], [5, 2, 1, 1, "gemDark"]],
  // Sticky fingers' sack of loot.
  sack: [[-2, -7, 4, 1, "wood"], [-1, -6, 2, 1, "gold"], [-4, -5, 8, 2, "wood"], [-5, -3, 10, 7, "wood"], [-4, 4, 8, 1, "wood"],
    [-1, -1, 3, 3, "gold"], [0, 0, 1, 1, "light"]],
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
  gemWhite: [[-3, -5, 6, 1, "light"], [-5, -4, 10, 3, "pale"], [-4, -1, 8, 2, "pale"], [-2, 1, 4, 2, "pale"], [-1, 3, 2, 1, "pale"],
    [-4, -4, 3, 1, "light"], [1, 0, 3, 1, "blue"]],
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
  critChance: ["CRITICAL HITS", pct],
  critDamage: ["CRITS DO", (x) => `${Math.round(x * 100) / 100}X`],
  goldPerKill: ["BOUNTY", null],
  timePerKill: ["EACH KILL ADDS", (x) => `${Math.round(x * 100) / 100}S`],
  healOnClear: ["HEART BACK ON A CLEAR", pct],
};
const UNLOCK_TEXT = { descend: "WHERE EVERYTHING GROWS FROM", dash: "UNLOCKS THE DASH (SHIFT)", timeOrbs: "UNLOCKS TIME ORBS" };

// "DAMAGE 3 > 4": what buying the node changes, now and after. Or, for a
// stat shown as a percentage, "MAGNET RANGE +25%": how much bigger it makes
// it (and once it's owned, how much bigger it is in all). A node that only
// works in its own depth shows that depth's numbers.
function effectText(node, levels) {
  if (node.effect.unlock) return UNLOCK_TEXT[node.effect.unlock] ?? "UNLOCKS SOMETHING NEW";
  const { stat } = node.effect;
  const [label, show] = STAT_TEXT[stat];
  // Bounty: in gold as it is in the node's depth (its first room).
  if (stat === "goldPerKill") {
    const scale = BALANCE.depths[node.depth - 1].scale.gold;
    const gold = (x) => `+${shortGold(Math.round(x * scale * 10) / 10)} GOLD A KILL`;
    const owned = (levels[node.id] ?? 0) > 0;
    return owned ? `${label} ${gold(heroStats(levels, node.depth)[stat])}` : `${label} ${gold(node.effect.add)} MORE`;
  }
  const now = heroStats(levels, node.depth)[stat];
  const owned = (levels[node.id] ?? 0) > 0;
  const next = owned ? now : heroStats({ ...levels, [node.id]: 1 }, node.depth)[stat];
  const percent = (ratio) => `+${Math.round((ratio - 1) * 100)}%`;
  if (!show) return owned ? `${label} ${percent(now / heroStats({})[stat])} IN ALL` : `${label} ${percent(next / now)}`;
  return owned ? `${label} ${show(now)}` : `${label} ${show(now)} > ${show(next)}`;
}

// ---- The page -------------------------------------------------------------------

const TOP_BAR = 12;                       // the title bar's height
const PANEL_Y = GAME_HEIGHT - 38;         // the info panel's top
const ZOOMS = [1, 2, 3];
const frameOf = (node) => (node.big || node.id === CENTER ? 9 : 7); // a node frame's radius at 1x

// The rules for what you can see and buy (nodes.js), from the save (save.js).
const owned = (id) => (getSave().levels[id] ?? 0) > 0;
const shown = (node) => isShown(getSave().levels, node);
// For a depth not reached yet (stats.js): on sale already, at the early
// price (balance.js earlyPrice), for anyone who'd rather save up for it.
const early = (node) => isEarly(node, getSave().cleared);
// What it costs, or null once it's owned.
const priceOf = (node) => (owned(node.id) ? null : costOf(node, 0, early(node)));
const canBuy = (node) => !blockerOf(getSave().levels, node) && getSave().gold >= priceOf(node);

// The special upgrades: each depth's, bought a level at a time with its
// material. A slot shows once that material has been found (or a level
// bought). Their ids are "special:<id>", like the save's (stats.js).
const SPECIAL_ROW = 20; // the row's height, under the title bar
const SPECIAL_ICONS = { gravedigger: { draw: "shovel" }, sticky_fingers: { draw: "sack" }, shield: { draw: "shield" }, waders: { draw: "boot" } };
const specialOf = (id) => (id?.startsWith("special:") ? BALANCE.specials.find((sp) => `special:${sp.id}` === id) : null);
const materialOf = (special) => BALANCE.depths[special.depth - 1].material;
const specialLevel = (special) => getSave().levels[`special:${special.id}`] ?? 0;
const specialCost = (special) => special.costs[specialLevel(special)] ?? null; // null once it's maxed
const specialsOnShow = () => BALANCE.specials.filter((sp) => specialLevel(sp) > 0 || (getSave().materials[materialOf(sp)] ?? 0) > 0);
const canBuySpecial = (special) => specialCost(special) !== null && getSave().materials[materialOf(special)] >= specialCost(special);
// What a special upgrade does at a level, as the panel says it: what it's
// about, then what it does at that level.
const effectOf = (id) => BALANCE.specials.find((sp) => sp.id === id).effect;
const SPECIAL_TEXT = {
  gravedigger: ["STAMPS", (level) => {
    const { graveGold, graveTime } = effectOf("gravedigger");
    return level ? `${Math.round(graveGold * level * 100)}% GOLD +${graveTime * level}S` : "NOTHING";
  }],
  sticky_fingers: ["A CAUGHT THIEF'S LOOT", (level) => `${2 + effectOf("sticky_fingers").thiefBonus * level}X`],
  waders: ["SPEED IN WATER", (level) => `${Math.round((BALANCE.depths[3].water.slow + effectOf("waders").waders * level) * 100)}%`],
  shield: ["BLOCKS A HIT", (level) => (level ? `EVERY ${BALANCE.specials.find((sp) => sp.id === "shield").recharge[level - 1]}S` : "NEVER")],
};

// Whether there's anything you could buy right now (the altar's sigil glows).
export const canBuyAnything = () => NODES.some(canBuy) || BALANCE.specials.some(canBuySpecial);

// Opens the tree over the current scene. `onClose` runs when it's closed.
export function openTree(onClose) {
  C ??= Object.fromEntries(Object.entries(PALETTE).map(([name, [r, g, b]]) => [name, rgb(r, g, b)]));
  const save = getSave();
  const slots = specialsOnShow();
  const VIEW_TOP = TOP_BAR + (slots.length ? SPECIAL_ROW : 0); // where the tree's view starts
  const VIEW_MIDDLE = vec2(GAME_WIDTH / 2, (VIEW_TOP + PANEL_Y) / 2);
  const slotCenter = (special) => vec2(16 + slots.indexOf(special) * 62, TOP_BAR + SPECIAL_ROW / 2);
  const levels = save.levels;
  // The nodes on show (owned, or touching one that is), worked out again
  // whenever something's bought, and how far the view can go: its middle
  // stays within them.
  let visible = [];
  let edges = null;
  const look = () => {
    visible = NODES.filter(shown);
    const places = visible.map((n) => placeOf(n.id));
    edges = {
      left: Math.min(...places.map((p) => p.x)), right: Math.max(...places.map((p) => p.x)),
      top: Math.min(...places.map((p) => p.y)), bottom: Math.max(...places.map((p) => p.y)),
    };
  };
  look();
  let zoom = 1;
  let camera = vec2(0, 0);   // the web's point at the middle of the view
  let selected = CENTER;
  let hovered = null;         // the node under the mouse, until a key is pressed
  let message = null;        // { id, text, color, until }: a moment's note about a node, in the panel
  const born = time();
  // The E press that opened the page is still being handed out when the
  // page's own E handler is added, so it would buy something straight away.
  // Nothing on the page reacts in the frame it opened.
  const justOpened = () => time() === born;
  const flashes = {};        // node id -> when it was bought (for its sparkle)
  const revealed = {};       // node id -> when it came into view (it pops in)

  const toScreen = (place) => VIEW_MIDDLE.add(place.sub(camera).scale(zoom));
  const nodeAt = (point) => {
    if (point.y > TOP_BAR && point.y < VIEW_TOP) {
      const special = slots.find((sp) => slotCenter(sp).dist(point) < 11);
      return special ? `special:${special.id}` : null;
    }
    return point.y > VIEW_TOP && point.y < PANEL_Y
      ? visible.find((n) => toScreen(placeOf(n.id)).dist(point) < (frameOf(n) + 2) * zoom)?.id ?? null
      : null;
  };
  // Where something is in the web, for the arrow keys: a slot in the row is
  // wherever on the web is under it right now.
  const worldOf = (id) => (specialOf(id) ? camera.add(slotCenter(specialOf(id)).sub(VIEW_MIDDLE).scale(1 / zoom)) : placeOf(id));
  const radiusOf = (id) => (specialOf(id) ? 8 : frameOf(byId[id])); // a frame's radius at 1x

  function buy(id) {
    const say = (text, color = C.red) => (message = { id, text, color, until: time() + 1.6 });
    const special = specialOf(id);
    if (special) {
      const cost = specialCost(special);
      const material = materialOf(special);
      if (cost === null) return say("ALREADY MAXED", C.muted), playSound("locked");
      if (save.materials[material] < cost) return say(`NEEDS ${cost} ${material.toUpperCase()}`), playSound("locked");
      buySpecialLevel(special.id, material, cost);
      flashes[id] = time();
      playSound("unlock");
      return say(`${special.name.toUpperCase()} ${specialLevel(special)}/${special.costs.length}`, C.green);
    }
    const node = byId[id];
    const blocker = blockerOf(levels, node);
    if (blocker === "owned") return say("ALREADY YOURS", C.muted), playSound("locked");
    if (blocker === "hidden") return say("BUY ONE NEXT TO IT FIRST"), playSound("locked");
    if (blocker === "needs") return say(`NEEDS ${needsName(node.needs).toUpperCase()} FIRST`), playSound("locked");
    const price = priceOf(node);
    if (save.gold < price) return say(`NEEDS ${shortGold(price)} GOLD`), playSound("locked");
    const before = new Set(visible.map((n) => n.id));
    buyLevel(id, price);
    look();
    for (const n of visible) if (!before.has(n.id)) revealed[n.id] = time();
    flashes[id] = time();
    playSound("unlock");
    const at = toScreen(placeOf(id));
    puffDust(at.x, at.y + 4, 6, 10, 210);
    say(`${node.name.toUpperCase()}: YOURS`, C.green);
  }

  // Keyboard: the arrows move to the nearest node on show that way.
  function step(direction) {
    const from = worldOf(selected);
    let best = null;
    for (const id of [...visible.map((n) => n.id), ...slots.map((sp) => `special:${sp.id}`)]) {
      if (id === selected) continue;
      const offset = worldOf(id).sub(from);
      const along = offset.dot(direction);
      if (along <= 0) continue;
      const across = Math.abs(offset.x * direction.y - offset.y * direction.x);
      const score = along + across * 2;
      if (!best || score < best.score) best = { id, score };
    }
    if (!best) return;
    selected = best.id;
    playSound("letter");
    if (specialOf(selected)) return; // the row doesn't move
    // Keep it in view: if it's too close to an edge, slide the view just
    // enough to bring it back in.
    const margin = (radiusOf(selected) + 3) * zoom;
    const at = toScreen(placeOf(selected));
    const dx = Math.min(0, at.x - margin) + Math.max(0, at.x - (GAME_WIDTH - margin));
    const dy = Math.min(0, at.y - (VIEW_TOP + margin)) + Math.max(0, at.y - (PANEL_Y - margin));
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
  const keepCamera = () => (camera = vec2(clamp(camera.x, edges.left, edges.right), clamp(camera.y, edges.top, edges.bottom)));

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
  handles.push(onKeyPress(["=", "+"], byKey(() => setZoom(zoom + 1, specialOf(selected) ? VIEW_MIDDLE : screenOf(selected)))));
  handles.push(onKeyPress("-", byKey(() => setZoom(zoom - 1, specialOf(selected) ? VIEW_MIDDLE : screenOf(selected)))));
  handles.push(onKeyPress("escape", byKey(close)));
  // The strip above the game says how it works, and how to get out.
  setPrompt(null, () => {}, "Click twice or press E to buy. Drag, scroll to zoom. Esc closes.");

  // ---- Drawing ---------------------------------------------------------------------
  const page = add([pos(0, 0), z(200), fixed()]);
  page.onDraw(() => {
    const appear = Math.min(1, (time() - born) / 0.15);
    drawRect({ pos: vec2(0, 0), width: GAME_WIDTH, height: GAME_HEIGHT, color: C.ink, opacity: 0.86 * appear });

    // The links between neighbours on show (each once), then the nodes. A
    // link is gold between two owned nodes.
    const onShow = new Set(visible.map((n) => n.id));
    for (const node of visible) {
      for (const id of node.neighbours) {
        if (id < node.id || !onShow.has(id)) continue;
        const color = owned(node.id) && owned(id) ? C.gold : C.stoneLight;
        const fade = Math.min(popOf(node.id), popOf(id));
        drawLine({ p1: screenOf(node.id), p2: screenOf(id), width: Math.max(1, zoom), color, opacity: appear * fade });
      }
    }
    for (const node of visible) drawNode(node, appear);
    if (slots.length) drawSpecials(appear);
    drawCursor(appear);

    // The title bar.
    drawRect({ pos: vec2(0, 0), width: GAME_WIDTH, height: TOP_BAR, color: C.ink });
    drawText({ text: "SKILL TREE", pos: vec2(6, 2), size: 8, font: "pixel", color: C.light });
    const gold = shortGold(save.gold);
    drawText({ text: gold, pos: vec2(GAME_WIDTH - 6, 2), size: 8, font: "pixel", color: C.gold, anchor: "topright" });
    drawSprite({ sprite: "coin", frame: 0, pos: vec2(GAME_WIDTH - 17 - gold.length * 8, 2) });
    drawText({ text: `${zoom}X`, pos: vec2(GAME_WIDTH / 2, 2), size: 8, font: "pixel", color: C.muted, anchor: "top" });

    drawPanel(hovered ?? selected);
  });

  // How far a node that just came into view has popped in (0 to 1).
  const popOf = (id) => Math.min(1, (time() - (revealed[id] ?? -9)) / 0.25);

  function drawNode(node, appear) {
    const at = screenOf(node.id);
    const reach = (frameOf(node) + 4) * zoom;
    if (at.x < -reach || at.x > GAME_WIDTH + reach || at.y < -reach || at.y > GAME_HEIGHT + reach) return;
    const pop = popOf(node.id);
    const r = Math.max(1, Math.round(frameOf(node) * zoom * easings.easeOutBack(pop)));
    const spot = spotOf(node.id);
    const blocker = blockerOf(levels, node);

    // The frame's rim says where it stands: gold when owned, green when you
    // can afford it, dark when it needs something first, grey otherwise.
    const rim = blocker === "owned" ? C.gold : canBuy(node) ? C.green : blocker === "needs" ? C.dark : C.stoneLight;
    const opacity = appear * Math.min(1, pop * 2);
    drawCircle({ pos: spot, radius: r + zoom, color: C.ink, opacity });
    drawCircle({ pos: spot, radius: r, color: rim, opacity });
    drawCircle({ pos: spot, radius: Math.max(1, r - 2 * zoom), color: C.stone, opacity });
    if (pop >= 1) drawIcon(node, spot, zoom, appear * (blocker === "needs" ? 0.45 : 1));
    // A sparkle when it's just been bought.
    const since = time() - (flashes[node.id] ?? -9);
    if (since < 0.4) drawCircle({ pos: spot, radius: r + (4 + since * 30) * zoom * 0.3, outline: { width: zoom, color: C.gold }, fill: false, opacity: 1 - since / 0.4 });
  }

  // The row of special upgrades: each slot's frame (gold when maxed, green
  // when you can afford the next level), its icon, its levels as pips, and
  // how much of its material you have.
  function drawSpecials(appear) {
    drawRect({ pos: vec2(0, TOP_BAR), width: GAME_WIDTH, height: SPECIAL_ROW, color: C.ink, opacity: appear });
    drawRect({ pos: vec2(0, TOP_BAR + SPECIAL_ROW - 1), width: GAME_WIDTH, height: 1, color: C.stoneLight, opacity: appear });
    for (const special of slots) {
      const id = `special:${special.id}`;
      const spot = spotOf(id);
      const level = specialLevel(special);
      const rim = specialCost(special) === null ? C.gold : canBuySpecial(special) ? C.green : C.stoneLight;
      drawCircle({ pos: spot, radius: 9, color: C.ink, opacity: appear });
      drawCircle({ pos: spot, radius: 8, color: rim, opacity: appear });
      drawCircle({ pos: spot, radius: 6, color: C.stone, opacity: appear });
      drawIcon({ icon: SPECIAL_ICONS[special.id] }, spot, 1, appear);
      const at = slotCenter(special).add(12, -7);
      for (let i = 0; i < special.costs.length; i++) {
        drawRect({ pos: at.add(i * 5, 0), width: 3, height: 3, color: i < level ? C.gold : C.stoneLight, opacity: appear });
      }
      drawText({ text: String(save.materials[materialOf(special)]), pos: at.add(0, 5), size: 8, font: "pixel", color: C.light, opacity: appear });
      const since = time() - (flashes[id] ?? -9);
      if (since < 0.4) drawCircle({ pos: spot, radius: 9 + since * 9, outline: { width: 1, color: C.gold }, fill: false, opacity: 1 - since / 0.4 });
    }
  }

  // Where a node (or a slot in the row) is on screen, in whole pixels so it's drawn crisp.
  function screenOf(id) {
    if (specialOf(id)) return slotCenter(specialOf(id));
    const at = toScreen(placeOf(id));
    return vec2(Math.round(at.x), Math.round(at.y));
  }
  // Where a node is drawn: the selected one bobs a little.
  function spotOf(id) {
    const bob = id === selected ? Math.round(Math.sin(time() * 5) * 0.8 * (specialOf(id) ? 1 : zoom)) : 0;
    return screenOf(id).add(0, bob);
  }

  // The selected node gets a cursor: four corner brackets around it, that
  // breathe in and out a little. They're outlined in dark, so they still
  // show where they cross a neighbour's light rim.
  function drawCursor(appear) {
    const spot = spotOf(selected);
    const scale = specialOf(selected) ? 1 : zoom; // the row isn't zoomed
    const out = (radiusOf(selected) + 4) * scale + Math.round(Math.sin(time() * 5)) * scale;
    const arm = 3 * scale;
    const arms = [];
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const corner = spot.add(sx * out, sy * out);
        const x = sx < 0 ? corner.x : corner.x - arm;
        const y = sy < 0 ? corner.y : corner.y - arm;
        arms.push([x, sy < 0 ? corner.y : corner.y - scale, arm, scale]);   // across
        arms.push([sx < 0 ? corner.x : corner.x - scale, y, scale, arm]);   // down
      }
    }
    for (const [x, y, w, h] of arms) {
      drawRect({ pos: vec2(x - scale, y - scale), width: w + 2 * scale, height: h + 2 * scale, color: C.ink, opacity: appear });
    }
    for (const [x, y, w, h] of arms) drawRect({ pos: vec2(x, y), width: w, height: h, color: C.light, opacity: appear });
  }

  function drawPanel(id) {
    drawRect({ pos: vec2(0, PANEL_Y), width: GAME_WIDTH, height: GAME_HEIGHT - PANEL_Y, color: C.ink });
    drawRect({ pos: vec2(0, PANEL_Y), width: GAME_WIDTH, height: 1, color: C.stoneLight });
    const text = (content, x, y, color = C.light, anchorName = "topleft") =>
      drawText({ text: content, pos: vec2(x, y), size: 8, font: "pixel", color, anchor: anchorName });
    const special = specialOf(id);
    if (special) {
      // "GRAVEDIGGER  1/3", what the next level does, and its price in material.
      const level = specialLevel(special);
      const cost = specialCost(special);
      const material = materialOf(special).toUpperCase();
      drawIcon({ icon: SPECIAL_ICONS[special.id] }, vec2(15, PANEL_Y + 19), 1);
      text(special.name.toUpperCase(), 30, PANEL_Y + 4, C.gold);
      text(`${level}/${special.costs.length}`, GAME_WIDTH - 6, PANEL_Y + 4, C.muted, "topright");
      const [about, say] = SPECIAL_TEXT[special.id];
      text(cost === null ? `${about}: ${say(level)}` : `${about}: ${say(level)} > ${say(level + 1)}`, 30, PANEL_Y + 15);
      let status;
      if (message?.id === id && time() < message.until) status = [message.text, message.color];
      else if (cost === null) status = ["MAXED", C.gold];
      else if (save.materials[materialOf(special)] < cost) status = [`COSTS ${cost} ${material} (YOU HAVE ${save.materials[materialOf(special)]})`, C.red];
      else status = [id === selected ? `BUY ${cost} ${material}: CLICK OR E` : `${cost} ${material}: CLICK TO PICK`, C.green];
      text(status[0], 30, PANEL_Y + 26, status[1]);
      return;
    }
    const node = byId[id];

    drawIcon(node, vec2(15, PANEL_Y + 19), 1);
    text(node.name.toUpperCase(), 30, PANEL_Y + 4, C.gold);
    // Top right: the depth it's for: "DEPTH 2 ONLY" for one that only works
    // there, "DEPTH 2" for an early one.
    const depthTag = node.perDepth ? `DEPTH ${node.depth} ONLY` : early(node) ? `DEPTH ${node.depth}` : "";
    text(depthTag, GAME_WIDTH - 6, PANEL_Y + 4, C.muted, "topright");
    text(effectText(node, levels), 30, PANEL_Y + 15);

    let status;
    const blocker = blockerOf(levels, node);
    if (message?.id === id && time() < message.until) status = [message.text, message.color];
    else if (id === CENTER) status = ["YOURS", C.gold];
    else if (blocker === "owned") status = ["YOURS", C.gold];
    else if (blocker === "needs") status = [`NEEDS ${needsName(node.needs).toUpperCase()} FIRST`, C.red];
    else {
      // The selected node is one click (or E) from bought; any other node the
      // mouse is on is a click from being selected. An early node says it
      // costs more for now.
      const price = priceOf(node);
      const afford = save.gold >= price;
      const cost = shortGold(price);
      const tag = early(node) ? `EARLY ${BALANCE.earlyPrice}X: ` : "";
      if (!afford) status = [`${tag}COSTS ${cost} GOLD`, C.red];
      else if (id === selected) status = [early(node) ? `${tag}${cost} GOLD, CLICK OR E` : `BUY ${cost} GOLD: CLICK OR E`, C.green];
      else status = [`${tag}${cost} GOLD${early(node) ? "," : ":"} CLICK TO PICK`, C.green];
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
