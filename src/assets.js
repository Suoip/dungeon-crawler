import { TILE } from "./config.js";

// An "atlas" is one big image holding many sprites. We tell Kaplay where each
// sprite sits inside it (x, y, width, height). The numbers come from
// assets/tileset/tile_list_v1.7.
const tile = (x, y, width = TILE, height = TILE) => ({ x, y, width, height });

export function loadAssets() {
  loadFont("pixel", "assets/fonts/press-start-2p-latin-400-normal.woff2", {
    filter: "nearest", // keep the pixel font sharp instead of blurry
  });

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

    // The back wall of a pit, seen from above. Only the top part has bricks;
    // the rest is see-through so the darkness of the pit shows.
    edge_down: tile(96, 128),

    // 4 frames: holes in the floor, then the spikes sliding up.
    floor_spikes: {
      x: 16, y: 192, width: TILE * 4, height: TILE,
      sliceX: 4,
      anims: { up: { from: 0, to: 3, speed: 20 } },
    },

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

    // A door is 4 pieces: wall on each side, the arch on top, and the door itself.
    door_frame_left: tile(16, 240, 16, 32),
    door_frame_right: tile(64, 240, 16, 32),
    door_frame_top: tile(32, 224, 32, 16),
    door_closed: tile(32, 240, 32, 32),
    door_open: tile(80, 240, 32, 32),
  });
}
