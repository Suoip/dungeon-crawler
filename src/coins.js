import { playSound } from "./sound.js";
import { roomLimits } from "./room.js";

// Coins on the floor (DESIGN.md section 6). A kill drops its gold as coins
// that hop out of the monster and lie where they land. Once the hero is
// within the magnet's range, they fly to him and count toward the run's
// gold. Coins left behind when he goes through the door are lost. When a run
// ends, they're banked at once (floorValue), and sweepFloor() pulls every
// coin still on the floor to him, from anywhere in the room, while he's
// taken away; collectFloor() then adds any that didn't make it in time to
// the run's total. The depths' materials (dropMaterial) work the same way.
//
// Gold drops as coins and stones, the biggest that fit: a gold coin is
// worth 1, an emerald 5, a sapphire 100, a ruby 10K, an amethyst 1M and a
// diamond 100M. So each depth's kills bring their own stone (the crypt's
// emeralds, the warrens' sapphires, the fort's rubies, the swamp's
// amethysts, the pit's diamonds), the stones show the hero is earning more,
// and a room full of kills doesn't bury the floor in coins. A drop is at
// most MOST_COINS pieces: past that, its pieces are each worth a share more.
const STONES = [ // biggest first; `kind` is the pickup's look (and tag)
  { kind: "diamond", value: 100_000_000, light: [255, 255, 255], main: [196, 232, 245], dark: [112, 160, 190] },
  { kind: "amethyst", value: 1_000_000, light: [220, 190, 250], main: [160, 90, 220], dark: [90, 40, 140] },
  { kind: "ruby", value: 10_000, light: [255, 170, 160], main: [220, 50, 60], dark: [130, 20, 40] },
  { kind: "sapphire", value: 100, light: [170, 210, 255], main: [60, 110, 220], dark: [30, 50, 130] },
  { kind: "gem", value: 5, light: [160, 236, 150], main: [56, 183, 100], dark: [30, 120, 64] }, // the emerald
];
const STONE_OF = Object.fromEntries(STONES.map((s) => [s.kind, s]));
const MOST_COINS = 12;     // pieces shown for one drop at most
const PICKUP = 6;          // px: this close, it's picked up
const FLY_SPEED = 140;     // px per second, once the magnet has it
const SWEEP_SPEED = 330;   // px per second at most, for a swept coin (it speeds up on the way)

let lastJingle = 0;

// `amount` gold as pieces: [kind, value] pairs, the biggest stones that fit
// first, then coins, at most MOST_COINS in all (whatever doesn't fit is
// shared out over the biggest pieces, so they add up to `amount`).
export function splitGold(amount) {
  const pieces = [];
  let rest = amount;
  for (const stone of STONES) {
    if (rest < stone.value) continue;
    const room = MOST_COINS - pieces.length - 1; // leave a place for what's smaller
    const count = Math.max(1, Math.min(Math.floor(rest / stone.value), room));
    for (let i = 0; i < count; i++) pieces.push([stone.kind, stone.value]);
    rest -= count * stone.value;
    if (pieces.length >= MOST_COINS - 1) break;
  }
  const coins = Math.min(rest, MOST_COINS - pieces.length);
  for (let i = 0; i < coins; i++) pieces.push(["coin", 1]);
  rest -= coins;
  for (let i = 0; rest > 0; i++) {
    // Too much for the pieces there are: the biggest ones take a share more.
    const share = Math.ceil(rest / (pieces.length - i));
    pieces[i % pieces.length][1] += share;
    rest -= share;
  }
  return pieces;
}

// Drops `amount` gold (whole coins) at `at`, as stones and coins. `run.gold`
// is what they add to; `magnet()` is the hero's magnet range right now, in px.
export function dropCoins(at, amount, run, player, magnet, { spread = 10 } = {}) {
  const limits = roomLimits([6, 4]);
  for (const [kind, value] of splitGold(amount)) {
    const angle = rand(0, Math.PI * 2);
    const land = at.add(Math.cos(angle) * rand(2, spread), Math.sin(angle) * rand(1, spread * 0.6));
    const target = vec2(clamp(land.x, limits.left, limits.right), clamp(land.y, limits.top, limits.bottom));
    addPickup(at, target, kind, value, run, player, magnet);
  }
}

// A piece of the depth's material (balance.js depths' `material`: bones in
// the crypt, teeth in the warrens, tusks in the fort, slime in the swamp,
// embers in the pit): kills drop it from sub-depth 6 on, and it's picked up
// like a coin, into `run.material`. It buys each depth's special upgrade.
export function dropMaterial(at, run, player, magnet, material) {
  const limits = roomLimits([6, 4]);
  const land = at.add(rand(-8, 8), rand(-3, 3));
  addPickup(at, vec2(clamp(land.x, limits.left, limits.right), clamp(land.y, limits.top, limits.bottom)), "material", 1, run, player, magnet, material);
}

// The materials aren't in the tileset, so they're drawn: [x, y, w, h,
// color], outlined in dark. A bone with a knob at each end; a fang; a curved
// tusk; a blob of slime; glowing embers.
const IVORY = [232, 224, 208];
const MATERIAL_SHAPES = {
  bones: [[-5, -5, 3, 3, IVORY], [-5, -3, 3, 3, IVORY], [3, -5, 3, 3, IVORY], [3, -3, 3, 3, IVORY], [-3, -4, 7, 2, IVORY]],
  teeth: [[-2, -8, 5, 2, IVORY], [-2, -6, 4, 2, IVORY], [-1, -4, 3, 2, IVORY], [0, -2, 2, 1, IVORY]],
  tusks: [[-5, -8, 3, 2, [240, 230, 200]], [-4, -6, 3, 2, [240, 230, 200]], [-3, -4, 4, 2, [240, 230, 200]], [-1, -3, 4, 2, [240, 230, 200]], [2, -4, 3, 2, [200, 180, 140]]],
  slime: [[-3, -6, 6, 1, [150, 220, 110]], [-4, -5, 8, 3, [100, 190, 80]], [-5, -2, 10, 2, [70, 150, 60]], [-2, -5, 2, 1, [220, 250, 200]]],
  embers: [[-3, -6, 3, 3, [255, 140, 40]], [1, -5, 3, 3, [255, 110, 30]], [-1, -3, 3, 3, [255, 160, 50]], [-2, -5, 1, 1, [255, 230, 120]], [2, -4, 1, 1, [255, 230, 120]]],
};
function drawMaterial(material, flickerAt) {
  const shape = MATERIAL_SHAPES[material] ?? MATERIAL_SHAPES.bones;
  for (const [x, y, w, h] of shape) drawRect({ pos: vec2(x - 1, y - 1), width: w + 2, height: h + 2, color: rgb(24, 20, 37) });
  const glow = material === "embers" ? 0.75 + 0.25 * Math.sin((time() + flickerAt) * 9) : 1; // embers flicker
  for (const [x, y, w, h, c] of shape) drawRect({ pos: vec2(x, y), width: w, height: h, color: rgb(...c), opacity: glow });
}

// The stones aren't in the tileset either: a small cut stone, outlined, with
// a light facet on top and a dark one below, that twinkles now and then.
const GEM_SHAPE = [[-2, -8, 5, 1], [-3, -7, 7, 2], [-2, -5, 5, 1], [-1, -4, 3, 1], [0, -3, 1, 1]];
function drawStone(stone, twinkleAt) {
  const c = (rgbList) => rgb(...rgbList);
  for (const [x, y, w, h] of GEM_SHAPE) drawRect({ pos: vec2(x - 1, y - 1), width: w + 2, height: h + 2, color: rgb(24, 20, 37) });
  for (const [x, y, w, h] of GEM_SHAPE) drawRect({ pos: vec2(x, y), width: w, height: h, color: c(stone.main) });
  drawRect({ pos: vec2(-2, -8), width: 3, height: 1, color: c(stone.light) }); // light facet
  drawRect({ pos: vec2(-3, -7), width: 2, height: 1, color: c(stone.light) });
  drawRect({ pos: vec2(1, -5), width: 2, height: 1, color: c(stone.dark) });    // dark facet
  drawRect({ pos: vec2(0, -4), width: 2, height: 1, color: c(stone.dark) });
  if ((time() + twinkleAt) % 2.5 < 0.12) drawRect({ pos: vec2(-1, -7), width: 1, height: 1, color: rgb(255, 255, 255) });
}

// A coin, a stone or a piece of material, hopping out to `to` and lying
// there until the magnet (or the end-of-run sweep) brings it to him. Stones
// are tagged "coin" too: they're gold.
function addPickup(from, to, kind, value, run, player, magnet, material = null) {
  const born = time();
  const stone = STONE_OF[kind];
  const coin = add([
    ...(kind === "coin" ? [sprite("coin", { frame: choose([0, 0, 3]) }), anchor("bot")] : []), // frame 1 is the white shine, 2 edge-on
    pos(from),
    z(8),
    stone ? "coin" : kind,
    kind,
    "pickup",
    { value },
  ]);
  if (kind === "material") {
    const flickerAt = rand(0, 3);
    coin.onDraw(() => drawMaterial(material, flickerAt));
  }
  if (stone) {
    const twinkleAt = rand(0, 2.5);
    coin.onDraw(() => drawStone(stone, twinkleAt));
  }
  let flying = false;
  let flewFor = 0; // seconds since it started flying
  coin.onUpdate(() => {
    const age = time() - born;
    if (age < 0.3) {
      // The hop out of the monster.
      const t = age / 0.3;
      coin.pos = from.lerp(to, t).sub(0, Math.sin(t * Math.PI) * 8);
      return;
    }
    coin.landed = true;
    // It starts flying once he's close enough and free to move, or as soon
    // as the floor is swept, wherever it is.
    const distance = coin.pos.dist(player.pos);
    if (!flying && !coin.swept && (player.frozen || distance > magnet())) return;
    flying = coin.flying = true;
    flewFor += dt();
    if (distance < PICKUP) {
      if (kind === "material") {
        run.material += coin.value;
        playSound("bone");
      } else {
        run.gold += coin.value;
        if (time() - lastJingle > 0.06) {
          playSound(stone ? "gem" : "coin");
          lastJingle = time();
        }
      }
      destroy(coin);
      return;
    }
    // A swept coin speeds up as it goes, so even one from across the room
    // reaches him before he's gone.
    const speed = coin.swept ? Math.min(SWEEP_SPEED, FLY_SPEED + 400 * flewFor) : FLY_SPEED;
    coin.pos = coin.pos.add(player.pos.sub(coin.pos).unit().scale(Math.min(distance, speed * dt())));
  });
}

// The run is over: every coin, stone and material on the floor flies to him, as if his
// magnet covered the whole room (ones still hopping out join in when they
// land).
export function sweepFloor() {
  for (const pickup of get("pickup")) pickup.swept = true;
}

// What's still on the floor (or still flying): the gold in coins and stones, and the material.
export const floorValue = () => get("coin").reduce((sum, coin) => sum + coin.value, 0);
export const floorMaterial = () => get("material").reduce((sum, piece) => sum + piece.value, 0);

// Every coin and piece of material still on the floor (or still flying), added to the run
// at once: the ones the sweep didn't bring in before the screen went dark.
export function collectFloor(run) {
  run.gold += floorValue();
  run.material += floorMaterial();
  for (const pickup of get("pickup")) destroy(pickup);
}
