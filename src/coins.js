import { playSound } from "./sound.js";
import { roomLimits } from "./room.js";

// Coins on the floor (DESIGN.md section 6). A kill drops its gold as coins
// that hop out of the monster and lie where they land. Once the hero is
// within the magnet's range, they fly to him and count toward the run's
// gold. Coins left behind when he goes through the door are lost; when a run
// ends, the ones still on the floor are collected (collectFloor).
//
// A big amount is split over a handful of coins, each worth a share, so the
// boss's pile doesn't become hundreds of sprites.
const MOST_COINS = 12;     // coins shown for one drop at most
const PICKUP = 6;          // px: this close, it's picked up
const FLY_SPEED = 140;     // px per second, once the magnet has it

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
    addCoin(at, target, value, run, player, magnet);
  }
}

function addCoin(from, to, value, run, player, magnet) {
  const born = time();
  const coin = add([
    sprite("coin", { frame: choose([0, 0, 3]) }), // frame 1 is the white shine, 2 edge-on
    pos(from),
    anchor("bot"),
    z(8),
    "coin",
    { value },
  ]);
  let flying = false;
  coin.onUpdate(() => {
    const age = time() - born;
    if (age < 0.3) {
      // The hop out of the monster.
      const t = age / 0.3;
      coin.pos = from.lerp(to, t).sub(0, Math.sin(t * Math.PI) * 8);
      return;
    }
    if (player.frozen && !flying) return;
    const distance = coin.pos.dist(player.pos);
    if (!flying && distance > magnet()) return;
    flying = true;
    if (distance < PICKUP) {
      run.gold += coin.value;
      if (time() - lastJingle > 0.06) {
        playSound("coin");
        lastJingle = time();
      }
      destroy(coin);
      return;
    }
    coin.pos = coin.pos.add(player.pos.sub(coin.pos).unit().scale(Math.min(distance, FLY_SPEED * dt())));
  });
}

// Every coin still on the floor, collected at once (the run is over).
// Returns how much they were worth.
export function collectFloor() {
  let total = 0;
  for (const coin of get("coin")) {
    total += coin.value;
    destroy(coin);
  }
  return total;
}
