import { playSound } from "./sound.js";
import { roomLimits } from "./room.js";

// Coins on the floor (DESIGN.md section 6). A kill drops its gold as coins
// that hop out of the monster and lie where they land. Once the hero is
// within the magnet's range, they fly to him and count toward the run's
// gold. Coins left behind when he goes through the door are lost. When a run
// ends, they're banked at once (floorValue), and sweepFloor() pulls every
// coin still on the floor to him, from anywhere in the room, while he's
// taken away; collectFloor() then adds any that didn't make it in time to
// the run's total. Bones (dropBone) work the same way.
//
// Gold drops as green gems worth GEM gold each, plus coins for the rest: 8
// gold is a gem and 3 coins. So a room full of kills doesn't bury the floor
// in coins, and the gems themselves show the hero is earning more. A big
// amount is split over a handful of pieces, so the boss's pile doesn't
// become hundreds of sprites: past MOST_COINS, each gem is worth a share of
// the gems' gold.
const GEM = 5;             // gold a gem is worth
const MOST_COINS = 12;     // pieces shown for one drop at most
const PICKUP = 6;          // px: this close, it's picked up
const FLY_SPEED = 140;     // px per second, once the magnet has it
const SWEEP_SPEED = 330;   // px per second at most, for a swept coin (it speeds up on the way)

let lastJingle = 0;

// Drops `amount` gold (whole coins) at `at`, as gems and coins. `run.gold`
// is what they add to; `magnet()` is the hero's magnet range right now, in px.
export function dropCoins(at, amount, run, player, magnet, { spread = 10 } = {}) {
  const coins = amount % GEM;
  const gemGold = amount - coins;
  // How many gems to show (fewer, each worth more, if there'd be too many),
  // the first few taking any remainder.
  const gems = Math.min(gemGold / GEM, Math.max(1, MOST_COINS - coins));
  const values = [
    ...Array.from({ length: gems }, (_, i) => ["gem", Math.floor(gemGold / gems) + (i < gemGold % gems ? 1 : 0)]),
    ...Array.from({ length: Math.min(coins, MOST_COINS) }, () => ["coin", 1]),
  ];
  const limits = roomLimits([6, 4]);
  for (const [kind, value] of values) {
    const angle = rand(0, Math.PI * 2);
    const land = at.add(Math.cos(angle) * rand(2, spread), Math.sin(angle) * rand(1, spread * 0.6));
    const target = vec2(clamp(land.x, limits.left, limits.right), clamp(land.y, limits.top, limits.bottom));
    addPickup(at, target, kind, value, run, player, magnet);
  }
}

// A bone (the crypt's material, DESIGN.md section 6): it drops from kills
// from sub-depth 6 on, and is picked up like a coin, into `run.bones`. Bones
// don't buy anything yet; they're kept in the save for later.
export function dropBone(at, run, player, magnet) {
  const limits = roomLimits([6, 4]);
  const land = at.add(rand(-8, 8), rand(-3, 3));
  addPickup(at, vec2(clamp(land.x, limits.left, limits.right), clamp(land.y, limits.top, limits.bottom)), "bone", 1, run, player, magnet);
}

// The bone isn't in the tileset, so it's drawn: a small white bone with a
// knob at each end, lying on the floor.
const BONE = [[-5, -5, 3, 3], [-5, -3, 3, 3], [3, -5, 3, 3], [3, -3, 3, 3], [-3, -4, 7, 2]];
function drawBone() {
  for (const [x, y, w, h] of BONE) drawRect({ pos: vec2(x - 1, y - 1), width: w + 2, height: h + 2, color: rgb(24, 20, 37) });
  for (const [x, y, w, h] of BONE) drawRect({ pos: vec2(x, y), width: w, height: h, color: rgb(232, 224, 208) });
}

// The gem isn't in the tileset either: a small green cut stone, outlined,
// with a light facet on top and a dark one below, that twinkles now and then.
const GEM_SHAPE = [[-2, -8, 5, 1], [-3, -7, 7, 2], [-2, -5, 5, 1], [-1, -4, 3, 1], [0, -3, 1, 1]];
function drawGem(twinkleAt) {
  for (const [x, y, w, h] of GEM_SHAPE) drawRect({ pos: vec2(x - 1, y - 1), width: w + 2, height: h + 2, color: rgb(24, 20, 37) });
  for (const [x, y, w, h] of GEM_SHAPE) drawRect({ pos: vec2(x, y), width: w, height: h, color: rgb(56, 183, 100) });
  drawRect({ pos: vec2(-2, -8), width: 3, height: 1, color: rgb(160, 236, 150) }); // light facet
  drawRect({ pos: vec2(-3, -7), width: 2, height: 1, color: rgb(160, 236, 150) });
  drawRect({ pos: vec2(1, -5), width: 2, height: 1, color: rgb(30, 120, 64) });    // dark facet
  drawRect({ pos: vec2(0, -4), width: 2, height: 1, color: rgb(30, 120, 64) });
  if ((time() + twinkleAt) % 2.5 < 0.12) drawRect({ pos: vec2(-1, -7), width: 1, height: 1, color: rgb(255, 255, 255) });
}

// A coin, a gem or a bone, hopping out to `to` and lying there until the
// magnet (or the end-of-run sweep) brings it to him. Gems are tagged "coin"
// too: they're gold.
function addPickup(from, to, kind, value, run, player, magnet) {
  const born = time();
  const coin = add([
    ...(kind === "coin" ? [sprite("coin", { frame: choose([0, 0, 3]) }), anchor("bot")] : []), // frame 1 is the white shine, 2 edge-on
    pos(from),
    z(8),
    kind === "gem" ? "coin" : kind,
    kind,
    "pickup",
    { value },
  ]);
  if (kind === "bone") coin.onDraw(drawBone);
  if (kind === "gem") {
    const twinkleAt = rand(0, 2.5);
    coin.onDraw(() => drawGem(twinkleAt));
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
    // It starts flying once he's close enough and free to move, or as soon
    // as the floor is swept, wherever it is.
    const distance = coin.pos.dist(player.pos);
    if (!flying && !coin.swept && (player.frozen || distance > magnet())) return;
    flying = true;
    flewFor += dt();
    if (distance < PICKUP) {
      if (kind === "bone") {
        run.bones += coin.value;
        playSound("bone");
      } else {
        run.gold += coin.value;
        if (time() - lastJingle > 0.06) {
          playSound(kind === "gem" ? "gem" : "coin");
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

// The run is over: every coin, gem and bone on the floor flies to him, as if his
// magnet covered the whole room (ones still hopping out join in when they
// land).
export function sweepFloor() {
  for (const pickup of get("pickup")) pickup.swept = true;
}

// What's still on the floor (or still flying): the gold in coins and gems, and the bones.
export const floorValue = () => get("coin").reduce((sum, coin) => sum + coin.value, 0);
export const floorBones = () => get("bone").reduce((sum, bone) => sum + bone.value, 0);

// Every coin and bone still on the floor (or still flying), added to the run
// at once: the ones the sweep didn't bring in before the screen went dark.
export function collectFloor(run) {
  run.gold += floorValue();
  run.bones += floorBones();
  for (const pickup of get("pickup")) destroy(pickup);
}
