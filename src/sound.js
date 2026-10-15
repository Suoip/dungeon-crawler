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
  // Half the volume of the original step, and an 8 ms fade-in so it doesn't
  // start with a sharp click.
  step:     [0.12, 0.2, 90, 0.008, 0, 0.04, 4, 1, 0, 0, 0, 0, 0, 0.5],
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

// An equalizer (EQ) for some sounds: it changes their tone without changing
// the sound itself. The noisy sounds had harsh high frequencies that scratch
// the ear, so each of these goes through two of the browser's audio filters:
//   a high-shelf: turns everything above `shelfFrom` Hz down by `shelf` dB
//   a low-pass:   cuts everything above `lowpass` Hz
// Sounds not listed here play as they are. The values were picked by ear on
// an equalizer test page.
const EQ = {
  step:    { lowpass: 670, shelf: -2, shelfFrom: 500 },
  climb:   { lowpass: 670, shelf: -2, shelfFrom: 500 },  // same as the footsteps
  door:    { lowpass: 1800, shelf: -13, shelfFrom: 1150 },
  fall:    { lowpass: 2000, shelf: -3, shelfFrom: 7000 },
  crack:   { lowpass: 1600, shelf: -10, shelfFrom: 2700 },
  crumble: { lowpass: 1600, shelf: -10, shelfFrom: 2700 },
};

// Each sound's filters are built once, the first time it plays, and reused.
const eqInputs = {};
function eqInput(name) {
  if (!eqInputs[name]) {
    const { lowpass, shelf, shelfFrom } = EQ[name];
    const shelfFilter = zzfxX.createBiquadFilter();
    shelfFilter.type = "highshelf";
    shelfFilter.frequency.value = shelfFrom;
    shelfFilter.gain.value = shelf;

    const lowpassFilter = zzfxX.createBiquadFilter();
    lowpassFilter.type = "lowpass";
    lowpassFilter.frequency.value = lowpass;
    // The smoothest curve, with no boost at the cutoff, is a "Q" of 0.707.
    // The browser measures a low-pass filter's Q in decibels, so that's
    // 20 * log10(0.707) = -3.01 dB. (ZzFX's own filter uses Q 2, which adds a
    // small peak at the cutoff.)
    lowpassFilter.Q.value = -3.01;

    shelfFilter.connect(lowpassFilter).connect(zzfxX.destination);
    eqInputs[name] = shelfFilter;
  }
  return eqInputs[name];
}

export function playSound(name) {
  if (!getSetting("sound") || !SOUNDS[name]) return;
  const source = zzfx(...SOUNDS[name]);
  if (EQ[name]) {
    // zzfx() connects the sound straight to the speakers. It hasn't actually
    // started yet (audio runs a moment later), so we can re-route it through
    // its EQ first.
    source.disconnect();
    source.connect(eqInput(name));
  }
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
