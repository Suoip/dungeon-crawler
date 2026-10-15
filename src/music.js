// Background music: a small chiptune loop composed in code and played with
// the browser's Web Audio API. 16 bars in A minor at 85 BPM: a bass line, a
// quiet arpeggio, a melody in the first half, and soft hi-hats, with an echo
// so it sounds like it's bouncing off dungeon walls.

const BPM = 85;
const STEP = 60 / BPM / 2; // one eighth note, in seconds

// Note name -> frequency. "A4" is 440 Hz; each semitone up multiplies the
// frequency by 2^(1/12), so 12 semitones (an octave) doubles it.
const SEMITONES = { C: -9, "C#": -8, D: -7, "D#": -6, E: -5, F: -4, "F#": -3, G: -2, "G#": -1, A: 0, "A#": 1, B: 2 };
function frequency(note) {
  const [, name, octave] = note.match(/^([A-G]#?)(\d)$/);
  return 440 * 2 ** ((SEMITONES[name] + (octave - 4) * 12) / 12);
}

// Each chord lasts 2 bars: Am, F, Dm, E (a classic minor-key progression).
// The first note is the bass; the rest are the arpeggio.
const CHORDS = [
  ["A2", ["A3", "C4", "E4"]], ["F2", ["F3", "A3", "C4"]],
  ["D2", ["D3", "F3", "A3"]], ["E2", ["E3", "G#3", "B3"]],
];

// The melody, one entry per eighth note ("." = rest), 8 bars.
const MELODY = [
  "E5 . . D5 C5 . B4 .", "A4 . . . . . . .",
  "C5 . . A4 F4 . A4 .", "C5 . . . . . . .",
  "D5 . . E5 F5 . E5 D5", "A4 . . . . . . .",
  "B4 . . C5 D5 . E5 .", "G#4 . . . E4 . . .",
].join(" ").split(" ");

let ctx = null;
let output = null;  // everything plays into this, so stopping = disconnecting it
let echo = null;
let timer = null;
let step = 0;
let nextTime = 0;

function tone(time, hz, length, type, volume) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.01);        // quick fade in
  gain.gain.exponentialRampToValueAtTime(0.001, time + length);  // then fade out
  osc.connect(gain);
  gain.connect(output);
  gain.connect(echo);
  osc.start(time);
  osc.stop(time + length + 0.05);
}

function hiHat(time, volume) {
  const seconds = 0.05;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  filter.type = "highpass";
  filter.frequency.value = 6000;
  gain.gain.value = volume;
  noise.buffer = buffer;
  noise.connect(filter).connect(gain).connect(output);
  noise.start(time);
}

// Everything that happens on one eighth-note step of the 16-bar loop.
function playStep(s, time) {
  const bar = Math.floor(s / 8) % 16;
  const beat = s % 8;
  const [bass, chord] = CHORDS[Math.floor(bar / 2) % 4];

  if (beat === 0 || beat === 4) tone(time, frequency(bass), STEP * 3.5, "triangle", 0.5);
  if (beat === 7) tone(time, frequency(bass) * 2, STEP * 0.9, "triangle", 0.25);

  const arpeggio = [0, 1, 2, 1, 0, 1, 2, 1];
  tone(time, frequency(chord[arpeggio[beat]]) * 2, STEP * 0.8, "square", 0.035);

  const note = bar < 8 ? MELODY[bar * 8 + beat] : "."; // the second half is calmer
  if (note !== ".") tone(time, frequency(note), STEP * 2.5, "triangle", 0.22);

  if (beat % 2 === 1) hiHat(time, 0.04);
}

// Notes are queued a little ahead of time on the audio clock, which is much
// more precise than setInterval. setInterval just keeps the queue topped up.
function schedule() {
  while (nextTime < ctx.currentTime + 0.15) {
    playStep(step++, nextTime);
    nextTime += STEP;
  }
}

export function startMusic(audioContext) {
  if (timer) return; // already playing
  ctx = audioContext;

  output = ctx.createGain();
  output.gain.value = 0.09; // the music's overall volume (was 0.3)
  output.connect(ctx.destination);

  // Echo: a delayed copy of the sound, fed back into itself so each repeat
  // is quieter than the last.
  echo = ctx.createDelay();
  echo.delayTime.value = STEP * 1.5;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.3;
  const wet = ctx.createGain();
  wet.gain.value = 0.25;
  echo.connect(feedback).connect(echo);
  echo.connect(wet).connect(output);

  step = 0;
  nextTime = ctx.currentTime + 0.05;
  timer = setInterval(schedule, 25);
}

export function stopMusic() {
  clearInterval(timer);
  timer = null;
  output?.disconnect();
}
