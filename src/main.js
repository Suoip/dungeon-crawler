// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// The art is tiny (16x16 tiles), so the game runs at a small "virtual"
// resolution and Kaplay scales it up to fill the window.
const TILE = 16;
const ROOM_COLS = 20;
const ROOM_ROWS = 12;

kaplay({
  width: ROOM_COLS * TILE,   // 320 px
  height: ROOM_ROWS * TILE,  // 192 px
  stretch: true,             // scale up to fill the window...
  letterbox: true,           // ...but keep the shape (black bars if needed)
  crisp: true,               // no smoothing, so pixels stay sharp
  background: [24, 20, 37],
});

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------

// An "atlas" is one big image holding many sprites. We tell Kaplay where each
// sprite sits inside it (x, y, width, height). The numbers come from
// assets/tileset/tile_list_v1.7.
const tile = (x, y) => ({ x, y, width: TILE, height: TILE });

loadSpriteAtlas("assets/tileset/0x72_DungeonTilesetII_v1.7.png", {
  // The knight has 9 frames side by side: 4 idle, 4 run, 1 hit.
  // sliceX cuts the strip into those 9 frames, and anims names the ranges.
  knight: {
    x: 128, y: 100, width: 16 * 9, height: 28,
    sliceX: 9,
    anims: {
      idle: { from: 0, to: 3, speed: 8, loop: true },
      run: { from: 4, to: 7, speed: 12, loop: true },
      hit: 8,
    },
  },

  floor_1: tile(16, 64), floor_2: tile(32, 64), floor_3: tile(48, 64),
  floor_4: tile(16, 80), floor_5: tile(32, 80), floor_6: tile(48, 80),
  floor_7: tile(16, 96), floor_8: tile(32, 96),

  wall_top_mid: tile(32, 0),
  wall_mid: tile(32, 16),
  wall_edge_top_left: tile(31, 120),
  wall_edge_top_right: tile(48, 120),
  wall_edge_left: tile(32, 136),
  wall_edge_right: tile(48, 136),
  wall_edge_mid_left: tile(32, 152),
  wall_edge_mid_right: tile(48, 152),
  wall_edge_bottom_left: tile(32, 168),
  wall_edge_bottom_right: tile(48, 168),
});

// ---------------------------------------------------------------------------
// Room
// ---------------------------------------------------------------------------

// Draws one tile at a grid position (column, row).
function placeTile(name, col, row) {
  add([sprite(name), pos(col * TILE, row * TILE)]);
}

// Picks the wall piece for a grid position. The room is drawn like this:
//   row 0      ┌───────┐   top of the wall (thin cap)
//   row 1      │▓▓▓▓▓▓▓│   brick face of the wall
//   rows 2..   │       │   side walls are thin strips over the floor
//   last row   └───────┘   bottom wall is a thin strip too
function wallTileAt(col, row) {
  const last = { col: ROOM_COLS - 1, row: ROOM_ROWS - 1 };
  const side = col === 0 ? "left" : col === last.col ? "right" : null;

  if (row === 0) return side ? `wall_edge_top_${side}` : "wall_top_mid";
  if (row === 1) return side ? `wall_edge_${side}` : "wall_mid";
  if (row === last.row) return side ? `wall_edge_bottom_${side}` : "wall_top_mid";
  if (side) return `wall_edge_mid_${side}`;
  return null; // plain floor, no wall
}

// Mostly plain floor, with a cracked or dirty tile now and then for variety.
function randomFloor() {
  return chance(0.85) ? "floor_1" : choose([
    "floor_2", "floor_3", "floor_4", "floor_5", "floor_6", "floor_7", "floor_8",
  ]);
}

// An invisible box the player can't walk through. The walls you see are only
// pictures; these boxes are what actually block movement.
function addSolid(x, y, w, h) {
  add([
    pos(x, y),
    area({ shape: new Rect(vec2(0), w, h) }),
    body({ isStatic: true }),
  ]);
}

function buildRoom() {
  const W = ROOM_COLS * TILE;
  const H = ROOM_ROWS * TILE;

  for (let row = 0; row < ROOM_ROWS; row++) {
    for (let col = 0; col < ROOM_COLS; col++) {
      // Floor goes everywhere except the top two wall rows, because the side
      // and bottom wall strips are see-through and the floor shows behind them.
      if (row >= 2) placeTile(randomFloor(), col, row);

      const wall = wallTileAt(col, row);
      if (wall) placeTile(wall, col, row);
    }
  }

  // The colliders line up with the visible wall edges. The top one covers the
  // whole brick face, so the knight's head can overlap the wall while his feet
  // stop at its base. That overlap is what makes the room look 3D.
  addSolid(0, 0, W, 2 * TILE);    // top wall
  addSolid(0, 0, 5, H);           // left wall strip (5 px wide)
  addSolid(W - 5, 0, 5, H);       // right wall strip
  addSolid(0, H - 4, W, 4);       // bottom wall strip (4 px tall)
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------

const PLAYER_SPEED = 80; // pixels per second, so about 4 seconds to cross the room

function addPlayer(x, y) {
  return add([
    sprite("knight", { anim: "idle" }),
    pos(x, y),
    anchor("bot"), // pos is the point between his feet, not his top-left corner
    // Only his feet collide (10x6 px), not his whole 16x28 body. That's what
    // lets him walk "in front of" the wall instead of stopping at his head.
    area({ shape: new Rect(vec2(0), 10, 6) }),
    body(),
    "player",
  ]);
}

// True if any of the given keys is being held down.
const held = (...keys) => keys.some((k) => isKeyDown(k));

function setupPlayerMovement(player) {
  // onUpdate runs every frame (about 60 times a second).
  player.onUpdate(() => {
    const dir = vec2(0, 0);
    if (held("a", "left")) dir.x -= 1;
    if (held("d", "right")) dir.x += 1;
    if (held("w", "up")) dir.y -= 1;
    if (held("s", "down")) dir.y += 1;

    if (dir.len() > 0) {
      // unit() makes diagonal movement the same speed as straight movement.
      // Without it, moving diagonally would be about 41% faster.
      player.move(dir.unit().scale(PLAYER_SPEED));
      if (dir.x !== 0) player.flipX = dir.x < 0; // face the way he's walking
      if (player.getCurAnim().name !== "run") player.play("run");
    } else if (player.getCurAnim().name !== "idle") {
      player.play("idle");
    }
  });
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

// A scene is one "screen" of the game. For now there's just one room, but
// later we'll add a title screen, character select, game over and so on.
scene("room", () => {
  buildRoom();
  const player = addPlayer(width() / 2, height() / 2 + 20);
  setupPlayerMovement(player);
});

go("room");
