import { TILE, ROOM_COLS, TOP, LETTERS, LETTER_COLORS } from "./config.js";

const DOOR_COLS = 4; // each door is 4 tiles wide: wall, door (2 tiles), wall

// Works out which column each door starts at, spreading them evenly along the
// top wall. The walkable width is columns 1 to 18 (columns 0 and 19 are the
// side walls). Spare columns become gaps; leftovers go to the outer gaps first
// so the doors stay centered.
function doorColumns(count) {
  const inner = ROOM_COLS - 2;
  const spare = inner - count * DOOR_COLS;
  const gaps = Array(count + 1).fill(Math.floor(spare / (count + 1)));
  let leftover = spare - gaps[0] * (count + 1);
  // An odd leftover goes to the middle gap (if there is one) to stay symmetric.
  if (leftover % 2 === 1 && count % 2 === 0) {
    gaps[count / 2]++;
    leftover--;
  }
  for (let i = 0; leftover > 0; i++, leftover--) {
    // 0, last, 1, second to last, ... so it stays symmetric
    gaps[i % 2 === 0 ? i / 2 : count - (i - 1) / 2]++;
  }

  const columns = [];
  let col = 1 + gaps[0];
  for (let i = 0; i < count; i++) {
    columns.push(col);
    col += DOOR_COLS + gaps[i + 1];
  }
  return columns;
}

// Adds `count` doors (2 to 4) on the top wall and returns one object per door.
export function addDoors(count) {
  return doorColumns(count).map((col, i) => {
    const x = col * TILE;
    const doorX = x + TILE; // the door itself starts one tile in

    add([sprite("door_frame_left"), pos(x, TOP)]);
    add([sprite("door_frame_right"), pos(x + 3 * TILE, TOP)]);
    add([sprite("door_frame_top"), pos(doorX, TOP - TILE)]);
    const leaf = add([sprite("door_closed"), pos(doorX, TOP)]);

    const label = add([
      text(LETTERS[i], { size: 8, font: "pixel" }),
      pos(doorX + TILE, 7),
      anchor("center"),
      color(...LETTER_COLORS[i]),
      scale(1),
    ]);

    // An invisible strip of floor in front of the door. Standing on it means
    // "I'm at this door". It has an area but no body, so it never blocks you.
    const zone = add([
      pos(doorX + 4, TOP + 2 * TILE),
      area({ shape: new Rect(vec2(0), 2 * TILE - 8, 14) }),
    ]);

    return { index: i, letter: LETTERS[i], leaf, label, zone, centerX: doorX + TILE };
  });
}

// The door the player is standing at, or null.
export function doorAt(player, doors) {
  return doors.find((door) => player.isColliding(door.zone)) ?? null;
}

// Makes the active door's letter grow and bob so you can tell which one you'll
// open. The others go back to normal.
export function highlightDoor(doors, active) {
  for (const door of doors) {
    if (door === active) {
      const pulse = 1.4 + 0.15 * Math.sin(time() * 8);
      door.label.scale = vec2(pulse);
      door.label.pos.y = 7 - Math.abs(Math.sin(time() * 4)) * 2;
    } else {
      door.label.scale = vec2(1);
      door.label.pos.y = 7;
    }
  }
}

export function openDoor(door) {
  door.leaf.use(sprite("door_open"));
}
