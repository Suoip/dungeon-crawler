import { TILE, ROOM_COLS, TOP } from "./config.js";
import { playSound } from "./sound.js";

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

const LABEL_Y = 7;
const LABEL_ROOM = 60; // px above each door for its label (a door is 64 px wide)

// Adds 1 to 4 doors on the top wall and returns one object per door.
// `labels` has what's written above each door, like { text: "PLAY", color },
// or null for a door with no label (the way deeper in the dungeon).
export function addDoors(labels) {
  return doorColumns(labels.length).map((col, i) => {
    const x = col * TILE;
    const doorX = x + TILE; // the door itself starts one tile in

    // Draw order (z), back to front:
    //   0  the room's walls
    //   1  darkness behind the door, seen once it opens
    //   2  the knight while he walks into the doorway (see scenes.js)
    //   3  the door and its frame, so they overlap him as he goes in
    // The open door's middle is see-through, so without the darkness you'd see
    // the brick wall that's drawn behind it.
    add([rect(22, 24), pos(doorX + 7, TOP + 4), color(10, 8, 16), z(1)]);
    add([sprite("door_frame_left"), pos(x, TOP), z(3)]);
    add([sprite("door_frame_right"), pos(x + 3 * TILE, TOP), z(3)]);
    add([sprite("door_frame_top"), pos(doorX, TOP - TILE), z(3)]);
    const leaf = add([sprite("door_closed"), pos(doorX, TOP), z(3)]);

    const label = labels[i] && add([
      text(labels[i].text, { size: 8, font: "pixel" }),
      pos(doorX + TILE, LABEL_Y),
      anchor("center"),
      color(...labels[i].color),
      scale(1),
    ]);
    // How much the label can grow when highlighted without bumping into the
    // next door's label: a lot for a short word, a little for a long one.
    const maxScale = label
      ? Math.min(1.4, LABEL_ROOM / formatText({ text: labels[i].text, size: 8, font: "pixel" }).width)
      : 1;

    // An invisible strip of floor in front of the door. Standing on it means
    // "I'm at this door". It has an area but no body, so it never blocks you.
    const zone = add([
      pos(doorX + 4, TOP + 2 * TILE),
      area({ shape: new Rect(vec2(0), 2 * TILE - 8, 14) }),
    ]);

    return { leaf, label, maxScale, zone, centerX: doorX + TILE };
  });
}

// Makes a door's label grow and bob while it's the one you'd open, and puts
// it back to normal when it isn't. Called every frame.
export function highlightDoor(door, isActive) {
  if (!door.label) return;
  if (isActive) {
    const grow = 1 + (door.maxScale - 1) * (0.8 + 0.2 * Math.sin(time() * 8));
    door.label.scale = vec2(grow);
    door.label.pos.y = LABEL_Y - Math.abs(Math.sin(time() * 4)) * 2;
  } else {
    door.label.scale = vec2(1);
    door.label.pos.y = LABEL_Y;
  }
}

// Two chains crossed over a door in an X, with a padlock in the middle. The
// pack has no chains, so they're drawn from little squares: alternating light
// and dark links along each diagonal. z 4 puts them in front of the door.
export function chainDoor(door) {
  const left = door.centerX - TILE;
  const parts = [];
  for (const [fromX, toX] of [[left + 3, left + 29], [left + 29, left + 3]]) {
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const x = lerp(fromX, toX, t);
      const y = lerp(TOP + 5, TOP + 30, t);
      parts.push(add([rect(3, 3), pos(x - 1, y - 1), color(...(i % 2 ? [92, 88, 104] : [176, 172, 188])), opacity(1), z(4)]));
    }
  }
  const lock = [
    add([rect(6, 4), pos(door.centerX - 3, TOP + 12), color(130, 126, 140), opacity(1), z(4)]),   // shackle
    add([rect(4, 3), pos(door.centerX - 2, TOP + 13), color(24, 20, 37), opacity(1), z(4)]),      // inside the shackle
    add([rect(8, 7), pos(door.centerX - 4, TOP + 15), color(222, 168, 56), opacity(1), z(4)]),    // body
    add([rect(2, 3), pos(door.centerX - 1, TOP + 17), color(90, 60, 20), opacity(1), z(4)]),      // keyhole
  ];
  door.locked = true;
  door.chains = { parts, lock };
}

// The padlock pops open and the chains drop away.
export function unchainDoor(door) {
  if (!door.locked) return;
  door.locked = false;
  dropChains(door.chains);
}

function dropChains({ parts, lock }) {
  for (const piece of lock) {
    const start = piece.pos.clone();
    tween(0, 1, 0.3, (t) => {
      piece.pos = start.add(0, -6 * Math.sin(t * Math.PI) + 10 * t * t);
      piece.opacity = 1 - t;
    }).onEnd(() => destroy(piece));
  }
  for (const link of parts) {
    const start = link.pos.clone();
    wait(rand(0, 0.1), () => tween(0, 1, 0.35, (t) => {
      link.pos = start.add(0, 12 * t * t);
      link.opacity = 1 - t;
    }, easings.easeInQuad).onEnd(() => destroy(link)));
  }
}

// Turns a door into something the player can use (see interact.js).
export const doorInteraction = (door, prompt, use) => ({
  zone: door.zone,
  prompt,
  use,
  highlight: (isActive) => highlightDoor(door, isActive),
});

// Swings the door open, and its label (if it has one) does a little hop.
export function openDoor(door) {
  door.leaf.use(sprite("door_open"));
  playSound("door");
  if (!door.label) return;
  const hop = Math.min(1.8, door.maxScale + 0.3);
  tween(hop, 1, 0.35, (s) => (door.label.scale = vec2(s)), easings.easeOutBack);
  tween(0, 1, 0.35, (t) => (door.label.pos.y = LABEL_Y - 5 * Math.sin(t * Math.PI)));
}
