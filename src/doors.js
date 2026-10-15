import { TILE, ROOM_COLS, TOP, LETTERS, LETTER_COLORS } from "./config.js";
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

// Adds 2 to 4 doors on the top wall and returns one object per door.
// `labels` is what's written above each door: the quiz rooms use the letters
// A-D in their colors; the title room uses words like "PLAY".
//   { hidden: true } keeps the labels invisible until revealLabels().
export function addDoors(labels, { hidden = false } = {}) {
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

    const label = add([
      text(labels[i].text, { size: 8, font: "pixel" }),
      pos(doorX + TILE, LABEL_Y),
      anchor("center"),
      color(...labels[i].color),
      scale(1),
      opacity(hidden ? 0 : 1),
    ]);
    // How much the label can grow when highlighted without bumping into the
    // next door's label: a lot for one letter, a little for a word.
    const labelWidth = formatText({ text: labels[i].text, size: 8, font: "pixel" }).width;
    const maxScale = Math.min(1.4, LABEL_ROOM / labelWidth);

    // An invisible strip of floor in front of the door. Standing on it means
    // "I'm at this door". It has an area but no body, so it never blocks you.
    const zone = add([
      pos(doorX + 4, TOP + 2 * TILE),
      area({ shape: new Rect(vec2(0), 2 * TILE - 8, 14) }),
    ]);

    return { index: i, leaf, label, maxScale, zone, centerX: doorX + TILE };
  });
}

// The quiz rooms' labels: A, B, C, D in their colors.
export const letterLabels = (count) =>
  LETTERS.slice(0, count).map((letter, i) => ({ text: letter, color: LETTER_COLORS[i] }));

// Pops the labels in one after another, left to right.
export function revealLabels(doors) {
  doors.forEach((door, i) => {
    wait(i * 0.08, () => {
      door.label.opacity = 1;
      playSound("letter");
      tween(2, 1, 0.25, (s) => (door.label.scale = vec2(s)), easings.easeOutBack);
    });
  });
}

// Makes a door's label grow and bob while it's the one you'd open, and puts
// it back to normal when it isn't. Called every frame.
export function highlightDoor(door, isActive) {
  if (isActive) {
    const grow = 1 + (door.maxScale - 1) * (0.8 + 0.2 * Math.sin(time() * 8));
    door.label.scale = vec2(grow);
    door.label.pos.y = LABEL_Y - Math.abs(Math.sin(time() * 4)) * 2;
  } else {
    door.label.scale = vec2(1);
    door.label.pos.y = LABEL_Y;
  }
}

// Turns a door into something the player can use (see interact.js).
export const doorInteraction = (door, prompt, use) => ({
  zone: door.zone,
  prompt,
  use,
  highlight: (isActive) => highlightDoor(door, isActive),
});

// Swings the door open, and its label does a little hop.
export function openDoor(door) {
  door.leaf.use(sprite("door_open"));
  playSound("door");
  const hop = Math.min(1.8, door.maxScale + 0.3);
  tween(hop, 1, 0.35, (s) => (door.label.scale = vec2(s)), easings.easeOutBack);
  tween(0, 1, 0.35, (t) => (door.label.pos.y = LABEL_Y - 5 * Math.sin(t * Math.PI)));
}
