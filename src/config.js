// Numbers and settings shared by every other file.

export const TILE = 16;
export const ROOM_COLS = 20;
export const ROOM_ROWS = 12;

// Empty strip above the room. The door arches poke up into it, and the door
// labels sit there.
export const TOP = TILE;

export const GAME_WIDTH = ROOM_COLS * TILE;          // 320 px
export const GAME_HEIGHT = TOP + ROOM_ROWS * TILE;   // 208 px

// Above the game: a thin strip for hints and the clock. It's HTML, but sized
// in game pixels and scaled together with the game, so the whole picture
// (the "stage") always keeps its shape.
export const STRIP_HEIGHT = 12;
export const STAGE_HEIGHT = STRIP_HEIGHT + GAME_HEIGHT; // 220 px

export const BACKGROUND = [24, 20, 37];

export const PLAYER_SPEED = 80; // pixels per second

// How many rooms deep a run goes. The boss waits in the last one.
export const ROOMS = 10;
