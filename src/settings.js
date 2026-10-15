// Player settings that are remembered between visits, saved in the browser's
// localStorage. Reading or writing it can fail (private windows, blocked site
// data), so every access is wrapped in try/catch and the game falls back to
// the defaults.

const KEY = "dungeon-crawler-settings";

const DEFAULTS = {
  sound: true,
  music: true,
  shake: true,         // screen shake (some players get dizzy from it)
  hero: "knight_m",
};

let settings = { ...DEFAULTS };
try {
  settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
} catch {
  // Nothing saved, or storage isn't available: keep the defaults.
}

export const getSetting = (name) => settings[name];

export function setSetting(name, value) {
  settings[name] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Can't save. The setting still works until the page is closed.
  }
}
