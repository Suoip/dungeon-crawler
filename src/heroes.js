// Every hero in the tileset. They all use the same layout in the sprite
// sheet: 9 frames in a row starting at x = 128 (4 idle, 4 run, 1 hit), so
// only the row (y) is different.
// (The pack spells wizard "wizzard"; we keep its spelling for the ids.)
export const HEROES = [
  { id: "knight_m", name: "Knight", y: 100 },
  { id: "knight_f", name: "Knight", y: 68 },
  { id: "elf_m", name: "Elf", y: 36 },
  { id: "elf_f", name: "Elf", y: 4 },
  { id: "wizzard_m", name: "Wizard", y: 164 },
  { id: "wizzard_f", name: "Wizard", y: 132 },
  { id: "lizard_m", name: "Lizard", y: 228 },
  { id: "lizard_f", name: "Lizard", y: 196 },
  { id: "dwarf_m", name: "Dwarf", y: 292 },
  { id: "dwarf_f", name: "Dwarf", y: 260 },
];

export const heroById = (id) => HEROES.find((hero) => hero.id === id) ?? HEROES[0];

// The atlas entries for loadSpriteAtlas, one per hero.
export function heroSprites() {
  return Object.fromEntries(HEROES.map((hero) => [hero.id, {
    x: 128, y: hero.y, width: 16 * 9, height: 28,
    sliceX: 9,
    anims: {
      idle: { from: 0, to: 3, speed: 8, loop: true },
      run: { from: 4, to: 7, speed: 12, loop: true },
      hit: 8,
    },
  }]));
}
