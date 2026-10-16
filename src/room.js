import { TILE, ROOM_COLS, ROOM_ROWS, TOP, GAME_WIDTH, GAME_HEIGHT } from "./config.js";

// Draws one tile at a grid position (column, row) and returns it. Extra
// components (like z for draw order) can be passed in too.
function placeTile(name, col, row, ...extra) {
  return add([sprite(name), pos(col * TILE, TOP + row * TILE), ...extra]);
}

// The grid square (column, row) that a point in the room is in.
export const tileAt = (x, y) => ({ col: Math.floor(x / TILE), row: Math.floor((y - TOP) / TILE) });

// Picks the wall piece for a grid position. The room is drawn like this:
//   row 0      ┌───────┐   top of the wall (thin cap)
//   row 1      │▓▓▓▓▓▓▓│   brick face of the wall (doors go here)
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

// How far something can go before its feet touch a wall. `feet` is the size
// of the box at its feet ([width, height] px, anchored at the bottom middle).
// The walls are 5 px thick at the sides, 4 px at the bottom, and 2 tiles
// (the brick face) at the top.
export function roomLimits([width, height]) {
  return {
    left: 5 + width / 2,
    right: GAME_WIDTH - 5 - width / 2,
    top: TOP + 2 * TILE + height,
    bottom: GAME_HEIGHT - 4,
  };
}

// Puts something back inside the walls if it moved past them. It's called
// after every move. The walls are solid, but the physics engine only pushes
// things out of a wall after they've moved into it, and something fast on a
// slow frame (a dash, a knockback) can move far enough to be pushed out the
// wrong side, out of the room. This way nothing ever gets that far.
export function keepInRoom(obj, feet) {
  const limits = roomLimits(feet);
  const x = clamp(obj.pos.x, limits.left, limits.right);
  const y = clamp(obj.pos.y, limits.top, limits.bottom);
  if (x !== obj.pos.x || y !== obj.pos.y) obj.pos = vec2(x, y);
}

// Builds the room and returns its floor tiles, so a trap can crack some of
// them later. Look one up with floor.get(`${col},${row}`).
export function buildRoom() {
  const floor = new Map();

  for (let row = 0; row < ROOM_ROWS; row++) {
    for (let col = 0; col < ROOM_COLS; col++) {
      // Floor goes everywhere except the top two wall rows, because the side
      // and bottom wall strips are see-through and the floor shows behind them.
      if (row >= 2) floor.set(`${col},${row}`, placeTile(randomFloor(), col, row));

      const wall = wallTileAt(col, row);
      if (wall) placeTile(wall, col, row);
    }
  }

  // The colliders' inner edges line up with the visible wall edges. The top
  // one covers the whole brick face, so the knight's head can overlap the
  // wall while his feet stop at its base. That overlap is what makes the
  // room look 3D.
  //
  // They also reach far outside the screen (THICK px). Something fast (a
  // dash, a big knockback) can move several px in one frame, deep into a
  // wall. The physics engine then pushes it out the shortest way, and with a
  // wall only 5 px thick that could be out the far side, out of the room.
  // With thick walls, the shortest way out is always back into the room.
  const THICK = 64;
  addSolid(-THICK, TOP - THICK, GAME_WIDTH + 2 * THICK, 2 * TILE + THICK);   // top wall
  addSolid(-THICK, TOP - THICK, THICK + 5, GAME_HEIGHT - TOP + 2 * THICK);  // left wall (5 px on screen)
  addSolid(GAME_WIDTH - 5, TOP - THICK, THICK + 5, GAME_HEIGHT - TOP + 2 * THICK); // right wall
  addSolid(-THICK, GAME_HEIGHT - 4, GAME_WIDTH + 2 * THICK, THICK + 4);     // bottom wall (4 px on screen)

  return floor;
}
