import { BALANCE } from "./balance.js";

// The skill tree's nodes, built from its map (treemap.js, read by balance.js
// `skillTree`), and the rules for which ones you can see and buy. Shared by
// the game and the pacing simulator (tools/), like stats.js.
//
// The map (treemap.js) is drawn on a grid of half nodes: a node at x, y
// (counted from Descend's `@`, in half-node steps across and rows down) is
// at column 2x, row 2y of the text, and its links are drawn between: "---"
// to the node beside it (x + 2), "\\" to the one below right (x + 1, y + 1)
// and "/" to the one below left. Only linked nodes are neighbours: a node
// can be bought once one it's linked to is owned. Every node is bought once
// (save.js levels: { id: 1 }).

const { map, bands, prices, kinds } = BALANCE.skillTree;
const isNode = (ch) => ch !== undefined && /[A-Za-z@*>&%#$]/.test(ch);

// How many rings out from Descend a spot is (ring 1: the six around it).
export const ringOf = (x, y) => Math.abs(y) + Math.max(0, (Math.abs(x) - Math.abs(y)) / 2);
// How far out a spot is, in node widths, as the crow flies.
const distanceOf = (x, y) => Math.hypot(x / 2, (y * Math.sqrt(3)) / 2);
// The depth a ring belongs to (bands: the last ring of each).
const depthOfRing = (ring) => Math.max(1, bands.findIndex((last) => ring <= last) + 1);

// A per-depth setting: a list (depth 1 first) or one value for all. A
// missing one (null) borrows the nearest depth's.
function forDepth(value, depth) {
  if (!Array.isArray(value)) return value;
  for (let off = 0; off < value.length; off++) {
    for (const d of [depth - off, depth + off]) if (value[d - 1] !== undefined && value[d - 1] !== null) return value[d - 1];
  }
  return undefined;
}

// A number from 0 to 1 that's always the same for a spot: each node's own
// nudge to its price.
function wobble(x, y) {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// The node's effect: a big node's is twice as strong.
function effectOf(kind, depth, big) {
  const { stat, add, mul, unlock } = kind.effect;
  if (unlock) return { unlock };
  if (add !== undefined) return { stat, add: forDepth(add, depth) * (big ? 2 : 1) };
  return { stat, mul: forDepth(mul, depth) ** (big ? 2 : 1) };
}

// Its price: the depth's start, times spread^(how far out in its band),
// times its kind's worth, nudged up or down; a big one costs `big` times as
// much, nudged further.
function priceOf(kind, depth, big, x, y) {
  const inside = (depth === 1 ? 1 : bands[depth - 2] + 1) * (Math.sqrt(3) / 2); // the band's nearest spots
  const outside = bands[depth - 1];
  const out = Math.min(1, Math.max(0, (distanceOf(x, y) - inside) / (outside - inside)));
  const nudge = 2 * wobble(x, y) - 1;
  const size = big ? prices.big * (1 + prices.bigJitter * nudge) : 1 + prices.jitter * nudge;
  return forDepth(prices.start, depth) * forDepth(prices.spread, depth) ** out * forDepth(kind.worth, depth) * size;
}

// ---- The nodes ------------------------------------------------------------------

const middleRow = map.findIndex((row) => row.includes("@"));
const middleColumn = map[middleRow].indexOf("@");
export const CENTER = "descend";
const idOf = (x, y) => (x === 0 && y === 0 ? CENTER : `${x},${y}`);

export const NODES = [];
map.forEach((row, r) => {
  [...row].forEach((letter, c) => {
    if (!isNode(letter)) return;
    const x = (c - middleColumn) / 2, y = (r - middleRow) / 2;
    const kind = kinds[letter.toLowerCase()] ?? kinds[letter];
    if (!kind) throw new Error(`skill tree map: no kind for "${letter}" at ${x},${y}`);
    const center = letter === "@";
    const big = /[A-Z]/.test(letter);
    const ring = ringOf(x, y);
    const depth = depthOfRing(ring);
    const name = forDepth(kind.name, depth);
    NODES.push({
      id: idOf(x, y), x, y, ring, depth,
      letter: letter.toLowerCase(), big,
      name: big ? `Great ${name[0].toLowerCase()}${name.slice(1)}` : name,
      effect: effectOf(kind, depth, big),
      perDepth: !!kind.perDepth,
      needs: kind.needs ?? null,
      cost: center ? 0 : Math.max(1, priceOf(kind, depth, big, x, y)), // a node is never free
      levels: 1, growth: 1, // one purchase each (stats.js costOf)
      owned: center,
    });
  });
});
export const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
// The links, both ways.
for (const node of NODES) node.neighbours = [];
const at = (x, y) => map[middleRow + 2 * y]?.[middleColumn + 2 * x];
for (const node of NODES) {
  const { x, y } = node;
  for (const [char, dx, dy, mark] of [["-", 2, 0, at(x + 0.5, y)], ["\\", 1, 1, at(x + 0.5, y + 0.5)], ["/", -1, 1, at(x - 0.5, y + 0.5)]]) {
    const other = byId[idOf(x + dx, y + dy)];
    if (mark !== char) continue;
    if (!other) throw new Error(`skill tree map: a link from ${x},${y} to nothing`);
    node.neighbours.push(other.id);
    other.neighbours.push(node.id);
  }
}

// ---- What you can see and buy ----------------------------------------------------

const has = (levels, id) => (levels[id] ?? 0) > 0;
// Whether you own a node of this letter (a `needs`).
const ownsKind = (levels, letter) => Object.keys(levels).some((id) => has(levels, id) && byId[id]?.letter === letter);
// Touching one you own (or owned already): you can see it.
export const isShown = (levels, node) => has(levels, node.id) || node.neighbours.some((id) => has(levels, id));
// What stops it being bought, if anything (gold aside): "owned", "hidden"
// (nothing you own touches it) or "needs" (its `needs` isn't owned yet).
export function blockerOf(levels, node) {
  if (has(levels, node.id)) return "owned";
  if (!isShown(levels, node)) return "hidden";
  if (node.needs && !ownsKind(levels, node.needs)) return "needs";
  return null;
}
// The node a `needs` letter stands for (its kind's name).
export const needsName = (letter) => forDepth(kinds[letter].name, 1);
