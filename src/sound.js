import { getSetting } from "./settings.js";
import { startMusic, stopMusic, isMusicPlaying, setMusicGain } from "./music.js";

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
  crumble:  [0.7, 0.1, 70, 0.05, 0.4, 0.5, 4, 2, 0, 0, 0, 0, 0, 2, 0, 0.2],
  lever:    [0.0625, 0, 160, 0, 0.02, 0.08, 5, 0.3, 0, 0, -50, 0.03],
  poof:     [0.4, 0.05, 400, 0.02, 0.1, 0.3, 1, 1, 6, 0, 200, 0.05],

  // Combat
  swing:    [0.2, 0.05, 520, 0.01, 0.02, 0.1, 1, 1, -20],
  mobHit:   [0.35, 0.05, 180, 0, 0.02, 0.08, 0, 1, -6],
  crit:     [0.4, 0.05, 420, 0, 0.03, 0.15, 1, 1, -10, 0, 300, 0.03],       // a critical hit: a sharper, ringing hit
  mobDie:   [0.35, 0.1, 300, 0, 0.05, 0.2, 1, 1, -10, 0, 0, 0, 0, 0.5],
  spawn:    [0.3, 0.1, 60, 0.1, 0.2, 0.2, 0, 1, 2],
  hurt:     [0.5, 0.1, 220, 0, 0.05, 0.2, 2, 1, -12, 0, 0, 0, 0, 1],
  unlock:   [0.3, 0, 600, 0, 0.03, 0.15, 3, 1, 0, 0, -200, 0.04],
  locked:   [0.15, 0.2, 400, 0, 0.02, 0.06, 3, 1, 0, 0, 0, 0, 0.03],
  charge:   [0.4, 0.1, 90, 0.1, 0.3, 0.3, 2, 1, 3, 0, 0, 0, 0, 0.5],
  dash:     [0.25, 0.05, 300, 0.01, 0.03, 0.12, 4, 1, -5, 0, 0, 0, 0, 0.3],
  stamp:    [0.5, 0.05, 80, 0, 0.03, 0.15, 4, 1, -3, 0, 0, 0, 0, 1],             // a grave stamped flat: a dull thud
  heal:     [0.35, 0, 600, 0.01, 0.08, 0.25, 0, 1, 0, 0, 300, 0.07],
  snatch:   [0.25, 0.05, 900, 0, 0.02, 0.1, 1, 1, 6, 0, -300, 0.02],        // a thief scoops up coins: a quick, sly jingle
  burrow:   [0.3, 0.05, 140, 0.02, 0.05, 0.2, 4, 1, -2, 0, 0, 0, 0, 0.6],    // a thief dives into its burrow: a scrabble of dirt
  drumWarn: [0.6, 0.05, 55, 0.01, 0.1, 0.5, 0, 1, -1, 0, 0, 0, 0, 0.5],      // the war drums are coming: one deep boom
  drum:     [0.45, 0.05, 70, 0, 0.04, 0.2, 0, 1, -3, 0, 0, 0, 0, 0.3],       // a beat of the war drums
  plate:    [0.3, 0.05, 400, 0, 0.01, 0.04, 3, 1, 0, 0, 0, 0, 0, 0.3],       // a pressure plate clicks down
  arrow:    [0.3, 0.05, 900, 0, 0.02, 0.12, 0, 1, -40, 0, 0, 0, 0, 0.2],     // an arrow shoots from the wall: a twang
  shieldReady: [0.15, 0.02, 1200, 0.01, 0.03, 0.1, 1, 1, 0, 0, 400, 0.05], // the Shield is ready again: a soft ting
  waterRise: [0.25, 0.1, 120, 0.1, 0.2, 0.4, 0, 1, 0, 0, 0, 0, 0.05, 0.5, 0, 0.3], // the swamp's water creeps up a row: a low gurgle
  pactOffer: [0.3, 0.05, 220, 0.05, 0.2, 0.4, 0, 1, 0, 0, -60, 0.1, 0, 0.1, 6], // the pit offers its cards: a low, wavering hum
  pactTake: [0.35, 0.05, 160, 0.01, 0.1, 0.5, 2, 1, -2, 0, 0, 0, 0, 0.3],     // a pact is sealed: a deep, burning thud
  hammerRise: [0.2, 0.05, 180, 0.15, 0.2, 0.3, 0, 1, 4, 0, 0, 0, 0, 0.2],   // the hammer rises over him: a rising whoosh
  hammer:   [0.7, 0.05, 60, 0, 0.08, 0.4, 4, 1, -2, 0, 0, 0, 0, 1.2],      // it crashes down: a heavy, crunching thud
  zap:      [0.3, 0.1, 1400, 0, 0.02, 0.12, 3, 1, -30, 0, 0, 0, 0.02, 1, 0, 0.2], // chain lightning jumps: a sharp electric crack
  coin:     [0.2, 0.05, 1600, 0, 0.02, 0.12, 1, 1, 0, 0, 600, 0.03],         // a little jingle
  gem:      [0.2, 0.02, 2100, 0, 0.03, 0.2, 0, 1, 0, 0, 700, 0.04],          // a gem: a brighter, ringing chime
  orb:      [0.3, 0, 784, 0.01, 0.06, 0.25, 0, 1, 0, 0, 392, 0.06],          // a time orb: a bright two-note chime

  // The crypt
  smash:    [0.45, 0.1, 260, 0, 0.03, 0.18, 4, 1.5, -4, 0, 0, 0, 0, 0.7],    // a pot or crate breaking
  chomp:    [0.5, 0.05, 140, 0.01, 0.04, 0.12, 2, 1, -12, 0, 0, 0, 0.05, 0.4], // a mimic snapping open
  spikes:   [0.1, 0.05, 1100, 0, 0.01, 0.05, 3, 1, 0, 0, 0, 0, 0.02],       // the floor spikes coming up
  bone:     [0.22, 0.05, 260, 0, 0.02, 0.07, 1, 1, 0, 0, 140, 0.03],        // a bone picked up: a hollow clack

  // The goblin warrens
  fireball: [0.3, 0.1, 160, 0.02, 0.08, 0.2, 4, 1, 6, 0, 0, 0, 0, 0.4],     // an imp throws a fireball: a soft whoosh
  fuse:     [0.2, 0.05, 1200, 0.02, 0.5, 0.1, 4, 1, 0, 0, 0, 0, 0, 0.2],    // a wogol's fuse: a hiss
  boom:     [0.7, 0.1, 60, 0, 0.1, 0.5, 4, 1, -2, 0, 0, 0, 0, 1.5, 0, 0.1],  // a wogol going off

  // The orc fort
  block:    [0.3, 0.05, 700, 0, 0.02, 0.1, 3, 1, -20, 0, 0, 0, 0, 0.2],     // a hit on a masked orc's shield: a clank
  mend:     [0.25, 0, 330, 0.05, 0.15, 0.3, 0, 1, 0, 0, 165, 0.1],         // a shaman's healing pulse

  // The demon pit
  glass:    [0.35, 0.1, 1400, 0, 0.02, 0.15, 4, 1, 0, 0, 0, 0, 0.02, 0.3],    // a plague doctor's flask bursting

  // The boss's moves
  gurgle:   [0.35, 0.1, 110, 0.05, 0.3, 0.15, 2, 1, 0, 0, 0, 0, 0.05, 0.5, 15],
  vomit:    [0.4, 0.1, 200, 0, 0.05, 0.25, 4, 1, -8, 0, 0, 0, 0, 1],
  summon:   [0.3, 0, 200, 0.2, 0.2, 0.3, 1, 1, 4, 0, 0, 0, 0.08],
  roar:     [0.6, 0.1, 80, 0.1, 0.4, 0.4, 2, 1, -1, 0, 0, 0, 0, 0.8, 0, 0.1],

  // The run's clock
  tick:     [0.15, 0, 1400, 0, 0.005, 0.03, 0, 1],                         // a soft click, each of the last 5 seconds
  gong:     [0.5, 0, 98, 0.01, 0.2, 1.4, 0, 1, 0, 0, 0, 0, 0, 0, 1.5, 0, 0, 1, 0.3], // time's up: a low, ringing gong
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
  crumble: { lowpass: 1600, shelf: -10, shelfFrom: 2700 },
  // New combat sounds made from noisy or buzzy waves start out softened too.
  hurt:    { lowpass: 1800, shelf: -10, shelfFrom: 1200 },
  unlock:  { lowpass: 2500, shelf: -6, shelfFrom: 1800 },
  locked:  { lowpass: 2000, shelf: -6, shelfFrom: 1500 },
  charge:  { lowpass: 1500, shelf: -8, shelfFrom: 1000 },
  dash:    { lowpass: 1800, shelf: -6, shelfFrom: 1200 },
  gurgle:  { lowpass: 1500, shelf: -8, shelfFrom: 1000 },
  vomit:   { lowpass: 1600, shelf: -10, shelfFrom: 1200 },
  roar:    { lowpass: 1400, shelf: -8, shelfFrom: 900 },
  gong:    { lowpass: 1200, shelf: -6, shelfFrom: 800 },
  fireball: { lowpass: 1500, shelf: -8, shelfFrom: 1000 },
  fuse:    { lowpass: 2500, shelf: -8, shelfFrom: 1500 },
  boom:    { lowpass: 1200, shelf: -8, shelfFrom: 800 },
  block:   { lowpass: 2500, shelf: -8, shelfFrom: 1500 },
  glass:   { lowpass: 3000, shelf: -10, shelfFrom: 1800 },
  smash:   { lowpass: 1800, shelf: -10, shelfFrom: 1200 },
  spikes:  { lowpass: 2000, shelf: -6, shelfFrom: 1500 },
  chomp:   { lowpass: 1600, shelf: -8, shelfFrom: 1000 },
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

    shelfFilter.connect(lowpassFilter).connect(effectsOutput());
    eqInputs[name] = shelfFilter;
  }
  return eqInputs[name];
}

// Volume levels go from 0 (off) to 10, and 5 is the mix as designed. Ears
// hear loudness on a curve, not in a straight line, so the level is raised
// to a power: each step then sounds about the same size. 10 is about 2.8x
// as loud as 5.
export const VOLUME_STEPS = 10;
export const volumeGain = (level) => (level / 5) ** 1.5;

// All sound effects play through one volume control, and then a limiter: at
// high volumes, the loudest moments are turned down a little instead of
// distorting.
let effects = null;
function effectsOutput() {
  if (!effects) {
    const limiter = zzfxX.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 3;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.1;
    limiter.connect(zzfxX.destination);
    effects = zzfxX.createGain();
    effects.gain.value = volumeGain(getSetting("sound"));
    effects.connect(limiter);
  }
  return effects;
}

export function setEffectsVolume(level) {
  effectsOutput().gain.value = volumeGain(level);
}

export function playSound(name) {
  if (!getSetting("sound") || !SOUNDS[name]) return;
  const source = zzfx(...SOUNDS[name]);
  // zzfx() connects the sound straight to the speakers. It hasn't actually
  // started yet (audio runs a moment later), so we can re-route it: through
  // its EQ if it has one, and the effects volume either way.
  source.disconnect();
  source.connect(EQ[name] ? eqInput(name) : effectsOutput());
}

// Browsers keep sound switched off until the player clicks, taps or presses a
// key, so nothing plays by surprise. On that first press we switch it on and
// start the music.
export function unlockAudioOnFirstInput() {
  const unlock = () => {
    zzfxX.resume();
    if (getSetting("music")) startMusic(zzfxX, volumeGain(getSetting("music")));
    window.removeEventListener("keydown", unlock, true);
    window.removeEventListener("pointerdown", unlock, true);
  };
  // `true` = listen in the capture phase, so we hear the key even though
  // Kaplay's canvas handles it.
  window.addEventListener("keydown", unlock, true);
  window.addEventListener("pointerdown", unlock, true);
}

// Changes the music's volume while it plays: 0 stops it, and turning it up
// from 0 starts it again.
export function setMusicVolume(level) {
  if (level === 0) stopMusic();
  else if (!isMusicPlaying()) startMusic(zzfxX, volumeGain(level));
  else setMusicGain(volumeGain(level));
}
