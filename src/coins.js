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
// A big amount is split over a handful of coins, each worth a share, so the
// boss's pile doesn't become hundreds of sprites.
const MOST_COINS = 12;     // coins shown for one drop at most
const PICKUP = 6;          // px: this close, it's picked up
const FLY_SPEED = 140;     // px per second, once the magnet has it
const SWEEP_SPEED = 330;   // px per second at most, for a swept coin (it speeds up on the way)

let lastJingle = 0;

// Drops `amount` gold (whole coins) at `at`. `run.gold` is what they add to;
// `magnet()` is the hero's magnet range right now, in px.
export function dropCoins(at, amount, run, player, magnet, { spread = 10 } = {}) {
  const count = Math.min(amount, MOST_COINS);
  const limits = roomLimits([6, 4]);
  for (let i = 0; i < count; i++) {
    // Share the amount out evenly, the first few coins taking the remainder.
    const value = Math.floor(amount / count) + (i < amount % count ? 1 : 0);
    const angle = rand(0, Math.PI * 2);
    const land = at.add(Math.cos(angle) * rand(2, spread), Math.sin(angle) * rand(1, spread * 0.6));
    const target = vec2(clamp(land.x, limits.left, limits.right), clamp(land.y, limits.top, limits.bottom));
    addPickup(at, target, "coin", value, run, player, magnet);
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

// A coin or a bone, hopping out to `to` and lying there until the magnet
// (or the end-of-run sweep) brings it to him.
function addPickup(from, to, kind, value, run, player, magnet) {
  const born = time();
  const coin = add([
    ...(kind === "coin" ? [sprite("coin", { frame: choose([0, 0, 3]) }), anchor("bot")] : []), // frame 1 is the white shine, 2 edge-on
    pos(from),
    z(8),
    kind,
    "pickup",
    { value },
  ]);
  if (kind === "bone") coin.onDraw(drawBone);
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
          playSound("coin");
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

// The run is over: every coin and bone on the floor flies to him, as if his
// magnet covered the whole room (ones still hopping out join in when they
// land).
export function sweepFloor() {
  for (const pickup of get("pickup")) pickup.swept = true;
}

// What's still on the floor (or still flying): the coins' gold, and the bones.
export const floorValue = () => get("coin").reduce((sum, coin) => sum + coin.value, 0);
export const floorBones = () => get("bone").reduce((sum, bone) => sum + bone.value, 0);

// Every coin and bone still on the floor (or still flying), added to the run
// at once: the ones the sweep didn't bring in before the screen went dark.
export function collectFloor(run) {
  run.gold += floorValue();
  run.bones += floorBones();
  for (const pickup of get("pickup")) destroy(pickup);
}
