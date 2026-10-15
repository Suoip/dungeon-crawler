import { getSetting } from "./settings.js";
import { startMusic, stopMusic } from "./music.js";

// Sound effects are made by ZzFX (lib/zzfx.js), which builds each sound from a
// list of numbers instead of playing a recorded file. The numbers are, in
// order: volume, randomness, frequency, attack, sustain, release, shape
// (0 sine, 1 triangle, 2 saw, 3 tan, 4 noise), shape curve, slide, delta
// slide, pitch jump, pitch jump time, repeat time, noise, modulation,
// bit crush, delay, sustain volume, decay, tremolo, filter.
// To design new ones, the ZzFX website has a sound designer:
// https://killedbyapixel.github.io/ZzFX/
const SOUNDS = {
  step:     [0.25, 0.2, 90, 0, 0, 0.04, 4, 1, 0, 0, 0, 0, 0, 0.5],
  climb:    [0.3, 0.2, 160, 0, 0, 0.04, 4, 1, 0, 0, 0, 0, 0, 0.3],
  door:     [0.5, 0.05, 120, 0.05, 0.25, 0.2, 2, 1, -1, 0, 0, 0, 0, 0, 25],
  fall:     [0.3, 0.1, 500, 0.15, 0.25, 0.1, 4, 1, -8, 0, 0, 0, 0, 1],
  land:     [0.8, 0.05, 70, 0, 0.03, 0.18, 0, 2, -4, 0, 0, 0, 0, 0.6],
  correct:  [0.5, 0, 523, 0, 0.08, 0.3, 1, 1, 0, 0, 262, 0.09],
  letter:   [0.15, 0, 880, 0, 0.02, 0.05, 1, 1, 30],
  crack:    [0.7, 0.2, 260, 0, 0.03, 0.2, 4, 1, 0, 0, 0, 0, 0, 1.5, 0, 0.1],
  crumble:  [0.7, 0.1, 70, 0.05, 0.4, 0.5, 4, 2, 0, 0, 0, 0, 0, 2, 0, 0.2],
  spikes:   [0.5, 0.05, 1400, 0, 0.04, 0.15, 3, 1, 20, 0, 0, 0, 0, 0, 0, 0, 0.04],
  hit:      [0.6, 0.1, 220, 0, 0.05, 0.2, 2, 1, -12, 0, 0, 0, 0, 1],
  lever:    [0.5, 0, 160, 0, 0.02, 0.08, 5, 0.3, 0, 0, -50, 0.03],
  poof:     [0.4, 0.05, 400, 0.02, 0.1, 0.3, 1, 1, 6, 0, 200, 0.05],
};

export function playSound(name) {
  if (!getSetting("sound") || !SOUNDS[name]) return;
  zzfx(...SOUNDS[name]);
}

// Browsers keep sound switched off until the player clicks, taps or presses a
// key, so nothing plays by surprise. On that first press we switch it on and
// start the music.
export function unlockAudioOnFirstInput() {
  const unlock = () => {
    zzfxX.resume();
    if (getSetting("music")) startMusic(zzfxX);
    window.removeEventListener("keydown", unlock, true);
    window.removeEventListener("pointerdown", unlock, true);
  };
  // `true` = listen in the capture phase, so we hear the key even though
  // Kaplay's canvas handles it.
  window.addEventListener("keydown", unlock, true);
  window.addEventListener("pointerdown", unlock, true);
}

export function setMusicPlaying(on) {
  if (on) startMusic(zzfxX);
  else stopMusic();
}
