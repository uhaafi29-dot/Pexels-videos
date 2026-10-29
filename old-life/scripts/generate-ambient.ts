// Original sound design for the film (public/ambient.wav), generated from the
// same story code as the picture so every cue lands on its frame:
//  - music: a slow pad, warm (major) in the light, cool (minor) at night
//  - room tone: morning air + distant birds; night hum + a soft clock tick
//  - footsteps from the figure's actual walk cycle
//  - phone notification, phone set down, curtains drawn, soft swells on cuts
// Run: npm run audio
import {writeFileSync} from 'node:fs';
import {figureAt, sceneAt, worldAt} from '../src/story';
import {DURATION_IN_FRAMES, FPS, SCENES, s} from '../src/timeline';

const RATE = 48000;
const N = Math.ceil((DURATION_IN_FRAMES / FPS) * RATE);
const L = new Float32Array(N);
const R = new Float32Array(N);
let seed = 777;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const add = (i: number, l: number, r = l) => {
  if (i >= 0 && i < N) {
    L[i] += l;
    R[i] += r;
  }
};

// Per-sample "warmth" (0 = night, 1 = light), following the film.
const warmthAtSample = (i: number) => {
  const f = Math.floor((i / RATE) * FPS);
  const sc = sceneAt(f);
  if (sc === 'hook') return 1;
  if (sc === 'payoff') return 1;
  if (sc === 'science' && figureAt(f).room === 'hotel') return 0.7;
  return worldAt(f).dawn;
};
const warmth = new Float32Array(Math.ceil(N / 480) + 1);
for (let k = 0; k < warmth.length; k++) warmth[k] = warmthAtSample(k * 480);
// smooth so changes glide rather than jump
for (let pass = 0; pass < 3; pass++) for (let k = 1; k < warmth.length; k++) warmth[k] = warmth[k - 1] + (warmth[k] - warmth[k - 1]) * 0.08;
const W = (i: number) => warmth[Math.min(warmth.length - 1, Math.floor(i / 480))];

// --- music pad --------------------------------------------------------------------------------
const warmChord = [130.81, 196.0, 261.63, 329.63, 392.0, 493.88]; // Cmaj9 colour
const coolChord = [110.0, 164.81, 220.0, 261.63, 329.63, 392.0]; // Am(add9) colour
for (let k = 0; k < warmChord.length; k++) {
  for (const det of [-0.2, 0.23]) {
    let pw = rand() * 6.28;
    let pc = rand() * 6.28;
    const pan = 0.5 + det * 1.6;
    for (let i = 0; i < N; i++) {
      const t = i / RATE;
      const w = W(i);
      const lfo = 0.55 + 0.45 * Math.sin(2 * Math.PI * (0.04 + k * 0.009) * t + k * 1.3);
      pw += (2 * Math.PI * (warmChord[k] + det)) / RATE;
      pc += (2 * Math.PI * (coolChord[k] + det)) / RATE;
      const amp = (0.026 / (1 + k * 0.4)) * lfo;
      const v = (Math.sin(pw) * w + Math.sin(pc) * (1 - w)) * amp;
      add(i, v * (1 - pan) * 2, v * pan * 2);
    }
  }
}

// --- room tone ----------------------------------------------------------------------------------
{
  let a = 0;
  let b = 0;
  for (let i = 0; i < N; i++) {
    const w = W(i);
    a += 0.03 * (rand() * 2 - 1 - a);
    b += 0.03 * (rand() * 2 - 1 - b);
    const hum = Math.sin((2 * Math.PI * 60 * i) / RATE) * 0.004 * (1 - w);
    add(i, a * 0.05 + hum, b * 0.05 + hum);
  }
}
// distant birds in the morning light
for (let t = 0.6; t < N / RATE; t += 0.35 + rand() * 1.4) {
  const i0 = Math.floor(t * RATE);
  const w = W(i0);
  if (w < 0.5 || rand() < 0.35) continue;
  const f0 = 2600 + rand() * 1800;
  const len = 0.05 + rand() * 0.09;
  const pan = rand();
  let ph = 0;
  for (let j = 0; j < len * RATE; j++) {
    const u = j / (len * RATE);
    ph += (2 * Math.PI * f0 * (1 + 0.25 * Math.sin(u * Math.PI * (2 + (i0 % 3))))) / RATE;
    const v = Math.sin(ph) * Math.sin(Math.PI * u) * 0.006 * w;
    add(i0 + j, v * (1 - pan), v * pan);
  }
}
// a soft clock tick at night in the bedroom
for (let t = SCENES.ret.from / FPS; t < s(55.5) / FPS; t += 1) {
  const f = Math.floor(t * FPS);
  if (figureAt(f).room !== 'bedroom') continue;
  const i0 = Math.floor(t * RATE);
  for (let j = 0; j < RATE * 0.02; j++) {
    const env = Math.exp(-j / (RATE * 0.003));
    add(i0 + j, (rand() * 2 - 1) * env * 0.02 + Math.sin((2 * Math.PI * 3200 * j) / RATE) * env * 0.01);
  }
}

// --- footsteps from the actual walk cycle ----------------------------------------------------------
const HALF_STEP = 0.9666 / 2; // the walk clip has two steps per cycle
let lastStep = -1;
for (let f = 0; f < DURATION_IN_FRAMES; f++) {
  const m = figureAt(f).main!;
  if (m.walk < 0.4) continue;
  const step = Math.floor(m.walkTime / HALF_STEP);
  if (step !== lastStep && lastStep !== -1) {
    const i0 = Math.floor((f / FPS) * RATE);
    const hard = figureAt(f).room === 'hotel' ? 1 : 0.7; // stone vs wood
    let lp = 0;
    for (let j = 0; j < RATE * 0.09; j++) {
      lp += (hard > 0.8 ? 0.25 : 0.12) * (rand() * 2 - 1 - lp);
      const env = Math.exp(-j / (RATE * 0.018));
      const thump = Math.sin((2 * Math.PI * 85 * j) / RATE) * Math.exp(-j / (RATE * 0.03));
      add(i0 + j, (lp * 0.35 + thump * 0.05) * env * 0.9);
    }
  }
  lastStep = step;
}

// --- story cues ------------------------------------------------------------------------------------
const tone = (at: number, freq: number, len: number, gain: number) => {
  const i0 = Math.floor(at * RATE);
  for (let j = 0; j < len * RATE; j++) {
    const env = Math.min(1, j / 200) * Math.exp(-j / (len * RATE * 0.35));
    add(i0 + j, Math.sin((2 * Math.PI * freq * j) / RATE) * env * gain);
  }
};
// the phone lights up: a soft two-note notification
tone(25.9, 1318.5, 0.35, 0.03);
tone(26.05, 1760, 0.45, 0.025);
// the phone is set down on the desk
tone(52.85, 220, 0.08, 0.05);
// curtains drawn: a long airy swish
{
  const i0 = Math.floor(56.6 * RATE);
  let lp = 0;
  for (let j = 0; j < RATE * 1.0; j++) {
    lp += 0.2 * (rand() * 2 - 1 - lp);
    add(i0 + j, lp * Math.sin((Math.PI * j) / (RATE * 1.0)) * 0.08);
  }
}
// swells into the big cuts
for (const f of [SCENES.ret.from, SCENES.science.from, SCENES.experiment.from, SCENES.payoff.from]) {
  const c = Math.floor((f / FPS) * RATE);
  let lp = 0;
  for (let i = c - RATE; i < c + RATE * 1.4; i++) {
    const t = (i - c) / RATE;
    const env = t < 0 ? Math.exp(-((t * 2.4) ** 2)) : Math.exp(-t * 2.4);
    lp += 0.04 * (rand() * 2 - 1 - lp);
    add(i, (Math.sin(2 * Math.PI * 55 * t) * 0.05 + lp * 0.22) * env);
  }
}

// --- master -----------------------------------------------------------------------------------------
const out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0);
out.writeUInt32LE(36 + N * 4, 4);
out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(RATE, 24);
out.writeUInt32LE(RATE * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write('data', 36);
out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  const t = i / RATE;
  const fd = Math.min(1, t / 1.0, (N / RATE - t) / 1.5);
  out.writeInt16LE(Math.round(Math.tanh(L[i] * 1.3) * fd * 0.92 * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.tanh(R[i] * 1.3) * fd * 0.92 * 32767), 46 + i * 4);
}
writeFileSync('public/ambient.wav', out);
console.log('wrote public/ambient.wav');
