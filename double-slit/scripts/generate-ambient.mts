// Generates the original sound design (public/ambient.wav), synced to the
// timeline: a slow evolving pad, airy noise, swells under camera moves, a
// soft tick for every detected electron (thinning into a fine crackle as the
// hits pile up) and blips from the which-path detector.
// Run: npm run audio
import {writeFileSync} from 'node:fs';
import {DURATION_IN_FRAMES, FPS, RUN_B, SCENES, TOTAL_A, TOTAL_B, birthFrames, countA, countB, s} from '../src/timeline.ts';

const RATE = 48000;
const N = Math.ceil((DURATION_IN_FRAMES / FPS) * RATE);
const L = new Float32Array(N);
const R = new Float32Array(N);

let seed = 4242;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

// --- pad: D minor add9, detuned pairs, slow breathing -------------------------------
const pad = [73.42, 110, 146.83, 174.61, 220, 329.63];
for (const [k, f] of pad.entries()) {
  const amp = 0.045 / (1 + k * 0.35);
  for (const detune of [-0.15, 0.19]) {
    const ph = rand() * Math.PI * 2;
    const pan = 0.5 + detune * 1.8;
    for (let i = 0; i < N; i++) {
      const t = i / RATE;
      const lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * (0.045 + k * 0.011) * t + k);
      const sm = Math.sin(2 * Math.PI * (f + detune) * t + ph) * amp * lfo;
      L[i] += sm * (1 - pan);
      R[i] += sm * pan;
    }
  }
}

// --- air -------------------------------------------------------------------------------
{
  let l = 0;
  let r = 0;
  for (let i = 0; i < N; i++) {
    const a = 0.018 + 0.008 * Math.sin((2 * Math.PI * 0.06 * i) / RATE);
    l += 0.02 * (rand() * 2 - 1 - l);
    r += 0.02 * (rand() * 2 - 1 - r);
    L[i] += l * a * 4;
    R[i] += r * a * 4;
  }
}

// --- swells under the big camera moves -------------------------------------------------------
for (const frame of [SCENES.dots.from, s(15.8), SCENES.measure.from, SCENES.compare.from]) {
  const c = Math.floor((frame / FPS) * RATE);
  let lp = 0;
  for (let i = Math.max(0, c - RATE); i < Math.min(N, c + RATE * 1.6); i++) {
    const t = (i - c) / RATE;
    const env = t < 0 ? Math.exp(-((t * 2.6) ** 2)) : Math.exp(-t * 2.0);
    lp += 0.04 * (rand() * 2 - 1 - lp);
    const sm = (Math.sin(2 * Math.PI * (45 + 12 * env) * t) * 0.07 + lp * 0.3) * env;
    L[i] += sm;
    R[i] += sm;
  }
}

// --- electron arrivals ------------------------------------------------------------------------
// Each hit is a tiny, bright tick; when many arrive per second their level is
// scaled down so the build-up becomes a soft crackle rather than noise.
const tick = (at: number, gain: number, pitch: number, pan: number) => {
  const c = Math.floor(at * RATE);
  const len = Math.floor(RATE * 0.05);
  for (let i = 0; i < len && c + i < N; i++) {
    const t = i / RATE;
    const env = Math.min(1, t * 3000) * Math.exp(-t * 90);
    const sm = (Math.sin(2 * Math.PI * pitch * t) * 0.7 + (rand() * 2 - 1) * 0.3) * env * gain;
    L[c + i] += sm * (1 - pan);
    R[c + i] += sm * pan;
  }
};
const arrivals = (births: Float32Array, count: (f: number) => number, gain: number) => {
  for (let i = 0; i < births.length; i++) {
    const f = births[i];
    if (f > DURATION_IN_FRAMES) break;
    const rate = Math.max(1, (count(Math.floor(f) + FPS / 2) - count(Math.floor(f) - FPS / 2)) / 1); // hits per second
    const g = gain / Math.sqrt(rate);
    if (g < 0.0015) continue;
    tick(f / FPS, g, 1900 + rand() * 900, 0.3 + rand() * 0.4);
  }
};
arrivals(birthFrames(countA, TOTAL_A), countA, 0.09);
arrivals(birthFrames(countB, TOTAL_B), countB, 0.07);

// --- which-path detector blips (run B), lower and rounder ----------------------------------------
for (let f = RUN_B.from; f < RUN_B.to; f += 2) {
  const t = f / FPS;
  const c = Math.floor(t * RATE);
  const pitch = rand() < 0.5 ? 660 : 784;
  for (let i = 0; i < RATE * 0.06 && c + i < N; i++) {
    const tt = i / RATE;
    const env = Math.min(1, tt * 600) * Math.exp(-tt * 60);
    const sm = Math.sin(2 * Math.PI * pitch * tt) * env * 0.012;
    L[c + i] += sm;
    R[c + i] += sm;
  }
}

// --- master ---------------------------------------------------------------------------------------
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
  const fade = Math.min(1, t / 1.5, (N / RATE - t) / 1.5);
  out.writeInt16LE(Math.round(Math.tanh(L[i] * 1.4) * fade * 0.9 * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.tanh(R[i] * 1.4) * fade * 0.9 * 32767), 46 + i * 4);
}
writeFileSync(new URL('../public/ambient.wav', import.meta.url), out);
console.log('wrote public/ambient.wav');
