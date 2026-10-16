// Numbers and settings shared by every other file.

export const TILE = 16;
export const ROOM_COLS = 20;
export const ROOM_ROWS = 12;

// Empty strip above the room. The door arches poke up into it, and the door
// letters sit there.
export const TOP = TILE;

export const GAME_WIDTH = ROOM_COLS * TILE;          // 320 px
export const GAME_HEIGHT = TOP + ROOM_ROWS * TILE;   // 208 px

// Above the game: the question scroll, and a thin strip under it for hints
// and the clock. They're HTML, but sized in game pixels and scaled together
// with the game, so the whole picture (the "stage") always keeps its shape.
export const SCROLL_HEIGHT = 56;
export const STRIP_HEIGHT = 12;
export const STAGE_HEIGHT = SCROLL_HEIGHT + STRIP_HEIGHT + GAME_HEIGHT; // 276 px

export const BACKGROUND = [24, 20, 37];

export const PLAYER_SPEED = 80; // pixels per second

// Door letters and their colors. The scroll above the game uses the same colors,
// so door A and answer A always match.
export const LETTERS = ["A", "B", "C", "D"];
export const LETTER_COLORS = [
  [230, 72, 46],   // A red
  [77, 155, 230],  // B blue
  [99, 199, 77],   // C green
  [255, 205, 70],  // D yellow
];

export const DUNGEON_URL = "data/dungeons/math-test.json";
