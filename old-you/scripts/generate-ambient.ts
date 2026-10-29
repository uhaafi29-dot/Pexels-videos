// Original, restrained sound design for the reel (public/ambient.wav),
// generated from the same story beats as the picture:
//  - a slow pad: warm in the vacation light, cooler at home, warming again
//    as the new window opens and the new routine begins
//  - a soft shimmer when the waiting outline appears
//  - a quiet phone notification when the cue lights up
//  - a fine, falling sparkle as the old outlines fall apart
//  - two gentle chime notes as the window opens
//  - a light tap as the phone is set down outside the bedroom
// Run: npm run audio
import {writeFileSync} from 'node:fs';
import {A} from '../src/anchors';
import {DURATION_S, lineEnd} from '../src/timeline';

const RATE = 48000;
const N = Math.ceil(DURATION_S * RATE);
const L = new Float32Array(N);
const R = new Float32Array(N);
let seed = 4321;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const add = (i: number, l: number, r = l) => {
  if (i >= 0 && i < N) {
    L[i] += l;
    R[i] += r;
  }
};

// warmth over time: 1 = warm/major, 0 = cool/minor
const knots: [number, number][] = [
  [0, 1],
  [5.5, 1],
  [8.5, 0.15],
  [A.newCues - 0.5, 0.1],
  [A.newCues + 1.5, 0.75],
  [A.action + 0.5, 0.4],
  [A.choose, 0.45],
  [A.choose + 2, 0.95],
  [DURATION_S, 1],
];
const warmth = (t: number) => {
  let i = 0;
  while (i < knots.length - 2 && t > knots[i + 1][0]) i++;
  const [t0, w0] = knots[i];
  const [t1, w1] = knots[i + 1];
  const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
  return w0 + (w1 - w0) * (u * u * (3 - 2 * u));
};

// pad
const warm = [146.83, 220.0, 293.66, 369.99, 440.0]; // D major add9 colour
const cool = [146.83, 220.0, 293.66, 349.23, 440.0]; // D minor colour
for (let k = 0; k < warm.length; k++) {
  for (const det of [-0.18, 0.2]) {
    let pw = rand() * 6.28;
    let pc = rand() * 6.28;
    const pan = 0.5 + det * 1.5;
    for (let i = 0; i < N; i++) {
      const t = i / RATE;
      const w = warmth(t);
      pw += (2 * Math.PI * (warm[k] + det)) / RATE;
      pc += (2 * Math.PI * (cool[k] + det)) / RATE;
      const lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * (0.05 + k * 0.012) * t + k);
      const v = (Math.sin(pw) * w + Math.sin(pc) * (1 - w)) * (0.022 / (1 + k * 0.45)) * lfo;
      add(i, v * (1 - pan) * 2, v * pan * 2);
    }
  }
}
// air
{
  let a = 0;
  let b = 0;
  for (let i = 0; i < N; i++) {
    a += 0.025 * (rand() * 2 - 1 - a);
    b += 0.025 * (rand() * 2 - 1 - b);
    add(i, a * 0.045, b * 0.045);
  }
}

const tone = (at: number, freq: number, len: number, gain: number, pan = 0.5) => {
  const i0 = Math.floor(at * RATE);
  for (let j = 0; j < len * RATE; j++) {
    const env = Math.min(1, j / 400) * Math.exp(-j / (len * RATE * 0.3));
    const v = (Math.sin((2 * Math.PI * freq * j) / RATE) + 0.25 * Math.sin((4 * Math.PI * freq * j) / RATE)) * env * gain;
    add(i0 + j, v * (1 - pan) * 2, v * pan * 2);
  }
};
const shimmer = (at: number, len: number, gain: number) => {
  const i0 = Math.floor(at * RATE);
  let hp = 0;
  let prev = 0;
  for (let j = 0; j < len * RATE; j++) {
    const u = j / (len * RATE);
    const env = Math.sin(Math.PI * u) ** 2;
    const n = rand() * 2 - 1;
    hp = 0.97 * (hp + n - prev);
    prev = n;
    add(i0 + j, hp * env * gain, hp * env * gain * 0.8);
  }
};

// the waiting outline appears
shimmer(A.reveal - 0.1, 1.6, 0.025);
tone(A.reveal + 0.2, 587.33, 2.2, 0.012, 0.6);
tone(A.reveal + 0.5, 880.0, 2.0, 0.008, 0.4);
// the phone lights up (scrolling at night; then the cue)
for (const at of [A.night + 0.8, A.permission + 0.05]) {
  tone(at, 1318.5, 0.3, 0.016, 0.55);
  tone(at + 0.13, 1760.0, 0.4, 0.013, 0.55);
}
// the old outlines fall apart: a fine falling sparkle
for (let n = 0; n < 26; n++) {
  const at = A.fellApart + n * 0.045 + rand() * 0.03;
  tone(at, 2400 - n * 45 + rand() * 120, 0.12, 0.006 * (1 - n / 30), rand());
}
// the window opens
tone(A.newCues + 0.1, 659.25, 2.4, 0.018, 0.45);
tone(A.newCues + 0.45, 987.77, 2.2, 0.012, 0.55);
// the phone is set down outside the bedroom
{
  const i0 = Math.floor((A.charge + 1.25) * RATE);
  for (let j = 0; j < RATE * 0.06; j++) add(i0 + j, Math.sin((2 * Math.PI * 190 * j) / RATE) * Math.exp(-j / (RATE * 0.012)) * 0.05);
}
// the new outline begins
tone(A.choose + 0.9, 739.99, 2.6, 0.012, 0.5);
tone(lineEnd('cta') - 0.2, 587.33, 2.4, 0.01, 0.5);

// master
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
  const fd = Math.min(1, t / 0.8, (DURATION_S - t) / 1.4);
  out.writeInt16LE(Math.round(Math.tanh(L[i] * 1.3) * Math.max(0, fd) * 0.92 * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.tanh(R[i] * 1.3) * Math.max(0, fd) * 0.92 * 32767), 46 + i * 4);
}
writeFileSync('public/ambient.wav', out);
console.log('wrote public/ambient.wav');
