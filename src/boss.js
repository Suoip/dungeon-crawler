import { TILE, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { raiseMob } from "./mobs.js";
import { addShot } from "./shots.js";
import { sleep, during, puffDust, shakeScreen, flashScreen, showBanner } from "./effects.js";
import { playSound } from "./sound.js";
import { roomLimits } from "./room.js";

// The boss fight. Between moves the boss walks toward the hero; every few
// seconds it casts one of three moves at random, each with its own warning
// so you can tell what's coming:
//   dash   flashes red, then dashes at you, leaving a trail of fire
//   vomit  flashes green, then spits a ring of 12 projectiles (they can only
//          be dodged: shots.js)
//   spawn  flashes purple, then raises 3 minions around itself
// Each boss casts its favorite move twice as often as the others. Below
// half health it becomes enraged, and every move gets stronger.

const CAST_EVERY = [1.5, 3];       // seconds between moves, picked at random
const RAGE_CAST_EVERY = [1.2, 2.2];
const FIRST_CAST = 1;              // seconds after its roar

const DASH_SPEED = 210;            // px per second
const RAGE_DASH_SPEED = 330;       // the second dash when enraged
const DASH_TIME = 0.6;
const FIRE_LIFE = 4;               // seconds the fire trail burns

const SHOTS = 12;                  // projectiles per ring, 30° apart
const SHOT_SPEED = 70;

const WARNING_COLORS = {
  dash: [255, 90, 90],
  vomit: [140, 220, 90],
  spawn: [180, 120, 240],
};

// Gives a boss its moves. The mob brain (mobs.js) calls boss.bossTurn()
// every frame; it returns true while the boss is busy with a move, so the
// brain doesn't also walk it toward the hero.
export function setupBoss(boss, room) {
  boss.busy = false;
  boss.raging = false;
  boss.minionsLeft = 0; // minions from its spawns that are still up
  let nextCast = null;
  // Resolves once it has introduced itself (the boss room waits for its roar
  // before giving the hero back his controls).
  let introduced;
  boss.ready = new Promise((resolve) => (introduced = resolve));

  boss.bossTurn = () => {
    if (!boss.raging && boss.hp <= boss.maxHp / 2) enrage(boss);
    if (boss.busy) return true;
    if (nextCast === null) {
      // Its first turn: it introduces itself.
      nextCast = Infinity;
      boss.busy = true;
      introduce(boss, room).then(() => {
        boss.busy = false;
        nextCast = time() + FIRST_CAST;
        introduced();
      });
      return true;
    }
    if (time() < nextCast) return false;

    cast(boss, room).then(() => {
      const [min, max] = boss.raging ? RAGE_CAST_EVERY : CAST_EVERY;
      nextCast = time() + rand(min, max);
    });
    return true;
  };
}

const alive = (boss, room) => boss.exists() && boss.active && !room.over && !room.frozen;

async function cast(boss, room) {
  boss.busy = true;
  await MOVES[pickMove(boss)](boss, room);
  boss.busy = false;
  if (boss.exists()) boss.color = boss.tint;
}

// A random move, with the favorite counting twice. Spawn is left out while
// more than one of its minions is still up.
function pickMove(boss) {
  const moves = ["dash", "vomit", "spawn"].filter((move) => move !== "spawn" || boss.minionsLeft <= 1);
  return choose(moves.flatMap((move) => (move === boss.def.favorite ? [move, move] : [move])));
}

// The warning before a move: it stands still and flashes the move's color.
// Resolves false if the boss died (or the fight ended) meanwhile.
async function windUp(boss, room, move, seconds, sound) {
  playSound(sound);
  boss.play("idle");
  const ok = await during(seconds, (t) => {
    boss.color = Math.floor(t * 12) % 2 ? rgb(...WARNING_COLORS[move]) : boss.tint;
  }, () => alive(boss, room));
  if (boss.exists()) boss.color = boss.tint;
  return ok;
}

const MOVES = {
  // Dashes at where the hero is. Enraged, its dashes don't stop until it
  // slams into a wall, and then it turns and dashes again, faster. Because
  // the second dash starts from across the room, there's time to get out of
  // the way.
  async dash(boss, room) {
    if (!(await windUp(boss, room, "dash", 0.6, "charge"))) return;
    if (!(await dashOnce(boss, room, DASH_SPEED, { toWall: boss.raging }))) return;
    if (!boss.raging) return;
    if (!(await windUp(boss, room, "dash", 0.4, "charge"))) return;
    await dashOnce(boss, room, RAGE_DASH_SPEED, { toWall: true });
  },

  // A ring of 12 shots. Enraged, a second ring follows, turned by half the
  // gap, so it covers the holes the first one left.
  async vomit(boss, room) {
    if (!(await windUp(boss, room, "vomit", 0.5, "gurgle"))) return;
    const turn = rand(0, 360 / SHOTS);
    ring(boss, room, turn);
    if (boss.raging) {
      await sleep(0.45);
      if (!alive(boss, room)) return;
      ring(boss, room, turn + 360 / SHOTS / 2);
    }
    await sleep(0.3);
  },

  // Raises 3 minions around itself. A boss with its own `minions` (the Big
  // Zombie's tiny zombies, the ogre's goblins) raises those in both phases;
  // the others raise tougher ones once enraged.
  async spawn(boss, room) {
    if (!(await windUp(boss, room, "spawn", 0.6, "summon"))) return;
    const own = room.minion ? [room.minion] : boss.def.minions; // the depth's own (balance.js), or the boss's
    const types = own ? [0, 1, 2].map((i) => own[i % own.length])
      : boss.raging ? ["goblin", "goblin", "orc_warrior"] : ["tiny_zombie", "tiny_zombie", "tiny_zombie"];
    const turn = rand(0, 120);
    boss.minionsLeft += types.length;
    types.forEach((type, i) => {
      const angle = ((turn + i * 120) * Math.PI) / 180;
      const spot = vec2(
        clamp(boss.pos.x + Math.cos(angle) * 36, 32, GAME_WIDTH - 32),
        clamp(boss.pos.y + Math.sin(angle) * 24, TOP + 3 * TILE + 8, GAME_HEIGHT - 20),
      );
      raiseMob(type, room, { at: spot, delay: i * 0.15, onDeath: () => boss.minionsLeft-- });
    });
    await sleep(0.4);
  },
};

// One dash. Normally it lasts DASH_TIME; with { toWall: true } it keeps
// going until it slams into a wall. Resolves false if the boss died
// meanwhile.
//
// While dashing it isn't a solid body: it runs straight through the hero
// (who still gets hit, and knocked aside) instead of shoving him along. That
// means the walls don't stop it either, so it's kept inside the room here:
// the moment it would go past a wall, it stops at it. (Leaving the walls to
// the physics engine made it slide along them, since a body is only pushed
// straight out of a wall.)
// Whether its feet, at `at`, would run into something solid in the room (a
// pillar, a breakable or a chest: crypt.js tags them "solid", with a box).
function blockedAt(boss, at) {
  const [width, height] = boss.def.feet;
  return get("solid").some(({ box }) =>
    at.x + width / 2 > box.left && at.x - width / 2 < box.right && at.y > box.top && at.y - height < box.bottom);
}

async function dashOnce(boss, room, speed, { toWall = false } = {}) {
  const aim = room.player.pos.sub(boss.pos).unit();
  boss.play("run");
  if (boss.has("body")) boss.unuse("body");

  const limits = roomLimits(boss.def.feet); // how far its feet can go
  // If it starts against a wall (after a slam) and the hero is off to that
  // side, it would hit the same wall straight away, so it dashes along it.
  const intoSide = (boss.pos.x <= limits.left + 0.5 && aim.x < 0) || (boss.pos.x >= limits.right - 0.5 && aim.x > 0);
  const intoEnd = (boss.pos.y <= limits.top + 0.5 && aim.y < 0) || (boss.pos.y >= limits.bottom - 0.5 && aim.y > 0);
  const along = vec2(intoSide ? 0 : aim.x, intoEnd ? 0 : aim.y);
  if (along.len() < 0.1) {
    boss.use(body());
    return alive(boss, room);
  }
  const dir = along.unit();
  boss.flipX = dir.x < 0;

  let lastFire = null;
  let hitWall = false;
  let stopped = false; // ran into a pillar, a breakable or a chest
  await during(toWall ? 3 : DASH_TIME, () => {
    const next = boss.pos.add(dir.scale(speed * dt()));
    const kept = vec2(clamp(next.x, limits.left, limits.right), clamp(next.y, limits.top, limits.bottom));
    if (blockedAt(boss, kept)) {
      // Something solid stops it like a wall (a long dash slams into it).
      stopped = true;
      hitWall = toWall;
      return;
    }
    if (!kept.eq(next)) hitWall = toWall; // ran into a wall (a short dash just stops moving there)
    boss.pos = kept;
    // A patch of fire every 8 px along the way.
    if (!lastFire || boss.pos.dist(lastFire) >= 8) {
      lastFire = boss.pos.clone();
      addFire(lastFire);
    }
  }, () => alive(boss, room) && !hitWall && !stopped);

  if (boss.exists()) boss.use(body());
  if (hitWall) {
    playSound("land");
    shakeScreen(4);
    puffDust(boss.pos.x, boss.pos.y, 10, 18);
  }
  return alive(boss, room);
}

// As soon as it's up: it stands still, its name appears, and it roars.
async function introduce(boss, room) {
  boss.play("idle");
  showBanner(room.bossName ?? boss.def.name, [255, 205, 70], TOP + 2 * TILE + 7); // just under the top wall, clear of its health bar
  await sleep(0.3);
  playSound("roar");
  shakeScreen(5);
  puffDust(boss.pos.x, boss.pos.y, 12, 24);
  await during(0.5, (t) => (boss.scale = vec2(1 + 0.12 * Math.sin((t / 0.5) * Math.PI))), () => alive(boss, room));
  if (boss.exists()) boss.scale = vec2(1);
  await sleep(0.4);
}

// Below half health: it roars, turns redder, walks faster, and its moves
// get stronger.
function enrage(boss) {
  boss.raging = true;
  boss.tint = rgb(255, 150, 150);
  boss.color = boss.tint;
  boss.speed *= 1.2;
  playSound("roar");
  shakeScreen(6);
  flashScreen([200, 30, 30], 0.25, 0.4);
  puffDust(boss.pos.x, boss.pos.y, 12, 24);
  showBanner("ENRAGED!", [230, 72, 46]);
}

// One patch of the fire trail. It's on the floor (z 6, under everyone), and
// hurts the hero if he steps in it (setupHurt in combat.js checks everything
// tagged "hazard").
function addFire(at) {
  const born = time();
  const seed = rand(0, 10);
  const fire = add([
    pos(at),
    z(6),
    "hazard",
    {
      touches: (player) => time() - born < FIRE_LIFE - 0.3
        && Math.abs(player.pos.x - at.x) < 8 && Math.abs(player.pos.y - at.y) < 5,
    },
  ]);

  fire.onUpdate(() => {
    if (time() - born > FIRE_LIFE) destroy(fire);
  });
  fire.onDraw(() => {
    const fade = Math.min(1, (FIRE_LIFE - (time() - born)) / 0.6); // fades out over its last 0.6 s
    drawRect({ pos: vec2(-5, -2), width: 10, height: 4, color: rgb(120, 30, 20), opacity: 0.7 * fade });
    // Three little flames that flicker up and down.
    [-3, 0, 3].forEach((x, i) => {
      const height = 3 + 2.5 * Math.abs(Math.sin(time() * 14 + seed + i * 2));
      drawRect({ pos: vec2(x - 1.5, -height), width: 3, height, color: rgb(247, 150, 23), opacity: 0.9 * fade });
      drawRect({ pos: vec2(x - 0.5, -height * 0.6), width: 1, height: height * 0.6, color: rgb(255, 220, 80), opacity: fade });
    });
  });
}

function ring(boss, room, turn) {
  playSound("vomit");
  shakeScreen(2);
  for (let i = 0; i < SHOTS; i++) {
    const angle = ((turn + (i * 360) / SHOTS) * Math.PI) / 180;
    const dir = vec2(Math.cos(angle), Math.sin(angle));
    addShot(boss.pos.add(dir.scale(14)), dir, { speed: SHOT_SPEED, look: "spit" });
  }
}
